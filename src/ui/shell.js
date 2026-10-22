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
    wireCategories();
    document.querySelectorAll('button[data-nav="lobby"], button[data-view="lobby"]').forEach(function (button) {
      button.onclick = function () { MC.sound.click(); MC.showView('lobby'); };
    });
  }

  /* ---------------- barra lateral ---------------- */
  function wireSidebar() {
    var sidebar = document.getElementById('sidebar');
    var scrim = document.getElementById('sbScrim');

    function closeMobile() {
      sidebar.classList.remove('open');
      scrim.classList.remove('show');
      sidebar.inert = true;
      document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
      if (sidebar.contains(document.activeElement)) document.getElementById('menuToggle').focus();
    }

    document.getElementById('menuToggle').onclick = function () {
      sidebar.classList.toggle('open');
      scrim.classList.toggle('show');
      sidebar.inert = !sidebar.classList.contains('open');
      this.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
      if (sidebar.classList.contains('open')) document.getElementById('sidebarClose').focus();
    };
    scrim.onclick = closeMobile;
    document.getElementById('sidebarClose').onclick = closeMobile;
    sidebar.querySelector('.sb-nav').addEventListener('click', function (event) {
      if (event.target.closest('.sb-item')) closeMobile();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && sidebar.classList.contains('open')) {
        closeMobile();
        document.getElementById('menuToggle').focus();
      }
      if (event.key === 'Tab' && sidebar.classList.contains('open')) {
        var buttons = Array.from(sidebar.querySelectorAll('button, a[href], [tabindex="0"]')).filter(function (el) {
          return !el.disabled && el.getClientRects().length;
        });
        var first = buttons[0];
        var last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.getElementById('sbAccount').onclick = function () { MCCuenta.abrirCuenta(); };
    document.getElementById('sbMissions').onclick = function () {
      MCActions.run('missions');
      closeMobile();
    };
    document.getElementById('sbJackpot').onclick = function () {
      var pozo = MCBote.pozo();
      MC.modal('Bote Bubba',
        '<p style="font-size:30px;color:var(--gold);margin:4px 0">' + MC.fmt(pozo) + ' fichas</p>' +
        '<p>Cada ronda aporta el <strong>1% de lo apostado</strong> al pozo, y esa misma ' +
        'ronda tiene una chance de ganárselo entero.</p>' +
        '<p>La probabilidad es <strong>(1% de tu apuesta) ÷ pozo</strong>. Con eso el bote ' +
        'devuelve exactamente el 1% de lo que apostás, sin importar cómo apuestes: ' +
        'jugar fuerte no mejora tu retorno, sólo adelanta el momento.</p>' +
        '<p>Apostando 1.000 fichas ahora mismo: <strong>1 en ' +
        MC.fmt(MCBote.unoEnCuantas(1000)) + '</strong>. Cuanto más crece el pozo, ' +
        'más raro se hace — como en un progresivo de verdad.</p>' +
        /* El renglón de abajo cambia según contra qué pozo se está
           jugando. Dejarlo fijo era la opción fácil y la que miente:
           el texto decía "no es compartido" y ahora puede serlo. */
        (MCBote.esCompartido()
          ? '<p style="font-size:12.5px;color:var(--txt-dim)">Este pozo es <strong>de ' +
            'todos</strong>: lo alimentan las apuestas de todos los que juegan con cuenta, ' +
            'y se lo lleva entero el primero al que le toque. Compartirlo no te cambia el ' +
            'retorno —seguís recuperando el 1% de lo que apostás vos—, pero sí lo hace más ' +
            'raro y más grande.' +
            (MCBote.comun() && MCBote.comun().ganados
              ? ' Van <strong>' + MC.fmt(MCBote.comun().ganados) + '</strong> cobrados, el ' +
                'último de ' + MC.fmt(MCBote.comun().ultimo || 0) + ' fichas.'
              : ' Todavía no lo ganó nadie.') +
            '</p>'
          : '<p style="font-size:12.5px;color:var(--txt-dim)">Este es <strong>tu</strong> ' +
            'pozo: lo alimenta lo que apostás vos y se guarda con tu progreso. Entrando con ' +
            'Google pasás a jugar contra el pozo compartido, que lo alimentan todos.</p>'),
        [{ label: 'Entendido', kind: 'primary' }]);
      closeMobile();
    };
    document.getElementById('sbRanking').onclick = function () { MCRanking.open(); closeMobile(); };
    document.getElementById('sbVip').onclick = function () { MCVip.open(); closeMobile(); };
    document.getElementById('sbAgente').onclick = function () { MCAgente.open(); closeMobile(); };
    document.getElementById('sbAjustes').onclick = function () { MCAjustes.open(); closeMobile(); };
    document.getElementById('sbStats').onclick = function () { MCEstadisticas.open(); closeMobile(); };
    document.getElementById('sbHelp').onclick = function () { MCModals.openHelp(); closeMobile(); };
    document.addEventListener('mc:viewchange', function () {
      var items = { missions:'sbMissions', vip:'sbVip', ranking:'sbRanking', torneo:'sbTorneo', stats:'sbStats', agente:'sbAgente', casa:'sbCasa', ajustes:'sbAjustes' };
      markActive(document.getElementById(items[MC.getCurrentView()]));
      closeMobile();
    });
  }

  function markActive(btn) {
    document.querySelectorAll('.sb-item').forEach(function (b) {
      b.classList.toggle('active', b === btn);
      if (b === btn) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  /* ---------------- barra superior ---------------- */
  function wireCategories() {
    var nav = document.querySelector('.category-nav');
    function select(category) {
      nav.querySelectorAll('[data-category]').forEach(function (button) {
        var active = button.dataset.category === category;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    }
    nav.addEventListener('click', function (event) {
      var button = event.target.closest('[data-category]');
      if (!button) return;
      var category = button.dataset.category;
      MC.sound.click();
      if (category === 'casino') MC.showView('catalog');
      else if (category === 'deportes') MC.showView('sports');
      else {
        MC.showView('lobby');
        if (MC.getCurrentView() !== 'lobby') return;
        if (category !== 'inicio') MCRails.scrollTo(category);
      }
      if (MC.getCurrentView() === (category === 'casino' ? 'catalog' : category === 'deportes' ? 'sportsbook' : 'lobby')) {
        select(category);
      }
    });
    document.addEventListener('mc:viewchange', function () {
      var game = MC.getGame(MC.getCurrentGame());
      var kinds = { Deportes:'deportes', Mesa:'mesa', Tragamonedas:'tragamonedas', Crash:'crash', Instantáneo:'crash' };
      select(game ? kinds[game.kind] : MC.getCurrentView() === 'lobby' ? 'inicio' : MC.getCurrentView() === 'catalog' ? 'casino' : null);
    });
    document.addEventListener('mc:railchange', function (event) {
      select(event.detail);
    });
  }

  function wireTopbar() {
    var soundBtn = document.getElementById('soundBtn');
    // El icono lo dibuja audio.js: es el que sabe si el sonido esta prendido
    // y ademas evita que cada sistema operativo dibuje su propio altavoz.
    MC.pintarBotonSonido();
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
