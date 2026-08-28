/* ============================================================
   UI / RIELES — las filas horizontales de juegos del lobby.
   Un solo listener por contenedor: las flechas, el "ver todos"
   y las tarjetas se resuelven por delegación.
   ============================================================ */
window.MCRails = (function () {
  'use strict';

  var SCROLL_STEP = 400;   // píxeles que corre cada flecha

  function build() {
    var wrap = document.getElementById('rails');

    wrap.innerHTML = MCCatalog.rails.map(function (r) {
      return '<section class="rail" id="rail-' + r.id + '">' +
               '<div class="rail-head">' +
                 '<h2>' + r.title + '</h2>' +
                 '<span class="rail-sub">' + r.sub + '</span>' +
                 '<div class="rail-arrows">' +
                   (r.more ? '<button class="btn btn-ghost rail-all">Ver todos</button>' : '') +
                   '<button class="rail-arrow" data-dir="-1">‹</button>' +
                   '<button class="rail-arrow" data-dir="1">›</button>' +
                 '</div>' +
               '</div>' +
               '<div class="rail-track">' + r.games.map(MCCard.html).join('') + '</div>' +
             '</section>';
    }).join('');

    wrap.onclick = function (e) {
      if (e.target.closest('.rail-all')) { MCActions.run('catalog'); return; }

      var arrow = e.target.closest('.rail-arrow');
      if (arrow) {
        var track = arrow.closest('.rail').querySelector('.rail-track');
        track.scrollBy({ left: parseInt(arrow.dataset.dir, 10) * SCROLL_STEP, behavior: 'smooth' });
        return;
      }

      MCCard.handleClick(e);
    };
  }

  // Lleva el lobby hasta un riel concreto (lo usa el sidebar).
  function scrollTo(railId) {
    var target = document.getElementById('rail-' + railId);
    if (target) setTimeout(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  return { build: build, scrollTo: scrollTo };
})();
