import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let now = Date.parse('2026-10-04T15:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
function event(id, league = '4328', stamp = '2026-10-04T20:00:00', extra = {}) {
  return { idEvent: String(id), idLeague: league, strSport: 'Soccer', strTimestamp: stamp,
    dateEvent: stamp.slice(0, 10), strTime: stamp.slice(11), idHomeTeam: String(id) + '1', idAwayTeam: String(id) + '2',
    strHomeTeam: 'Local ' + id, strAwayTeam: 'Visita ' + id, strStatus: 'NS', intHomeScore: null, intAwayScore: null, ...extra };
}
function setup(handler, storage = new Map()) {
  const teams = new Map(), calls = [];
  const context = vm.createContext({ Date: Clock, Intl, URL, AbortController, setTimeout, clearTimeout, console,
    window: {}, MCLeague: { status: () => ({ ready: false }) },
    MCTeams: { get: id => teams.get(id), register(data) { if (!data) return; const t = { ...teams.get(data.id), ...data }; teams.set(t.id, t); return t; } },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    fetch: async url => { calls.push(url); const data = await handler(new URL(url)); return { ok: true, json: async () => data }; }
  });
  vm.runInContext(readFileSync('src/sports/poisson.js', 'utf8'), context);
  context.MCPoisson = context.window.MCPoisson;
  vm.runInContext(readFileSync('src/sports/football.js', 'utf8'), context);
  context.MCFootball = context.window.MCFootball;
  return { api: context.window.MCFootball, calls, storage, teams, context };
}
const rows = [event(1), event(2, '4335'), event(3, '4328', '2026-10-05T02:30:00'),
  event(4, '4328', '2026-10-04T02:00:00'), event(5, '4328', '2026-10-05T04:00:00'),
  event(6, '4331', '2026-10-04T14:00:00', { strStatus: '1H', intHomeScore: '0', intAwayScore: '0' }),
  event(7, '4332', '2026-10-04T12:00:00', { strStatus: 'FT', intHomeScore: '2', intAwayScore: '1' })];
const respond = url => ({ events: rows.filter(e => e.idLeague === url.searchParams.get('l') && e.dateEvent === url.searchParams.get('d')) });
const s = setup(respond);
const pending = s.api.refresh();
assert.equal(s.api.refresh(), pending, 'Concurrent callers share a request');
await pending;
assert.equal(s.calls.filter(url => url.includes('eventsday.php')).length, 16, 'Two UTC days for each league');
assert.equal(s.calls.length, 20, 'Next fixtures are requested for leagues missing from the daily feed');
assert.equal(s.api.day('2026-10-05T02:30:00Z'), '2026-10-04', 'Buenos Aires date crosses UTC midnight');
assert.equal(s.api.find('1').date, '2026-10-04T20:00:00.000Z');
assert.equal(s.api.status().matches[0].id, '6', 'In-play games first');
assert.equal(s.api.status().matches.length, 5);
assert.equal(s.api.find('4'), null, 'Yesterday in Argentina is excluded');
assert.equal(s.api.status().upcoming[0].id, '5');
assert.equal(s.api.marketOpen(s.api.find('6')), false);
assert.equal(s.api.marketOpen(s.api.find('7')), false);
assert.equal(s.api.marketOpen(s.api.find('1')), true);
assert.equal(s.api.image('javascript:alert(1)'), '');
assert.equal(s.api.image('http://bad.example/badge.png'), '');
assert.equal(s.api.normalize(event(8, '4328', 'bad', { strTimestamp: null, strTime: null }), s.api.LEAGUES[1]).date, null);
assert.equal(s.api.normalize(event(8, '4328', undefined, { intHomeScore: '', intAwayScore: undefined }), s.api.LEAGUES[1]).gh, null);
assert.equal(s.api.normalize(event(8, '4328', undefined, { strSport: 'Basketball' }), s.api.LEAGUES[1]), null);
const o = s.api.odds(s.api.find('1'));
assert.ok(o.home > 1 && o.draw > 1 && o.away > 1);
await s.api.refresh();
assert.equal(s.calls.length, 20, 'Warm cache avoids API calls');
const restored = setup(() => { throw Error('offline'); }, s.storage);
await restored.api.refresh();
assert.equal(restored.calls.length, 0);
assert.ok(restored.teams.has('11'), 'Cached badges and team names are restored');
now += 601000;
const partial = setup(url => { if (url.searchParams.get('l') === '4328') throw Error('offline'); return { events: null }; }, s.storage);
await partial.api.refresh();
assert.equal(partial.api.status().partial, true);
assert.ok(partial.api.find('1'), 'Keep previous games only for a failed league');
assert.equal(partial.api.find('2'), null, 'A successful empty league clears its old rows');
const offline = setup(() => { throw Error('offline'); });
await offline.api.refresh();
assert.equal(offline.api.status().ready, false);
assert.ok(offline.api.status().error);
const malformed = setup(() => ({ events: 'invalid' }));
await malformed.api.refresh();
assert.equal(malformed.api.status().ready, false, 'Malformed payload is not an empty successful schedule');
const empty = setup(url => ({ events: url.pathname.includes('eventsnextleague') && url.searchParams.get('id') === '4328'
  ? [event(90, '4328', '2026-10-10T18:00:00')] : null }));
await empty.api.refresh();
assert.equal(empty.api.status().matches.length, 0);
assert.equal(empty.api.status().upcoming[0].id, '90');
const results = setup(() => ({ events: [event(123, '4328', undefined, { strStatus: 'FT', intHomeScore: '0', intAwayScore: '0' })] }));
const tickets = [{ selections: [{ matchId: '123', source: 'daily', leagueId: '4328' }] }];
const finals = await results.api.ticketResults(tickets);
assert.equal(results.api.finished(finals['123']), true, 'An official 0-0 is a final result');
await results.api.ticketResults(tickets);
assert.equal(results.calls.length, 1, 'Result checks are throttled');
now = Date.parse('2026-10-05T04:00:00Z');
await restored.api.refresh();
assert.equal(restored.api.status().matches.length, 0, 'Previous day cannot appear as today after midnight');
now = Date.parse('2026-10-04T15:00:00Z');
const native = setup(url => {
  if (url.pathname.includes('lookuptable')) return { table: [] };
  return { events: [event(100, '4406', undefined, { intRound: '9' }),
    event(101, '4406', undefined, { strTimestamp: null, strTime: null })] };
});
native.context.MC = { state: { sports: { tickets: [] } } };
vm.runInContext(readFileSync('src/sports/league.js', 'utf8'), native.context);
await native.context.window.MCLeague.refresh();
assert.equal(native.context.window.MCLeague.fixture().length, 1, 'Argentina skips unconfirmed times');
assert.equal(native.context.window.MCLeague.fixture()[0].date, '2026-10-04T20:00:00.000Z', 'Argentina and international adapters agree on UTC');
now = Date.parse('2026-10-05T02:59:00Z');
const midnight = setup(() => { now = Date.parse('2026-10-05T03:01:00Z'); return { events: [event(700)] }; });
await midnight.api.refresh();
assert.equal(midnight.api.status().date, '2026-10-05');
assert.equal(midnight.api.status().matches.length, 0, 'A request finishing after midnight cannot publish yesterday as today');
assert.equal(midnight.api.status().ready, false);
console.log('PASS: international fixtures, UTC boundaries, statuses, cache, partial errors, upcoming fallback and official results.');
