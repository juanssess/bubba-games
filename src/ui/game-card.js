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

    var cover = MCIllustrated.cover(g);
    return '<article class="gcard" role="button" tabindex="0" aria-label="Jugar a ' + g.name + '" data-game="' + g.id + '">' +
             '<div class="gcard-art' + (cover ? ' tiene-arte illustrated-card' : '') + '" data-arte="' + g.id + '" style="background:' + g.art + '">' +
               (cover || '<span class="gcard-emoji">' + MCStudioSymbols.render(g.emoji) + '</span>') +
               badge +
               // El RTP sale de MC.rtp y no de g.rtp: con el retorno
               // bajado desde el panel, el texto fijo del catálogo
               // dejaría la vitrina anunciando el de fábrica.
               '<span class="gcard-live' + (MC.rtp.ajustado(g.id) ? ' ajustado' : '') +
                 '">' + MC.rtp.etiqueta(g) + '</span>' +
               '<div class="gcard-play"><span>Jugar</span></div>' +
             '</div>' +
             '<div class="gcard-body">' +
               // Con portada ilustrada el nombre ya está en el arte: repetirlo
               // abajo era ruido. Sin arte, el nombre sigue acá.
               (cover ? '' : '<strong>' + g.name + '</strong>') +
               // Solo la descripcion: con el estudio adelante la linea no
               // entraba y se cortaba con puntos suspensivos. El estudio
               // esta en el catalogo y en la ficha del juego, que es donde
               // alguien lo va a buscar.
               '<span>' + g.desc + '</span>' +
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

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.gcard')) {
      e.preventDefault();
      e.target.click();
    }
  });

  return { html: html, handleClick: handleClick };
})();
