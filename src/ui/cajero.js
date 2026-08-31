/* ============================================================
   UI / CAJERO — de dónde salen las fichas.

   Es la pantalla que en un casino de plata real sería el depósito.
   Acá NO se cobra nada ni se piden datos de pago: las fichas son
   virtuales y se consiguen jugando. Lo que se conserva del diseño
   de un cajero de verdad es la claridad — que se vea de un vistazo
   cuánto tenés, cuánto podés conseguir y cuándo.

   Las tres vías son las que ya existían en el casino, juntas y
   explicadas en un solo lugar por primera vez:
     1. el bono recargable (cada 8 h, escalado por rango)
     2. las misiones del día
     3. subir de rango, que agranda el bono para siempre

   Depende de: wallet, levels, missions, ui, format.
   ============================================================ */
window.MCCajero = (function () {
  'use strict';

  var timer = null;

  /* ---------------- datos ---------------- */
  function bonoActual() {
    return Math.round(MC.BONUS_AMOUNT * MCLevels.bonusMultiplier());
  }

  function misionesPendientes() {
    // Se leen por el módulo y no de MC.state: MCMissions.items() regenera
    // las del día si cambió la fecha. Leyendo el estado crudo mostrábamos
    // las de ayer hasta que el jugador abriera la pantalla de misiones.
    var items = (window.MCMissions && MCMissions.items()) || [];
    var falta = 0, premio = 0;
    items.forEach(function (m) {
      if (m.claimed) return;
      falta++;
      // reward es { chips, xp }: acá interesan las fichas.
      premio += (m.reward && m.reward.chips) || 0;
    });
    return { falta: falta, premio: premio, total: items.length };
  }

  /* ---------------- dibujo ---------------- */
  function pintar() {
    var cont = document.getElementById('cajeroBody');
    if (!cont) return;

    var t = MCLevels.current();
    var sig = MCLevels.next();
    var listo = MC.bonusReadyIn() === 0;
    var mis = misionesPendientes();

    cont.innerHTML =
      // ---- saldo, arriba y grande: es el dato que se viene a ver ----
      '<div class="cj-hero">' +
        '<div class="cj-hero-main">' +
          '<span class="cj-kicker">Tu saldo</span>' +
          '<strong class="cj-balance">' + MC.fmt(MC.getBalance()) + '</strong>' +
          '<span class="cj-unit">fichas virtuales</span>' +
        '</div>' +
        '<div class="cj-hero-rank">' +
          '<span class="cj-rank-ico">' + t.ico + '</span>' +
          '<div>' +
            '<strong>' + t.name + '</strong>' +
            '<span>Bono ×' + t.bonus.toFixed(2).replace('.', ',') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ---- la acción principal ----
      '<div class="cj-claim' + (listo ? ' on' : '') + '">' +
        '<div class="cj-claim-txt">' +
          '<strong>' + MC.fmt(bonoActual()) + ' fichas</strong>' +
          '<span>' + (listo
            ? 'Tu recarga está lista'
            : 'Próxima recarga en ' + MC.humanTime(MC.bonusReadyIn())) + '</span>' +
        '</div>' +
        '<button class="btn btn-gold" id="cjClaim"' + (listo ? '' : ' disabled') + '>' +
          (listo ? 'Recargar fichas' : 'Todavía no') +
        '</button>' +
      '</div>' +

      // ---- la tabla: mismo ritmo que un cajero de verdad ----
      '<div class="cj-table">' +
        '<div class="cj-row cj-head">' +
          '<span>Cómo conseguir fichas</span>' +
          '<span>Cuánto</span>' +
          '<span>Cada cuánto</span>' +
          '<span>Estado</span>' +
        '</div>' +
        filaTabla('Bono recargable', MC.fmt(bonoActual()), 'Cada 8 horas',
          listo ? 'Disponible' : MC.humanTime(MC.bonusReadyIn()), listo) +
        filaTabla('Misiones del día',
          mis.premio ? 'Hasta ' + MC.fmt(mis.premio) : 'Completadas',
          'Se renuevan a medianoche',
          mis.falta ? mis.falta + ' pendientes' : 'Todo hecho', mis.falta > 0) +
        filaTabla('Subir de rango',
          sig ? 'Bono ×' + sig.bonus.toFixed(2).replace('.', ',') : 'Rango máximo',
          'Apostando',
          sig ? 'Faltan ' + MC.fmt(sig.min - (MC.state.xp || 0)) + ' XP' : 'Sos leyenda', !!sig) +
        filaTabla('Ganar jugando', 'Lo que salga', 'En cada ronda', 'Siempre', true) +
      '</div>' +

      // ---- accesos, para que la pantalla no sea un callejón sin salida ----
      '<div class="cj-actions">' +
        '<button class="btn btn-accent" id="cjMissions">Ver misiones</button>' +
        '<button class="btn btn-ghost" id="cjVip">Club VIP</button>' +
        '<button class="btn btn-ghost" id="cjPlay">Ir a jugar</button>' +
      '</div>' +

      // ---- el aviso, sin letra chica ----
      '<div class="cj-note">' +
        '<strong>Esto es un casino de práctica.</strong> Las fichas son virtuales, se ' +
        'consiguen gratis y no tienen ningún valor. Nunca te vamos a pedir datos de una ' +
        'tarjeta ni de una cuenta bancaria: no hay forma de depositar ni de retirar dinero.' +
      '</div>';

    enganchar();
  }

  function filaTabla(nombre, cuanto, cadaCuanto, estado, activo) {
    return '<div class="cj-row">' +
      '<span class="cj-name">' + nombre + '</span>' +
      '<span class="cj-mono">' + cuanto + '</span>' +
      '<span class="cj-when">' + cadaCuanto + '</span>' +
      '<span class="cj-state' + (activo ? ' on' : '') + '">' + estado + '</span>' +
      '</div>';
  }

  function enganchar() {
    var claim = document.getElementById('cjClaim');
    if (claim) claim.onclick = function () {
      MC.claimBonus();
      pintar();
    };
    var mis = document.getElementById('cjMissions');
    if (mis) mis.onclick = function () { MCMissionsView.open(); };
    var vip = document.getElementById('cjVip');
    if (vip) vip.onclick = function () { MCVip.open(); };
    var play = document.getElementById('cjPlay');
    if (play) play.onclick = function () { MC.showView('lobby'); };
  }

  /* ---------------- ciclo de vida ---------------- */
  function init() {
    MC.onEnter('cajero', function () {
      pintar();
      // El contador del bono corre solo mientras la pantalla está abierta.
      clearInterval(timer);
      timer = setInterval(pintar, 1000 * 30);
    });
    MC.onLeave('cajero', function () { clearInterval(timer); });
  }

  return { init: init, pintar: pintar };
})();
