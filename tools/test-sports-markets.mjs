import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let factor = 1;
const context = vm.createContext({ window: {}, MC: { rtp: { factor: () => factor, fichas: Math.round } },
  MCTeams: { get: id => ({ name: id === 'h' ? 'Local' : 'Visita' }) },
  MCLeague: { status: () => ({ ready: false }) } });
context.window.MC = context.MC;
vm.runInContext(readFileSync('src/sports/poisson.js', 'utf8'), context);
context.MCPoisson = context.window.MCPoisson;
context.MCFootball = { odds: () => {
  const p = context.MCPoisson.markets(1.35, 1.10), quote = ps => context.MCPoisson.oddsFor(ps);
  const [home, draw, away] = quote([p.home, p.draw, p.away]);
  const [over, under] = quote([p.over, p.under]), [btts, nobtts] = quote([p.btts, p.nobtts]);
  return { home, draw, away, over, under, btts, nobtts };
} };
vm.runInContext(readFileSync('src/sports/markets.js', 'utf8'), context);
const api = context.window.MCMarkets;
const result = (h, a) => ({ gh: h, ga: a });
assert.equal(Object.keys(api.PICKS).length, 71);
assert.equal(api.outcome('dc_1x', result(0, 0)), 'win');
assert.equal(api.outcome('dc_x2', result(2, 1)), 'lose');
assert.equal(api.outcome('dc_12', result(1, 1)), 'lose');
assert.equal(api.outcome('dnb_home', result(1, 1)), 'push');
assert.equal(api.outcome('dnb_away', result(1, 2)), 'win');
assert.equal(api.outcome('over_15', result(1, 1)), 'win');
assert.equal(api.outcome('under_35', result(2, 2)), 'lose');
assert.equal(api.outcome('home_over_05', result(1, 0)), 'win');
assert.equal(api.outcome('away_under_15', result(1, 2)), 'lose');
assert.equal(api.outcome('even', result(0, 0)), 'win');
assert.equal(api.outcome('hcp_home_m15', result(2, 1)), 'lose');
assert.equal(api.outcome('hcp_home_m15', result(3, 1)), 'win');
assert.equal(api.outcome('hcp_away_15', result(2, 1)), 'win');
assert.equal(api.outcome('score_2_1', result(2, 1)), 'win');
assert.equal(api.outcome('score_other_home', result(10, 0)), 'win');
assert.equal(api.outcome('home_btts_yes', result(2, 1)), 'win');
assert.equal(api.outcome('home_btts_no', result(2, 1)), 'lose');
assert.equal(api.outcome('unknown', result(2, 1)), null);
assert.equal(api.outcome('home', result(null, null)), null);
assert.equal(api.outcome('home', result(-1, 1)), null);
const groups = api.GROUPS.filter(g => !['double', 'dnb'].includes(g.id));
for (let h = 0; h <= 12; h++) for (let a = 0; a <= 12; a++) {
  for (const g of groups) assert.equal(g.picks.filter(p => api.outcome(p, result(h, a)) === 'win').length, 1,
    `${g.id} partitions the complete result space at ${h}-${a}`);
}
const match = { home: 'h', away: 'a', source: 'daily', leagueId: '4328' };
const quotes = api.odds(match);
assert.ok(Object.values(quotes).every(q => Number.isFinite(q) && q >= 1.01 && q <= 1000));
assert.ok(quotes.dnb_home < quotes.home);
assert.ok(quotes.dc_1x < quotes.home);
assert.equal(quotes.over, context.MCFootball.odds(match).over, 'Legacy quotes remain identical');
const p = context.MCPoisson.markets(1.35, 1.10);
assert.ok(Math.abs(quotes.dnb_home - (1 - p.draw) / (p.home * 1.08)) < .01);
factor = .8;
assert.ok(api.odds(match).score_2_1 < quotes.score_2_1, 'House factor applies to expanded markets');
const ticket = picks => ({ stake: 100, odds: picks.reduce((q, s) => q * s.odds, 1), selections: picks });
const leg = (pick, id = '1', odds = 2) => ({ pick, matchId: id, odds });
assert.equal(api.settle(ticket([leg('dnb_home')]), { 1: result(0, 0) }).payout, 100, 'A single push returns the stake');
assert.equal(api.settle(ticket([leg('dnb_home'), leg('home', '2', 3)]), { 1: result(1, 1), 2: result(2, 0) }).payout, 300);
assert.equal(api.settle(ticket([leg('dnb_home'), leg('home', '2', 3)]), { 1: result(1, 1), 2: result(0, 2) }).payout, 0);
assert.equal(api.settle(ticket([leg('home')]), {}), null);
assert.equal(api.settle(ticket([leg('unknown')]), { 1: result(1, 0) }), null);
console.log('PASS: 71 selections, result-space partitions, existing model pricing, legacy quotes, pushes and combination settlements.');
