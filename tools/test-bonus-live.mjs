import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const runtime = process.argv[2];
const { chromium } = await import(pathToFileURL(runtime).href);
const { PNG } = createRequire(runtime)('pngjs');
const base = process.argv[3] || 'http://localhost:8123';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const game of ['classic20', 'sebusca', 'vendimia']) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(game => localStorage.setItem('turbo.' + game, '1'), game);
    await page.goto(base + '/games/slots/index.html?game=' + game + '&debug=1');
    await page.waitForFunction(() => window.__maverick);
    await page.evaluate(() => { window.__finished = false; void __maverick.buy().then(() => { window.__finished = true; }); });
    await page.locator('.cinema-continue').waitFor();
    await page.locator('.cinema-continue').click();
    await page.waitForFunction(() => document.body.hasAttribute('data-bonus-theme'));
    assert.equal(await page.locator('.bonus-live').count(),0,'No extra banner during the bonus');
    for (const [name, width, height] of [['desktop', 1366, 850], ['mobile', 390, 844], ['landscape', 844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(180);
      const fit = await page.evaluate(() => {
        const b = __maverick.reelSet.view.getBounds();
        return { reels: b.y >= 0 && b.x >= 0 && b.x + b.width <= innerWidth + 1 && b.y + b.height <= innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.deepEqual(fit, { reels: true, overflow: false }, game + ' ' + name);
      const shot = PNG.sync.read(await page.screenshot({ path: 'tmp/requests-live-bonus-' + game + '-' + name + '.png' }));
      const colors = new Set();
      for (let i = 0; i < shot.data.length; i += 40) colors.add(shot.data[i] + ',' + shot.data[i + 1] + ',' + shot.data[i + 2]);
      assert.ok(colors.size > 500, 'Actual reels and illustrated assets must be nonblank');
    }
    await page.keyboard.press('Space');
    await page.locator('.cinema[data-kind="summary"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(1600);
    assert.match(await page.locator('.cinema-value').innerText(), /^[\d.]+$/, 'Final payout remains visible');
    await page.locator('.cinema-continue').click();
    await page.waitForFunction(() => window.__finished);
    assert.equal(await page.locator('.bonus-live').count(), 0);
    assert.equal(await page.evaluate(() => document.body.hasAttribute('data-bonus-theme')), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base + '/?nosync=1');
  await page.waitForFunction(() => window.MCSlots5);
  await page.evaluate(() => { MC.closeModal(); MC.showView('slots5'); });
  await page.locator('#g5Buy').click();
  await page.getByRole('button', { name: 'Comprar', exact: true }).click();
  await page.locator('.cinema-continue').click();
  await page.locator('.g5-board--bonus').waitFor();
  assert.equal(await page.locator('.bonus-live').count(),0);
  await page.locator('.g5-board--bonus').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tmp/requests-live-bonus-gold-mobile.png' });
  await page.locator('.cinema[data-kind="summary"]').waitFor({ timeout: 120000 });
  await page.waitForTimeout(1600);
  await page.locator('.cinema-continue').click();
  assert.equal(await page.locator('.g5-board--bonus').count(), 0);
  assert.equal(await page.locator('.bonus-live').count(), 0);
  await page.close();
  console.log('PASS: actual bonus rounds, all four engines, responsive canvas, no invasive banner, payout summaries and cleanup.');
} finally { await browser.close(); }
