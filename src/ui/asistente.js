/* ============================================================
   UI / ASISTENTE — el panelito de la esquina.

   Responde sobre ESTE casino y sobre TU cuenta: cuánto tenés,
   qué misiones te faltan, cómo se juega y cuánto paga cada juego,
   cómo va el bote, dónde queda cada pantalla.

   Este archivo es el MOTOR (entender la pregunta) y la INTERFAZ.
   Lo que sabe —las respuestas y las reglas de cada juego— está en
   asistente-saber.js.

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
   tocar: lo que no entienda el motor se le pasa al modelo.

   ---------------------------------------------------------------
   CÓMO ENTIENDE
   ---------------------------------------------------------------
   1. Normaliza: minúsculas, sin tildes ni signos, y traduce las
      abreviaturas de chat ("q", "xq", "pal").
   2. Cada palabra se compara contra las claves de cada intención
      tolerando errores de tipeo ("maverik", "misones") y plurales.
      Las palabras de relleno ("que", "el", "de") suman poco, así
      "qué es el RTP" va al RTP y no a "qué es…".
   3. Si la pregunta nombra un juego, la intención sólo elige QUÉ
      parte de la ficha del juego mostrar (reglas, pagos, consejo).
   4. Contexto: "¿y cuánto paga?" sin nombrar nada se aplica al
      último juego del que se habló.

   Depende de: MCAsistenteSaber, state, wallet, catalog, format.
   ============================================================ */
