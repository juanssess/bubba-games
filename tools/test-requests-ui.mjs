import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + '\\')) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/?nosync=1');
  await page.evaluate(() => {
    MC.closeModal();
    const u = { uid: 'google:test-player', name: 'Jugador', rol: 'jugador' };
    MC.auth.current = () => u;
    MC.auth.all = () => [u];
    window.testCloud = {
      disponible: () => true, esAgente: () => u.rol === 'agente', estado: () => 'ok',
      caja: () => ({ saldo: 498000, entregado: 2000 }),
      todas: () => [
        { id: 'one', uid: 'test-player', nombre: 'Jugador', monto: 1000, at: Date.now(), estado: 'pendiente', nube: true },
        { id: 'two', uid: 'test-player', nombre: 'Jugador', monto: 2000, at: Date.now() - 10000, estado: 'aceptada', nube: true }
      ],
      resolver: async () => ({ ok: true })
    };
    MCPeticiones.attachNube(testCloud);
    window.testUser = u;
    MCCajero.open ? MCCajero.open() : MC.showView('cajero');
  });
  for (const [name, width, height] of [['desktop', 1366, 900], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: 'tmp/requests-player-' + name + '.png', fullPage: true, animations: 'disabled' });
    assert.ok(await page.locator('#cajeroBody').innerText().then(t => t.includes('Aceptada') && t.includes('Esperando')));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, name + ': no horizontal overflow');
  }
  await page.evaluate(() => {
    testUser.rol = 'agente'; MCRoles.aplicar(); MCAgente.open();
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sbScrim').classList.remove('show');
  });
  for (const [name, width, height] of [['desktop', 1366, 900], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: 'tmp/requests-agent-' + name + '.png', fullPage: true, animations: 'disabled' });
    assert.ok((await page.locator('#agenteBody').innerText()).includes('Tu caja online'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ': agent overflow');
  }
  assert.deepEqual(errors, [], 'No runtime errors in online request views');
  console.log('Request UI checks passed on desktop and mobile; screenshots saved in tmp.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
