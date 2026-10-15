import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] || 'http://127.0.0.1:8123';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('tmp', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.addInitScript(() => localStorage.setItem('bubba_games_welcome_v1', '1'));
  await page.goto(base);
  await page.waitForFunction(() => window.MCBowling && window.MC?.getGame('bowling'));
  await page.locator('.gcard[data-game="bowling"]').first().click();
  assert.equal(await page.locator('#view-bowling').isVisible(), true);
  assert.equal(await page.locator('.bw-pin').count(), 3);
  await page.locator('#view-bowling').screenshot({ path: 'tmp/bowling-desktop.png' });
  await page.evaluate(() => { MC.state.soundOn = false; MCBote.ronda = () => 0; MCPremio.celebrar = () => {}; });
  // Una ronda animada real, doble lanzamiento y salida durante el tiro.
  await page.evaluate(() => {
    MC.state.balance = 5000;
    MC.rtp.factor = () => 1;
    MC.randInt = () => 1;
    MC.rtp.fichas = Math.round;
    MC.showView('bowling');
    document.getElementById('bw-throw').click();
    document.getElementById('bw-throw').click();
    MC.showView('lobby');
    MC.showView('bowling');
  });
  assert.equal(await page.evaluate(() => MC.getCurrentGame()), 'bowling');
  assert.equal(await page.evaluate(() => MC.getBalance()), 4900);
  assert.equal(await page.locator('#bw-up').isDisabled(), true);
  assert.equal(await page.locator('.bw-pin').first().isDisabled(), true);
  await page.waitForTimeout(900);
  assert.notEqual(await page.locator('#bw-ball').getAttribute('transform'), 'translate(400 490) scale(1)');
  await page.locator('#view-bowling').screenshot({ path: 'tmp/bowling-rolling.png' });
  await page.waitForFunction(() => !document.getElementById('bw-throw').disabled);
  assert.equal(await page.evaluate(() => MC.getBalance()), 5191);
  assert.equal(await page.evaluate(() => MC.state.history.filter(r => r.game === 'bowling').length), 1);
  assert.equal(await page.locator('.bw-pin.prize').count(), 1);
  assert.equal(await page.locator('.bw-pin.empty').count(), 2);
  await page.locator('#view-bowling').screenshot({ path: 'tmp/bowling-win.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Todos los cruces elección/premio: nueve rondas en la billetera real.
  for (let selected = 0; selected < 3; selected++) for (let winner = 0; winner < 3; winner++) {
    await page.locator('.bw-choice').nth(selected).click();
    await page.evaluate(w => { MC.randInt = () => w; }, winner);
    const before = await page.evaluate(() => ({ balance: MC.getBalance(), rounds: MC.state.stats.plays }));
    await page.locator('#bw-throw').click();
    await page.waitForFunction(() => !document.getElementById('bw-throw').disabled);
    const after = await page.evaluate(() => ({ balance: MC.getBalance(), rounds: MC.state.stats.plays, round: MC.state.history[0] }));
    assert.equal(after.balance, before.balance - 100 + (selected === winner ? 291 : 0));
    assert.equal(after.rounds, before.rounds + 1);
    assert.equal(after.round.game, 'bowling');
    assert.equal(after.round.returned, selected === winner ? 291 : 0);
    assert.equal(await page.locator('.bw-pin.hit').count(), 1);
    assert.equal(await page.locator('.bw-pin.prize').count(), 1);
  }
  assert.equal(await page.locator('.bw-history-chip').count(), 8);
  // El pago mostrado respeta el factor; una modificación a mitad de tiro no altera el pago capturado.
  await page.evaluate(() => { MC.rtp.factor = () => .8; MC.randInt = () => 2; MC.showView('bowling'); });
  assert.equal(await page.locator('#bw-payout').innerText(), '2,328x');
  assert.equal(await page.locator('#bw-rtp').innerText(), '77,6%');
  await page.locator('#bw-throw').click();
  await page.evaluate(() => { MC.rtp.factor = () => 1; });
  await page.waitForFunction(() => !document.getElementById('bw-throw').disabled);
  assert.equal(await page.evaluate(() => MC.state.history[0].returned), 233);
  // Saldo insuficiente: sin débito, ronda o bloqueo de controles.
  const rounds = await page.evaluate(() => { MC.state.balance = 0; return MC.state.stats.plays; });
  await page.locator('#bw-throw').click();
  assert.equal(await page.evaluate(() => MC.state.stats.plays), rounds);
  assert.equal(await page.locator('#bw-throw').isDisabled(), false);
  // Pantallas chicas, paisaje y selección por teclado.
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => MC.showView('bowling'));
    assert.equal(await page.locator('#view-bowling').evaluate(e => e.scrollWidth > e.clientWidth + 1), false);
    await page.locator('#view-bowling').screenshot({ path: `tmp/bowling-${viewport.width}.png` });
  }
  await page.locator('.bw-choice').first().focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#bw-target').innerText(), 'Pino 1');
  await page.locator('#bw-down').click();
  assert.equal(await page.locator('#bw-bet').innerText(), '50');
  await page.reload();
  await page.waitForFunction(() => window.MCBowling && window.MC?.getGame('bowling'));
  await page.evaluate(() => MC.showView('bowling'));
  assert.equal(await page.locator('.bw-history-chip').count(), 8);
  // Recargar con la bola en juego conserva el sorteo y cierra una sola vez.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const pendingBefore = await page.evaluate(() => {
    MC.state.balance = 5000;
    MC.rtp.factor = () => 1;
    MC.randInt = () => 1;
    MC.rtp.fichas = Math.round;
    return MC.state.stats.plays;
  });
  await page.locator('.bw-choice').nth(1).click();
  await page.locator('#bw-throw').click();
  await page.reload();
  await page.waitForFunction(() => window.MCBowling && window.MC?.getGame('bowling'));
  await page.evaluate(() => { MCBote.ronda = () => 0; MCPremio.celebrar = () => {}; MC.showView('bowling'); });
  await page.waitForFunction(() => !document.getElementById('bw-throw').disabled);
  assert.equal(await page.evaluate(() => MC.getBalance()), 5191);
  assert.equal(await page.evaluate(() => MC.state.stats.plays), pendingBefore + 1);
  assert.equal(await page.evaluate(() => MC.state.bowlingPending), null);
  await page.evaluate(() => MC.showView('bowling'));
  assert.equal(await page.evaluate(() => MC.getBalance()), 5191);
  assert.deepEqual(errors, []);
  console.log('PASS: real animation, 9 outcomes, exact wallet/history, double-click/navigation locks, RTP, insufficient balance, mobile/landscape, keyboard, history persistence and pending-round recovery.');
} finally { await browser.close(); }
