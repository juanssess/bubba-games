import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { sync, COMPETITIONS } from './sync-football-data.mjs';

let now = Date.parse('2026-10-04T15:00:00Z');
class Clock extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
const row = (id = 1, code = 'PL', extra = {}) => ({ id, competition: { code }, utcDate: '2026-10-04T20:00:00Z',
  status: 'TIMED', homeTeam: { id: 10, name: 'Arsenal FC', shortName: 'Arsenal' },
  awayTeam: { id: 20, name: 'Chelsea FC', shortName: 'Chelsea' },
  score: { duration: 'REGULAR', fullTime: { home: null, away: null } }, ...extra });
const calls = [];
const output = await sync({ token: 'test-secret', now: new Date(now), pause: async () => {},
  fetcher: async (url, options) => {
    calls.push(url); assert.equal(options.headers['X-Auth-Token'], 'test-secret');
    return { ok: true, json: async () => ({ resultSet: { count: 1 }, matches: [row(1, 'PL', { minute: 67, injuryTime: 0 })] }) };
  }, previous: { matches: [row(8, 'PD', { utcDate: '2026-09-30T20:00:00Z', status: 'FINISHED' })] } });
assert.equal(calls.length, 2);
assert.equal(output.matches.length, 2, 'Deduplicate overlapping windows and preserve past results');
assert.ok(!JSON.stringify(output).includes('test-secret'));
assert.equal(output.matches.find(m => m.id === 1).minute, 67, 'Public snapshot retains the reported minute');
await assert.rejects(sync({ token: '' }), /Falta el secreto/);
await assert.rejects(sync({ token: 'x', fetcher: async () => ({ ok: false, status: 429 }) }), /429/);
await assert.rejects(sync({ token: 'x', fetcher: async () => ({ ok: true, json: async () => ({ matches: [] }) }) }), /incompleta/);

function setup(feed) {
  const requests = [], teams = new Map();
  const context = vm.createContext({ window: {}, Date: Clock, Intl, URL, AbortController, setTimeout, clearTimeout,
    MCLeague: { status: () => ({ ready: false }) }, localStorage: { getItem: () => null, setItem() {} },
    MCTeams: { register: t => { teams.set(t.id, t); return t; } },
    fetch: async url => {
      requests.push(url);
      if (url.includes('raw.githubusercontent')) return { ok: true, json: async () => feed };
      const u = new URL(url), league = u.searchParams.get('l');
      return { ok: true, json: async () => ({ events: league && u.searchParams.get('d') === '2026-10-04' ? [{
        idEvent: league + '1', idLeague: league, strSport: 'Soccer', idHomeTeam: '10', idAwayTeam: '20',
        strHomeTeam: 'Local', strAwayTeam: 'Visita', strTimestamp: '2026-10-04T20:00:00', strStatus: 'NS'
      }] : [] }) };
    } });
  for (const file of ['football-data', 'football']) {
    vm.runInContext(readFileSync('src/sports/' + file + '.js', 'utf8'), context);
    context[file === 'football' ? 'MCFootball' : 'MCFootballData'] = context.window[file === 'football' ? 'MCFootball' : 'MCFootballData'];
  }
  return { api: context.MCFootball, feed: context.MCFootballData, requests, teams };
}
const feed = { version: 1, generatedAt: new Date(now).toISOString(), competitions: COMPETITIONS,
  matches: [row(), row(2, 'BSA'), row(3, 'PL', { status: 'FINISHED', score: { duration: 'REGULAR', fullTime: { home: 0, away: 0 } } })] };
const combined = setup(feed);
await combined.api.refresh();
assert.equal(combined.api.LEAGUES.length, 14);
assert.ok(combined.api.find('fd-1'));
assert.equal(combined.api.status().matches.length, 5, 'Three shared matches plus Argentina and Libertadores');
assert.ok(!combined.requests.some(u => /[?&]l=4328/.test(u)), 'Covered leagues do not use SportsDB or duplicate fixtures');
assert.ok(combined.api.marketOpen(combined.api.find('fd-1')));
const live = combined.feed.normalize(row(5, 'PL', { status: 'IN_PLAY', minute: 90, injuryTime: 3 }));
assert.equal(combined.api.liveLabel(live), 'Segundo tiempo');
assert.equal(combined.api.marketOpen(live), false, 'Reported minutes must not enable stale prematch odds');
assert.equal(combined.feed.normalize(row(5, 'PL', { minute: '67', injuryTime: -1 })).minute, null);
assert.equal(combined.api.marketOpen(combined.feed.normalize(row(5, 'PL', { status: 'SCHEDULED' }))), false, 'A tentative schedule cannot open a market');
assert.equal(combined.api.finished(combined.api.find('fd-3')), true);
const results = await combined.api.ticketResults([{ selections: [{ matchId: 'fd-3', source: 'daily' }] }]);
assert.equal(results['fd-3'].gh, 0);
assert.ok(combined.teams.has('fd-team-10'), 'Provider team IDs do not collide');
assert.equal(combined.feed.normalize(row(4, 'PL', { status: 'FINISHED', score: { duration: 'EXTRA_TIME', fullTime: { home: 3, away: 2 } } })).gh, null);
assert.equal(combined.feed.normalize(row(4, 'PL', { status: 'FINISHED', score: { duration: 'EXTRA_TIME', regularTime: { home: 1, away: 1 } } })).gh, 1);
now += 2 * 3600000;
assert.equal(combined.api.marketOpen(combined.api.find('fd-1')), false, 'Expired cached feed closes markets');
const stale = setup(feed);
await stale.api.refresh();
assert.equal(stale.api.find('fd-1'), null);
assert.equal(stale.api.status().sharedFeed, false);
assert.equal(stale.api.status().matches.length, 8, 'Stale snapshot falls back to the original eight leagues');
console.log('PASS: secure sync, deduplication, shared coverage, fallback, namespaced identities, results and stale markets.');