window.MCAsistente = (function () {
  'use strict';

  var S = window.MCAsistenteSaber;

  var abierto = false;
  var historial = [];   // { de: 'vos'|'bubba', texto }

  /* Lo último de lo que se habló, para las preguntas de seguimiento. */
  var ctx = { juego: null, ultimo: null };

  /* ============================================================
     NORMALIZAR
     ============================================================ */
  var ABREVIATURAS = {
    q: 'que', k: 'que', ke: 'que', xq: 'porque', pq: 'porque', porq: 'porque',
    pal: 'para el', pa: 'para', tmb: 'tambien', tb: 'tambien', x: 'por',
    guita: 'plata', mangos: 'plata', luca: 'plata', lucas: 'plata',
    cuant: 'cuanto', cuantas: 'cuantas', toy: 'estoy', ta: 'esta',
    ns: 'no se', nose: 'no se', komo: 'como', kuanto: 'cuanto'
  };

  /* Palabras de relleno: cuentan para que una frase coincida entera,
     pero casi no suman puntaje. */
  var RELLENO = ['que', 'es', 'el', 'la', 'lo', 'los', 'la', 'de', 'del', 'un', 'una', 'me', 'mi',
    'a', 'al', 'en', 'y', 'o', 'se', 'como', 'cuanto', 'cual', 'hay', 'para', 'con', 'por', 'le',
    'te', 'tu', 'yo', 'mas', 'sin', 'no'];

  function sinTildes(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function normalizar(q) {
    return sinTildes(String(q || '').toLowerCase())
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .map(function (w) { return ABREVIATURAS[w] || w; })
      .join(' ');
  }

  /* Raíz mínima: le saca el plural. Se aplica igual a la pregunta y a
     las claves, así "misiones" y "mision" quedan en lo mismo. */
  function raiz(w) {
    if (w.length > 4 && /[^aeiou]es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function tokens(normalizada) {
    return normalizada ? normalizada.split(' ').map(raiz) : [];
  }

  /* ============================================================
     COMPARAR
     ============================================================ */
  function distancia(a, b, tope) {
    if (Math.abs(a.length - b.length) > tope) return tope + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var menor = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < menor) menor = cur[j];
      }
      if (menor > tope) return tope + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /** Cuánto se parece una palabra de la pregunta a una de la clave (0 a 1). */
  function parecido(tq, tc, prefijo) {
    if (tq === tc) return 1;
    if (prefijo && tq.indexOf(tc) === 0) return 1;
    // Errores de tipeo sólo en palabras largas: en las cortas, una letra
    // de diferencia ya es otra palabra ("mas"/"mes", "bono"/"bote").
    if (tc.length < 5 || /\d/.test(tc)) return 0;
    // Y la primera letra tiene que coincidir: casi nadie le erra a esa, y
    // sin esto "mision" queda a dos letras de "comision".
    if (tq.charAt(0) !== tc.charAt(0)) return 0;
    var tope = tc.length >= 8 ? 2 : 1;
    var base = prefijo ? tq.slice(0, tc.length) : tq;
    return distancia(base, tc, tope) <= tope ? 0.8 : 0;
  }

  function peso(t) { return RELLENO.indexOf(t) >= 0 ? 0.6 : t.length; }

  /** Compila una clave de texto a algo comparable. */
  function compilar(clave) {
    var prefijo = /\*$/.test(clave);
    var t = tokens(normalizar(clave.replace(/\*$/, '')));
    return { t: t, prefijo: prefijo };
  }

  /* Puntaje de una clave contra la pregunta. Las claves de varias
     palabras tienen que aparecer seguidas y en orden. */
  function puntajeClave(qt, c) {
    var mejor = 0;
    for (var i = 0; i + c.t.length <= qt.length; i++) {
      var suma = 0;
      for (var j = 0; j < c.t.length; j++) {
        var ultima = j === c.t.length - 1;
        var p = parecido(qt[i + j], c.t[j], c.prefijo && ultima);
        if (!p) { suma = 0; break; }
        suma += p * peso(c.t[j]);
      }
      // Una frase de varias palabras le gana a una sola de largo parecido.
      if (suma) suma += (c.t.length - 1);
      if (suma > mejor) mejor = suma;
    }
    return mejor;
  }

  /* Puntaje de una lista de claves: la mejor manda, y cada otra que
     también coincida suma un poquito para desempatar. */
  function puntajeLista(qt, compiladas) {
    var mejor = 0, extra = 0;
    compiladas.forEach(function (c) {
      var p = puntajeClave(qt, c);
      if (p > mejor) { if (mejor) extra += 0.25; mejor = p; }
      else if (p) extra += 0.25;
    });
    return mejor ? mejor + extra : 0;
  }

  /* ---------------- tablas compiladas, una sola vez ---------------- */
  var INTENCIONES = S.INTENCIONES.map(function (i) {
    return { def: i, claves: i.claves.map(compilar) };
  });

  var LUGARES = S.LUGARES.map(function (l) {
    return { def: l, claves: l.claves.map(compilar) };
  });

  var JUEGOS = null;   // se arma al primer uso: el catálogo puede cargar después
  function juegos() {
    if (JUEGOS) return JUEGOS;
    JUEGOS = ((window.MCCatalog && MCCatalog.all) || []).map(function (g) {
      var alias = ((S.GUIAS[g.id] && S.GUIAS[g.id].alias) || []).concat([g.name]);
      return { g: g, claves: alias.map(compilar) };
    });
    return JUEGOS;
  }

  function mejorDe(lista, qt) {
    var mejor = null, puntaje = 0;
    lista.forEach(function (x) {
      var p = puntajeLista(qt, x.claves);
      if (p > puntaje) { puntaje = p; mejor = x; }
    });
    return mejor ? { x: mejor, puntaje: puntaje } : null;
  }

  /* ============================================================
     ENTENDER
     Devuelve qué hacer con la pregunta, sin responderla todavía.
     ============================================================ */
  var PIDE_IR = /(^| )(donde|llevame|lleva|abri|abrime|abrir|mostrame|ir a|quiero ir|como llego|como entro)( |$)/;
  var SEGUIMIENTO = /(^y )|(^| )(ese|este|eso|esta|esa|ahi)( |$)/;
  // Aspectos que, sin nombrar un juego, sólo se atan al anterior si la
  // pregunta lo marca ("¿y el RTP?"). "¿Qué es el RTP?" es una duda general.
  var ASPECTO_GENERAL = ['rtp', 'volatilidad'];

  function entender(texto, contexto) {
    contexto = contexto || ctx;
    var q = normalizar(texto);
    var qt = tokens(q);
    if (!qt.length) return { tipo: 'nada' };

    var juego = mejorDe(juegos(), qt);
    var lugares = LUGARES.filter(function (l) {
      return !l.def.rol || l.def.rol === (S.esAgente() ? 'agente' : 'jugador');
    });

    // Intenciones ordenadas por puntaje.
    var ranking = INTENCIONES.map(function (i) {
      return { def: i.def, puntaje: puntajeLista(qt, i.claves) };
    }).filter(function (r) { return r.puntaje > 0; })
      .sort(function (a, b) { return b.puntaje - a.puntaje; });
    var mejor = ranking[0] || null;
    var segunda = ranking[1] || null;
    var dudosa = mejor && segunda && segunda.puntaje >= mejor.puntaje * 0.8 ? segunda.def : null;

    // 1. "¿Dónde está…?" / "Llevame a…"
    if (PIDE_IR.test(q)) {
      if (juego) return { tipo: 'ir', juego: juego.x.g };
      var lugar = mejorDe(lugares, qt);
      if (lugar) return { tipo: 'ir', lugar: lugar.x.def };
    }

    // 2. Nombra un juego: la intención decide qué parte de la ficha.
    if (juego && (!mejor || mejor.def.aspecto || mejor.puntaje <= juego.puntaje)) {
      return { tipo: 'juego', juego: juego.x.g, aspecto: (mejor && mejor.def.aspecto) || 'ficha' };
    }

    // 3. Seguimiento de un juego: "¿y cuánto paga?", "¿cómo se juega?"
    if (mejor && mejor.def.aspecto && contexto.juego) {
      var marcada = SEGUIMIENTO.test(q);
      var corta = qt.length <= 5;
      if (marcada || (corta && ASPECTO_GENERAL.indexOf(mejor.def.id) < 0)) {
        return { tipo: 'juego', juego: contexto.juego, aspecto: mejor.def.aspecto };
      }
    }

    // 4. Una intención.
    if (mejor) return { tipo: 'intencion', def: mejor.def, dudosa: dudosa };

    // 5. Nada coincide, pero parece seguir la charla: "¿y cuánto falta?"
    if (contexto.ultimo && (SEGUIMIENTO.test(q) || qt.length <= 3)) {
      return contexto.ultimo;
    }

    return { tipo: 'nada' };
  }

  /* ============================================================
     RESPONDER
     El único lugar a tocar el día que haya un modelo de verdad.
     ============================================================ */
  var SUG_JUGADOR = ['¿Cuánto tengo?', '¿Cómo consigo fichas?', '¿Qué juegos hay?', '¿Cómo va el bote?', '¿Qué sabés hacer?'];
  var SUG_AGENTE = ['¿Cuánto tengo en la caja?', '¿Hay pedidos pendientes?', '¿Qué es el panel de la casa?', '¿Qué juegos hay?'];
  function sugBase() { return S.esAgente() ? SUG_AGENTE : SUG_JUGADOR; }

  function valor(v, g) { return typeof v === 'function' ? v(g) : v; }

  function fichaJuego(g, aspecto) {
    var guia = S.GUIAS[g.id] || {};
    var cab = '<strong>' + (g.emoji ? g.emoji + ' ' : '') + g.name + '</strong> · ' + g.kind +
      ' · ' + S.rtpDe(g) + (g.volatility ? ' · volatilidad ' + g.volatility.toLowerCase() : '') +
      (g.maxWin ? ' · máx. ×' + MC.fmt(g.maxWin) : '');
    var como = valor(guia.como, g) || g.desc || '';
    var paga = valor(guia.paga, g) || ('Paga hasta ×' + MC.fmt(g.maxWin) + '.');
    var consejo = valor(guia.consejo, g) ||
      'Ningún método cambia el RTP: elegí la apuesta para que tu saldo aguante las rachas.';

    var cuerpo = aspecto === 'como' ? como
      : aspecto === 'paga' ? paga
      : aspecto === 'consejo' ? consejo
      : como;

    var sug = [];
    if (aspecto !== 'como' && aspecto !== 'ficha') sug.push('¿Cómo se juega?');
    if (aspecto !== 'paga') sug.push('¿Cuánto paga?');
    if (aspecto !== 'consejo') sug.push('¿Algún consejo?');
    sug.push('¿Qué otros juegos hay?');

    return { texto: cab + '<br>' + cuerpo + '<br>' + S.jugar(g), sug: sug };
  }

  function respuestaDe(e) {
    if (e.tipo === 'juego') return fichaJuego(e.juego, e.aspecto);

    if (e.tipo === 'ir') {
      if (e.juego) return { texto: 'Acá lo tenés: ' + S.jugar(e.juego), sug: ['¿Cómo se juega?', '¿Cuánto paga?'] };
      return { texto: 'Te llevo: ' + S.link(e.lugar.ir, 'Ir ' + e.lugar.nombre + ' →') };
    }

    if (e.tipo === 'intencion') {
      var d = e.def;
      var agente = S.esAgente();
      var r;
      if (d.rol === 'jugador' && agente) {
        r = { texto: 'Eso es del lado del jugador. Como <strong>agente</strong> no apostás, así que no ' +
          'tenés bono, misiones, rango VIP, bote ni torneo: tu trabajo es la caja y tus jugadores. ' +
          S.link('agente', 'Abrir el panel'), sug: SUG_AGENTE };
      } else if (d.rol === 'agente' && !agente) {
        r = { texto: 'Eso lo maneja un perfil <strong>agente</strong>. Si lo que buscás son fichas, ' +
          'pasá por el ' + S.link('cajero', 'Cajero') + '.', sug: ['¿Cómo consigo fichas?'] };
      } else {
        r = d.responde();
        if (typeof r === 'string') r = { texto: r };
        if (!r.sug && d.sug) r.sug = d.sug;
      }
      if (e.dudosa && e.dudosa.pregunta) {
        r.sug = [e.dudosa.pregunta].concat((r.sug || []).filter(function (s) { return s !== e.dudosa.pregunta; }));
      }
      return r;
    }

    return {
      texto: 'Mmm, de eso no sé todavía. Puedo ayudarte con tu saldo, cómo conseguir fichas, ' +
        'cómo se juega y cuánto paga cada juego, el bote, el torneo, el RTP o dónde queda cada pantalla.<br>' +
        'Probá preguntarlo con otras palabras, o tocá una de estas:'
    };
  }

  function responder(pregunta) {
    var e = entender(pregunta, ctx);
    var r;
    try {
      r = respuestaDe(e);
    } catch (err) {
      if (MCAsistente.debug) throw err;
      // Un módulo que todavía no cargó no puede romper la charla.
      r = { texto: 'Uy, no pude leer ese dato ahora. Probá de nuevo en un ratito.' };
    }

    // Recordar de qué se habló, para la próxima.
    if (e.tipo === 'juego' || (e.tipo === 'ir' && e.juego)) ctx.juego = e.juego;
    if (e.tipo !== 'nada') ctx.ultimo = e;

    if (!r.sug || !r.sug.length) r.sug = sugBase();
    return r;
  }

  /* ---------------- interfaz ---------------- */
  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

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

  function pintarSugerencias(lista) {
    var sug = document.getElementById('asSug');
    if (!sug) return;
    sug.innerHTML = (lista || sugBase()).slice(0, 5).map(function (s) {
      return '<button type="button" class="as-chip">' + escapar(s) + '</button>';
    }).join('');
  }

  function preguntar(texto) {
    texto = (texto || '').trim();
    if (!texto) return;
    // Lo que escribe el usuario es TEXTO: nunca se interpreta como HTML.
    agregar('vos', escapar(texto));

    // Una pausa corta: una respuesta instantánea se lee como un cartel,
    // no como una conversación.
    var pensando = { de: 'bubba', texto: '<span class="as-dots"><i></i><i></i><i></i></span>' };
    historial.push(pensando);
    pintarMensajes();

    setTimeout(function () {
      historial.splice(historial.indexOf(pensando), 1);
      var r = responder(texto);
      agregar('bubba', r.texto);
      pintarSugerencias(r.sug);
    }, 380);
  }

  function saludo() {
    var u = MC.auth.current();
    var nombre = u && !u.guest ? ', ' + escapar(u.name) : '';
    if (S.esAgente()) {
      return '¡Hola' + nombre + '! Soy el asistente de Bubba. Te puedo decir cómo está tu caja, ' +
        'si hay pedidos de fichas, o explicarte cualquier juego.';
    }
    return '¡Hola' + nombre + '! Soy el asistente de Bubba. Sé de este casino y de tu cuenta: ' +
      'saldo, fichas gratis, reglas de cada juego, bote, torneo… Preguntame lo que quieras.';
  }

  function reiniciar() {
    historial = [];
    ctx = { juego: null, ultimo: null };
    agregar('bubba', saludo());
    pintarSugerencias();
  }

  function abrir() {
    abierto = true;
    document.getElementById('asistente').classList.add('open');
    document.getElementById('asFab').classList.add('oculto');
    if (!historial.length) reiniciar();
    var i = document.getElementById('asInput');
    if (i) i.focus();
  }

  function cerrar() {
    abierto = false;
    document.getElementById('asistente').classList.remove('open');
    document.getElementById('asFab').classList.remove('oculto');
  }

  /* Los enlaces de las respuestas navegan por el casino. Algunas
     pantallas tienen su propio open() porque se pintan al abrir. */
  function ir(destino) {
    var abridores = {
      misiones: window.MCMissionsView, vip: window.MCVip, agente: window.MCAgente,
      ajustes: window.MCAjustes, stats: window.MCEstadisticas, catalog: window.MCCatalogView
    };
    var m = abridores[destino];
    if (m && m.open) m.open();
    else MC.showView(destino);
    if (window.innerWidth < 900) cerrar();
  }

  function init() {
    var fab = document.getElementById('asFab');
    var cerrarBtn = document.getElementById('asClose');
    var resetBtn = document.getElementById('asReset');
    var form = document.getElementById('asForm');
    var input = document.getElementById('asInput');
    var sug = document.getElementById('asSug');
    if (!fab || !form) return;

    fab.onclick = function () { MC.sound.click(); abrir(); };
    cerrarBtn.onclick = function () { MC.sound.click(); cerrar(); };
    if (resetBtn) resetBtn.onclick = function () { MC.sound.click(); reiniciar(); };

    form.onsubmit = function (e) {
      e.preventDefault();
      preguntar(input.value);
      input.value = '';
    };

    pintarSugerencias();
    sug.onclick = function (e) {
      var b = e.target.closest('.as-chip');
      if (b) preguntar(b.textContent);
    };

    document.getElementById('asMsgs').onclick = function (e) {
      var a = e.target.closest('[data-ir]');
      if (a) ir(a.dataset.ir);
    };

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && abierto) cerrar();
    });
  }

  return {
    init: init, abrir: abrir, cerrar: cerrar, preguntar: preguntar,
    // Para tools/probar-asistente.js
    entender: entender, responder: responder, reiniciar: function () { ctx = { juego: null, ultimo: null }; },
    debug: false
  };
})();
