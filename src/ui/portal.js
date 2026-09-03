/* ============================================================
   UI / PORTAL — historial de jugadas y bote del lobby.

   Regla de la casa: acá no se inventan datos. La tabla muestra
   TUS rondas reales, y el bote crece con lo que vos apostaste.
   Nada de ganadores falsos ni contadores de jugadores online.

   La billetera llama a estos métodos al cerrar cada ronda.
   ============================================================ */
window.MCPortal = (function () {
  'use strict';

  var JACKPOT_BASE = 250000;
  var JACKPOT_SHARE = 0.5;   // parte de lo apostado que engorda el bote

  function renderHistory() {
    var wrap = document.getElementById('winsTable');
    var rows = MC.state.history || [];

    if (!rows.length) {
      wrap.innerHTML = '<p class="empty-msg">Todavía no jugaste nada. Elegí una mesa y arrancá.</p>';
      return;
    }

    wrap.innerHTML = rows.map(function (r) {
      var g = MCCatalog.games[r.game] || { emoji: '🎲', name: r.game };
      var up = r.net >= 0;
      return '<div class="win-row">' +
               '<span class="wr-game">' + g.emoji + ' ' + g.name + '</span>' +
               '<span class="wr-dim wr-hide-sm">' + (r.detail || '—') + '</span>' +
               '<span class="wr-dim">apuesta ' + MC.fmt(r.staked) + '</span>' +
               '<span class="wr-net ' + (up ? 'up' : 'down') + '">' +
                 (up ? '+' : '') + MC.fmt(r.net) +
               '</span>' +
             '</div>';
    }).join('');
  }

  function renderJackpot() {
    var el = document.getElementById('jackpotTicker');
    if (!el) return;
    // El pozo lo lleva MCBote, que además es quien lo sortea y lo paga.
    // Antes este número se calculaba acá aparte y no lo podía ganar nadie.
    el.textContent = MC.fmt(window.MCBote ? MCBote.pozo() : 0);

    var odds = document.getElementById('jackpotOdds');
    if (odds && window.MCBote) {
      var enCuantas = MCBote.unoEnCuantas(1000);
      odds.textContent = 'apostando 1.000 · 1 en ' + MC.fmt(enCuantas);
    }
  }

  return { renderHistory: renderHistory, renderJackpot: renderJackpot };
})();
