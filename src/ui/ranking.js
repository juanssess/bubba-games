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
    return {
      nombre: (u.name || 'Jugador').slice(0, 24),
      foto: u.photo || null,
      saldo: MC.getBalance(),
      apostado: s.wagered || 0,
      mejor: s.best || 0,
      xp: MC.state.xp || 0,
      at: Date.now()
    };
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
      cont.innerHTML = MCEstadisticas.vacio(
        MCEstadisticas.ICO.dados,
        'Todavía no hay nadie en la tabla',
        'Entrá con Google y jugá una ronda: vas a ser el primero de la lista. ' +
        'Se ordena por total apostado, así que no hace falta ganar para aparecer.',
        '<button class="btn btn-gold" id="rkJugar">Jugar una ronda</button>',
      );
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
