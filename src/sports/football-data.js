/* Shared public snapshot. The private provider token lives only in GitHub Secrets. */
window.MCFootballData = (function () {
  'use strict';
  var URL_FEED = 'https://raw.githubusercontent.com/juanssess/bubba-games/football-data/data/football-data.json';
  var MAX_AGE = 2 * 60 * 60 * 1000;
  var leagues = [
    { code: 'PL', id: '4328', name: 'Premier League', country: 'Inglaterra' },
    { code: 'PD', id: '4335', name: 'La Liga', country: 'Espa\u00f1a' },
    { code: 'SA', id: '4332', name: 'Serie A', country: 'Italia' },
    { code: 'BL1', id: '4331', name: 'Bundesliga', country: 'Alemania' },
    { code: 'FL1', id: '4334', name: 'Ligue 1', country: 'Francia' },
    { code: 'CL', id: '4480', name: 'Champions League', country: 'Europa' },
    { code: 'PPL', id: 'fd-PPL', name: 'Primeira Liga', country: 'Portugal' },
    { code: 'DED', id: 'fd-DED', name: 'Eredivisie', country: 'Pa\u00edses Bajos' },
    { code: 'ELC', id: 'fd-ELC', name: 'Championship', country: 'Inglaterra' },
    { code: 'BSA', id: 'fd-BSA', name: 'Brasileir\u00e3o', country: 'Brasil' },
    { code: 'WC', id: 'fd-WC', name: 'Mundial', country: 'Mundo' },
    { code: 'EC', id: 'fd-EC', name: 'Eurocopa', country: 'Europa' }
  ];
  var snapshot = null, pending = null, lastAttempt = null;
  function normalize(row) {
    var league = leagues.filter(function (l) { return row && row.competition && l.code === row.competition.code; })[0];
    if (!league || !Number.isInteger(row.id) || row.id <= 0 || !row.homeTeam || !row.awayTeam ||
        !Number.isInteger(row.homeTeam.id) || !Number.isInteger(row.awayTeam.id) ||
        !row.homeTeam.name || !row.awayTeam.name || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(row.utcDate || '')) return null;
    var date = new Date(row.utcDate);
    if (isNaN(date.getTime())) return null;
    var statuses = { SCHEDULED: 'NS', TIMED: 'NS', IN_PLAY: 'LIVE', PAUSED: 'HT',
      FINISHED: 'FT', POSTPONED: 'PST', SUSPENDED: 'SUSPENDED', CANCELLED: 'CANC', AWARDED: 'AWARDED' };
    var home = MCTeams.register({ id: 'fd-team-' + row.homeTeam.id, name: row.homeTeam.shortName || row.homeTeam.name,
      code: row.homeTeam.tla, logo: MCFootball.image(row.homeTeam.crest) });
    var away = MCTeams.register({ id: 'fd-team-' + row.awayTeam.id, name: row.awayTeam.shortName || row.awayTeam.name,
      code: row.awayTeam.tla, logo: MCFootball.image(row.awayTeam.crest) });
    var goals = row.score && row.score.fullTime || {};
    // Existing markets are 90 minutes: never settle on extra-time or shootout totals.
    if (row.score && row.score.duration !== 'REGULAR') goals = row.score.regularTime || {};
    return { id: 'fd-' + row.id, source: 'daily', provider: 'football-data', leagueId: league.id,
      league: league.name, country: league.country, home: home.id, away: away.id, homeTeam: home, awayTeam: away,
      date: row.status === 'SCHEDULED' ? null : date.toISOString(), day: MCFootball.day(date), status: statuses[row.status] || 'UNKNOWN',
      feedAt: snapshot ? snapshot.generatedAt : null,
      minute: Number.isInteger(row.minute) && row.minute >= 0 && row.minute <= 120 ? row.minute : null,
      injuryTime: Number.isInteger(row.injuryTime) && row.injuryTime >= 0 && row.injuryTime <= 30 ? row.injuryTime : null,
      round: Number(row.matchday) || 0, gh: MCFootball.score(goals.home), ga: MCFootball.score(goals.away) };
  }
  function fresh() {
    var age = snapshot && Date.now() - Date.parse(snapshot.generatedAt);
    return !!snapshot && age >= -60000 && age < MAX_AGE;
  }
  function refresh() {
    if (pending) return pending;
    if (lastAttempt !== null && Date.now() - lastAttempt < 10 * 60 * 1000) return Promise.resolve(fresh());
    lastAttempt = Date.now();
    pending = (async function () {
      var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 10000);
      try {
        var response = await fetch(URL_FEED, { signal: controller.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error('Feed unavailable');
        var data = await response.json();
        if (data.version !== 1 || !Array.isArray(data.matches) || !Array.isArray(data.competitions) ||
            !Number.isFinite(Date.parse(data.generatedAt))) throw new Error('Invalid feed');
        snapshot = data;
      } catch (e) { /* A missing secret or delayed job must not break the other provider. */ }
      finally { clearTimeout(timer); }
      return fresh();
    })().finally(function () { pending = null; });
    return pending;
  }
  function covered() {
    if (!fresh()) return [];
    return leagues.filter(function (l) { return snapshot.competitions.indexOf(l.code) >= 0; }).map(function (l) { return l.id; });
  }
  function matches() { return fresh() ? snapshot.matches.map(normalize).filter(Boolean) : []; }
  function results() {
    var out = {};
    (snapshot && snapshot.matches || []).forEach(function (row) {
      var m = normalize(row); if (m) out[m.id] = m;
    });
    return out;
  }
  return { leagues: leagues, refresh: refresh, covered: covered, matches: matches, results: results,
    normalize: normalize, fresh: fresh, updatedAt: function () { return snapshot ? snapshot.generatedAt : null; } };
})();
