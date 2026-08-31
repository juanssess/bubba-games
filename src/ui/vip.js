/* ============================================================
   UI / CLUB VIP — los seis rangos, de un vistazo.

   El sistema de rangos ya existía (progress/levels.js) pero sólo
   se veía de a pedazos: la barrita del sidebar y un cartel al
   subir. Esta pantalla lo muestra entero, que es lo que hace que
   valga la pena perseguirlo.

   Nada de esto es nuevo por debajo: se lee todo de MCLevels, así
   que si mañana cambian los rangos o los beneficios, esta pantalla
   se actualiza sola.

   Depende de: levels, state, format, ui.
   ============================================================ */
window.MCVip = (function () {
  'use strict';

  function open() {
    MC.showView('vip');
    render();
  }

  function render() {
    var cont = document.getElementById('vipBody');
    if (!cont) return;

    var tiers = MCLevels.TIERS;
    var actual = MCLevels.current();
    var sig = MCLevels.next();
    var xp = MC.state.xp || 0;
    var avance = Math.round(MCLevels.progress() * 100);
    var iActual = tiers.indexOf(actual);

    cont.innerHTML =
      // ---- dónde estás parado ----
      '<div class="vip-hero">' +
        '<div class="vip-now">' +
          '<span class="vip-kicker">Tu rango</span>' +
          '<strong class="vip-name">' + actual.ico + ' ' + actual.name + '</strong>' +
          '<span class="vip-xp">' + MC.fmt(xp) + ' XP acumulada</span>' +
        '</div>' +
        '<div class="vip-prog">' +
          (sig
            ? '<div class="vip-prog-top">' +
                '<span>Siguiente: <strong>' + sig.name + '</strong></span>' +
                '<span>' + avance + '%</span>' +
              '</div>' +
              '<div class="vip-bar"><div class="vip-fill" style="width:' + avance + '%"></div></div>' +
              '<span class="vip-falta">Te faltan ' + MC.fmt(sig.min - xp) + ' XP</span>'
            : '<div class="vip-prog-top"><span>Llegaste al rango máximo</span></div>' +
              '<div class="vip-bar"><div class="vip-fill" style="width:100%"></div></div>' +
              '<span class="vip-falta">No hay nada por encima de esto</span>') +
        '</div>' +
      '</div>' +

      // ---- los seis niveles ----
      '<div class="vip-tiers">' +
        tiers.map(function (t, i) {
          var estado = i < iActual ? 'pasado' : (i === iActual ? 'actual' : 'futuro');
          return '<div class="vip-card ' + estado + '">' +
            '<span class="vip-card-num">Nivel ' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
            '<span class="vip-card-ico">' + t.ico + '</span>' +
            '<strong class="vip-card-name">' + t.name + '</strong>' +
            '<span class="vip-card-req">' +
              (t.min === 0 ? 'Desde el arranque' : 'Desde ' + MC.fmt(t.min) + ' XP') +
            '</span>' +
            '<span class="vip-card-perk">Bono ×' + t.bonus.toFixed(2).replace('.', ',') + '</span>' +
            (i === iActual ? '<span class="vip-card-tag">Estás acá</span>' : '') +
            '</div>';
        }).join('') +
      '</div>' +

      // ---- cómo funciona, en dos frases ----
      '<div class="vip-note">' +
        '<p><strong>La XP sube con lo que apostás, no con lo que ganás.</strong> ' +
        'Así el rango refleja cuánto jugaste y no si tuviste suerte — y nunca baja.</p>' +
        '<p>El beneficio es concreto: cada rango agranda el bono recargable del cajero. ' +
        'De Aprendiz a Leyenda Bubba, el bono se duplica.</p>' +
      '</div>' +

      '<div class="vip-actions">' +
        '<button class="btn btn-accent" id="vipCajero">Ir al cajero</button>' +
        '<button class="btn btn-ghost" id="vipPlay">Ir a jugar</button>' +
      '</div>';

    var c = document.getElementById('vipCajero');
    if (c) c.onclick = function () { MC.showView('cajero'); };
    var p = document.getElementById('vipPlay');
    if (p) p.onclick = function () { MC.showView('lobby'); };
  }

  function init() {
    MC.onEnter('vip', render);
  }

  return { init: init, open: open, render: render };
})();
