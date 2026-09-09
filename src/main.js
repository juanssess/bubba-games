/* ============================================================
   MAIN — arranque de la aplicación.

   Único punto de entrada: arma el portal, prende los motores de
   juego y deja todo escuchando. Si algo no aparece en pantalla,
   se empieza a mirar por acá.
   ============================================================ */
(function () {
  'use strict';

  var BONUS_REFRESH_MS = 60000;   // relojea el aviso del bono

  // Todos los motores se inicializan aunque su juego esté oculto: el
  // registro es barato y así basta con sacarlo de OCULTOS en el
  // catálogo para que vuelva a estar jugable, sin tocar nada acá.
  var ENGINES = [
    MCSlots, MCRoulette, MCBlackjack, MCCrash, MCMines,
    MCSportsbook, MCPlantilla, MCProveedor
  ];

  function start() {
    // 1. Portal
    MCArte.init();          // antes de los rieles: ellos montan el arte
    MCCarousel.build();
    buildQuickRow();
    MCRails.build();
    MCCatalogView.init();
    MCSearch.init();
    MCShell.init();
    MCMissionsView.init();
    MCCuenta.init();
    MCCajero.init();
    MCVip.init();
    MCRanking.init();
    MCTorneo_UI.init();
    MCBote.init();
    MCAgente.init();
    MCEstadisticas.init();
    MCCajaAgente.init();
    // Despues de MCAgente: si el perfil activo es agente, lo lleva a su panel.
    MCRoles.init();
    MCAjustes.init();
    MCAsistente.init();

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
    // Tres accesos fijos + un atajo por cada juego VISIBLE. Se arma
    // desde el catálogo para que la fila nunca ofrezca un juego oculto.
    /* Los accesos llevan icono de trazo y los juegos, una muestra de su
       propio color. Mezclar emojis de accion con emojis de juego hacia que
       la tira se leyera como un cajon de stickers en vez de un menu. */
    function trazo(d) {
      return '<svg class="quick-svg" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    }

    var items = [
      { ico: trazo('<circle cx="12" cy="15" r="5"/><path d="m9 10-2-6M15 10l2-6"/>'),
        title: 'Misiones', action: 'missions' },
      { ico: trazo('<rect x="3.5" y="9" width="17" height="11" rx="1.6"/>' +
                   '<path d="M3.5 13h17M12 9v11"/>' +
                   '<path d="M12 9C10 9 7.5 8.4 7.5 6.5A2 2 0 0 1 11 5.2c.6.7 1 2.1 1 3.8Z"/>'),
        title: 'Bono', action: 'bonus' },
      { ico: trazo('<rect x="3" y="5" width="18" height="14" rx="2"/>' +
                   '<path d="M8 9v6M12 9v6M16 9v6"/>'),
        title: 'Catálogo', action: 'catalog' }
    ].concat(MCCatalog.all.slice(0, 5).map(function (g) {
      return {
        ico: '<span class="quick-art" style="background:' + g.art + '"></span>',
        title: g.name, action: 'game:' + g.id
      };
    }));

    row.innerHTML = items.map(function (q) {
      return '<div class="quick" data-action="' + q.action + '">' +
               '<span class="quick-ico">' + q.ico + '</span>' +
               '<span class="quick-txt"><strong>' + q.title + '</strong></span>' +
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
