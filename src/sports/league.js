/* ============================================================
   DEPORTES / LIGA PROFESIONAL ARGENTINA
   Datos reales desde TheSportsDB y cuotas virtuales Poisson.
   ============================================================ */
window.MCLeague = (function () {
  'use strict';

  var LEAGUE_ID = 4406;
  var SEASON = 2026;
  var TOTAL_ROUNDS = 16;
  var LEAGUE_AVG = 1.35;
  var HOME_ADV = 1.15;
  var API = 'https://www.thesportsdb.com/api/v1/json/123/';
  var CACHE_KEY = 'bubba_liga_argentina_2026_v1';
  var CACHE_MS = 10 * 60 * 1000;
  var live = { ready: false, loading: false, error: '', round: 1,
    matches: [], results: [], table: [], updatedAt: 0 };

  function num(v) { return Number(v) || 0; }

  function eventDate(e) {
    var day = e.dateEventLocal || e.dateEvent;
    var time = e.strTimeLocal || e.strTime || '00:00:00';
    var d = new Date(day + 'T' + time + '-03:00');
    if (isNaN(d.getTime())) d = new Date(e.strTimestamp || day);
    return d;
  }

  function eventTeam(e, home) {
    return MCTeams.register({
      id: home ? e.idHomeTeam : e.idAwayTeam,
      name: home ? e.strHomeTeam : e.strAwayTeam,
      logo: home ? e.strHomeTeamBadge : e.strAwayTeamBadge
    });
  }

  function normalizeEvent(e) {
    var h = eventTeam(e, true), a = eventTeam(e, false);
    var status = String(e.strStatus || (e.intHomeScore !== null ? 'FT' : 'NS')).toUpperCase();
    return { id: String(e.idEvent), round: num(e.intRound), home: h.id, away: a.id,
      date: eventDate(e).toISOString(), status: status, venue: e.strVenue || '',
      gh: e.intHomeScore === null ? null : num(e.intHomeScore),
      ga: e.intAwayScore === null ? null : num(e.intAwayScore) };
  }

  function finished(m) {
    return ['FT', 'AET', 'PEN'].indexOf(m.status) >= 0 && m.gh !== null && m.ga !== null;
  }

  function around(events, pivot) {
    var center = pivot.getTime(), range = 30 * 86400000;
    return (events || []).map(normalizeEvent).filter(function (m) {
      return Math.abs(new Date(m.date).getTime() - center) < range;
    });
  }

  function normalizeTable(rows) {
    return (rows || []).map(function (r) {
      var pj = num(r.intPlayed), gf = num(r.intGoalsFor), gc = num(r.intGoalsAgainst);
      var team = MCTeams.register({ id: r.idTeam, name: r.strTeam, logo: r.strBadge,
        attack: pj ? Math.max(.65, Math.min(1.55, (gf / pj) / LEAGUE_AVG)) : 1,
        defense: pj ? Math.max(.65, Math.min(1.55, LEAGUE_AVG / Math.max(.35, gc / pj))) : 1 });
      return { team: team, rank: num(r.intRank), group: r.strGroup || '', pj: pj,
        g: num(r.intWin), e: num(r.intDraw), p: num(r.intLoss), gf: gf, gc: gc,
        dg: num(r.intGoalDifference), pts: num(r.intPoints) };
    }).sort(function (a, b) { return a.rank - b.rank || b.pts - a.pts || b.dg - a.dg; });
  }

  function packMatch(m) {
    var copy = Object.assign({}, m);
    copy.homeTeam = MCTeams.get(m.home);
    copy.awayTeam = MCTeams.get(m.away);
    return copy;
  }

  function unpack(data) {
    (data.matches || []).concat(data.results || []).forEach(function (m) {
      if (m.homeTeam) MCTeams.register(m.homeTeam);
      if (m.awayTeam) MCTeams.register(m.awayTeam);
    });
    (data.table || []).forEach(function (r) { if (r.team) MCTeams.register(r.team); });
    live = data;
    live.ready = true;
    live.loading = false;
    live.error = '';
  }

  function restoreCache() {
    try {
      var data = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!data || !data.matches) return false;
      unpack(data);
      return true;
    } catch (e) { return false; }
  }

  function saveCache() {
    try {
      var copy = Object.assign({}, live, {
        matches: live.matches.map(packMatch), results: live.results.map(packMatch)
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(copy));
    } catch (e) {}
  }

  function getJson(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function refresh(force) {
    if (live.loading) return Promise.resolve(live);
    if (!live.ready) restoreCache();
    if (!force && live.ready && Date.now() - live.updatedAt < CACHE_MS) return Promise.resolve(live);
    live.loading = true;
    live.error = '';

    return Promise.all([
      getJson('eventsnextleague.php?id=' + LEAGUE_ID),
      getJson('eventspastleague.php?id=' + LEAGUE_ID),
      getJson('lookuptable.php?l=' + LEAGUE_ID + '&s=' + SEASON)
    ]).then(function (base) {
      var next = base[0].events && base[0].events[0];
      var past = base[1].events && base[1].events[0];
      if (!next && !past) throw new Error('La fuente no devolvió partidos');
      var round = num(next ? next.intRound : num(past.intRound) + 1);
      var previousRound = num(past ? past.intRound : Math.max(1, round - 1));
      var nextPivot = eventDate(next || past), pastPivot = eventDate(past || next);
      var ticketIds = {}, extraRounds = [];
      var openTickets = (MC.state.sports && MC.state.sports.tickets) || [];
      openTickets.forEach(function (t) {
        (t.selections || []).forEach(function (s) { ticketIds[String(s.matchId)] = true; });
        var r = num(t.round);
        if (r && r !== round && r !== previousRound && extraRounds.indexOf(r) < 0) extraRounds.push(r);
      });
      var roundCalls = [
        getJson('eventsround.php?id=' + LEAGUE_ID + '&r=' + round + '&s=' + SEASON),
        getJson('eventsround.php?id=' + LEAGUE_ID + '&r=' + previousRound + '&s=' + SEASON)
      ].concat(extraRounds.slice(0, 8).map(function (r) {
        return getJson('eventsround.php?id=' + LEAGUE_ID + '&r=' + r + '&s=' + SEASON);
      }));
      return Promise.all(roundCalls).then(function (rounds) {
        var now = Date.now();
        var current = around(rounds[0].events, nextPivot);
        var previous = around(rounds[1].events, pastPivot);
        var older = [];
        rounds.slice(2).forEach(function (data) {
          (data.events || []).map(normalizeEvent).forEach(function (m) {
            if (ticketIds[m.id] && finished(m)) older.push(m);
          });
        });
        live.round = round;
        live.matches = current.filter(function (m) {
          return !finished(m) && new Date(m.date).getTime() > now - 7200000;
        }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        var seen = {};
        live.results = previous.concat(current, older).filter(finished).filter(function (m) {
          if (seen[m.id]) return false;
          seen[m.id] = true;
          return true;
        }).sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });
        live.table = normalizeTable(base[2].table);
        live.updatedAt = Date.now();
        live.ready = true;
        live.loading = false;
        live.error = '';
        saveCache();
        return live;
      });
    }).catch(function (e) {
      live.loading = false;
      live.error = e.message || 'No se pudo actualizar la liga';
      return live;
    });
  }

  function fixture() { return live.ready ? live.matches : []; }
  function results() { return live.ready ? live.results : []; }
  function table() { return live.ready ? live.table : []; }
  function currentRound() { return live.round || 1; }

  function lambdas(match) {
    var h = MCTeams.get(match.home), a = MCTeams.get(match.away);
    return { home: LEAGUE_AVG * ((h && h.attack) || 1) / ((a && a.defense) || 1) * HOME_ADV,
      away: LEAGUE_AVG * ((a && a.attack) || 1) / ((h && h.defense) || 1) };
  }

  function odds(match) {
    var l = lambdas(match), p = MCPoisson.markets(l.home, l.away);
    var a = MCPoisson.oddsFor([p.home, p.draw, p.away]);
    var g = MCPoisson.oddsFor([p.over, p.under]);
    var b = MCPoisson.oddsFor([p.btts, p.nobtts]);
    return { home: a[0], draw: a[1], away: a[2], over: g[0], under: g[1],
      btts: b[0], nobtts: b[1], probs: p };
  }

  function isWinner(pick, r) {
    if (pick === 'home') return r.gh > r.ga;
    if (pick === 'draw') return r.gh === r.ga;
    if (pick === 'away') return r.gh < r.ga;
    if (pick === 'over') return r.gh + r.ga >= 3;
    if (pick === 'under') return r.gh + r.ga <= 2;
    if (pick === 'btts') return r.gh >= 1 && r.ga >= 1;
    if (pick === 'nobtts') return r.gh === 0 || r.ga === 0;
    return false;
  }

  return { fixture: fixture, results: results, table: table, currentRound: currentRound,
    lambdas: lambdas, odds: odds, isWinner: isWinner, refresh: refresh,
    status: function () { return live; }, isReal: function () { return live.ready; },
    TOTAL_ROUNDS: TOTAL_ROUNDS, seasonComplete: function () { return false; } };
})();
