import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const runtime = process.argv[2];
const { chromium } = await import(pathToFileURL(runtime).href);
const { PNG } = createRequire(runtime)('pngjs');
const url = process.argv[3] || 'http://localhost:8123';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url + '/games/slots/index.html?game=classic20&debug=1');
  await page.waitForFunction(() => !!window.__maverick);
  const scene = await page.evaluate(() => {
    const { app, reelSet } = __maverick;
    const layer = app.stage.getChildByLabel('maverick-atmosphere');
    const bounds = reelSet.view.getBounds();
    return { index: app.stage.children.indexOf(layer), eventMode: layer.eventMode,
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
  });
  assert.equal(scene.index, 1, 'Atmosphere is behind the game and above the original backdrop');
  assert.equal(scene.eventMode, 'none', 'Atmosphere cannot intercept controls');

  const first = PNG.sync.read(await page.screenshot());
  await page.waitForTimeout(700);
  const second = PNG.sync.read(await page.screenshot({ path: 'tmp/requests-maverick-desktop.png' }));
  let changed = 0, changedReels = 0;
  const colors = new Set();
  for (let y = 0; y < first.height; y++) for (let x = 0; x < first.width; x++) {
    const i = (y * first.width + x) * 4;
    colors.add(first.data[i] + ',' + first.data[i + 1] + ',' + first.data[i + 2]);
    const difference = Math.abs(first.data[i] - second.data[i]) +
      Math.abs(first.data[i + 1] - second.data[i + 1]) + Math.abs(first.data[i + 2] - second.data[i + 2]);
    if (difference > 8) {
      changed++;
      const b = scene.bounds;
      if (x > b.x + 4 && x < b.x + b.width - 4 && y > b.y + 4 && y < b.y + b.height - 4) changedReels++;
    }
  }
  assert.ok(colors.size > 500, 'Real game assets and canvas are nonblank');
  assert.ok(changed > 100, 'Background visibly animates');
  assert.equal(changedReels, 0, 'Ambient motion does not alter the reel pixels');

  for (const [name, width, height] of [['mobile', 390, 844], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const alignment = await page.evaluate(() => {
      const app = __maverick.app;
      const background = app.stage.children[0];
      const layer = app.stage.getChildByLabel('maverick-atmosphere');
      return { dx: layer.x - background.x, dy: layer.y - background.y,
        scale: layer.scale.x - background.scale.x,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(alignment, { dx: 0, dy: 0, scale: 0, overflow: false }, name + ': image-aligned effects');
    assert.equal(await page.evaluate(() => {
      const b = __maverick.reelSet.view.getBounds();
      return b.x >= 0 && b.y >= 0 && b.x + b.width <= innerWidth && b.y + b.height <= innerHeight;
    }), true, name + ': all reels fit the viewport');
    const before = PNG.sync.read(await page.screenshot());
    await page.waitForTimeout(600);
    const after = PNG.sync.read(await page.screenshot({ path: 'tmp/requests-maverick-' + name + '.png' }));
    let moving = 0;
    for (let i = 0; i < before.data.length; i += 4) {
      if (Math.abs(before.data[i] - after.data[i]) + Math.abs(before.data[i + 1] - after.data[i + 1]) +
          Math.abs(before.data[i + 2] - after.data[i + 2]) > 2) moving++;
    }
    assert.ok(moving > 10, name + ': animated background remains visible');
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !__maverick.app.stage.getChildByLabel('maverick-atmosphere').visible);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => __maverick.app.stage.getChildByLabel('maverick-atmosphere').visible);
  const settled = await page.evaluate(async () => __maverick.spin());
  assert.equal(settled, true, 'Reels still spin and settle');
  assert.equal(await page.evaluate(() => __maverick.busy), false);

  for (const game of ['sebusca', 'vendimia']) {
    await page.goto(url + '/games/slots/index.html?game=' + game + '&debug=1');
    await page.waitForFunction(() => !!window.__maverick);
    assert.equal(await page.evaluate(() => !!__maverick.app.stage.getChildByLabel('maverick-atmosphere')), false,
      'Other games remain unchanged: ' + game);
  }

  await page.goto(url + '/?nosync=1');
  await page.evaluate(() => {
    MC.closeModal();
    MCCatalog.games.maverick.frameUrl += '&debug=1';
    MC.showView('maverick');
  });
  const frame = await (await page.locator('#provFrame').elementHandle()).contentFrame();
  await frame.waitForFunction(() => !!window.__maverick);
  await page.evaluate(() => document.body.classList.add('sin-animaciones'));
  await frame.waitForFunction(() => !__maverick.app.stage.getChildByLabel('maverick-atmosphere').visible);
  await page.evaluate(() => document.body.classList.remove('sin-animaciones'));
  await frame.waitForFunction(() => __maverick.app.stage.getChildByLabel('maverick-atmosphere').visible);
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log('PASS: animated canvas pixels, protected reels, responsive alignment, motion preferences, spin and other games.');
} finally {
  await browser.close();
}
