import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Shared transactional store with optimistic conflicts, independent browser sessions.
const data = new Map(), versions = new Map(), listeners = new Set();
let serial = 0, failCommit = false;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const snapshot = key => ({ exists: () => data.has(key), data: () => clone(data.get(key)) });
function read(target) {
  if (target.key) return snapshot(target.key);
  let rows = [...data].filter(([key]) => key.startsWith(target.col + '/'));
  for (const f of target.filters) {
    if (f.type === 'where') rows = rows.filter(([, p]) => p[f.field] === f.value);
    if (f.type === 'order') rows.sort((a, b) => (a[1][f.field] - b[1][f.field]) * (f.dir === 'desc' ? -1 : 1));
    if (f.type === 'limit') rows = rows.slice(0, f.count);
  }
  return { forEach: fn => rows.forEach(([key]) => fn(snapshot(key))) };
}
function notify() { for (const l of listeners) l.fn(read(l.target)); }
const store = {
  collection: (_db, col) => ({ col }),
  doc(parent, col, id) {
    if (parent.col) { id = 'request' + (++serial); col = parent.col; }
    return { key: col + '/' + id, id };
  },
  where: (field, _op, value) => ({ type: 'where', field, value }),
  orderBy: (field, dir) => ({ type: 'order', field, dir }),
  limit: count => ({ type: 'limit', count }),
  query: (collection, ...filters) => ({ col: collection.col, filters }),
  onSnapshot(target, fn) {
    const l = { target, fn }; listeners.add(l);
    queueMicrotask(() => { if (listeners.has(l)) fn(read(target)); });
    return () => listeners.delete(l);
  },
  async runTransaction(_db, fn) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const seen = new Map(), writes = new Map();
      const result = await fn({
        async get(ref) {
          assert.equal(writes.size, 0, 'Firestore requires all reads before writes');
          seen.set(ref.key, versions.get(ref.key) || 0);
          return snapshot(ref.key);
        },
        set: (ref, value) => writes.set(ref.key, clone(value))
      });
      if ([...seen].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
      if (failCommit) throw new Error('Connection interrupted');
      for (const [key, value] of writes) { data.set(key, value); versions.set(key, (versions.get(key) || 0) + 1); }
      notify(); return result;
    }
    throw new Error('Too much contention');
  }
};
const source = readFileSync(new URL('../src/progress/peticiones-nube.js', import.meta.url), 'utf8');
const owner = 'ZlnbdcBiASbUoEy5vheJBHTIDFg1';
function browser(uid, agent = false) {
  let active = true;
  const u = { uid: 'google:' + uid, name: uid, rol: agent ? 'agente' : 'jugador' };
  const context = vm.createContext({ window: {}, document: { querySelector: () => null },
    MC: { auth: { current: () => active ? u : { uid: 'local', name: 'Local' } } },
    MCRoles: { activoEsAgente: () => agent } });
  vm.runInContext(source, context);
  const api = context.window.MCPeticionesNube;
  return { client: api.crear(store, {}, () => uid), integrate: api.integrar, leave: () => { active = false; } };
}

const agent = browser(owner, true), agent2 = browser(owner, true);
const player = browser('player'), phone = browser('player'), other = browser('other');
await Promise.all([agent, agent2, player, phone, other].map(b => b.client.iniciar()));
assert.equal(agent.client.caja().saldo, 500000, 'A second device must not initialize the float twice');
const duplicate = await Promise.allSettled([player.client.pedir(1000, 'one'), phone.client.pedir(2000, 'two')]);
assert.equal(duplicate.filter(r => r.status === 'fulfilled').length, 1, 'Only one pending request across devices');
const request = player.client.todas()[0];
assert.equal(agent.client.todas()[0].id, request.id, 'Agent sees requests from a separate session');
assert.equal(other.client.todas().length, 0, 'Another player sees no requests from this player');
await assert.rejects(other.client.resolver(request.id, 'cancelada'));
await assert.rejects(player.client.resolver(request.id, 'aceptada'));
await Promise.all([agent.client.resolver(request.id, 'aceptada'), agent2.client.resolver(request.id, 'aceptada')]);
assert.equal(data.get('fichasRecibidas/player').total, request.monto);
assert.equal(agent.client.caja().saldo, 500000 - request.monto, 'Concurrent acceptance debits only once');
assert.equal(phone.client.todas()[0].estado, 'aceptada');

const state = { balance: 5000, fichasNube: 0 };
assert.equal(player.integrate(state, request.monto), request.monto);
assert.equal(player.integrate(state, request.monto), 0, 'Repeated snapshot must not credit twice');
state.balance -= 100;
assert.equal(player.integrate(state, request.monto + 500), 500, 'Credits preserve bets placed while syncing');
assert.equal(state.balance, 5400 + request.monto);
const stale = { balance: 2500, fichasNube: 0 };
player.integrate(stale, request.monto);
assert.equal(stale.balance, 2500 + request.monto, 'A stale uploaded state must include remote credits');
assert.throws(() => player.integrate(state, request.monto), /validar/);

await player.client.pedir(1000);
const cancel = player.client.todas().find(p => p.estado === 'pendiente');
const race = await Promise.allSettled([
  player.client.resolver(cancel.id, 'cancelada'), agent.client.resolver(cancel.id, 'aceptada')
]);
assert.equal(race.filter(r => r.status === 'fulfilled').length, 1, 'Cancellation and acceptance cannot both succeed');
const cancelledState = data.get('historialPedidos/' + cancel.id).estado;
assert.equal(data.get('fichasRecibidas/player').total, request.monto + (cancelledState === 'aceptada' ? 1000 : 0));

await player.client.pedir(1000);
const rejected = player.client.todas().find(p => p.estado === 'pendiente');
const before = clone(data.get('fichasRecibidas/player'));
failCommit = true;
await assert.rejects(agent.client.resolver(rejected.id, 'aceptada'), /interrupted/);
assert.deepEqual(data.get('fichasRecibidas/player'), before);
assert.equal(data.get('historialPedidos/' + rejected.id).estado, 'pendiente');
failCommit = false;
await agent.client.resolver(rejected.id, 'rechazada');
assert.deepEqual(data.get('fichasRecibidas/player'), before, 'Rejection must not move balances');
assert.ok(player.client.todas().some(p => p.id === rejected.id && p.estado === 'rechazada'));

await other.client.pedir(500000);
const excessive = other.client.todas()[0];
await assert.rejects(agent.client.resolver(excessive.id, 'aceptada'), /alcanza/);
assert.equal(data.get('historialPedidos/' + excessive.id).estado, 'pendiente');
await other.client.resolver(excessive.id, 'cancelada');

const reconnected = browser('player');
await reconnected.client.iniciar();
assert.ok(reconnected.client.todas().some(p => p.id === request.id), 'History survives closing the browser');
player.leave();
await assert.rejects(player.client.pedir(1000), /Google/);
for (const b of [agent, agent2, player, phone, other, reconnected]) b.client.parar();
assert.equal(listeners.size, 0, 'Closing sessions releases all subscriptions');
console.log('Cloud request checks passed: independent sessions, atomic transfers, conflicts, retries, credits and history.');
