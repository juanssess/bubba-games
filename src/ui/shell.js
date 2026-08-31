/* ============================================================
   UI / ARMAZÓN — barra lateral y barra superior.
   Es el único módulo que sabe cómo se abre y cierra el menú en
   móvil, y qué botón enciende cada cosa.
   ============================================================ */
window.MCShell = (function () {
  'use strict';

  function init() {
    wireSidebar();
    wireTopbar();
  }

  /* ---------------- barra lateral ---------------- */
  function wireSidebar() {
    var sidebar = document.getElementById('sidebar');
    var scrim = document.getElementById('sbScrim');

    function closeMobile() {
      sidebar.classList.remove('open');
      scrim.classList.remove('show');
    }

    document.getElementById('menuToggle').onclick = function () {
      sidebar.classList.toggle('open');
      scrim.classList.toggle('show');
    };
    scrim.onclick = closeMobile;

    document.querySelector('.sb-brand').onclick = function () {
      MC.sound.click();
      MC.showView('lobby');
      closeMobile();
    };

    document.getElementById('sbCount').textContent = MCCatalog.size;

    // Los ítems con data-rail vuelven al lobby y bajan hasta ese riel.
    document.querySelectorAll('[data-rail]').forEach(function (btn) {
      // Si todos los juegos de ese riel están ocultos, el riel no existe:
      // se esconde el botón en vez de dejarlo llevando a la nada.
      if (!document.getElementById('rail-' + btn.dataset.rail)) {
        btn.style.display = 'none';
        return;
      }
      btn.onclick = function () {
        MC.sound.click();
        markActive(btn);
        MC.showView('lobby');
        closeMobile();
        MCRails.scrollTo(btn.dataset.rail);
      };
    });

    document.getElementById('sbCatalog').onclick = function () {
      markActive(document.getElementById('sbCatalog'));
      MCActions.run('catalog');
      closeMobile();
    };
    document.getElementById('sbSports').onclick = function () {
      markActive(document.getElementById('sbSports'));
      MCActions.run('game:sports');
      closeMobile();
    };
    document.getElementById('sbMissions').onclick = function () {
      markActive(document.getElementById('sbMissions'));
      MCActions.run('missions');
      closeMobile();
    };
    document.getElementById('sbCajero').onclick = function () { MC.showView('cajero'); closeMobile(); };
    document.getElementById('sbVip').onclick = function () { MCVip.open(); closeMobile(); };
    document.getElementById('sbStats').onclick = function () { MCModals.openAccount(); closeMobile(); };
    document.getElementById('sbHelp').onclick = function () { MCModals.openHelp(); closeMobile(); };
  }

  function markActive(btn) {
    document.querySelectorAll('.sb-item').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }

  /* ---------------- barra superior ---------------- */
  function wireTopbar() {
    var soundBtn = document.getElementById('soundBtn');
    soundBtn.textContent = MC.state.soundOn ? '🔊' : '🔇';
    soundBtn.onclick = function () { MC.toggleSound(); };

    // La billetera lleva al cajero, que es donde se consiguen fichas.
    document.getElementById('walletBox').onclick = function () { MC.showView('cajero'); };
    document.getElementById('depositBtn').onclick = function () { MC.showView('cajero'); };

    document.getElementById('stageBack').onclick = function () {
      MC.sound.click();
      MC.showView('lobby');
    };
  }

  return { init: init };
})();
