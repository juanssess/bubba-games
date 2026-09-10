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
  var activeTab = 'matches';

  function tickets() {
    if (!MC.state.sports.tickets) MC.state.sports.tickets = [];
    return MC.state.sports.tickets;
  }

  function crest(team) {
    return '<i class="sp-crest" style="--tc:' + team.color + ';--tc2:' + team.color2 + '">' +
      team.code + '</i>';
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
    if (MCLeague.seasonComplete()) {
      MC.modal('¿Comenzar una nueva temporada?',
        '<p>La tabla y los resultados de la temporada terminada volverán a cero.</p>',
        [
          { label: 'Cancelar' },
          { label: 'Nueva temporada', kind: 'primary', onClick: function () {
            MCLeague.newSeason();
            slip = [];
            activeTab = 'matches';
            renderAll();
          } }
        ]);
      return;
    }

    var round = MCLeague.currentRound();
    var pendientes = tickets().filter(function (t) { return t.round === round; }).length;
    MC.modal('Jugar la jornada ' + round,
      '<p>Se simulan los 8 partidos y se liquidan ' + pendientes +
      (pendientes === 1 ? ' cupón pendiente.' : ' cupones pendientes.') + '</p>' +
      '<p>Una vez jugada, la fecha no se puede repetir.</p>',
      [
        { label: 'Cancelar' },
        { label: 'Jugar ahora', kind: 'primary', onClick: resolverJornada }
      ]);
  }

  function resolverJornada() {
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

    activeTab = 'results';
    renderAll();
  }

  /* ---------------- pintado ---------------- */
  function renderMatches() {
    var round = MCLeague.currentRound();
    var completa = MCLeague.seasonComplete();
    var visibleRound = Math.min(round, MCLeague.TOTAL_ROUNDS);
    el.round.textContent = visibleRound;
    el.heroRound.textContent = visibleRound;
    el.simulate.textContent = completa ? 'Nueva temporada' : 'Jugar jornada';

    var picked = {};
    slip.forEach(function (s) { picked[s.matchId] = s.pick; });

    if (completa) {
      el.matches.innerHTML = '<div class="sp-empty"><span>🏆</span><strong>Temporada finalizada</strong>' +
        '<p>Revisá la clasificación final o comenzá una nueva temporada.</p></div>';
      return;
    }

    el.matches.innerHTML = MCLeague.fixture(round).map(function (m, matchIndex) {
      var o = MCLeague.odds(m);
      var h = MCTeams.get(m.home);
      var a = MCTeams.get(m.away);

      function odd(pick, extraClass) {
        var on = picked[m.id] === pick ? ' active' : '';
        var label = PICKS[pick].long(m) + ', cuota ' + o[pick].toFixed(2);
        return '<button class="sp-odd' + on + (extraClass || '') + '" data-m="' + m.id +
          '" data-p="' + pick + '" aria-pressed="' + (on ? 'true' : 'false') +
          '" aria-label="' + label + '">' +
                 '<b>' + PICKS[pick].short + '</b><span>' + o[pick].toFixed(2) + '</span>' +
               '</button>';
      }

      return '<article class="sp-match">' +
               '<div class="sp-match-info">' +
                 '<span class="sp-kickoff">' + horaPartido(matchIndex) + ' · Prepartido</span>' +
                 '<span class="sp-team">' + crest(h) + '<strong>' + h.name + '</strong></span>' +
                 '<span class="sp-team">' + crest(a) + '<strong>' + a.name + '</strong></span>' +
               '</div>' +
               '<div class="sp-markets">' +
                 '<div class="sp-group"><span class="sp-glabel">Ganador</span><div>' +
                   odd('home') + odd('draw') + odd('away') + '</div></div>' +
                 '<div class="sp-group"><span class="sp-glabel">Total 2.5</span><div>' +
                   odd('over') + odd('under') + '</div></div>' +
                 '<div class="sp-group"><span class="sp-glabel">Ambos marcan</span><div>' +
                   odd('btts') + odd('nobtts') + '</div></div>' +
               '</div>' +
             '</article>';
    }).join('');
  }

  function horaPartido(index) {
    var minutos = 18 * 60 + index * 35;
    var h = Math.floor(minutos / 60);
    var m = minutos % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function renderSlip() {
    el.slipCount.textContent = slip.length;
    if (!slip.length) {
      el.slip.innerHTML = '<div class="sp-slip-empty"><span>＋</span><strong>Tu cupón está vacío</strong>' +
        '<p>Elegí una cuota de los partidos para empezar.</p></div>';
      el.summary.innerHTML = '';
      el.place.disabled = true;
      el.clear.disabled = true;
      return;
    }

    el.slip.innerHTML = slip.map(function (s) {
      return '<div class="slip-item" data-m="' + s.matchId + '">' +
               '<div><span class="slip-league">Liga Bubba</span><strong>' + s.label + '</strong>' +
                 '<span>' + s.match + '</span></div>' +
               '<b>' + s.odds.toFixed(2) + '</b>' +
               '<button class="slip-remove" aria-label="Quitar ' + s.label + '">×</button>' +
             '</div>';
    }).join('');

    var stake = Math.floor(parseFloat(el.stake.value) || 0);
    var odds = combinedOdds();

    el.summary.innerHTML =
      '<div><span>' + (slip.length > 1 ? 'Combinada de ' + slip.length : 'Cuota') + '</span>' +
        '<strong>' + odds.toFixed(2) + '</strong></div>' +
      '<div><span>Retorno potencial</span>' +
        '<strong class="sp-return">' + MC.fmt(Math.floor(stake * odds)) + '</strong></div>' +
      '<div><span>Ganancia neta</span>' +
        '<strong>' + MC.fmt(Math.max(0, Math.floor(stake * odds) - stake)) + '</strong></div>';

    el.place.disabled = stake < MIN_STAKE;
    el.clear.disabled = false;
  }

  function renderTickets() {
    var list = tickets();
    if (!list.length) {
      el.tickets.innerHTML = '';
      return;
    }
    el.tickets.innerHTML = '<div class="sp-ticket-head"><span>Abiertas</span><b>' + list.length + '</b></div>' +
      list.map(function (t) {
        return '<div class="sp-ticket">' +
                 '<div class="sp-ticket-top"><span>Ticket #' + String(t.id).slice(-6) + '</span><em>Pendiente</em></div>' +
                 '<strong>' + (t.selections.length > 1 ? 'Combinada · ' + t.selections.length + ' selecciones' : t.selections[0].label) + '</strong>' +
                 '<span>Jornada ' + t.round + ' · Cuota ' + t.odds.toFixed(2) + '</span>' +
                 '<div class="sp-ticket-money"><span>Apuesta <b>' + MC.fmt(t.stake) + '</b></span>' +
                   '<span>Retorno <b>' + MC.fmt(Math.floor(t.stake * t.odds)) + '</b></span></div>' +
               '</div>';
      }).join('');
  }

  function renderResults() {
    var res = MC.state.sports.results || [];
    el.resultCount.textContent = res.length;
    if (!res.length) {
      el.results.innerHTML = '<div class="sp-empty"><span>⚽</span><strong>Todavía no hay resultados</strong>' +
        '<p>Jugá la primera jornada para inaugurar la temporada.</p></div>';
      return;
    }
    el.results.innerHTML = '<div class="sp-results">' + res.map(function (r) {
        var h = MCTeams.get(r.home), a = MCTeams.get(r.away);
        return '<div class="sp-result">' +
                 '<small>Final</small>' +
                 '<span>' + crest(h) + h.name + '</span>' +
                 '<b>' + r.gh + '<em>–</em>' + r.ga + '</b>' +
                 '<span>' + a.name + crest(a) + '</span>' +
               '</div>';
      }).join('') + '</div>';
  }

  function renderTable() {
    var rows = MCLeague.table();
    el.table.innerHTML = '<div class="sp-table-wrap"><table class="sp-table"><thead><tr>' +
        '<th>Pos</th><th>Club</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr class="' + (i < 4 ? 'sp-zone' : '') + '">' +
                 '<td><b>' + (i + 1) + '</b></td>' +
                 '<td class="sp-tname">' + crest(r.team) + '<strong>' + r.team.name + '</strong></td>' +
                 '<td>' + r.pj + '</td><td>' + r.g + '</td><td>' + r.e + '</td><td>' + r.p + '</td>' +
                 '<td>' + r.gf + '</td><td>' + r.gc + '</td>' +
                 '<td>' + (r.dg > 0 ? '+' : '') + r.dg + '</td>' +
                 '<td><strong>' + r.pts + '</strong></td>' +
               '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderTabs() {
    document.querySelectorAll('[data-sp-tab]').forEach(function (b) {
      var on = b.dataset.spTab === activeTab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('[data-sp-section]').forEach(function (s) {
      var on = s.dataset.spSection === activeTab;
      s.classList.toggle('active', on);
      s.hidden = !on;
    });
  }

  function renderAll() {
    renderMatches();
    renderSlip();
    renderTickets();
    renderResults();
    renderTable();
    renderTabs();
  }

  /* ---------------- ciclo de vida ---------------- */
  function load() { renderAll(); }

  function init() {
    el.round = document.getElementById('spRound');
    el.heroRound = document.getElementById('spHeroRound');
    el.resultCount = document.getElementById('spResultCount');
    el.slipCount = document.getElementById('spSlipCount');
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
    el.quick = document.getElementById('spQuick');

    el.matches.onclick = function (e) {
      var b = e.target.closest('.sp-odd');
      if (b) toggle(b.dataset.m, b.dataset.p);
    };
    el.slip.onclick = function (e) {
      var item = e.target.closest('.slip-remove') && e.target.closest('.slip-item');
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
    el.quick.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      el.stake.value = b.dataset.value === 'max' ? MC.getBalance() : b.dataset.value;
      MC.sound.click();
      renderSlip();
    };
    var tabs = document.querySelector('.sp-tabs');
    tabs.onclick = function (e) {
      var b = e.target.closest('[data-sp-tab]');
      if (!b) return;
      activeTab = b.dataset.spTab;
      MC.sound.click();
      renderTabs();
    };
    tabs.onkeydown = function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var botones = Array.prototype.slice.call(tabs.querySelectorAll('[data-sp-tab]'));
      var actual = botones.indexOf(document.activeElement);
      if (actual < 0) return;
      e.preventDefault();
      var siguiente = (actual + (e.key === 'ArrowRight' ? 1 : -1) + botones.length) % botones.length;
      activeTab = botones[siguiente].dataset.spTab;
      renderTabs();
      botones[siguiente].focus();
    };

    MC.registerEngine('sportsbook', { load: load });
  }

  return { init: init };
})();
