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

    function close() { box.classList.remove('open'); }

    input.oninput = function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { close(); return; }

      var hits = MCCatalog.all.filter(function (g) {
        return (g.name + ' ' + g.kind + ' ' + g.studio).toLowerCase().indexOf(q) >= 0;
      });
      var shown = hits.slice(0, MAX_RESULTS);

      box.innerHTML = shown.length
        ? shown.map(itemHTML).join('') +
          (hits.length > shown.length
            ? '<div class="sr-item sr-all"><span>Ver los ' + hits.length + ' resultados</span></div>'
            : '')
        : '<p class="sr-empty">No hay ningún juego con ese nombre.</p>';

      box.classList.add('open');
    };

    box.onclick = function (e) {
      if (e.target.closest('.sr-all')) {
        var text = input.value.trim();
        input.value = '';
        close();
        MCCatalogView.openWithQuery(text);
        return;
      }

      var item = e.target.closest('.sr-item');
      if (!item) return;
      input.value = '';
      close();
      MC.sound.click();
      MC.showView(item.dataset.game);
    };

    // Cerrar al tocar fuera del buscador.
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) close();
    });
  }

  function itemHTML(g) {
    return '<div class="sr-item" data-game="' + g.id + '">' +
             '<span class="sr-thumb" style="background:' + g.art + '">' + g.emoji + '</span>' +
             '<span><strong>' + g.name + '</strong><br>' +
               '<span style="font-size:11.5px;color:var(--txt-dim)">' + g.studio + ' · ' + g.rtp + '</span>' +
             '</span>' +
           '</div>';
  }

  return { init: init };
})();
