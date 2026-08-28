/* ============================================================
   UI / MODALES — cuenta, ayuda y bienvenida.
   Los textos largos viven acá y no ensucian el resto del código.
   ============================================================ */
window.MCModals = (function () {
  'use strict';

  var WELCOME_KEY = 'bubba_games_welcome_v1';

  /* ---------------- cuenta ---------------- */
  function openAccount() {
    MC.sound.click();
    var s = MC.state.stats;
    var netColor = s.net >= 0 ? 'var(--green)' : 'var(--red)';

    var body =
      '<p>Saldo: <strong style="color:var(--gold)">' + MC.fmt(MC.getBalance()) + ' fichas</strong></p>' +
      '<p>Rondas jugadas: <strong>' + MC.fmt(s.plays) + '</strong></p>' +
      '<p>Total apostado: <strong>' + MC.fmt(s.wagered) + '</strong></p>' +
      '<p>Mejor golpe: <strong style="color:var(--green)">+' + MC.fmt(s.best) + '</strong></p>' +
      '<p>Balance neto: <strong style="color:' + netColor + '">' +
        (s.net >= 0 ? '+' : '') + MC.fmt(s.net) + '</strong></p>' +
      '<p>Próximo bono: <strong>' +
        (MC.bonusReadyIn() === 0 ? 'disponible ahora' : 'en ' + MC.humanTime(MC.bonusReadyIn())) +
      '</strong></p>' +
      '<p style="margin-top:14px;font-size:12.5px">Las fichas son virtuales y se guardan sólo en este ' +
      'navegador. No hay dinero real involucrado.</p>';

    MC.modal('Tu cuenta', body, [
      { label: 'Reiniciar', onClick: confirmReset },
      { label: 'Cerrar', kind: 'primary' }
    ]);
  }

  function confirmReset() {
    MC.modal('¿Reiniciar todo?',
      '<p>Volvés a ' + MC.fmt(MC.STARTING_CHIPS) + ' fichas y se borran las estadísticas.</p>',
      [
        { label: 'Cancelar' },
        { label: 'Sí, reiniciar', kind: 'primary', onClick: MC.resetProgress }
      ]);
  }

  /* ---------------- ayuda ---------------- */
  function openHelp() {
    MC.sound.click();
    MC.modal('Cómo funciona',
      '<p><strong>Bubba Games</strong> es un casino de práctica: las fichas son virtuales y no se ' +
      'compran ni se cobran.</p>' +
      '<p>Los ' + MCCatalog.size + ' juegos son ficticios y se generan en tu propia máquina. Cada ' +
      'tragamonedas tiene símbolos, pesos y tabla de pagos propios, y el <strong>RTP que ves está ' +
      'calculado sobre esa tabla real</strong>, no es un cartel decorativo.</p>' +
      '<p>Los resultados salen del generador aleatorio del navegador, sin trampas ni rachas programadas.</p>' +
      '<p>Tu saldo, tus estadísticas y tu historial viven en el almacenamiento local de este navegador.</p>' +
      '<p style="color:var(--red)"><strong>+18.</strong> Si el juego con dinero real te genera problemas, ' +
      'buscá ayuda profesional.</p>',
      [{ label: 'Entendido', kind: 'primary' }]);
  }

  /* ---------------- bienvenida ---------------- */
  function welcomeIfFirstTime() {
    if (localStorage.getItem(WELCOME_KEY)) return;
    localStorage.setItem(WELCOME_KEY, '1');

    MC.modal('Bienvenido a Bubba',
      '<p>Arrancás con <strong style="color:var(--gold)">' + MC.fmt(MC.STARTING_CHIPS) +
      ' fichas virtuales</strong>.</p>' +
      '<p>Hay <strong>' + MCCatalog.size + ' juegos</strong> abiertos: Crash, Mines, Ruleta, Blackjack ' +
      'y todo el salón de tragamonedas. Si te quedás corto, el bono te recarga.</p>' +
      '<p style="font-size:12.5px">Es un juego: no se apuesta ni se gana dinero real.</p>',
      [{ label: 'Entrar al salón', kind: 'primary' }]);
  }

  return {
    openAccount: openAccount,
    openHelp: openHelp,
    welcomeIfFirstTime: welcomeIfFirstTime
  };
})();
