import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../tmp/firebase-cli/package.json', import.meta.url));
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const sdk = require('firebase/firestore');
const source = readFileSync(new URL('../src/progress/peticiones-nube.js', import.meta.url), 'utf8');
const owner = 'ZlnbdcBiASbUoEy5vheJBHTIDFg1';
let rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
if (process.env.BUBBA_RULES_DEBUG) {
  rules = rules.replace(/(get(?:After)?\([^;\n]+?\)\.data)/g, 'debug($1)');
}
const env = await initializeTestEnvironment({ projectId: 'demo-bubba',
  firestore: { host: '127.0.0.1', port: 8088, rules } });
const clients = [];
function browser(uid, agent = false) {
  const db = env.authenticatedContext(uid).firestore();
  const context = { window: {}, document: { querySelector: () => null },
    MC: { auth: { current: () => ({ uid: 'google:' + uid, name: uid }) } },
    MCRoles: { activoEsAgente: () => agent } };
  // Keep SDK data in the same realm: Firebase rejects cross-realm plain objects.
  new Function('window', 'MC', 'MCRoles', 'document', source)(context.window, context.MC, context.MCRoles, context.document);
  const client = context.window.MCPeticionesNube.crear(sdk, db, () => uid);
  clients.push(client);
  return { client, db };
}
try {
  await env.clearFirestore();
  const agent = browser(owner, true), agent2 = browser(owner, true);
  const player = browser('player'), phone = browser('player'), stranger = browser('stranger', true);
  await Promise.all([agent, agent2, player, phone, stranger].map(b => b.client.iniciar()));
  for (const c of clients) assert.equal(c.estado(), 'ok', c.error());
  const slot = sdk.doc(player.db, 'pedidosNube', 'player');
  const box = sdk.doc(agent.db, 'cajasAgentes', owner);
  const credits = sdk.doc(player.db, 'fichasRecibidas', 'player');

  const duplicates = await Promise.allSettled([player.client.pedir(1000), phone.client.pedir(1000)]);
  assert.equal(duplicates.filter(r => r.status === 'fulfilled').length, 1);
  const p = (await sdk.getDoc(slot)).data();
  const h = sdk.doc(player.db, 'historialPedidos', p.id);
  await assertFails(sdk.getDoc(sdk.doc(stranger.db, 'historialPedidos', p.id)));
  await assertFails(sdk.getDoc(sdk.doc(stranger.db, 'players', 'player')));
  await assertFails(sdk.setDoc(sdk.doc(player.db, 'fichasRecibidas', 'player'), { total: 1000, ultimoPedido: p.id }));
  await assertFails(sdk.setDoc(sdk.doc(stranger.db, 'cajasAgentes', 'stranger'), { saldo: 500000, entregado: 0, ultimoPedido: '' }));
  await assertFails(sdk.updateDoc(h, { estado: 'aceptada', resueltaAt: Date.now() }));

  // Even the authorized agent cannot accept a request without both sides of the transfer.
  const partial = sdk.writeBatch(agent.db);
  const accepted = { ...p, estado: 'aceptada', resueltaAt: Date.now() };
  partial.set(sdk.doc(agent.db, 'pedidosNube', 'player'), accepted);
  partial.set(sdk.doc(agent.db, 'historialPedidos', p.id), accepted);
  await assertFails(partial.commit());
  assert.equal((await sdk.getDoc(slot)).data().estado, 'pendiente');

  await Promise.all([agent.client.resolver(p.id, 'aceptada'), agent2.client.resolver(p.id, 'aceptada')]);
  assert.equal((await sdk.getDoc(credits)).data().total, 1000);
  assert.equal((await sdk.getDoc(box)).data().saldo, 499000);
  assert.equal((await sdk.getDoc(h)).data().estado, 'aceptada');
  await assertFails(sdk.updateDoc(box, { saldo: 500000 }));
  await assertFails(sdk.updateDoc(h, { monto: 2000 }));
  await assertFails(sdk.deleteDoc(h));

  await phone.client.pedir(500000);
  const tooMuch = (await sdk.getDoc(slot)).data();
  await assert.rejects(agent.client.resolver(tooMuch.id, 'aceptada'), /alcanza/);
  assert.equal((await sdk.getDoc(slot)).data().estado, 'pendiente');
  await phone.client.resolver(tooMuch.id, 'cancelada');
  assert.equal((await sdk.getDoc(credits)).data().total, 1000);
  await assert.rejects(agent.client.resolver(tooMuch.id, 'aceptada'), /resuelto/);

  await player.client.pedir(1000);
  const reject = (await sdk.getDoc(slot)).data();
  await assertSucceeds(agent.client.resolver(reject.id, 'rechazada'));
  assert.equal((await sdk.getDoc(credits)).data().total, 1000);
  assert.equal((await sdk.getDoc(box)).data().saldo, 499000);

  await player.client.pedir(1000);
  const race = (await sdk.getDoc(slot)).data();
  const outcomes = await Promise.allSettled([
    player.client.resolver(race.id, 'cancelada'), agent.client.resolver(race.id, 'aceptada')
  ]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  const final = (await sdk.getDoc(slot)).data();
  const moved = final.estado === 'aceptada' ? 1000 : 0;
  assert.equal((await sdk.getDoc(credits)).data().total, 1000 + moved);
  assert.equal((await sdk.getDoc(box)).data().saldo, 499000 - moved);
  console.log('Firestore emulator checks passed: real rules, atomic approvals, permissions, history and races.');
} catch (e) {
  const coverage = await fetch('http://127.0.0.1:8088/emulator/v1/projects/demo-bubba:ruleCoverage');
  writeFileSync(new URL('../tmp/rules-coverage.json', import.meta.url), JSON.stringify(await coverage.json(), null, 2));
  throw e;
} finally {
  clients.forEach(c => c.parar());
  await env.cleanup();
}
