/* ============================================================
   MOTOR / CASA DE APUESTAS — Liga Bubba

   Un motor más del router, como slots o crash: se abre desde el
   catálogo y liquida por la misma billetera.

   Reglas de la casa:
   - Una sola selección por partido en un mismo cupón (dos mercados
     del mismo partido están correlacionados y romperían la cuota).
   - En combinada tienen que entrar todas: gana todo o no gana nada.
   - Los cupones quedan pendientes hasta recibir resultados oficiales,
     y sobreviven a un F5.

   Depende de: MCLeague, MCTeams, MCPoisson, MC (billetera/router).
   ============================================================ */
window.MCSportsbook = (function () {
  'use strict';

  var MIN_STAKE = 10;
  var MAX_LEGS = 8;

  var PICKS = MCMarkets.PICKS;

  var slip = [];      // selecciones aún no confirmadas
  var el = {};
  var activeTab = 'matches';
  var dailyResults = {};
  var expanded = null, category = 'main', historyFilter = 'all';

  function escape(t) {
    return String(t || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fixture() {
    var daily = MCFootball.status();
    var list = daily.matches.concat(daily.upcoming), ids = {};
    list.forEach(function (m) { ids[m.id] = true; });
    return list.concat(MCLeague.fixture().filter(function (m) { return !ids[m.id]; })).filter(function (m) {
      return !MCFootball.finished(m) && !MCFootball.cancelled(m);
    }).sort(function (a, b) { return new Date(a.date || '9999-01-01') - new Date(b.date || '9999-01-01'); });
  }
  function odds(m) { return MCMarkets.odds(m); }
  function marketOpen(m) { return MCFootball.marketOpen(m); }
  async function updateResults() {
    var owner = MC.auth.current().uid;
    var state = MC.state;
    var results = await MCFootball.ticketResults(tickets());
    if (MC.auth.current().uid !== owner || MC.state !== state) return;
    dailyResults = results;
    settleTickets(); renderAll();
  }

  function tickets() {
    if (!MC.state.sports.tickets) MC.state.sports.tickets = [];
    return MC.state.sports.tickets;
  }

  function refundLegacyTickets() {
    var old = tickets().filter(function (t) {
      return t.selections && t.selections.some(function (s) { return /^r\d+m\d+$/.test(String(s.matchId)); });
    });
    if (!old.length) return;
    var refund = old.reduce(function (sum, t) { return sum + (Number(t.stake) || 0); }, 0);
    MC.state.sports.tickets = tickets().filter(function (t) { return old.indexOf(t) < 0; });
    if (refund) MC.addBalance(refund);
    MC.save();
    MC.toast('Se devolvieron ' + MC.fmt(refund) + ' fichas de la liga anterior', 'info');
  }

  function crest(team) {
    if (team && team.logo) {
      return '<img class="sp-crest sp-crest-real" src="' + escape(MCFootball.image(team.logo)) + '" alt="" loading="lazy">';
    }
    return '<i class="sp-crest" style="--tc:' + team.color + ';--tc2:' + team.color2 + '">' +
      team.code + '</i>';
  }

  /* ---------------- cupón ---------------- */
  function combinedOdds() {
    return Math.round(slip.reduce(function (acc, s) { return acc * s.odds; }, 1) * 100) / 100;
  }

  function toggle(matchId, pick) {
    if (!PICKS[pick]) return false;
    var match = fixture().filter(function (m) {
      return m.id === matchId;
    })[0];
    if (!match) return false;
    if (!marketOpen(match)) {
      MC.toast('Este partido ya comenzó y el mercado está cerrado.', 'lose');
      return false;
    }

    var quote = odds(match)[pick];
    if (!Number.isFinite(quote) || quote < 1.01) return false;
    var existing = slip.filter(function (s) { return s.matchId === matchId; })[0];
    // Volver a tocar la misma opción la saca del cupón.
    if (existing && existing.pick === pick) {
      slip = slip.filter(function (s) { return s.matchId !== matchId; });
      MC.sound.click();
      renderSlip();
      renderMatches();
      return true;
    }
    if (!existing && slip.length >= MAX_LEGS) {
      MC.toast('Máximo ' + MAX_LEGS + ' partidos por cupón.', 'lose');
      return false;
    }

    // Una sola selección por partido: la nueva reemplaza a la anterior.
    slip = slip.filter(function (s) { return s.matchId !== matchId; });
    slip.push({
      matchId: matchId,
      pick: pick,
      odds: quote,
      market: PICKS[pick].group,
      date: match.date,
      source: match.source || 'argentina',
      leagueId: match.leagueId || '4406',
      league: match.league || 'Liga Profesional Argentina',
      label: PICKS[pick].long(match),
      match: MCTeams.get(match.home).name + ' vs ' + MCTeams.get(match.away).name
    });

    MC.sound.chip();
    renderSlip();
    renderMatches();
    return true;
  }

  function place() {
    if (!slip.length) return;
    var available = {};
    fixture().forEach(function (m) { if (marketOpen(m)) available[m.id] = m; });
    if (slip.some(function (s) { return !available[s.matchId] || s.date !== available[s.matchId].date; })) {
      slip = slip.filter(function (s) { return available[s.matchId] && s.date === available[s.matchId].date; });
      MC.toast('Se quitó un partido que ya comenzó.', 'lose');
      renderAll();
      return;
    }
    var stake = Math.floor(parseFloat(el.stake.value) || 0);

    if (!Number.isSafeInteger(stake) || stake < MIN_STAKE) { MC.toast('La apuesta mínima es ' + MIN_STAKE + ' fichas.', 'lose'); return; }
    if (!Number.isFinite(stake * combinedOdds()) || stake * combinedOdds() > 1000000000) {
      MC.toast('El retorno máximo por cupón es de 1.000 millones de fichas.', 'info'); return;
    }
    if (!MC.canBet(stake)) { MC.toast('No te alcanzan las fichas.', 'lose'); return; }

    MC.addBalance(-stake);
    tickets().push({
      id: 'tk' + Date.now(),
      placedAt: Date.now(),
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

  /* ---------------- actualización y liquidación real ---------------- */
  async function simulateRound() {
    el.simulate.disabled = true;
    el.simulate.textContent = 'Actualizando…';
    await Promise.all([MCLeague.refresh(true), MCFootball.refresh(true)]);
    await updateResults();
    MC.toast('Datos de futbol actualizados', 'info');
  }

  function settleTickets() {
    var byId = {};
    MCLeague.results().forEach(function (r) { byId[r.id] = r; });
    Object.keys(dailyResults).forEach(function (id) {
      if (MCFootball.finished(dailyResults[id])) byId[id] = dailyResults[id];
    });
    var open = [], settled = 0, won = 0;
    tickets().forEach(function (t) {
      var voided = t.selections.some(function (s) {
        var r = s.source === 'daily' && dailyResults[s.matchId];
        return r && ['CANC', 'CANCELLED', 'ABD', 'ABANDONED'].indexOf(r.status) !== -1;
      });
      if (voided) {
        MC.addBalance(t.stake);
        MC.recordRound(t.stake, t.stake, 'Cupon anulado: partido cancelado. Fichas devueltas.');
        archive(t, { status: 'refunded', odds: 1, payout: t.stake, reason: 'Partido cancelado' });
        settled++;
        return;
      }
      var complete = t.selections.every(function (s) { return !!byId[s.matchId]; });
      if (!complete) { open.push(t); return; }
      var result = MCMarkets.settle(t, byId);
      if (!result) { open.push(t); return; }
      var payout = result.payout;
      if (payout) { MC.addBalance(payout); won++; }
      var detail = (t.selections.length > 1 ? 'combinada de ' + t.selections.length : t.selections[0].label) +
        ' · cuota ' + result.odds.toFixed(2) + ' · resultado oficial' + (result.pushes ? ' · Empate no válido devuelto' : '');
      MC.recordRound(t.stake, payout, detail);
      archive(t, result);
      settled++;
    });
    if (!settled) return;
    MC.state.sports.tickets = open;
    MC.save();
    if (won) { MC.sound.win(); MC.toast('Se acreditaron ' + won + ' cupones ganadores', 'win'); }
    else { MC.sound.lose(); MC.toast('Se liquidaron ' + settled + ' cupones', 'lose'); }
  }

  function archive(ticket, result) {
    var history = MC.state.sports.settled || [];
    history.unshift(Object.assign({}, ticket, result, { settledAt: Date.now(), originalOdds: ticket.odds }));
    MC.state.sports.settled = history.slice(0, 50);
  }

  /* ---------------- pintado ---------------- */
  function renderMatches() {
    var focus = el.matches.contains(document.activeElement) ? document.activeElement : null;
    var focusData = focus ? Object.assign({}, focus.dataset) : {};
    var focusDetail = focus && !!focus.closest('.sp-details');
    var round = MCLeague.currentRound();
    var state = MCLeague.status();
    var matches = fixture();
    el.round.textContent = round;
    var competitions = {};
    matches.forEach(function (m) { competitions[m.leagueId || '4406'] = true; });
    el.heroRound.textContent = Object.keys(competitions).length;
    el.matchCount.textContent = matches.length;
    el.heroMatches.textContent = matches.length;
    el.simulate.disabled = state.loading || MCFootball.status().loading;
    el.simulate.textContent = el.simulate.disabled ? 'Actualizando…' : 'Actualizar datos';

    var search = el.search.value.trim().toLocaleLowerCase('es');
    var today = MCFootball.day();
    matches = matches.filter(function (m) {
      var names = (MCTeams.get(m.home).name + ' ' + MCTeams.get(m.away).name).toLocaleLowerCase('es');
      return (!search || names.indexOf(search) >= 0) &&
        (el.competition.value === 'all' || (m.leagueId || '4406') === el.competition.value) &&
        (el.when.value === 'all' || (m.date && (el.when.value === 'today' ? MCFootball.day(m.date) === today : MCFootball.day(m.date) > today))) &&
        (!el.openOnly.checked || marketOpen(m));
    });
    el.visibleCount.textContent = matches.length + ' partidos';

    var picked = {};
    slip.forEach(function (s) { picked[s.matchId] = s.pick; });

    if (!state.ready && !MCFootball.status().ready && !matches.length) {
      el.matches.innerHTML = '<div class="sp-empty"><span>⚽</span><strong>Consultando los partidos</strong>' +
        '<p>' + escape(MCFootball.status().error || state.error || 'Buscando el fixture oficial…') + '</p></div>';
      return;
    }
    if (!matches.length) {
      el.matches.innerHTML = '<div class="sp-empty"><strong>No hay partidos para estos filtros</strong></div>';
      return;
    }

    el.matches.innerHTML = matches.map(function (m) {
      var o = odds(m);
      var h = MCTeams.get(m.home);
      var a = MCTeams.get(m.away);

      function odd(pick, extraClass) {
        var on = picked[m.id] === pick ? ' active' : '';
        var quote = Number.isFinite(o[pick]) ? o[pick].toFixed(2) : '--';
        var label = escape(PICKS[pick].long(m) + ', cuota virtual ' + quote);
        return '<button class="sp-odd' + on + (extraClass || '') + '" data-m="' + m.id +
          '" data-p="' + pick + '" aria-pressed="' + (on ? 'true' : 'false') +
          '"' + (marketOpen(m) && Number.isFinite(o[pick]) ? '' : ' disabled') +
          ' aria-label="' + label + '">' +
                 '<b>' + PICKS[pick].short + '</b><span>' + quote + '</span>' +
               '</button>';
      }

      var detail = expanded === m.id;
      var categories = [['main', 'Principales'], ['goals', 'Goles'], ['handicap', 'Hándicap'], ['score', 'Resultado exacto'], ['combo', 'Combinados']];
      var more = detail ? '<div class="sp-details" id="spDetail-' + m.id + '">' +
        '<div class="sp-market-tabs" role="tablist" aria-label="Mercados del partido">' + categories.map(function (c) {
          return '<button role="tab" aria-selected="' + (category === c[0]) + '" tabindex="' + (category === c[0] ? '0' : '-1') +
            '" data-sp-category="' + c[0] + '" id="spCat-' + c[0] + '">' + c[1] + '</button>';
        }).join('') + '</div><div class="sp-market-panels" role="tabpanel" aria-labelledby="spCat-' + category + '">' +
        MCMarkets.GROUPS.filter(function (g) { return g.category === category; }).map(function (g) {
          return '<section class="sp-market-section"><h4>' + escape(g.title) + '</h4><div class="sp-options sp-options-' +
            (g.picks.length > 3 ? 'many' : g.picks.length) + '">' + g.picks.map(function (p) { return odd(p); }).join('') + '</div></section>';
        }).join('') + '</div></div>' : '<div id="spDetail-' + m.id + '" hidden></div>';
      return '<article class="sp-match"><div class="sp-match-row">' +
               '<div class="sp-match-info">' +
                 '<span class="sp-kickoff">' + escape(m.league || 'Liga Argentina') + ' · ' + horaPartido(m) +
                   (MCFootball.inPlay(m) ? ' · ' + escape(MCFootball.liveLabel(m)) + (m.gh !== null && m.ga !== null ? ' · ' + m.gh + ' - ' + m.ga : '') : '') +
                   (marketOpen(m) ? ' · Prepartido' : ' · Mercado cerrado') + '</span>' +
                 '<span class="sp-team">' + crest(h) + '<strong>' + escape(h.name) + '</strong></span>' +
                 '<span class="sp-team">' + crest(a) + '<strong>' + escape(a.name) + '</strong></span>' +
                 '<button class="sp-more" data-sp-more="' + m.id + '" aria-expanded="' + detail +
                   '" aria-controls="spDetail-' + m.id + '">' + (detail ? '− Cerrar mercados' : '+ Más mercados') + '</button>' +
               '</div>' +
               '<div class="sp-markets">' +
                 '<div class="sp-group"><span class="sp-glabel">Ganador</span><div>' +
                   odd('home') + odd('draw') + odd('away') + '</div></div>' +
                 '<div class="sp-group"><span class="sp-glabel">Total 2.5</span><div>' +
                   odd('over') + odd('under') + '</div></div>' +
                 '<div class="sp-group"><span class="sp-glabel">Ambos marcan</span><div>' +
                   odd('btts') + odd('nobtts') + '</div></div>' +
               '</div></div>' + more +
             '</article>';
    }).join('');
    if (focus) {
      var controls = Array.prototype.slice.call(el.matches.querySelectorAll('button'));
      var nextFocus = controls.filter(function (b) {
        if (focusData.spMore) return b.dataset.spMore === focusData.spMore;
        if (focusData.spCategory) return b.dataset.spCategory === focusData.spCategory;
        return b.dataset.m === focusData.m && b.dataset.p === focusData.p && !!b.closest('.sp-details') === focusDetail;
      })[0];
      if (nextFocus) nextFocus.focus({ preventScroll: true });
    }
  }

  function horaPartido(match) {
    if (!match.date) return 'Horario a confirmar';
    var d = new Date(match.date);
    return d.toLocaleDateString('es-AR', { timeZone: MCFootball.ZONE, weekday: 'short', day: '2-digit', month: '2-digit' }) +
      ' · ' + d.toLocaleTimeString('es-AR', { timeZone: MCFootball.ZONE, hour: '2-digit', minute: '2-digit' });
  }

  function renderSlip() {
    el.slipCount.textContent = slip.length;
    el.jumpCount.textContent = slip.length;
    el.jump.hidden = !slip.length;
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
               '<div><span class="slip-league">' + escape(s.league || 'Liga Profesional Argentina') + '</span><strong>' + escape(s.label) + '</strong>' +
                 '<span>' + escape(s.match) + '</span></div>' +
               '<b>' + s.odds.toFixed(2) + '</b>' +
               '<button class="slip-remove" aria-label="Quitar ' + escape(s.label) + '">×</button>' +
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
                 '<strong>' + escape(t.selections.length > 1 ? 'Combinada · ' + t.selections.length + ' selecciones' : t.selections[0].label) + '</strong>' +
                 '<span>' + (t.selections.some(function (s) { return s.source === 'daily'; }) ? 'Futbol' : 'Argentina, fecha ' + t.round) +
                   ' · Cuota ' + t.odds.toFixed(2) + '</span>' +
                 '<div class="sp-ticket-money"><span>Apuesta <b>' + MC.fmt(t.stake) + '</b></span>' +
                   '<span>Retorno <b>' + MC.fmt(Math.floor(t.stake * t.odds)) + '</b></span></div>' +
               '</div>';
      }).join('');
  }

  function renderHistory() {
    var list = tickets().map(function (t) { return Object.assign({}, t, { status: 'pending' }); })
      .concat(MC.state.sports.settled || []).filter(function (t) { return historyFilter === 'all' || t.status === historyFilter; });
    var labels = { pending: 'Pendiente', won: 'Ganada', lost: 'Perdida', refunded: 'Devuelta' };
    el.ticketCount.textContent = tickets().length;
    el.history.innerHTML = list.length ? list.map(function (t) {
      var date = t.settledAt || t.placedAt;
      return '<article class="sp-bet"><header><strong>Ticket #' + escape(String(t.id).slice(-6)) + '</strong>' +
        '<span class="sp-bet-status sp-bet-' + t.status + '">' + labels[t.status] + '</span></header>' +
        (date ? '<time>' + new Date(date).toLocaleString('es-AR', { timeZone: MCFootball.ZONE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</time>' : '') +
        '<ul>' + t.selections.map(function (s) { return '<li><strong>' + escape(s.label) + '</strong><span>' + escape(s.match) + ' · ' + s.odds.toFixed(2) + '</span></li>'; }).join('') + '</ul>' +
        '<footer><span>Apuesta <b>' + MC.fmt(t.stake) + '</b></span><span>Cuota <b>' + t.odds.toFixed(2) + '</b></span><span>' +
        (t.status === 'pending' ? 'Retorno potencial' : 'Pago') + ' <b>' + MC.fmt(t.status === 'pending' ? Math.floor(t.stake * t.odds) : t.payout) + '</b></span></footer>' +
        (t.pushes || t.reason ? '<p>' + escape(t.reason || 'Empate no válido: ' + t.pushes + ' selección devuelta a cuota 1.') + '</p>' : '') + '</article>';
    }).join('') : '<div class="sp-empty"><strong>No hay apuestas para este estado</strong></div>';
  }

  function renderResults() {
    var seen = {};
    var res = Object.keys(dailyResults).map(function (id) { return dailyResults[id]; })
      .concat(MCFootball.status().matches, MCLeague.results()).filter(MCFootball.finished).filter(function (m) {
        if (seen[m.id]) return false;
        seen[m.id] = true; return true;
      }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    el.resultCount.textContent = res.length;
    if (!res.length) {
      el.results.innerHTML = '<div class="sp-empty"><span>⚽</span><strong>Todavía no hay resultados</strong>' +
        '<p>Los marcadores oficiales aparecerán cuando finalicen los partidos.</p></div>';
      return;
    }
    el.results.innerHTML = '<div class="sp-results">' + res.map(function (r) {
        var h = MCTeams.get(r.home), a = MCTeams.get(r.away);
        return '<div class="sp-result">' +
                 '<small>Final · ' + escape(r.league || 'Liga Argentina') + '</small>' +
                 '<span>' + crest(h) + escape(h.name) + '</span>' +
                 '<b>' + r.gh + '<em>–</em>' + r.ga + '</b>' +
                 '<span>' + escape(a.name) + crest(a) + '</span>' +
               '</div>';
      }).join('') + '</div>';
  }

  function renderTable() {
    var rows = MCLeague.table();
    el.tableCount.textContent = rows.length;
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
    renderHistory();
    renderResults();
    renderTable();
    renderTabs();
  }

  /* ---------------- ciclo de vida ---------------- */
  function load() {
    dailyResults = {};
    refundLegacyTickets();
    renderAll();
    Promise.all([MCLeague.refresh(false), MCFootball.refresh(false)]).then(updateResults);
  }

  function init() {
    el.round = document.getElementById('spRound');
    el.heroRound = document.getElementById('spHeroRound');
    el.resultCount = document.getElementById('spResultCount');
    el.matchCount = document.getElementById('spMatchCount');
    el.tableCount = document.getElementById('spTableCount');
    el.heroMatches = document.getElementById('spHeroMatches');
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
    el.search = document.getElementById('spSearch');
    el.competition = document.getElementById('spCompetition');
    el.when = document.getElementById('spWhen');
    el.openOnly = document.getElementById('spOpenOnly');
    el.visibleCount = document.getElementById('spVisibleCount');
    el.history = document.getElementById('spBetHistory');
    el.ticketCount = document.getElementById('spTicketCount');
    el.jump = document.getElementById('spSlipJump');
    el.jumpCount = document.getElementById('spJumpCount');
    el.jump.onclick = function () {
      el.slip.closest('.sp-slip').scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.stake.focus({ preventScroll: true });
    };
    el.competition.innerHTML = '<option value="all">Todas las competiciones</option>' + MCFootball.LEAGUES.map(function (l) {
      return '<option value="' + l.id + '">' + escape(l.name) + '</option>';
    }).join('');
    el.search.oninput = renderMatches;
    [el.competition, el.when, el.openOnly].forEach(function (control) { control.onchange = renderMatches; });
    document.getElementById('spHistoryFilter').onchange = function (e) { historyFilter = e.target.value; renderHistory(); };

    el.matches.onclick = function (e) {
      var b = e.target.closest('.sp-odd');
      if (b) { toggle(b.dataset.m, b.dataset.p); return; }
      var more = e.target.closest('[data-sp-more]');
      if (more) { expanded = expanded === more.dataset.spMore ? null : more.dataset.spMore; category = 'main'; renderMatches(); return; }
      var tab = e.target.closest('[data-sp-category]');
      if (tab) { category = tab.dataset.spCategory; renderMatches(); document.getElementById('spCat-' + category).focus({ preventScroll: true }); }
    };
    el.matches.onkeydown = function (e) {
      var tab = e.target.closest('[data-sp-category]');
      if (!tab || ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      var list = Array.prototype.slice.call(el.matches.querySelectorAll('[data-sp-category]'));
      var index = list.indexOf(tab);
      index = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      category = list[index].dataset.spCategory; renderMatches(); document.getElementById('spCat-' + category).focus({ preventScroll: true });
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
    MCFootball.onChange(function () { if (MC.getCurrentView() === 'sportsbook') renderMatches(); });
    MC.rtp.onCambio(function () { if (MC.getCurrentView() === 'sportsbook') renderMatches(); });
    setInterval(function () {
      if (!document.hidden && MC.getCurrentView() === 'sportsbook') {
        renderMatches();
        Promise.all([MCLeague.refresh(false), MCFootball.refresh(false)]).then(updateResults);
      }
    }, 60000);
  }

  function selectFromHome(id, pick) {
    var m = MCFootball.find(id);
    if (!m || !marketOpen(m)) { MC.toast('El mercado de este partido esta cerrado.', 'info'); return; }
    MC.showView('sports');
    if (MC.getCurrentView() !== 'sportsbook') return;
    activeTab = 'matches';
    el.search.value = ''; el.competition.value = 'all'; el.when.value = 'all'; el.openOnly.checked = false;
    toggle(id, pick); renderTabs();
    el.slip.closest('.sp-slip').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  return { init: init, selectFromHome: selectFromHome };
})();
