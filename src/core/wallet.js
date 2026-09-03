/* ============================================================
   CORE / BILLETERA — saldo, apuestas, cierre de ronda y bono.
   Ningún juego toca MC.state.balance directamente: todo pasa
   por acá, y por eso el saldo en pantalla nunca se desincroniza.
   Depende de: state, format, ui, audio.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var BONUS_AMOUNT = 2500;
  var BONUS_COOLDOWN_MS = 8 * 60 * 60 * 1000;   // 8 horas
  var BROKE_THRESHOLD = 100;                     // debajo de esto, la casa rescata
  var HISTORY_LEN = 14;

  /* ---------------- saldo ---------------- */
  function getBalance() { return MC.state.balance; }

  function canBet(amount) {
    if (!(amount > 0) || MC.state.balance < amount) return false;

    // El límite de juego responsable se consulta acá, en el único lugar por
    // el que pasan TODAS las apuestas. Si viviera en cada juego, el primero
    // que se agregue mañana se olvidaría de respetarlo.
    if (window.MCAjustes) {
      var motivo = MCAjustes.bloqueaApuesta(amount);
      if (motivo) {
        MC.toast(motivo, 'lose');
        return false;
      }
    }
    return true;
  }

  // delta negativo = apuesta, positivo = pago
  function addBalance(delta) {
    MC.state.balance = Math.max(0, Math.round(MC.state.balance + delta));
    MC.save();
    renderBalance(true);
    return MC.state.balance;
  }

  /* ---------------- cierre de ronda ---------------- */
  // Alimenta estadísticas e historial. `detail` es el texto que se ve
  // en la tabla del lobby ("tres campanas", "salió el 17", ...).
  function recordRound(staked, returned, detail) {
    var net = returned - staked;
    var s = MC.state.stats;
    var gameId = MC.getCurrentGame() || 'casino';

    s.plays += 1;
    s.wagered += staked;
    s.net += net;
    if (net > s.best) s.best = net;

    var entry = {
      game: gameId,
      staked: staked,
      returned: returned,
      net: net,
      detail: detail || '',
      at: Date.now()
    };
    MC.state.history.unshift(entry);
    MC.state.history = MC.state.history.slice(0, HISTORY_LEN);

    MC.save();
    renderStats();
    if (window.MCPortal && MCPortal.renderHistory) MCPortal.renderHistory();

    // Punto único donde se enganchan XP y misiones: por eso ningún
    // juego tuvo que enterarse de que existe la progresión.
    var meta = MC.getGame(gameId);
    var round = {
      game: gameId,
      engine: meta ? meta.engine : 'casino',
      staked: staked,
      returned: returned,
      net: net,
      mult: staked > 0 ? returned / staked : 0
    };
    if (window.MCLevels) MCLevels.addXP(staked);
    if (window.MCMissions) MCMissions.track(round);
  }

  /* ---------------- pintado ---------------- */
  function renderBalance(bump) {
    var box = document.getElementById('walletBox');
    var val = document.getElementById('balanceValue');
    if (!val) return;

    val.textContent = MC.fmt(MC.state.balance);
    if (bump && box) {
      box.classList.remove('bump');
      void box.offsetWidth;   // reinicia la animación
      box.classList.add('bump');
    }
    refreshBonusButton();
  }

  function renderStats() {
    if (window.MCPortal && MCPortal.renderJackpot) MCPortal.renderJackpot();
  }

  /* ---------------- bono ---------------- */
  function bonusReadyIn() {
    var elapsed = Date.now() - (MC.state.lastBonusAt || 0);
    return Math.max(0, BONUS_COOLDOWN_MS - elapsed);
  }

  function claimBonus() {
    // Si se quedó sin fichas, la casa siempre lo rescata: es un juego, no un banco.
    var broke = MC.state.balance < BROKE_THRESHOLD;
    if (bonusReadyIn() > 0 && !broke) {
      MC.toast('El bono vuelve en ' + MC.humanTime(bonusReadyIn()), 'info');
      return false;
    }

    // El rango VIP agranda el bono: ese es el perk concreto de subir.
    var mult = window.MCLevels ? MCLevels.bonusMultiplier() : 1;
    var amount = Math.round((broke ? Math.max(BONUS_AMOUNT, 1000) : BONUS_AMOUNT) * mult);
    if (!broke) MC.state.lastBonusAt = Date.now();

    addBalance(amount);
    MC.sound.win();
    MC.toast('Bono acreditado: +' + MC.fmt(amount) + ' fichas' +
             (mult > 1 ? ' (rango x' + mult.toFixed(2) + ')' : ''), 'win');
    return true;
  }

  function refreshBonusButton() {
    var badge = document.getElementById('sbBonusBadge');
    if (!badge) return;
    var ready = bonusReadyIn() === 0 || MC.state.balance < BROKE_THRESHOLD;
    badge.classList.toggle('off', !ready);
  }

  MC.getBalance = getBalance;
  MC.canBet = canBet;
  MC.addBalance = addBalance;
  MC.recordRound = recordRound;
  MC.renderBalance = renderBalance;
  MC.renderStats = renderStats;
  MC.BONUS_AMOUNT = BONUS_AMOUNT;
  MC.claimBonus = claimBonus;
  MC.bonusReadyIn = bonusReadyIn;
  MC.refreshBonusButton = refreshBonusButton;
})(window.MC);
