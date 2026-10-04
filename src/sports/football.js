/* Daily international fixtures. No fabricated schedules, scores or live feed. */
window.MCFootball = (function () {
  'use strict';
  var API = 'https://www.thesportsdb.com/api/v1/json/123/';
  var ZONE = 'America/Argentina/Buenos_Aires';
  var CACHE = 'bubba_futbol_diario_v1';
  var TTL = 10 * 60 * 1000;
  var LEAGUES = [
    { id: '4406', name: 'Liga Argentina', country: 'Argentina' },
    { id: '4328', name: 'Premier League', country: 'Inglaterra' },
    { id: '4335', name: 'La Liga', country: 'Espa\u00f1a' },
    { id: '4332', name: 'Serie A', country: 'Italia' },
    { id: '4331', name: 'Bundesliga', country: 'Alemania' },
    { id: '4334', name: 'Ligue 1', country: 'Francia' },
    { id: '4480', name: 'Champions League', country: 'Europa' },
    { id: '4501', name: 'Copa Libertadores', country: 'Sudam\u00e9rica' }
  ];
  var state = { ready: false, loading: false, date: '', matches: [], upcoming: [],
    updatedAt: 0, error: '', partial: false };
  var pending = null;
  var listeners = [];
  var checked = {};
  var resultRequest = null;

  function day(value) {
    var parts = new Intl.DateTimeFormat('en', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(value === undefined ? Date.now() : value));
    var values = {};
    parts.forEach(function (p) { values[p.type] = p.value; });
    return values.year + '-' + values.month + '-' + values.day;
  }
  function nextDay(value) {
    return new Date(new Date(value + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
  }
  function timestamp(e) {
    var stamp = String(e.strTimestamp || '').trim();
    if (!stamp && e.dateEvent && /^\d{2}:\d{2}(:\d{2})?$/.test(e.strTime || '')) {
      stamp = e.dateEvent + 'T' + e.strTime;
    }
    if (!stamp || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(stamp)) return null;
    // TheSportsDB timestamps without an offset are UTC, not the visitor's timezone.
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(stamp)) stamp += 'Z';
    var date = new Date(stamp);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  function image(url) {
    try { var parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; }
    catch (e) { return ''; }
  }
  function score(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }
  function normalize(e, league) {
    if (!e || !/^\d+$/.test(String(e.idEvent || '')) || e.strSport !== 'Soccer' ||
        !/^\d+$/.test(String(e.idHomeTeam || '')) || !/^\d+$/.test(String(e.idAwayTeam || '')) || !e.strHomeTeam || !e.strAwayTeam ||
        String(e.idLeague) !== league.id) return null;
    var home = MCTeams.register({ id: e.idHomeTeam, name: e.strHomeTeam, logo: image(e.strHomeTeamBadge) });
    var away = MCTeams.register({ id: e.idAwayTeam, name: e.strAwayTeam, logo: image(e.strAwayTeamBadge) });
    var status = String(e.strStatus || 'NS').toUpperCase();
    if (String(e.strPostponed).toLowerCase() === 'yes') status = 'PST';
    return { id: String(e.idEvent), source: 'daily', leagueId: league.id, league: league.name,
      country: league.country, home: home.id, away: away.id, homeTeam: home, awayTeam: away,
      date: timestamp(e), day: e.dateEvent || '', status: status, round: Number(e.intRound) || 0,
      gh: score(e.intHomeScore), ga: score(e.intAwayScore) };
  }
  function finished(m) { return ['FT', 'AET', 'PEN'].indexOf(m.status) !== -1 && m.gh !== null && m.ga !== null; }
  function cancelled(m) { return ['CANC', 'CANCELLED', 'ABD', 'ABANDONED', 'PST', 'POSTPONED'].indexOf(m.status) !== -1; }
  function inPlay(m) { return ['1H', '2H', 'HT', 'ET', 'LIVE', 'IN PLAY', 'IN PROGRESS'].indexOf(m.status) !== -1; }
  function marketOpen(m) {
    return !!m.date && ['NS', 'NOT STARTED', 'SCHEDULED'].indexOf(m.status) !== -1 && new Date(m.date).getTime() > Date.now();
  }
  function unique(list) {
    var ids = {};
    return list.filter(function (m) { if (!m || ids[m.id]) return false; ids[m.id] = true; return true; });
  }
  function ordered(list) {
    return list.slice().sort(function (a, b) {
      return Number(inPlay(b)) - Number(inPlay(a)) || Number(finished(a) || cancelled(a)) - Number(finished(b) || cancelled(b)) ||
        (a.date ? new Date(a.date).getTime() : Infinity) - (b.date ? new Date(b.date).getTime() : Infinity) || a.id.localeCompare(b.id);
    });
  }
  function emit() { listeners.forEach(function (fn) { fn(); }); }
  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (!saved || saved.date !== day() || !Array.isArray(saved.matches) || !Array.isArray(saved.upcoming)) return;
      saved.matches.concat(saved.upcoming).forEach(function (m) {
        MCTeams.register(m.homeTeam); MCTeams.register(m.awayTeam);
      });
      state = Object.assign(state, saved, { loading: false, ready: true });
    } catch (e) {}
  }
  function save() { try { localStorage.setItem(CACHE, JSON.stringify(state)); } catch (e) {} }
  async function get(path) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var response = await fetch(API + path, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function batch(jobs) {
    var index = 0, results = [], failures = 0, successes = 0, failedLeagues = {};
    async function worker() {
      while (index < jobs.length) {
        var job = jobs[index++];
        try {
          var data = await get(job.path);
          if (!data || !Object.prototype.hasOwnProperty.call(data, 'events') ||
              (data.events !== null && !Array.isArray(data.events))) throw new Error('Respuesta invalida');
          successes++;
          (data.events || []).forEach(function (e) { var m = normalize(e, job.league); if (m) results.push(m); });
        } catch (e) { failures++; failedLeagues[job.league.id] = true; }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    return { matches: unique(results), failures: failures, successes: successes, failedLeagues: failedLeagues };
  }
  function refresh(force) {
    if (pending) return pending;
    var today = day();
    if (!state.ready) restore();
    if (!force && state.date === today && state.ready && Date.now() - state.updatedAt < TTL) return Promise.resolve(state);
    // Avoid repeated manual requests consuming the free provider's minute quota.
    if (force && state.updatedAt && Date.now() - state.updatedAt < 60000) return Promise.resolve(state);
    if (state.date !== today) state = Object.assign(state, { ready: false, date: today, matches: [], upcoming: [], updatedAt: 0, partial: false });
    state.loading = true; state.error = ''; emit();
    pending = (async function () {
      var jobs = [];
      LEAGUES.forEach(function (league) {
        [today, nextDay(today)].forEach(function (date) {
          jobs.push({ league: league, path: 'eventsday.php?d=' + date + '&s=Soccer&l=' + league.id });
        });
      });
      var data = await batch(jobs);
      var matches = data.matches.filter(function (m) { return m.date ? day(m.date) === today : m.day === today; });
      var upcoming = data.matches.filter(function (m) { return marketOpen(m) && day(m.date) > today; });
      if (data.successes) {
        var seenLeagues = {};
        data.matches.forEach(function (m) { seenLeagues[m.leagueId] = true; });
        var next = await batch(LEAGUES.filter(function (league) { return !matches.length || !seenLeagues[league.id]; }).map(function (league) {
          return { league: league, path: 'eventsnextleague.php?id=' + league.id };
        }));
        upcoming = unique(upcoming.concat(next.matches.filter(function (m) { return marketOpen(m) && day(m.date) > today; })));
        matches = unique(matches.concat(next.matches.filter(function (m) { return m.date && day(m.date) === today; })));
        data.failures += next.failures;
      }
      if (today !== day()) {
        state = Object.assign(state, { loading: false, ready: false, date: day(), matches: [], upcoming: [], updatedAt: 0, partial: false });
        emit(); return state;
      }
      if (!data.successes) {
        state.error = 'No pudimos consultar los partidos. Intenta de nuevo mas tarde.';
      } else {
        // Retain previous rows for a league whose requests failed, with an explicit partial-data notice.
        if (data.failures && state.ready) {
          matches = unique(matches.concat(state.matches.filter(function (m) { return data.failedLeagues[m.leagueId]; })));
        }
        state.matches = ordered(matches); state.upcoming = ordered(upcoming);
        state.ready = true; state.updatedAt = Date.now(); state.partial = !!data.failures;
        save();
      }
      state.loading = false; emit();
      return state;
    })().catch(function () {
      state.loading = false; state.error = 'No pudimos actualizar los partidos.'; emit(); return state;
    }).finally(function () { pending = null; });
    return pending;
  }
  function find(id) { return state.matches.concat(state.upcoming).filter(function (m) { return m.id === id; })[0] || null; }
  function odds(m) {
    if (m.leagueId === '4406' && MCLeague.status().ready) return MCLeague.odds(m);
    // Generic demonstration model, not fitted to international teams or sold as real bookmaker odds.
    var p = MCPoisson.markets(1.35, 1.10);
    var winner = MCPoisson.oddsFor([p.home, p.draw, p.away]);
    var total = MCPoisson.oddsFor([p.over, p.under]);
    var goals = MCPoisson.oddsFor([p.btts, p.nobtts]);
    return { home: winner[0], draw: winner[1], away: winner[2], over: total[0], under: total[1], btts: goals[0], nobtts: goals[1] };
  }
  function ticketResults(tickets) {
    if (resultRequest) return resultRequest;
    var ids = {};
    (tickets || []).forEach(function (ticket) {
      (ticket.selections || []).forEach(function (s) {
        if (s.source === 'daily' && /^\d+$/.test(s.matchId)) ids[s.matchId] = s.leagueId;
      });
    });
    resultRequest = (async function () {
      var requests = 0;
      for (var id of Object.keys(ids)) {
        if (checked[id] && Date.now() - checked[id].at < TTL) continue;
        var league = LEAGUES.filter(function (l) { return l.id === ids[id]; })[0];
        if (!league) continue;
        if (requests++ >= 8) break;
        try {
          var data = await get('lookupevent.php?id=' + id);
          var match = normalize(data.events && data.events[0], league);
          if (match && match.id === id) checked[id] = { at: Date.now(), match: match };
        } catch (e) { /* Unavailable results leave tickets pending. */ }
      }
      var results = {};
      Object.keys(checked).forEach(function (id) { results[id] = checked[id].match; });
      return results;
    })().finally(function () { resultRequest = null; });
    return resultRequest;
  }
  return { LEAGUES: LEAGUES, ZONE: ZONE, day: day, normalize: normalize, timestamp: timestamp,
    image: image, score: score, marketOpen: marketOpen, finished: finished, cancelled: cancelled, inPlay: inPlay,
    odds: odds, refresh: refresh, find: find, ticketResults: ticketResults,
    status: function () { return state; }, onChange: function (fn) { listeners.push(fn); } };
})();
