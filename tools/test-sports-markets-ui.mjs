import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.argv[3] || 'http://localhost:8123';
let now = Date.parse('2026-10-04T15:00:00Z');
const fixture = (id, league, home, away, stamp = '2026-10-04T21:00:00') => ({
  idEvent: id, idLeague: league, strSport: 'Soccer', idHomeTeam: id + '1', idAwayTeam: id + '2',
  strHomeTeam: home, strAwayTeam: away, strTimestamp: stamp, dateEvent: stamp.slice(0, 10), strTime: stamp.slice(11),
  strStatus: 'NS', intHomeScore: null, intAwayScore: null
});
const rows = [fixture('101', '4328', 'Arsenal', 'Chelsea'), fixture('102', '4328', 'Liverpool', 'Manchester City'),
  fixture('103', '4406', 'River Plate', 'Boca Juniors'), fixture('104', '4335', 'Real Madrid', 'Barcelona', '2026-10-05T21:00:00'),
  { ...fixture('105', '4332', 'Inter', 'Juventus', '2026-10-04T14:00:00'), strStatus: '1H', intHomeScore: 1, intAwayScore: 0 }];
const finals = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date(now));
  await page.route('https://raw.githubusercontent.com/juanssess/bubba-games/football-data/**', r => r.fulfill({ status: 404, json: {} }));
  await page.route('https://www.thesportsdb.com/api/**', async route => {
    const u = new URL(route.request().url());
    let events = [];
    if (u.pathname.includes('eventsday')) events = rows.filter(r => r.idLeague === u.searchParams.get('l') && r.dateEvent === u.searchParams.get('d'));
    if (u.pathname.includes('lookupevent')) events = finals[u.searchParams.get('id')] ? [finals[u.searchParams.get('id')]] : [];
    await route.fulfill({ json: u.pathname.includes('lookuptable') ? { table: [] } : { events } });
  });
  await page.goto(base + '/?nosync=1');
  await page.evaluate(() => MC.closeModal());
  await page.waitForFunction(() => MCFootball.status().ready && !MCFootball.status().loading);
  await page.evaluate(() => MC.showView('sports'));
  await page.waitForSelector('[data-sp-more="101"]');
  await page.locator('[data-sp-more="101"]').click();
  assert.equal(await page.locator('.sp-details .sp-market-section').count(), 4);
  const select = async (id, pick) => {
    await page.locator(`.sp-details [data-m="${id}"][data-p="${pick}"]`).click();
    assert.equal(await page.locator('#spSlipCount').innerText(), '1', 'One selection per event');
  };
  await select('101', 'dc_1x');
  await select('101', 'dnb_home');
  assert.match(await page.locator('#spSlip').innerText(), /Empate no válido/);
  await page.locator('[data-sp-category="goals"]').click();
  await select('101', 'home_over_05');
  assert.match(await page.locator('#spSlip').innerText(), /Arsenal: más de 0.5/);
  await page.locator('[data-sp-category="handicap"]').click();
  await select('101', 'hcp_home_m15');
  await page.locator('[data-sp-category="score"]').click();
  await select('101', 'score_2_1');
  assert.equal(await page.locator('.sp-details .sp-odd').count(), 19);
  await page.locator('[data-sp-category="combo"]').click();
  await select('101', 'home_btts_yes');
  await page.locator('#spClear').click();
  await page.locator('[data-sp-category="main"]').click();
  await page.locator('#spCat-main').press('ArrowRight');
  assert.equal(await page.locator('#spCat-goals').getAttribute('aria-selected'), 'true');
  await page.selectOption('#spCompetition', '4328');
  assert.equal(await page.locator('.sp-match').count(), 2);
  await page.locator('#spSearch').fill('Arsenal');
  assert.equal(await page.locator('.sp-match').count(), 1);
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['narrow', 320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ': no overflow');
    for (const category of ['main', 'goals', 'handicap', 'score', 'combo']) {
      await page.locator(`[data-sp-category="${category}"]`).click();
      const overlaps = await page.locator('.sp-details .sp-odd').evaluateAll(buttons => buttons.some(b => b.scrollWidth > b.clientWidth + 1));
      assert.equal(overlaps, false, name + ': ' + category + ' quotes fit');
    }
    await page.locator('[data-sp-category="goals"]').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'tmp/requests-sports-markets-' + name + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'oscuro'));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sp-match')).backgroundColor), 'rgb(25, 27, 31)');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => document.documentElement.setAttribute('data-tema', 'claro'));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sp-match')).backgroundColor), 'rgb(255, 255, 255)');
  await page.locator('#spSearch').fill('');
  await page.selectOption('#spCompetition', 'all');
  await page.selectOption('#spWhen', 'future');
  assert.equal(await page.locator('.sp-match').count(), 1);
  await page.selectOption('#spWhen', 'all');
  await page.locator('#spOpenOnly').check();
  assert.equal(await page.locator('.sp-match').count(), 4);
  await page.locator('#spOpenOnly').uncheck();
  await page.locator('[data-sp-more="105"]').click();
  assert.equal(await page.locator('.sp-details button.sp-odd:not(:disabled)').count(), 0, 'In-play markets stay closed');
  await page.locator('[data-sp-more="101"]').click();
  const balance = await page.evaluate(() => MC.getBalance());
  await select('101', 'dnb_home');
  await page.locator('#spStake').fill('100');
  await page.locator('#spPlace').click();
  assert.equal(await page.evaluate(() => MC.getBalance()), balance - 100);
  await page.locator('[data-sp-tab="bets"]').click();
  assert.match(await page.locator('#spBetHistory').innerText(), /Pendiente/);
  await page.reload();
  await page.waitForFunction(() => MCFootball.status().ready && !MCFootball.status().loading);
  await page.evaluate(() => { MC.closeModal(); MC.showView('sports'); });
  assert.equal(await page.evaluate(() => MC.state.sports.tickets.length), 1, 'Expanded markets survive reload');
  finals['101'] = { ...rows[0], strStatus: 'FT', intHomeScore: 0, intAwayScore: 0 };
  now += 601000;
  await page.clock.setFixedTime(new Date(now));
  await page.locator('#spSimulate').click();
  await page.waitForFunction(() => MC.state.sports.tickets.length === 0);
  assert.equal(await page.evaluate(() => MC.getBalance()), balance, 'Single DNB draw refunds exactly');
  await page.locator('[data-sp-tab="bets"]').click();
  await page.selectOption('#spHistoryFilter', 'refunded');
  assert.equal(await page.locator('.sp-bet').count(), 1);
  assert.match(await page.locator('#spBetHistory').innerText(), /Devuelta/);
  await page.locator('[data-sp-tab="matches"]').click();
  await page.locator('[data-sp-more="101"]').click();
  await select('101', 'dnb_home');
  await page.locator('[data-m="102"][data-p="home"]').first().click();
  const quote = await page.evaluate(() => MCMarkets.odds(MCFootball.find('102')).home);
  await page.locator('#spPlace').click();
  finals['102'] = { ...rows[1], strStatus: 'FT', intHomeScore: 2, intAwayScore: 0 };
  now += 601000;
  await page.clock.setFixedTime(new Date(now));
  await page.locator('#spSimulate').click();
  await page.waitForFunction(() => MC.state.sports.tickets.length === 0);
  const paid = await page.evaluate(() => MC.getBalance());
  assert.ok(Math.abs(paid - (balance - 100 + 100 * quote)) <= 1, 'A pushed leg becomes 1 in a combination');
  await page.locator('#spSimulate').click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => MC.getBalance()), paid, 'Settlement is credited once');
  await page.locator('[data-sp-tab="rules"]').click();
  assert.match(await page.locator('.sp-rules').innerText(), /90 minutos/);
  assert.deepEqual(errors, []);
  console.log('PASS: expanded markets, filters, keyboard navigation, closed markets, mobile layout, persistence, DNB refunds, history and combinadas.');
} finally { await browser.close(); }
