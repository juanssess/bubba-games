/* ============================================================
   MOTOR / CASA DE APUESTAS — Liga Bubba

   Un motor más del router, como slots o crash: se abre desde el
   catálogo y liquida por la misma billetera.

   Reglas de la casa:
   - Una sola selección por partido en un mismo cupón (dos mercados
     del mismo partido están correlacionados y romperían la cuota).
   - En combinada tienen que entrar todas: gana todo o no gana nada.
   - Los cupones quedan pendientes hasta que se simula la jornada,
     y sobreviven a un F5.

   Depende de: MCLeague, MCTeams, MCPoisson, MC (billetera/router).
   ============================================================ */
window.MCSportsbook = (function () {
  'use strict';

  var MIN_STAKE = 10;
  var MAX_LEGS = 8;

  // pick → etiqueta corta (botón) y larga (cupón)
  var PICKS = {
    home:   { short: '1',    long: function (m) { return MCTeams.get(m.home).name + ' gana'; } },
    draw:   { short: 'X',    long: function () { return 'Empate'; } },
    away:   { short: '2',    long: function (m) { return MCTeams.get(m.away).name + ' gana'; } },
    over:   { short: '+2.5', long: function () { return 'Más de 2.5 goles'; } },
    under:  { short: '−2.5', long: function () { return 'Menos de 2.5 goles'; } },
    btts:   { short: 'Sí',   long: function () { return 'Ambos marcan'; } },
    nobtts: { short: 'No',   long: function () { return 'No marcan ambos'; } }
  };

  var slip = [];      // selecciones aún no confirmadas
  var el = {};

  function tickets() {
    if (!MC.state.sports.tickets) MC.state.sports.tickets = [];
    return MC.state.sports.tickets;
  }

  /* ---------------- cupón ---------------- */
  function combinedOdds() {
    return slip.reduce(function (acc, s) { return acc * s.odds; }, 1);
  }

  function toggle(matchId, pick) {
    var match = MCLeague.fixture(MCLeague.currentRound()).filter(function (m) {
      return m.id === matchId;
    })[0];
    if (!match) return;

    var existing = slip.filter(function (s) { return s.matchId === matchId; })[0];
    // Volver a tocar la misma opción la saca del cupón.
    if (existing && existing.pick === pick) {
      slip = slip.filter(function (s) { return s.matchId !== matchId; });
      MC.sound.click();
      renderSlip();
      renderMatches();
      return;
    }
    if (!existing && slip.length >= MAX_LEGS) {
      MC.toast('Máximo ' + MAX_LEGS + ' partidos por cupón.', 'lose');
      return;
    }

    // Una sola selección por partido: la nueva reemplaza a la anterior.
    slip = slip.filter(function (s) { return s.matchId !== matchId; });
    slip.push({
      matchId: matchId,
      pick: pick,
      odds: MCLeague.odds(match)[pick],
      label: PICKS[pick].long(match),
      match: MCTeams.get(match.home).name + ' vs ' + MCTeams.get(match.away).name
    });

    MC.sound.chip();
    renderSlip();
    renderMatches();
  }

  function place() {
    if (!slip.length) return;
    var stake = Math.floor(parseFloat(el.stake.value) || 0);

    if (stake < MIN_STAKE) { MC.toast('La apuesta mínima es ' + MIN_STAKE + ' fichas.', 'lose'); return; }
    if (!MC.canBet(stake)) { MC.toast('No te alcanzan las fichas.', 'lose'); return; }

    MC.addBalance(-stake);
    tickets().push({
      id: 'tk' + Date.now(),
      round: MCLeague.currentRound(),
      stake: stake,
      odds: Math.round(combinedOdds() * 100) / 100,
      selections: slip.slice()
    });
    MC.save();

    slip = [];
    MC.sound.chip();
    MC.toast('Cupón confirmado por ' + MC.fmt(stake) + ' fichas', 'win');
    renderAll();
  }

  function clearSlip() {
    if (!slip.length) return;
    slip = [];
    MC.sound.click();
    renderSlip();
    renderMatches();
  }

  /* ---------------- jornada ---------------- */
  function simulateRound() {
    var round = MCLeague.currentRound();
    var results = MCLeague.simulate(round);

    var byId = {};
    results.forEach(function (r) { byId[r.id] = r; });

    // Se liquidan todos los cupones pendientes de esta jornada.
    var pending = tickets().filter(function (t) { return t.round === round; });
    var won = 0;

    pending.forEach(function (t) {
      var acierta = t.selections.every(function (s) {
        var res = byId[s.matchId];
        return res && MCLeague.isWinner(s.pick, res);
      });
      var payout = acierta ? Math.floor(t.stake * t.odds) : 0;
      if (payout > 0) { MC.addBalance(payout); won++; }

      var detalle = (t.selections.length > 1 ? 'combinada de ' + t.selections.length : t.selections[0].label) +
                    ' · cuota ' + t.odds.toFixed(2);
      MC.recordRound(t.stake, payout, detalle);
    });

    MC.state.sports.tickets = tickets().filter(function (t) { return t.round !== round; });
    MCLeague.applyResults(results);

    if (pending.length) {
      if (won) { MC.sound.win(); MC.toast('Acertaste ' + won + ' de ' + pending.length + ' cupones', 'win'); }
      else { MC.sound.lose(); MC.toast('Ningún cupón entró esta jornada', 'lose'); }
    } else {
      MC.sound.click();
    }

    renderAll();
  }

  /* ---------------- pintado ---------------- */
  function renderMatches() {
    var round = MCLeague.currentRound();
    el.round.textContent = round;

    var picked = {};
    slip.forEach(function (s) { picked[s.matchId] = s.pick; });

    el.matches.innerHTML = MCLeague.fixture(round).map(function (m) {
      var o = MCLeague.odds(m);
      var h = MCTeams.get(m.home);
      var a = MCTeams.get(m.away);

      function odd(pick, extraClass) {
        var on = picked[m.id] === pick ? ' active' : '';
        return '<button class="sp-odd' + on + (extraClass || '') + '" data-m="' + m.id + '" data-p="' + pick + '">' +
                 '<b>' + PICKS[pick].short + '</b><span>' + o[pick].toFixed(2) + '</span>' +
               '</button>';
      }

      return '<article class="sp-match">' +
               '<div class="sp-teams">' +
                 '<span class="sp-team">' + h.badge + ' ' + h.name + '</span>' +
                 '<span class="sp-vs">vs</span>' +
                 '<span class="sp-team">' + a.badge + ' ' + a.name + '</span>' +
               '</div>' +
               '<div class="sp-markets">' +
                 '<div class="sp-group"><span class="sp-glabel">Ganador</span>' +
                   odd('home') + odd('draw') + odd('away') + '</div>' +
                 '<div class="sp-group"><span class="sp-glabel">Goles</span>' +
                   odd('over') + odd('under') + '</div>' +
                 '<div class="sp-group"><span class="sp-glabel">Ambos marcan</span>' +
                   odd('btts') + odd('nobtts') + '</div>' +
               '</div>' +
             '</article>';
    }).join('');
  }

  function renderSlip() {
    if (!slip.length) {
      el.slip.innerHTML = '<p class="empty-msg">Tocá una cuota para armar tu cupón.</p>';
      el.summary.innerHTML = '';
      el.place.disabled = true;
      return;
    }

    el.slip.innerHTML = slip.map(function (s) {
      return '<div class="slip-item" data-m="' + s.matchId + '">' +
               '<div><strong>' + s.label + '</strong><span>' + s.match + '</span></div>' +
               '<b>' + s.odds.toFixed(2) + '</b>' +
             '</div>';
    }).join('');

    var stake = Math.floor(parseFloat(el.stake.value) || 0);
    var odds = combinedOdds();

    el.summary.innerHTML =
      '<div><span>' + (slip.length > 1 ? 'Combinada de ' + slip.length : 'Cuota') + '</span>' +
        '<strong>' + odds.toFixed(2) + '</strong></div>' +
      '<div><span>Ganancia posible</span>' +
        '<strong style="color:var(--green)">' + MC.fmt(Math.floor(stake * odds)) + '</strong></div>';

    el.place.disabled = false;
  }

  function renderTickets() {
    var list = tickets();
    if (!list.length) {
      el.tickets.innerHTML = '';
      return;
    }
    el.tickets.innerHTML = '<h4 class="sp-subtitle">Cupones pendientes</h4>' +
      list.map(function (t) {
        return '<div class="sp-ticket">' +
                 '<div><strong>' + (t.selections.length > 1 ? 'Combinada x' + t.selections.length : t.selections[0].label) + '</strong>' +
                   '<span>jornada ' + t.round + ' · cuota ' + t.odds.toFixed(2) + '</span></div>' +
                 '<b>' + MC.fmt(t.stake) + '</b>' +
               '</div>';
      }).join('');
  }

  function renderResults() {
    var res = MC.state.sports.results || [];
    if (!res.length) {
      el.results.innerHTML = '';
      return;
    }
    el.results.innerHTML = '<h4 class="sp-subtitle">Última jornada</h4>' +
      '<div class="sp-results">' + res.map(function (r) {
        var h = MCTeams.get(r.home), a = MCTeams.get(r.away);
        return '<div class="sp-result">' +
                 '<span>' + h.badge + ' ' + h.name + '</span>' +
                 '<b>' + r.gh + ' - ' + r.ga + '</b>' +
                 '<span>' + a.name + ' ' + a.badge + '</span>' +
               '</div>';
      }).join('') + '</div>';
  }

  function renderTable() {
    var rows = MCLeague.table();
    var jugadas = rows.reduce(function (s, r) { return s + r.pj; }, 0);
    if (!jugadas) {
      el.table.innerHTML = '<h4 class="sp-subtitle">Tabla de posiciones</h4>' +
        '<p class="empty-msg">La liga todavía no arrancó. Simulá la primera jornada.</p>';
      return;
    }

    el.table.innerHTML = '<h4 class="sp-subtitle">Tabla de posiciones</h4>' +
      '<table class="sp-table"><thead><tr>' +
        '<th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr>' +
                 '<td>' + (i + 1) + '</td>' +
                 '<td class="sp-tname">' + r.team.badge + ' ' + r.team.name + '</td>' +
                 '<td>' + r.pj + '</td><td>' + r.g + '</td><td>' + r.e + '</td><td>' + r.p + '</td>' +
                 '<td>' + (r.dg > 0 ? '+' : '') + r.dg + '</td>' +
                 '<td><strong>' + r.pts + '</strong></td>' +
               '</tr>';
      }).join('') + '</tbody></table>';
  }

  function renderAll() {
    renderMatches();
    renderSlip();
    renderTickets();
    renderResults();
    renderTable();
  }

  /* ---------------- ciclo de vida ---------------- */
  function load() { renderAll(); }

  function init() {
    el.round = document.getElementById('spRound');
    el.matches = document.getElementById('spMatches');
    el.slip = document.getElementById('spSlip');
    el.summary = document.getElementById('spSummary');
    el.stake = document.getElementById('spStake');
    el.place = document.getElementById('spPlace');
    el.clear = document.getElementById('spClear');
    el.simulate = document.getElementById('spSimulate');
    el.tickets = document.getElementById('spTickets');
    el.results = document.getElementById('spResults');
    el.table = document.getElementById('spTable');

    el.matches.onclick = function (e) {
      var b = e.target.closest('.sp-odd');
      if (b) toggle(b.dataset.m, b.dataset.p);
    };
    el.slip.onclick = function (e) {
      var item = e.target.closest('.slip-item');
      if (!item) return;
      slip = slip.filter(function (s) { return s.matchId !== item.dataset.m; });
      MC.sound.click();
      renderSlip();
      renderMatches();
    };
    el.stake.oninput = renderSlip;
    el.place.onclick = place;
    el.clear.onclick = clearSlip;
    el.simulate.onclick = simulateRound;

    MC.registerEngine('sportsbook', { load: load });
  }

  return { init: init };
})();
