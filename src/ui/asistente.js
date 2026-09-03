/* ============================================================
   UI / ASISTENTE — el panelito de la esquina.

   Responde sobre ESTE casino y sobre TU cuenta: cuánto tenés,
   qué misiones te faltan, cuánto paga cada juego, dónde queda
   cada pantalla, cómo funciona cada mecánica.

   ---------------------------------------------------------------
   POR QUÉ NO LLAMA A UN MODELO DE IA
   ---------------------------------------------------------------
   Para usar un modelo real haría falta una clave de API, y este
   sitio es estático y público: cualquiera la sacaría del navegador
   en diez segundos y la gastaría a tu nombre. Hace falta un
   servidor intermediario, y eso es otra conversación.

   Mientras tanto, esto: en vez de inventar respuestas, LEE el
   estado real del casino. Cuando te dice cuánto te falta para el
   próximo rango, el número sale de MCLevels, no de una tabla
   escrita a mano que quedaría vieja al primer cambio.

   El día que haya backend, `responder()` es el único lugar a
   tocar: se le pasa la pregunta al modelo y se devuelve su texto.

   Depende de: state, wallet, levels, missions, catalog, format.
   ============================================================ */
window.MCAsistente = (function () {
  'use strict';

  var abierto = false;
  var historial = [];   // { de: 'vos'|'bubba', texto }

  /* ============================================================
     INTENCIONES
     Cada una: palabras que la disparan y una función que arma la
     respuesta leyendo el estado de verdad.
     ============================================================ */
  var INTENCIONES = [
    {
      claves: ['saldo', 'fichas tengo', 'cuanto tengo', 'cuánto tengo', 'plata', 'dinero'],
      responde: function () {
        var s = MC.getBalance();
        var t = MCLevels.current();
        var txt = 'Tenés <strong>' + MC.fmt(s) + ' fichas</strong> y sos ' + t.ico + ' ' + t.name + '.';
        if (s < 500) {
          txt += ' Vas justo: pasá por el <a data-ir="cajero">Cajero</a>, ' +
                 'el bono es gratis y se recarga cada 8 horas.';
        }
        return txt;
      }
    },
    {
      claves: ['bono', 'recarga', 'gratis', 'mas fichas', 'más fichas', 'conseguir fichas', 'cajero'],
      responde: function () {
        var listo = MC.bonusReadyIn() === 0;
        var monto = Math.round(MC.BONUS_AMOUNT * MCLevels.bonusMultiplier());
        return listo
          ? 'Tenés <strong>' + MC.fmt(monto) + ' fichas</strong> esperándote en el ' +
            '<a data-ir="cajero">Cajero</a>. Es gratis.'
          : 'Tu próxima recarga de ' + MC.fmt(monto) + ' fichas llega en <strong>' +
            MC.humanTime(MC.bonusReadyIn()) + '</strong>. Mientras tanto podés sumar ' +
            'haciendo <a data-ir="misiones">misiones</a>.';
      }
    },
    {
      claves: ['mision', 'misión', 'misiones', 'objetivo', 'objetivos', 'diaria'],
      responde: function () {
        var items = (window.MCMissions && MCMissions.items()) || [];
        var faltan = items.filter(function (m) { return !m.claimed; });
        if (!items.length) return 'Todavía no se cargaron las misiones del día. Entrá a <a data-ir="misiones">Misiones</a>.';
        if (!faltan.length) return '¡Las hiciste todas! Mañana a medianoche salen tres nuevas.';
        return 'Te quedan <strong>' + faltan.length + ' de ' + items.length + '</strong>:<br>' +
          faltan.map(function (m) {
            // El texto de cada misión lo arma el propio módulo (describe),
            // así no hay dos redacciones distintas de lo mismo.
            var mostrado = m.key === 'bigmult' ? m.progress.toFixed(2) : MC.fmt(m.progress);
            var meta = m.key === 'bigmult' ? m.goal.toFixed(2) : MC.fmt(m.goal);
            return '· ' + MCMissions.describe(m) + ' <em>(' + mostrado + '/' + meta + ')</em>';
          }).join('<br>') +
          '<br><a data-ir="misiones">Ver misiones</a>';
      }
    },
    {
      claves: ['rango', 'vip', 'nivel', 'xp', 'subir'],
      responde: function () {
        var t = MCLevels.current();
        var sig = MCLevels.next();
        if (!sig) return 'Sos ' + t.ico + ' <strong>' + t.name + '</strong>, el rango más alto. No hay nada por encima.';
        return 'Sos ' + t.ico + ' <strong>' + t.name + '</strong> y te faltan <strong>' +
          MC.fmt(sig.min - (MC.state.xp || 0)) + ' XP</strong> para ' + sig.name + '.<br>' +
          'La XP sube con lo que <em>apostás</em>, no con lo que ganás, así que ' +
          'no depende de la suerte. Cada rango agranda el bono del cajero. ' +
          '<a data-ir="vip">Ver el Club VIP</a>';
      }
    },
    {
      claves: ['rtp', 'paga', 'devuelve', 'ventaja', 'probabilidad', 'chances'],
      responde: function () {
        var mejor = MCCatalog.all.slice().sort(function (a, b) {
          return (b.rtpValue || 0) - (a.rtpValue || 0);
        })[0];
        return 'El RTP es cuánto devuelve un juego a la larga: 96% quiere decir que ' +
          'de cada 100 fichas apostadas vuelven 96 en promedio, y las otras 4 son la ' +
          'ventaja de la casa.<br>' +
          'Acá <strong>ningún RTP es de adorno</strong>: están calculados sobre la tabla ' +
          'de pagos real de cada juego.<br>' +
          'El que más devuelve ahora es <strong>' + mejor.name + '</strong> (' + mejor.rtp + ').';
      }
    },
    {
      claves: ['maverick', 'escalinata', 'piramide', 'pirámide'],
      responde: function () {
        return '<strong>Maverick</strong> es una tragamonedas de 5×3 con 20 líneas, RTP 96,7%.<br>' +
          'Su feature es <em>La Escalinata</em>: con 3 templos escalás una pirámide y el ' +
          'nivel que alcanzás define el paquete de giros gratis, de 8 giros ×4 hasta ' +
          '20 giros ×10. También podés comprar la entrada directa por 80× tu apuesta.';
      }
    },
    {
      claves: ['se busca', 'sebusca', 'pegajoso', 'wild', 'multiplicador'],
      responde: function () {
        return '<strong>Se Busca</strong> es 5×5 con 15 líneas, RTP 96,4%, y es el más ' +
          'volátil del salón.<br>' +
          'En los giros gratis cada wild que cae <em>queda fijo</em> con un multiplicador ' +
          '(×2 a ×50), y los de una misma línea <strong>se multiplican entre sí</strong>: ' +
          'un ×10 y un ×25 juntos son ×250. El tope es 10.000× la apuesta.<br>' +
          'Aviso: vas a pasar rachas secas largas. Está hecho así a propósito.';
      }
    },
    {
      claves: ['volatil', 'volátil', 'varianza', 'racha'],
      responde: function () {
        return 'La volatilidad es cuánto se mueve el resultado, no cuánto paga.<br>' +
          '<strong>Baja</strong>: ganás seguido y poco. <strong>Alta</strong>: rachas ' +
          'secas largas y premios grandes cuando entran.<br>' +
          'Dos juegos con el mismo RTP pueden sentirse completamente distintos. ' +
          'Se Busca y Maverick tienen casi el mismo RTP y no se parecen en nada.';
      }
    },
    {
      claves: ['cuenta', 'perfil', 'login', 'google', 'entrar', 'registr'],
      responde: function () {
        var u = MC.auth.current();
        if (u.guest) {
          return 'Estás jugando como <strong>invitado</strong>. Si creás tu perfil ' +
            '<strong>conservás las fichas</strong> que ya ganaste. Con Google además ' +
            'tu saldo te sigue entre la compu y el celular.';
        }
        return 'Estás como <strong>' + u.name + '</strong>' +
          (u.provider === 'google' ? ' con tu cuenta de Google' : ' con un perfil local') +
          '. ' + (MC.auth.estadoNube() === 'ok'
            ? 'Tu progreso se guarda en la nube, así que te sigue entre dispositivos.'
            : 'Tu progreso está sólo en este navegador.');
      }
    },
    {
      claves: ['agente', 'jugadores', 'cargar fichas', 'panel'],
      responde: function () {
        return 'El <a data-ir="agente">Panel de agente</a> muestra todos los perfiles ' +
          'de este dispositivo: cuánto tiene cada uno, cuánto apostó y su rango. ' +
          'Desde ahí les cargás o descontás fichas.<br>' +
          'Es la mecánica de un panel de agente de verdad, sin la parte de la plata: ' +
          'acá se mueve un número guardado en tu navegador.';
      }
    },
    {
      claves: ['ajuste', 'configur', 'sonido', 'limite', 'límite', 'animacion'],
      responde: function () {
        return 'En <a data-ir="ajustes">Ajustes</a> tenés sonido, animaciones, ' +
          'y los controles de juego responsable: límite de apuesta por ronda y ' +
          'recordatorio del tiempo jugado.<br>' +
          'También podés <strong>descargar tu progreso</strong> como archivo, para ' +
          'respaldarlo o pasarlo a otro navegador.';
      }
    },
    {
      claves: ['deporte', 'futbol', 'fútbol', 'liga', 'apuesta deportiva', 'cuota'],
      responde: function () {
        return '<strong>Liga Bubba</strong> son 16 equipos inventados. Las cuotas salen ' +
          'de un modelo de Poisson sobre la fuerza de cada equipo, y <em>el partido ' +
          'después se simula con ese mismo modelo</em>.<br>' +
          'Por eso el retorno del 95,2% es real y no un cartel: la cuota y el resultado ' +
          'vienen del mismo lugar. <a data-ir="sports">Ir a la mesa</a>';
      }
    },
    {
      claves: ['dinero real', 'plata real', 'retirar', 'depositar', 'cobrar', 'tarjeta'],
      responde: function () {
        return 'No, y no es un detalle: <strong>acá no hay dinero real en ningún lado</strong>.<br>' +
          'Las fichas son virtuales, se consiguen gratis y no valen nada. No se puede ' +
          'depositar ni retirar, y nunca te vamos a pedir datos de una tarjeta ni de ' +
          'una cuenta bancaria.';
      }
    },
    {
      claves: ['truco', 'ganar siempre', 'sistema', 'martingala', 'estrategia'],
      responde: function () {
        return 'No hay truco, y desconfiá de quien te diga que sí.<br>' +
          'Cada giro es independiente: los rodillos no se acuerdan del anterior ni ' +
          '"están por pagar". La martingala (doblar cuando perdés) tampoco funciona: ' +
          'lo único que hace es cambiar muchas pérdidas chicas por una enorme.<br>' +
          'La ventaja de la casa está en el RTP y no se puede jugar en contra.';
      }
    },
    {
      claves: ['hola', 'buenas', 'ayuda', 'que haces', 'qué hacés', 'quien sos', 'quién sos'],
      responde: function () {
        return '¡Hola! Sé de este casino y de tu cuenta. Preguntame por tu saldo, ' +
          'las misiones del día, cómo funciona algún juego, qué es el RTP, o dónde ' +
          'queda algo. Si querés te tiro una <strong>recomendación</strong>.';
      }
    },
    {
      claves: ['recomend', 'que juego', 'qué juego', 'a que juego', 'a qué juego', 'sugerencia'],
      responde: function () {
        var s = MC.getBalance();
        if (s < 300) {
          return 'Con ' + MC.fmt(s) + ' fichas yo primero pasaría por el ' +
            '<a data-ir="cajero">Cajero</a> a buscar el bono. Después, con saldo, ' +
            'jugá tranquilo.';
        }
        var suave = MCCatalog.all.filter(function (g) {
          return g.volatility === 'Media' || g.volatility === 'Baja';
        })[0];
        var bravo = MCCatalog.all.filter(function (g) {
          return g.volatility === 'Extrema' || g.volatility === 'Alta';
        })[0];
        var txt = 'Depende de qué tengas ganas:<br>';
        if (suave) txt += '· Para que dure: <strong>' + suave.name + '</strong> (' + suave.rtp + ')<br>';
        if (bravo) txt += '· Para buscar el golpe: <strong>' + bravo.name + '</strong>, ' +
          'volatilidad ' + bravo.volatility.toLowerCase() + '<br>';
        txt += 'Con ' + MC.fmt(s) + ' fichas, apostando el 1% por ronda te alcanza ' +
          'para unas ' + MC.fmt(Math.floor(s / Math.max(1, Math.round(s * 0.01)))) + ' jugadas.';
        return txt;
      }
    }
  ];

  var SUGERENCIAS = [
    '¿Cuánto tengo?',
    '¿Qué misiones me faltan?',
    '¿A qué juego me conviene?',
    '¿Qué es el RTP?',
    '¿Cómo funciona Se Busca?'
  ];

  /* ============================================================
     El único lugar a tocar el día que haya un modelo de verdad.
     ============================================================ */
  function responder(pregunta) {
    var q = pregunta.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');   // sin tildes

    var mejor = null;
    var mejorPuntaje = 0;
    INTENCIONES.forEach(function (i) {
      i.claves.forEach(function (c) {
        var clave = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
        // Gana la coincidencia más larga: "se busca" le tiene que ganar a "busca".
        if (q.indexOf(clave) !== -1 && clave.length > mejorPuntaje) {
          mejorPuntaje = clave.length;
          mejor = i;
        }
      });
    });

    if (mejor) return mejor.responde();

    return 'De eso no sé todavía. Puedo ayudarte con tu saldo, las misiones, ' +
      'los rangos, cómo funciona cada juego, el RTP o dónde queda cada pantalla.<br>' +
      'Probá con algo de esto: <em>' + SUGERENCIAS.slice(0, 3).join(' · ') + '</em>';
  }

  /* ---------------- interfaz ---------------- */
  function agregar(de, texto) {
    historial.push({ de: de, texto: texto });
    if (historial.length > 40) historial.shift();
    pintarMensajes();
  }

  function pintarMensajes() {
    var cont = document.getElementById('asMsgs');
    if (!cont) return;
    cont.innerHTML = historial.map(function (m) {
      return '<div class="as-msg as-' + m.de + '">' + m.texto + '</div>';
    }).join('');
    cont.scrollTop = cont.scrollHeight;
  }

  function preguntar(texto) {
    texto = (texto || '').trim();
    if (!texto) return;
    agregar('vos', texto);

    // Una pausa corta: una respuesta instantánea se lee como un cartel,
    // no como una conversación.
    var pensando = { de: 'bubba', texto: '<span class="as-dots"><i></i><i></i><i></i></span>' };
    historial.push(pensando);
    pintarMensajes();

    setTimeout(function () {
      historial.splice(historial.indexOf(pensando), 1);
      agregar('bubba', responder(texto));
    }, 380);
  }

  function abrir() {
    abierto = true;
    document.getElementById('asistente').classList.add('open');
    document.getElementById('asFab').classList.add('oculto');
    if (!historial.length) {
      agregar('bubba', '¡Hola' + (MC.auth.current().guest ? '' : ', ' + MC.auth.current().name) +
        '! Soy el asistente de Bubba. Sé de este casino y de tu cuenta — preguntame lo que quieras.');
    }
    var i = document.getElementById('asInput');
    if (i) i.focus();
  }

  function cerrar() {
    abierto = false;
    document.getElementById('asistente').classList.remove('open');
    document.getElementById('asFab').classList.remove('oculto');
  }

  function init() {
    var fab = document.getElementById('asFab');
    var cerrarBtn = document.getElementById('asClose');
    var form = document.getElementById('asForm');
    var input = document.getElementById('asInput');
    var sug = document.getElementById('asSug');
    if (!fab || !form) return;

    fab.onclick = function () { MC.sound.click(); abrir(); };
    cerrarBtn.onclick = function () { MC.sound.click(); cerrar(); };

    form.onsubmit = function (e) {
      e.preventDefault();
      preguntar(input.value);
      input.value = '';
    };

    sug.innerHTML = SUGERENCIAS.map(function (s) {
      return '<button class="as-chip">' + s + '</button>';
    }).join('');
    sug.onclick = function (e) {
      var b = e.target.closest('.as-chip');
      if (b) preguntar(b.textContent);
    };

    // Los enlaces de las respuestas navegan por el casino.
    document.getElementById('asMsgs').onclick = function (e) {
      var a = e.target.closest('[data-ir]');
      if (!a) return;
      var destino = a.dataset.ir;
      if (destino === 'misiones') MCMissionsView.open();
      else if (destino === 'vip') MCVip.open();
      else if (destino === 'agente') MCAgente.open();
      else if (destino === 'ajustes') MCAjustes.open();
      else MC.showView(destino);
      if (window.innerWidth < 900) cerrar();
    };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && abierto) cerrar();
    });
  }

  return { init: init, abrir: abrir, cerrar: cerrar, preguntar: preguntar };
})();
