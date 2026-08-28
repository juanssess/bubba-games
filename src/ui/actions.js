/* ============================================================
   UI / ACCIONES — traduce un data-action del HTML a algo que pasa.

   Los banners, los accesos rápidos y los botones del sidebar
   comparten este vocabulario en vez de cablear cada uno su handler:
     'bonus'        reclamar el bono
     'wallet'       abrir la cuenta
     'catalog'      abrir el catálogo completo
     'missions'     abrir misiones y rango
     'game:<id>'    abrir ese juego
   ============================================================ */
window.MCActions = (function () {
  'use strict';

  function run(action) {
    if (!action) return;
    MC.sound.click();

    if (action === 'bonus') MC.claimBonus();
    else if (action === 'wallet') MCModals.openAccount();
    else if (action === 'catalog') MCCatalogView.open();
    else if (action === 'missions') MCMissionsView.open();
    else if (action.indexOf('game:') === 0) MC.showView(action.slice(5));
  }

  return { run: run };
})();
