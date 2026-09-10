/* ============================================================
   UI / BUSCADOR — el desplegable de la barra superior.
   Muestra los primeros resultados y ofrece pasar al catálogo
   filtrado cuando hay más de los que entran.
   ============================================================ */
window.MCSearch = (function () {
  'use strict';

  var MAX_RESULTS = 8;

  function init() {
    var input = document.getElementById('searchInput');
    var box = document.getElementById('searchResults');
    var results = [];
    var activeIndex = -1;

    function close() {
      box.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
    }

    function open() {
      box.classList.add('open');
      input.setAttribute('aria-expanded', 'true');
    }

    function select(index) {
      if (!results[index]) return;
      input.value = '';
      close();
      MC.sound.click();
      MC.showView(results[index].id);
    }

    function paintActive() {
      box.querySelectorAll('.sr-item[data-game]').forEach(function (item, index) {
        var active = index === activeIndex;
        item.classList.toggle('selected', active);
        item.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      if (results[activeIndex]) input.setAttribute('aria-activedescendant', 'sr-' + results[activeIndex].id);
      else input.removeAttribute('aria-activedescendant');
    }

    input.oninput = function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { close(); return; }

      var hits = MCCatalog.all.filter(function (g) {
        return (g.name + ' ' + g.kind + ' ' + g.studio).toLowerCase().indexOf(q) >= 0;
      });
      var shown = hits.slice(0, MAX_RESULTS);
      results = shown;
      activeIndex = -1;

      box.innerHTML = shown.length
        ? shown.map(itemHTML).join('') +
          (hits.length > shown.length
            ? '<div class="sr-item sr-all"><span>Ver los ' + hits.length + ' resultados</span></div>'
            : '')
        : '<p class="sr-empty">No hay ningún juego con ese nombre.</p>';

      open();
    };

    input.onkeydown = function (e) {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (!results.length || !box.classList.contains('open')) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = e.key === 'ArrowDown'
          ? (activeIndex + 1) % results.length
          : (activeIndex - 1 + results.length) % results.length;
        paintActive();
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        select(activeIndex);
      }
    };

    box.onclick = function (e) {
      if (e.target.closest('.sr-all')) {
        var text = input.value.trim();
        input.value = '';
        close();
        MCCatalogView.openWithQuery(text);
        return;
      }

      var item = e.target.closest('.sr-item[data-game]');
      if (!item) return;
      select(results.findIndex(function (g) { return g.id === item.dataset.game; }));
    };

    // Cerrar al tocar fuera del buscador.
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) close();
    });
  }

  function itemHTML(g) {
    return '<div class="sr-item" id="sr-' + g.id + '" role="option" aria-selected="false" data-game="' + g.id + '">' +
             '<span class="sr-thumb" style="background:' + g.art + '">' + g.emoji + '</span>' +
             '<span><strong>' + g.name + '</strong><br>' +
               '<span style="font-size:11.5px;color:var(--txt-dim)">' + g.studio + ' · ' + g.rtp + '</span>' +
             '</span>' +
           '</div>';
  }

  return { init: init };
})();
