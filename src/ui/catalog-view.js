/* ============================================================
   UI / VISTA DE CATÁLOGO — la grilla completa con filtros.
   Se pinta por tandas para que abrir el salón entero no trabe
   la página cuando el catálogo crezca.
   ============================================================ */
window.MCCatalogView = (function () {
  'use strict';

  var PAGE = 48;          // juegos por tanda

  var shown = PAGE;
  var filtered = [];

  function open() {
    MC.showView('catalog');
    apply();
  }

  /* ---------------- filtrado y orden ---------------- */
  function apply() {
    var q = document.getElementById('catSearch').value.trim().toLowerCase();
    var studio = document.getElementById('catStudio').value;
    var vol = document.getElementById('catVol').value;
    var sort = document.getElementById('catSort').value;

    filtered = MCCatalog.all.filter(function (g) {
      if (studio && g.studio !== studio) return false;
      if (vol && g.volatility !== vol) return false;
      if (q && (g.name + ' ' + g.kind + ' ' + g.studio).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });

    if (sort === 'nombre') {
      filtered = filtered.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
    } else if (sort === 'pago') {
      filtered = filtered.slice().sort(function (a, b) { return b.maxWin - a.maxWin; });
    } else if (sort === 'rtp') {
      filtered = filtered.slice().sort(function (a, b) { return b.rtpValue - a.rtpValue; });
    }

    shown = PAGE;
    render();
  }

  function render() {
    var grid = document.getElementById('catGrid');
    var slice = filtered.slice(0, shown);

    grid.innerHTML = slice.length
      ? slice.map(function (g) { return MCCard.html(g.id); }).join('')
      : '<p class="empty-msg">Ningún juego coincide con esos filtros.</p>';

    if (window.MCArte) { MCArte.limpiar(); MCArte.montar(grid); }

    document.getElementById('catCount').textContent =
      filtered.length + (filtered.length === 1 ? ' juego' : ' juegos');
    document.getElementById('catMore').style.display = shown < filtered.length ? '' : 'none';
  }

  /* ---------------- cableado ---------------- */
  function init() {
    document.getElementById('catStudio').innerHTML =
      '<option value="">Todos los estudios</option>' +
      MCCatalog.studios.map(function (s) {
        return '<option value="' + s + '">' + s + '</option>';
      }).join('');

    ['catSearch', 'catStudio', 'catVol', 'catSort'].forEach(function (id) {
      var el = document.getElementById(id);
      el.oninput = apply;
      el.onchange = apply;
    });

    document.getElementById('catReset').onclick = function () {
      document.getElementById('catSearch').value = '';
      document.getElementById('catStudio').value = '';
      document.getElementById('catVol').value = '';
      document.getElementById('catSort').value = 'destacados';
      MC.sound.click();
      apply();
    };

    document.getElementById('catMore').onclick = function () {
      shown += PAGE;
      MC.sound.click();
      render();
    };

    document.getElementById('catBack').onclick = function () {
      MC.sound.click();
      MC.showView('lobby');
    };

    document.getElementById('catGrid').onclick = MCCard.handleClick;
  }

  // Abre el catálogo ya filtrado por un texto (lo usa el buscador).
  function openWithQuery(text) {
    document.getElementById('catSearch').value = text;
    open();
  }

  return { init: init, open: open, openWithQuery: openWithQuery };
})();
