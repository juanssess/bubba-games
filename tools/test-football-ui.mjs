import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] || 'http://localhost:8123';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const stamp = '2026-10-04T15:00:00Z';
const names = { '4406': ['Talleres Cordoba', 'Belgrano'], '4328': ['Arsenal', 'Manchester City'],
  '4335': ['Real Madrid', 'Barcelona'], '4332': ['Inter', 'Juventus'], '4331': ['Bayern Munich', 'Dortmund'],
  '4334': ['Paris Saint-Germain', 'Lyon'], '4480': ['Liverpool', 'Benfica'], '4501': ['River Plate', 'Flamengo'] };
function event(league, suffix = '', extra = {}) {
  const pair = names[league];
  return { idEvent: league + '01' + suffix, idLeague: league, strSport: 'Soccer',
    idHomeTeam: league + '1', idAwayTeam: league + '2', strHomeTeam: pair[0], strAwayTeam: pair[1],
    strHomeTeamBadge: 'https://badges.invalid/missing.png', strTimestamp: '2026-10-04T21:00:00',
    dateEvent: '2026-10-04', strTime: '21:00:00', strStatus: 'NS', intHomeScore: null, intAwayScore: null, ...extra };
}
let mode = 'today', finals = {}, calls = [];
async function configure(page) {
  await page.clock.setFixedTime(new Date(stamp));
  await page.route('https://raw.githubusercontent.com/juanssess/bubba-games/football-data/**', route => route.fulfill({ status: 404, json: {} }));
  await page.route('https://badges.invalid/**', route => route.abort());
  await page.route('https://www.thesportsdb.com/api/**', async route => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    if (mode === 'offline') { await route.fulfill({ status: 503, json: { error: 'offline' } }); return; }
    let events = null;
    if (url.pathname.includes('eventsday.php')) {
      const league = url.searchParams.get('l');
      if (mode === 'partial' && league === '4335') { await route.fulfill({ status: 503, json: {} }); return; }
      if (mode !== 'empty' && url.searchParams.get('d') === '2026-10-04') {
        events = [event(league)];
        if (league === '4328') events.push(event(league, '9', { strTimestamp: '2026-10-04T14:00:00', strStatus: '1H', intHomeScore: '1', intAwayScore: '0' }));
        if (league === '4332') events.push(event(league, '8', { strTimestamp: '2026-10-04T12:00:00', strStatus: 'FT', intHomeScore: '2', intAwayScore: '1' }));
      }
      if (mode !== 'empty' && url.searchParams.get('d') === '2026-10-05' && league === '4328') {
        events = [event(league, '3', { dateEvent: '2026-10-05', strTimestamp: '2026-10-05T02:30:00' })];
      }
    }
    if (url.pathname.includes('eventsnextleague.php') && mode === 'empty') {
      events = [event(url.searchParams.get('id'), '', { dateEvent: '2026-10-10', strTimestamp: '2026-10-10T21:00:00' })];
    }
    if (url.pathname.includes('lookupevent.php')) events = finals[url.searchParams.get('id')] || null;
    await route.fulfill({ json: { events } });
  });
}
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await configure(page);
  await page.goto(base + '/?nosync=1');
  await page.evaluate(() => MC.closeModal());
  await page.waitForFunction(() => MCFootball.status().ready && !MCFootball.status().loading);
  assert.equal(await page.locator('.fb-match').count(), 11);
  assert.match(await page.locator('.fb-match').first().innerText(), /Primer tiempo/);
  assert.match(await page.locator('.fb-match').first().innerText(), /1 - 0/);
  assert.equal(await page.locator('.fb-match').first().locator('button:not(:disabled)').count(), 0);
  await page.selectOption('#fbCompetition', '4328');
  assert.equal(await page.locator('.fb-match').count(), 3);
  assert.match(await page.locator('[data-fb-match="4328013"]').first().locator('..').locator('..').innerText(), /23:30/,
    'Next UTC day is still today in Argentina');
  await page.selectOption('#fbCompetition', 'all');
  for (const [name, width, height] of [['desktop', 1366, 900], ['mobile', 390, 844], ['narrow', 320, 740]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ': no page overflow');
    await page.locator('#footballHome').scrollIntoViewIfNeeded();
    await page.locator('#footballHome').screenshot({ path: 'tmp/requests-football-' + name + '.png' });
    assert.equal(await page.locator('.fb-monogram').first().isVisible(), true, 'Badge failure has a visible fallback');
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  const before = await page.evaluate(() => MC.getBalance());
  await page.locator('[data-fb-match="432801"][data-fb-pick="draw"]').click();
  assert.equal(await page.evaluate(() => MC.getCurrentView()), 'sportsbook');
  assert.equal(await page.locator('#spSlipCount').innerText(), '1');
  assert.match(await page.locator('#spSlip').innerText(), /Premier League/i);
  const quote = Number(await page.locator('.slip-item>b').innerText());
  await page.locator('#spStake').fill('100');
  await page.locator('#spPlace').click();
  assert.equal(await page.evaluate(() => MC.getBalance()), before - 100);
  assert.equal(await page.evaluate(() => MC.state.sports.tickets[0].selections[0].source), 'daily');
  finals['432801'] = [event('4328', '', { strStatus: 'FT', intHomeScore: '0', intAwayScore: '0' })];
  await page.locator('#spSimulate').click();
  await page.waitForFunction(() => MC.state.sports.tickets.length === 0);
  const paid = await page.evaluate(() => MC.getBalance());
  assert.equal(paid, before - 100 + Math.round(100 * quote));
  await page.locator('#spSimulate').click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => MC.getBalance()), paid, 'An already settled ticket cannot credit twice');
  await page.evaluate(() => MC.showView('lobby'));
  await page.locator('[data-fb-match="433501"][data-fb-pick="home"]').click();
  await page.locator('#spPlace').click();
  finals['433501'] = [event('4335', '', { strStatus: 'CANC' })];
  await page.locator('#spSimulate').click();
  await page.waitForFunction(() => MC.state.sports.tickets.length === 0);
  assert.equal(await page.evaluate(() => MC.getBalance()), paid, 'Cancelled international event refunds the full ticket');
  await page.evaluate(() => { MC.showView('lobby'); MCSportsbook.selectFromHome('4328019', 'home'); });
  assert.equal(await page.evaluate(() => MC.getCurrentView()), 'lobby', 'Cannot select a started match');
  assert.deepEqual(errors, []);
  await page.close();

  for (const scenario of ['empty', 'partial', 'offline']) {
    mode = scenario;
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await configure(p);
    await p.goto(base + '/?nosync=1');
    await p.evaluate(() => MC.closeModal());
    await p.waitForFunction(() => !MCFootball.status().loading && (MCFootball.status().ready || MCFootball.status().error));
    if (scenario === 'empty') {
      assert.match(await p.locator('#footballTitle').innerText(), /Pr.ximos partidos/);
      assert.equal(await p.locator('.fb-match').count(), 8);
      await p.locator('#fbToday').click();
      assert.equal(await p.locator('.fb-match').count(), 0);
      assert.match(await p.locator('.fb-empty').innerText(), /no tiene partidos de hoy/);
    } else if (scenario === 'partial') {
      assert.match(await p.locator('.fb-warning').innerText(), /Cobertura parcial/);
      assert.ok(await p.locator('.fb-match').count() > 0);
    } else {
      assert.match(await p.locator('.fb-warning').innerText(), /No pudimos consultar/);
      assert.equal(await p.locator('.fb-match').count(), 0);
    }
    await p.close();
  }
  mode = 'today';
  const combined = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await configure(combined);
  const shared = id => ({ id, competition: { code: id === 901 ? 'BSA' : 'PL' },
    utcDate: '2026-10-04T21:00:00Z', status: 'TIMED',
    homeTeam: { id: 101, name: 'Flamengo' }, awayTeam: { id: 102, name: 'Palmeiras' },
    score: { duration: 'REGULAR', fullTime: { home: null, away: null } } });
  await combined.route('https://raw.githubusercontent.com/juanssess/bubba-games/football-data/**', route => route.fulfill({ json: {
    version: 1, generatedAt: stamp, competitions: ['PL', 'BSA'], matches: [shared(900), shared(901),
      { ...shared(902), status: 'IN_PLAY', minute: 67, injuryTime: 0,
        score: { duration: 'REGULAR', fullTime: { home: 1, away: 0 } } }]
  } }));
  await combined.goto(base + '/?nosync=1');
  await combined.evaluate(() => MC.closeModal());
  await combined.waitForFunction(() => MCFootball.status().ready && !MCFootball.status().loading);
  assert.match(await combined.locator('.fb-match').first().innerText(), /Segundo tiempo/);
  assert.doesNotMatch(await combined.locator('.fb-match').first().innerText(), /67'/);
  assert.equal(await combined.locator('[data-fb-match="fd-902"][data-fb-pick="home"]').isDisabled(), true);
  await combined.selectOption('#fbCompetition', 'fd-BSA');
  assert.equal(await combined.locator('.fb-match').count(), 1);
  assert.match(await combined.locator('.fb-source').innerText(), /football-data.org/);
  assert.equal(await combined.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await combined.locator('[data-fb-match="fd-901"][data-fb-pick="draw"]').click();
  assert.equal(await combined.locator('#spSlipCount').innerText(), '1');
  assert.match(await combined.locator('#spSlip').innerText(), /Brasileir/i);
  await combined.locator('#spStake').fill('100');
  await combined.locator('#spPlace').click();
  const balance = await combined.evaluate(() => MC.getBalance());
  await combined.route('https://raw.githubusercontent.com/juanssess/bubba-games/football-data/**', route => route.fulfill({ json: {
    version: 1, generatedAt: '2026-10-04T15:11:00Z', competitions: ['PL', 'BSA'],
    matches: [shared(900), { ...shared(901), status: 'FINISHED', score: { duration: 'REGULAR', fullTime: { home: 0, away: 0 } } }]
  } }));
  await combined.clock.setFixedTime(new Date('2026-10-04T15:11:00Z'));
  await combined.locator('#spSimulate').click();
  await combined.waitForFunction(() => MC.state.sports.tickets.length === 0);
  assert.ok(await combined.evaluate(() => MC.getBalance()) > balance, 'Shared provider results settle the virtual coupon');
  await combined.close();
  console.log('PASS: football homepage, combined providers, responsive cards, coupons, results and fallback.');
} finally { await browser.close(); }
