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
    const now = Date.now();
    const old = now - 10 * 86400000;
    const agent = { uid: 'google:agent-test', name: 'Agente', rol: 'agente' };
    window.panelAgent = agent;
    MC.auth.current = () => agent;
    MC.auth.all = () => [agent];
    window.panelRequests = [
      { id: 'new', uid: 'player-b', nombre: 'Bruno', monto: 500, at: now, estado: 'pendiente' },
      { id: 'old', uid: 'player-a', nombre: 'Jos\u00e9', monto: 1000, at: old, estado: 'pendiente' },
      { id: 'done', uid: 'player-c', nombre: 'Carla', monto: 2000, at: old, resueltaAt: now, estado: 'aceptada' },
      { id: 'past', uid: 'player-d', nombre: 'Diego', monto: 3000, at: old, resueltaAt: old, estado: 'aceptada' },
      { id: 'reject', uid: 'player-e', nombre: 'Eva', monto: 4000, at: now, resueltaAt: now, estado: 'rechazada' }
    ];
    MCPeticiones.attachNube({
      disponible: () => true, esAgente: () => true, estado: () => 'ok',
      caja: () => ({ saldo: 498000, entregado: 2000 }),
      todas: limit => panelRequests.slice(0, limit),
      resolver: async () => ({ ok: true })
    });
    MCRoles.aplicar(); MCAgente.open();
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sbScrim').classList.remove('show');
  });
  assert.equal(await page.locator('.ag-pedido').count(), 4, 'Old resolved requests excluded, old pending retained');
  assert.match(await page.locator('.ag-pedido').first().innerText(), /Jos\u00e9/, 'Oldest pending first');
  await page.selectOption('#agFiltro', 'pendiente');
  assert.equal(await page.locator('.ag-pedido').count(), 2);
  await page.locator('#agBusqueda').pressSequentially('jose');
  assert.equal(await page.locator('.ag-pedido').count(), 1, 'Accent-insensitive search');
  assert.equal(await page.locator('#agBusqueda').inputValue(), 'jose', 'Typing preserves focus across renders');
  await page.evaluate(() => MCAgente.render());
  assert.equal(await page.locator('#agBusqueda').inputValue(), 'jose', 'Live updates preserve filters');
  await page.locator('#agBusqueda').fill('player-b');
  assert.match(await page.locator('.ag-pedido').innerText(), /Bruno/, 'Search by player ID');
  await page.locator('#agBusqueda').fill('no existe');
  assert.equal(await page.locator('.ag-pedido').count(), 0);
  assert.match(await page.locator('.ag-vacio').innerText(), /No hay pedidos/);
  await page.locator('#agBusqueda').fill('');
  await page.selectOption('#agFiltro', 'todos');
  await page.locator('[data-tab="movimientos"]').click();
  assert.equal(await page.locator('.ag-pedido').count(), 1, 'Online movement date filter works');
  assert.match(await page.locator('.ag-resultados').first().innerText(), /2[.,]?000 fichas/);
  await page.locator('[data-per="todo"]').click();
  assert.equal(await page.locator('.ag-pedido').count(), 2);
  await page.locator('[data-tab="pedidos"]').click();
  await page.selectOption('#agFiltro', 'rechazada');
  assert.match(await page.locator('.ag-pedido').innerText(), /Eva/);
  await page.selectOption('#agFiltro', 'pendiente');
  await page.evaluate(() => {
    panelRequests = Array.from({ length: 45 }, (_, i) => ({
      id: 'pending-' + i, uid: 'uid-' + i, nombre: 'Jugador ' + i,
      monto: 100, at: Date.now() - i * 1000, estado: 'pendiente'
    }));
    MCAgente.render();
  });
  assert.equal(await page.locator('.ag-pedido').count(), 45, 'No display cap hides pending requests');
  await page.evaluate(() => {
    panelRequests = [
      { id: 'long', uid: 'long', nombre: 'UnNombreDeJugadorMuyLargoSinEspaciosQueNoDebeRomperElPanel',
        monto: 500000, at: Date.now(), estado: 'pendiente', nota: '<img src=x onerror=alert(1)>' },
      { id: 'short', uid: 'short', nombre: 'Ana', monto: 500, at: Date.now(), estado: 'pendiente' }
    ];
    MCAgente.render();
  });
  assert.equal(await page.locator('.ag-pedido-nota img').count(), 0, 'Request text is escaped');
  for (const [name, width, height] of [['desktop', 1366, 900], ['mobile', 390, 844], ['narrow', 320, 740]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name + ': no overflow');
    await page.screenshot({ path: 'tmp/requests-agent-filters-' + name + '.png', fullPage: true, animations: 'disabled' });
  }
  await page.evaluate(() => {
    panelAgent.uid = 'local-agent';
    const player = { uid: 'local-player', name: 'Jos\u00e9', rol: 'jugador', avatar: 'J' };
    MC.auth.all = () => [panelAgent, player];
    MC.auth.leerEstado = () => ({ balance: 1000, xp: 0, stats: {}, diario: [] });
    MC.state.caja = [
      { uid: player.uid, nombre: player.name, delta: 1000, saldo: 2000, at: Date.now() },
      { uid: player.uid, nombre: player.name, delta: -500, saldo: 1500, at: Date.now() }
    ];
    MCRoles.aplicar(); MCAgente.render();
  });
  await page.locator('[data-tab="jugadores"]').click();
  await page.locator('#agBusqueda').fill('jose');
  assert.equal(await page.locator('.ag-row:not(.ag-head)').count(), 1, 'Local player search');
  await page.locator('#agBusqueda').fill('missing');
  assert.equal(await page.locator('.ag-row:not(.ag-head)').count(), 0);
  await page.locator('#agBusqueda').fill('');
  await page.locator('[data-tab="movimientos"]').click();
  await page.selectOption('#agFiltro', 'cargas');
  assert.equal(await page.locator('.ag-row:not(.ag-head)').count(), 1);
  assert.match(await page.locator('.ag-row:not(.ag-head)').innerText(), /\+1[.,]?000/);
  await page.selectOption('#agFiltro', 'descuentos');
  assert.equal(await page.locator('.ag-row:not(.ag-head)').count(), 1);
  assert.match(await page.locator('.ag-row:not(.ag-head)').innerText(), /500/);
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log('Agent panel checks passed: search, status, periods, totals, pending queue and responsive views.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
