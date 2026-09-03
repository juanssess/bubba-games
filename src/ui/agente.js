/* ============================================================
   UI / PANEL DE AGENTE — la mesa vista desde arriba.

   En un casino de dinero real, el agente es quien gestiona
   jugadores: les carga y descuenta crédito, ve cuánto mueven y
   cobra comisión. Acá es lo mismo pero con las fichas virtuales
   de este dispositivo, así que sirve para ver la mecánica sin que
   haya plata de por medio.

   Los "jugadores" son los perfiles guardados en este navegador.
   Cargarle fichas a uno es mover un número en su almacenamiento
   local: no hay dinero, no hay cobro y no hay nada que pagar.

   Depende de: auth, state, levels, format, ui.
   ============================================================ */
window.MCAgente = (function () {
  'use strict';

  /* ---------------- datos ---------------- */

  // El perfil activo se lee de MC.state y no del almacenamiento: si el
  // jugador acaba de girar, lo guardado puede estar un instante atrasado.
  function estadoDe(u) {
    if (u.uid === MC.auth.current().uid) return MC.state;
    return MC.auth.leerEstado(u.uid);
  }

  function filaDe(u) {
    var st = estadoDe(u) || {};
    var stats = st.stats || {};
    return {
      u: u,
      saldo: st.balance || 0,
      apostado: stats.wagered || 0,
      jugadas: stats.plays || 0,
      neto: stats.net || 0,
      xp: st.xp || 0,
      activo: u.uid === MC.auth.current().uid
    };
  }

  function tabla() {
    return MC.auth.all().map(filaDe).sort(function (a, b) {
      // El que está jugando primero; después por volumen apostado, que es
      // lo que a un agente le importa mirar.
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      return b.apostado - a.apostado;
    });
  }

  /** Rango de un jugador a partir de su XP, sin depender del perfil activo. */
  function rangoDe(xp) {
    var t = MCLevels.TIERS[0];
    MCLevels.TIERS.forEach(function (x) { if (xp >= x.min) t = x; });
    return t;
  }

  /* ---------------- movimientos ---------------- */

  /**
   * Carga o descuenta fichas. `delta` positivo carga, negativo descuenta.
   *
   * Si el jugador es el activo se toca MC.state y se guarda por la vía
   * normal, para que la pantalla y la sincronía se enteren. Si es otro, se
   * escribe directo su almacenamiento.
   */
  function mover(uid, delta) {
    var users = MC.auth.all();
    var u = null;
    users.forEach(function (x) { if (x.uid === uid) u = x; });
    if (!u) return;

    if (uid === MC.auth.current().uid) {
      var nuevo = Math.max(0, MC.getBalance() + delta);
      MC.addBalance(nuevo - MC.getBalance());
    } else {
      var st = MC.auth.leerEstado(uid);
      if (!st) {
        // Perfil que nunca jugó: se le arma un estado mínimo para poder
        // acreditarle algo. El resto lo completa state.js al abrirlo.
        st = { balance: MC.STARTING_CHIPS };
      }
      st.balance = Math.max(0, (st.balance || 0) + delta);
      MC.auth.escribirEstado(uid, st);
    }

    MC.sound[delta >= 0 ? 'win' : 'click']();
    MC.toast(
      (delta >= 0 ? 'Cargaste ' : 'Descontaste ') + MC.fmt(Math.abs(delta)) +
      ' fichas a ' + u.name,
      delta >= 0 ? 'win' : 'info'
    );
    render();
  }

  function pedirMonto(uid, signo) {
    var u = null;
    MC.auth.all().forEach(function (x) { if (x.uid === uid) u = x; });
    if (!u) return;

    var montos = [500, 1000, 5000, 25000];
    var body =
      '<p>' + (signo > 0 ? 'Cargar fichas a' : 'Descontar fichas de') +
      ' <strong>' + u.name + '</strong>.</p>' +
      '<div class="ag-montos">' +
        montos.map(function (m) {
          return '<button class="btn btn-ghost ag-monto" data-m="' + m + '">' +
            (signo > 0 ? '+' : '−') + MC.fmt(m) + '</button>';
        }).join('') +
      '</div>' +
      '<label class="auth-label">O poné el monto</label>' +
      '<input type="number" id="agMonto" class="filter-input" min="1" step="1" placeholder="0">';

    MC.modal(signo > 0 ? 'Cargar fichas' : 'Descontar fichas', body, [
      { label: 'Cancelar' },
      {
        label: 'Confirmar',
        kind: 'primary',
        onClick: function () {
          var campo = document.getElementById('agMonto');
          var n = campo ? Math.floor(Number(campo.value)) : 0;
          if (n > 0) mover(uid, n * signo);
        }
      }
    ]);

    // Los botones de monto rápido cierran el modal y aplican de una.
    document.querySelectorAll('.ag-monto').forEach(function (b) {
      b.onclick = function () {
        MC.closeModal();
        mover(uid, Number(b.dataset.m) * signo);
      };
    });
  }

  /* ---------------- dibujo ---------------- */
  function render() {
    var cont = document.getElementById('agenteBody');
    if (!cont) return;

    var filas = tabla();
    var totalFichas = filas.reduce(function (a, f) { return a + f.saldo; }, 0);
    var totalApostado = filas.reduce(function (a, f) { return a + f.apostado; }, 0);
    var totalJugadas = filas.reduce(function (a, f) { return a + f.jugadas; }, 0);

    cont.innerHTML =
      // ---- resumen de la operación ----
      '<div class="ag-resumen">' +
        tarjeta('Jugadores', MC.fmt(filas.length), '') +
        tarjeta('Fichas en juego', MC.fmt(totalFichas), 'var(--gold)') +
        tarjeta('Volumen apostado', MC.fmt(totalApostado), '') +
        tarjeta('Rondas totales', MC.fmt(totalJugadas), '') +
      '</div>' +

      // ---- la mesa ----
      '<div class="ag-tabla">' +
        '<div class="ag-row ag-head">' +
          '<span>Jugador</span><span>Saldo</span><span>Apostado</span>' +
          '<span>Rango</span><span>Movimientos</span>' +
        '</div>' +
        filas.map(fila).join('') +
      '</div>' +

      '<div class="ag-note">' +
        '<strong>Los jugadores son los perfiles de este dispositivo.</strong> ' +
        'Cargar o descontar fichas mueve un número guardado en este navegador: ' +
        'no hay dinero, no se cobra nada y no hay nada que pagar. Es la mecánica ' +
        'de un panel de agente, sin la parte de la plata.' +
      '</div>';

    enganchar();
  }

  function tarjeta(k, v, color) {
    return '<div class="ag-card">' +
      '<span>' + k + '</span>' +
      '<strong' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</strong>' +
      '</div>';
  }

  function fila(f) {
    var t = rangoDe(f.xp);
    var netoColor = f.neto >= 0 ? 'var(--green)' : 'var(--red)';
    return '<div class="ag-row' + (f.activo ? ' activo' : '') + '">' +
      '<span class="ag-jugador">' +
        '<span class="ag-av">' +
          (f.u.photo
            ? '<img src="' + f.u.photo + '" alt="" referrerpolicy="no-referrer">'
            : f.u.avatar) +
        '</span>' +
        '<span class="ag-nombre">' + f.u.name +
          (f.activo ? '<em>vos</em>' : (f.u.guest ? '<em>invitado</em>' : '')) +
        '</span>' +
      '</span>' +
      '<span class="ag-mono ag-saldo">' + MC.fmt(f.saldo) + '</span>' +
      '<span class="ag-mono">' + MC.fmt(f.apostado) +
        '<em style="color:' + netoColor + '">' +
          (f.neto >= 0 ? '+' : '') + MC.fmt(f.neto) +
        '</em>' +
      '</span>' +
      '<span class="ag-rango">' + t.ico + ' ' + t.name + '</span>' +
      '<span class="ag-acciones">' +
        '<button class="btn btn-gold ag-mas" data-uid="' + f.u.uid + '">Cargar</button>' +
        '<button class="btn btn-ghost ag-menos" data-uid="' + f.u.uid + '">Quitar</button>' +
      '</span>' +
      '</div>';
  }

  function enganchar() {
    document.querySelectorAll('.ag-mas').forEach(function (b) {
      b.onclick = function () { pedirMonto(b.dataset.uid, 1); };
    });
    document.querySelectorAll('.ag-menos').forEach(function (b) {
      b.onclick = function () { pedirMonto(b.dataset.uid, -1); };
    });
  }

  function open() {
    MC.showView('agente');
    render();
  }

  function init() {
    MC.onEnter('agente', render);
  }

  return { init: init, open: open, render: render };
})();
