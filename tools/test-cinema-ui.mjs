import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] || 'http://localhost:8123';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('tmp', { recursive: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/bonus-preview', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/games/cinema.css?v=2"><script src="/src/ui/cinema.js?v=2"></script><body><button id="origin">Volver</button></body></html>' }));
  await page.goto(base + '/bonus-preview');
  await page.waitForFunction(() => window.MCCinema);
  for (const asset of ['environments.png', 'provider-atlas.png', 'originals-atlas.png']) {
    assert.equal(await page.evaluate(async url => {
      const img = new Image(); img.src = url; await img.decode(); return img.naturalWidth > 0;
    }, base + '/assets/illustrated/' + asset), true);
  }
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ['gold', 'classic20', 'sebusca', 'vendimia']) {
      for (const kind of ['intro', 'summary']) {
        await page.locator('#origin').focus();
        await page.evaluate(({ theme, kind }) => { void MCCinema.show({ theme, kind, spins: 12, total: 125480 }); }, { theme, kind });
        await page.waitForTimeout(kind === 'summary' ? 1600 : 750);
        assert.equal(await page.locator('.cinema').count(), 1);
        assert.equal(await page.locator('.cinema').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        const feature = page.locator(kind === 'intro' ? '.cinema-feature' : '.cinema-receipt');
        assert.equal(await feature.isVisible(), true);
        if (kind === 'summary') assert.equal(await page.locator('.cinema-value').innerText(), '125.480');
        for (const selector of ['.cinema-value', 'h2', '.cinema-continue']) {
          assert.equal(await page.locator(selector).evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
        }
        if (kind === 'intro' && viewport.height > 390) await page.screenshot({ path: `tmp/requests-bonus-${theme}-${viewport.width}.png` });
        await page.locator('.cinema-continue').click();
        assert.equal(await page.locator('.cinema').count(), 0);
        assert.equal(await page.locator('#origin').evaluate(el => el === document.activeElement), true);
      }
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { void MCCinema.show({ theme: 'gold', kind: 'summary', total: 0, spins: 10 }); });
  assert.equal(await page.locator('.cinema-value').innerText(), '0');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cinema').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: four bonus themes, exact totals, assets, desktop/mobile/landscape, focus and reduced motion.');
} finally { await browser.close(); }
