/* ============================================================
   UI / TARJETA DE JUEGO — el ladrillo que comparten los rieles,
   el catálogo y el buscador. Una sola definición del aspecto de
   un juego en la grilla.
   ============================================================ */
window.MCCard = (function () {
  'use strict';

  var BADGE_LABEL = { hot: 'Popular', new: 'Nuevo', top: 'Top' };

  function html(id) {
    var g = MCCatalog.games[id];
    if (!g) return '';

    var badge = g.badge
      ? '<span class="gcard-badge badge-' + g.badge + '">' + BADGE_LABEL[g.badge] + '</span>'
      : '';

    return '<article class="gcard" data-game="' + g.id + '">' +
             '<div class="gcard-art" style="background:' + g.art + '">' + g.emoji +
               badge +
               '<span class="gcard-live">' + g.rtp + '</span>' +
               '<div class="gcard-play"><span>Jugar</span></div>' +
             '</div>' +
             '<div class="gcard-body">' +
               '<strong>' + g.name + '</strong>' +
               '<span>' + g.studio + ' · ' + g.desc + '</span>' +
             '</div>' +
           '</article>';
  }

  // Delegación: se engancha una vez al contenedor y sirve para todas
  // las tarjetas de adentro, incluidas las que se agreguen después.
  function handleClick(e) {
    var card = e.target.closest('.gcard');
    if (!card) return false;
    MC.sound.click();
    MC.showView(card.dataset.game);
    return true;
  }

  return { html: html, handleClick: handleClick };
})();
