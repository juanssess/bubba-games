/* ============================================================
   UI / TABLA DE POSICIONES

   El ranking entre todos los que entran al link. Es lo que hace
   que tener cuenta sirva para algo más que guardar fichas.

   ---------------------------------------------------------------
   CÓMO FUNCIONA
   ---------------------------------------------------------------
   Cada jugador con cuenta de Google publica una fila en la
   colección `leaderboard` de Firestore: nombre, foto, saldo,
   apostado y mejor golpe. Cualquiera puede LEER esa colección;
   sólo el dueño puede escribir la suya. Las reglas lo garantizan.

   Los perfiles locales no participan: sin cuenta no hay a quién
   atribuirle la fila, y dejar escribir sin identidad sería abrirle
   la puerta a cualquiera para llenar la tabla de basura.

   ---------------------------------------------------------------
   POR QUÉ SE ORDENA POR APOSTADO Y NO POR SALDO
   ---------------------------------------------------------------
   El saldo se puede inflar reclamando bonos sin jugar. Lo apostado
   sólo sube jugando, así que mide lo que la tabla dice medir. El
   saldo igual se muestra, pero no es el criterio.

   Depende de: auth, state, levels, format, ui.
   ============================================================ */
window.MCRanking = (function () {
  'use strict';

  var TOPE = 25;

  var ICO_CANDADO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="4" y="10" width="16" height="10" rx="2"/>' +
    '<path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2"/></svg>';
  var filas = null;      // null = todavía no se cargó
  var error = '';
  var cargando = false;

  /* ---------------- publicar la fila propia ---------------- */
  // La llama auth-firebase cuando sincroniza, para no abrir una segunda
  // vía de escritura con su propia lógica de cuándo y cuánto.
  function datosPropios() {
    var u = MC.auth.current();
    if (!u || u.provider !== 'google') return null;
    // El agente crea las fichas: dejarlo competir volveria la tabla un
    // adorno, porque su "apostado" no costaria nada.
    if (MCRoles.esAgente(u)) return null;
    var s = MC.state.stats || {};
    var fila = {
      nombre: (u.name || 'Jugador').slice(0, 24),
      foto: u.photo || null,
      saldo: MC.getBalance(),
      apostado: s.wagered || 0,
      mejor: s.best || 0,
      xp: MC.state.xp || 0,
      at: Date.now()
    };

    /* EL TORNEO VIAJA EN LA MISMA FILA, y eso fue a proposito.
       Podria tener su coleccion propia en Firestore, con su indice y su
       orden hecho en el servidor. Pero una coleccion nueva son reglas
       nuevas, y las reglas se publican a mano en la consola de Firebase:
       cada coleccion que se agrega es una visita mas a la consola y una
       oportunidad mas de que el casino quede a medias esperando a que
       alguien se acuerde. Tres campos en un documento que YA es publico
       no cuestan nada y no piden permiso nuevo.
       El costo se paga del otro lado: la tabla del torneo se ordena en el
       navegador. Ver el comentario de src/ui/torneo.js. */
    if (window.MCTorneo) {
      var t = MCTorneo.mio();
      fila.sem = t.sem;
      fila.golpe = t.golpe || 0;
      fila.semApostado = t.apostado || 0;
    }
    return fila;
  }

  /* ---------------- cargar ---------------- */
  function cargar(cb) {
    if (cargando) return;
    var api = MC.auth.rankingApi && MC.auth.rankingApi();
    if (!api) {
      error = 'sin-conexion';
      if (cb) cb();
      return;
    }
    cargando = true;
    api.leer(TOPE).then(function (res) {
      filas = res;
      error = '';
    }).catch(function (e) {
      error = e.code || e.message || 'error';
    }).then(function () {
      cargando = false;
      if (cb) cb();
    });
  }

  /* ---------------- el vacío, según por qué está vacío ----------------

     Antes acá había UN solo cartel: "Entrá con Google y jugá una ronda".
     Se veía igual estuvieras como estuvieras, y por eso era inservible
     justo cuando más hacía falta: alguien que YA entró con Google y YA
     jugó —compró un bonus, incluso— leía que hiciera exactamente lo que
     acababa de hacer. Un mensaje que no distingue entre "te falta algo" y
     "algo se rompió" manda al jugador a repetir la acción para siempre.

     Son cuatro situaciones distintas y cada una tiene su respuesta. La
     cuarta es la importante: si jugaste logueado y aun así no estás en la
     tabla, el problema es la SUBIDA, y la pantalla tiene que decirlo con
     el motivo que reporta Firestore en vez de mandarte a jugar de nuevo. */
  function vacioSegunElCaso(u) {
    var esGoogle = !!u && u.provider === 'google';

    if (!esGoogle) {
      return MCEstadisticas.vacio(
        MCEstadisticas.ICO.dados,
        'Estás jugando como invitado',
        'La tabla compara cuentas de Google, porque es lo único que sigue siendo ' +
        'vos en otro dispositivo. Tus fichas de invitado viven solo en este ' +
        'navegador y no compiten. Entrá con Google y jugá una ronda.',
        '<button class="btn btn-gold" id="rkEntrar">Entrar con Google</button>',
      );
    }

    if (window.MCRoles && MCRoles.esAgente(u)) {
      return MCEstadisticas.vacio(
        MCEstadisticas.ICO.dados,
        'El agente no compite',
        'Tu cuenta de agente crea las fichas que reparte, así que su "apostado" ' +
        'no le cuesta nada. Dejarla entrar volvería la tabla un adorno. ' +
        'Entrá con una cuenta de jugador para aparecer.',
        '<button class="btn btn-ghost" id="rkRefrescar">Reintentar</button>',
      );
    }

    var apostado = (MC.state.stats || {}).wagered || 0;
    if (apostado <= 0) {
      return MCEstadisticas.vacio(
        MCEstadisticas.ICO.dados,
        'Jugá una ronda y sos el primero',
        'Se ordena por total apostado, así que no hace falta ganar para aparecer.',
        '<button class="btn btn-gold" id="rkJugar">Jugar una ronda</button>',
      );
    }

    // Jugaste, estás logueado, y no estás en la tabla. Acá hay un problema
    // de verdad, y lo que corresponde es mostrar el motivo.
    var estado = MC.auth.estadoNube ? MC.auth.estadoNube() : '';
    var motivo = MC.auth.errorNube ? MC.auth.errorNube() : '';

    if (estado === 'error') {
      return MCEstadisticas.vacio(
        ICO_CANDADO,
        'Tu progreso no está subiendo',
        'Ya apostaste ' + MC.fmt(apostado) + ' fichas con esta cuenta, pero la nube ' +
        'rechazó el guardado' + (motivo ? ': <code>' + escapar(motivo) + '</code>' : '') +
        '. Mientras no suba tu progreso tampoco sube tu fila del ranking.',
        '<button class="btn btn-ghost" id="rkRefrescar">Reintentar</button>',
      );
    }

    return MCEstadisticas.vacio(
      MCEstadisticas.ICO.dados,
      'Tu fila está por subir',
      'Ya apostaste ' + MC.fmt(apostado) + ' fichas. La fila del ranking viaja ' +
      'con el guardado en la nube, que sale un par de segundos después de cada ' +
      'ronda. Si después de reintentar seguís sin aparecer, avisame.',
      '<button class="btn btn-ghost" id="rkRefrescar">Reintentar</button>',
    );
  }

  /* ---------------- dibujo ---------------- */
  function render() {
    var cont = document.getElementById('rankingBody');
    if (!cont) return;
    var u = MC.auth.current();

    if (filas === null && !error) {
      cont.innerHTML = aviso('Cargando la tabla…', '');
      cargar(render);
      return;
    }

    if (error) {
      /* El error que de verdad se ve es `permission-denied`, y significa una
         cosa concreta: las reglas de Firestore no estan publicadas. Decir el
         codigo y nada mas manda a alguien a buscar en Google; decir que
         significa y donde se arregla es la mitad del trabajo que falta. */
      var esPermiso = /permission/i.test(error);
      cont.innerHTML = MCEstadisticas.vacio(
        ICO_CANDADO,
        esPermiso ? 'Falta publicar las reglas' : 'No se pudo cargar la tabla',
        esPermiso
          ? 'La tabla lee una colección pública de Firestore y todavía no tiene ' +
            'permiso. Se arregla en la consola de Firebase: Firestore Database → ' +
            'Reglas, pegar el contenido de firestore.rules del repo y publicar.'
          : (error === 'sin-conexion'
              ? 'Necesitás conexión y una cuenta de Google para ver el ranking.'
              : 'Firestore devolvió: ' + escapar(error)),
        '<button class="btn btn-ghost" id="rkRefrescar">Reintentar</button>',
      );
      enganchar();
      return;
    }

    if (!filas.length) {
      cont.innerHTML = vacioSegunElCaso(u);
      enganchar();
      return;
    }

    var miIndice = -1;
    filas.forEach(function (f, i) { if (f.id === u.uid.replace('google:', '')) miIndice = i; });

    cont.innerHTML =
      '<div class="rk-tabla">' +
        '<div class="rk-row rk-head">' +
          '<span>#</span><span>Jugador</span><span>Apostado</span>' +
          '<span>Saldo</span><span>Mejor golpe</span>' +
        '</div>' +
        filas.map(function (f, i) { return fila(f, i, i === miIndice); }).join('') +
      '</div>' +
      (miIndice === -1 && u.provider === 'google'
        ? aviso('Todavía no apareciste',
            'Jugá una ronda y tu fila se publica sola en unos segundos.')
        : '') +
      (u.provider !== 'google'
        ? aviso('Estás jugando sin cuenta',
            'La tabla es para cuentas de Google. Entrá con la tuya para aparecer.')
        : '') +
      '<p class="rk-nota">Se ordena por <strong>total apostado</strong>, no por saldo: ' +
      'el saldo se puede inflar reclamando bonos sin jugar, lo apostado no.</p>' +
      botones();

    enganchar();
  }

  function fila(f, i, esMio) {
    var medalla = ['🥇', '🥈', '🥉'][i] || (i + 1);
    return '<div class="rk-row' + (esMio ? ' mio' : '') + '">' +
      '<span class="rk-pos">' + medalla + '</span>' +
      '<span class="rk-jugador">' +
        '<span class="rk-av">' +
          (f.foto ? '<img src="' + f.foto + '" alt="" referrerpolicy="no-referrer">' : '👤') +
        '</span>' +
        '<span class="rk-nombre">' + escapar(f.nombre) + (esMio ? '<em>vos</em>' : '') + '</span>' +
      '</span>' +
      '<span class="rk-mono rk-fuerte">' + MC.fmt(f.apostado || 0) + '</span>' +
      '<span class="rk-mono">' + MC.fmt(f.saldo || 0) + '</span>' +
      '<span class="rk-mono">' + MC.fmt(f.mejor || 0) + '</span>' +
      '</div>';
  }

  // Los nombres los eligen otras personas: nunca van al DOM sin limpiar.
  function escapar(t) {
    return String(t || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function aviso(titulo, sub) {
    return '<div class="rk-aviso"><strong>' + titulo + '</strong>' +
      (sub ? '<span>' + sub + '</span>' : '') + '</div>';
  }

  function botones() {
    return '<div class="rk-acciones">' +
      '<button class="btn btn-ghost" id="rkRefrescar">Actualizar</button>' +
      '<button class="btn btn-accent" id="rkJugar">Ir a jugar</button>' +
      '</div>';
  }

  function enganchar() {
    var r = document.getElementById('rkRefrescar');
    if (r) r.onclick = function () {
      filas = null; error = ''; MC.sound.click(); render();
    };
    var j = document.getElementById('rkJugar');
    if (j) j.onclick = function () { MC.showView('lobby'); };
    var e = document.getElementById('rkEntrar');
    if (e) e.onclick = function () {
      MC.sound.click();
      MC.auth.entrarCon('google');
    };
  }

  function open() {
    MC.showView('ranking');
    render();
  }

  function init() {
    MC.onEnter('ranking', function () { filas = null; error = ''; render(); });
  }

  return { init: init, open: open, render: render, datosPropios: datosPropios };
})();
