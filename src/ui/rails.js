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
                 // El canto de la ficha: separa el titulo de los controles
                 // y le da al riel un remate que no es una linea generica.
                 '<div class="chip-rule"></div>' +
                 '<div class="rail-arrows">' +
                   (r.more ? '<button class="btn btn-ghost rail-all">Ver todos</button>' : '') +
                   '<button class="rail-arrow" data-dir="-1">‹</button>' +
                   '<button class="rail-arrow" data-dir="1">›</button>' +
                 '</div>' +
               '</div>' +
               '<div class="rail-track">' + r.games.map(MCCard.html).join('') + '</div>' +
             '</section>';
    }).join('') + categorias();

    // El arte vivo se monta despues de que las tarjetas esten en el DOM:
    // necesita medirlas para dimensionar cada canvas.
    if (window.MCArte) { MCArte.limpiar(); MCArte.montar(wrap); }

    wrap.onclick = function (e) {
      if (e.target.closest('.rail-all')) { MCActions.run('catalog'); return; }

      var tab = e.target.closest('.cxp-tab');
      if (tab) { elegir(tab); return; }

      var arrow = e.target.closest('.rail-arrow');
      if (arrow) {
        var track = arrow.closest('.rail').querySelector('.rail-track');
        track.scrollBy({ left: parseInt(arrow.dataset.dir, 10) * SCROLL_STEP, behavior: 'smooth' });
        return;
      }

      MCCard.handleClick(e);
    };
  }

  /* ---------------- explorá por categoría ----------------
     Una sola sección con pestañas en vez de rieles cortos. Cada pestaña
     lleva el id del riel que reemplaza (rail-crash, rail-mesa...), así
     el sidebar la encuentra y la abre. */
  function categorias() {
    var cats = MCCatalog.categories;
    if (!cats.length) return '';
    return '<section class="rail cxp-block" id="rail-categorias">' +
             '<div class="rail-head">' +
               '<h2>Explorá por categoría</h2>' +
               '<div class="chip-rule"></div>' +
             '</div>' +
             '<div class="cxp-tabs" role="tablist">' +
               cats.map(function (c, i) {
                 return '<button class="cxp-tab" role="tab" id="rail-' + c.id + '" data-cat="' + c.id +
                        '" aria-selected="' + (i === 0) + '">' + c.tab +
                        ' <span>' + c.games.length + '</span></button>';
               }).join('') +
             '</div>' +
             cats.map(function (c, i) {
               return '<div class="cxp-grid" data-cat="' + c.id + '" role="tabpanel"' + (i ? ' hidden' : '') + '>' +
                        c.games.map(MCCard.html).join('') +
                      '</div>';
             }).join('') +
           '</section>';
  }

  function elegir(tab) {
    var block = tab.closest('.cxp-block');
    block.querySelectorAll('.cxp-tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t === tab));
    });
    block.querySelectorAll('.cxp-grid').forEach(function (g) {
      g.hidden = g.dataset.cat !== tab.dataset.cat;
    });
  }

  // Lleva el lobby hasta un riel concreto (lo usa el sidebar). Si es una
  // pestaña de categoría, la abre y baja hasta el bloque.
  function scrollTo(railId) {
    var target = document.getElementById('rail-' + railId);
    if (target && target.classList.contains('cxp-tab')) {
      elegir(target);
      target = target.closest('.cxp-block');
    }
    if (target) setTimeout(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  return { build: build, scrollTo: scrollTo };
})();
