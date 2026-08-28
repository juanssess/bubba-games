/* ============================================================
   MAIN — arranque de la aplicación.

   Único punto de entrada: arma el portal, prende los motores de
   juego y deja todo escuchando. Si algo no aparece en pantalla,
   se empieza a mirar por acá.
   ============================================================ */
(function () {
  'use strict';

  var BONUS_REFRESH_MS = 60000;   // relojea el aviso del bono

  var ENGINES = [MCSlots, MCRoulette, MCBlackjack, MCCrash, MCMines, MCSportsbook];

  function start() {
    // 1. Portal
    MCCarousel.build();
    buildQuickRow();
    MCRails.build();
    MCCatalogView.init();
    MCSearch.init();
    MCShell.init();
    MCMissionsView.init();

    // 2. Motores de juego (cada uno se registra solo en el router)
    ENGINES.forEach(function (engine) { engine.init(); });

    // El canvas del crash necesita medirse recién cuando está visible.
    MC.onEnter('crash', function () { MCCrash.redraw(); });

    // 3. Primer pintado
    MC.renderBalance(false);
    MCPortal.renderHistory();
    MCPortal.renderJackpot();
    MCLevels.render();
    MCMissions.render();
    MC.refreshBonusButton();
    setInterval(MC.refreshBonusButton, BONUS_REFRESH_MS);

    // 4. Cierre del modal por click fuera o Escape
    document.getElementById('modal').addEventListener('click', function (e) {
      if (e.target === this) MC.closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') MC.closeModal();
    });

    MCModals.welcomeIfFirstTime();
  }

  /* ---------------- accesos rápidos del lobby ---------------- */
  function buildQuickRow() {
    var row = document.getElementById('quickRow');
    var items = [
      { ico: '🏅', title: 'Misiones',  sub: 'objetivos del día',        action: 'missions' },
      { ico: '⚽', title: 'Deportes',  sub: 'Liga Bubba',            action: 'game:sports' },
      { ico: '🎁', title: 'Bono',      sub: 'fichas gratis',            action: 'bonus' },
      { ico: '🎰', title: 'Catálogo',  sub: MCCatalog.size + ' juegos', action: 'catalog' },
      { ico: '🚀', title: 'Crash',     sub: 'hasta 1000x',              action: 'game:crash' },
      { ico: '💣', title: 'Mines',     sub: '5x5',                      action: 'game:mines' }
    ];

    row.innerHTML = items.map(function (q) {
      return '<div class="quick" data-action="' + q.action + '">' +
               '<span class="quick-ico">' + q.ico + '</span>' +
               '<span class="quick-txt"><strong>' + q.title + '</strong><span>' + q.sub + '</span></span>' +
             '</div>';
    }).join('');

    row.onclick = function (e) {
      var card = e.target.closest('.quick');
      if (card) MCActions.run(card.dataset.action);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
