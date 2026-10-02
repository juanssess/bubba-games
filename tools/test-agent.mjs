import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function setup() {
  const storage = new Map(), states = new Map();
  const player = { uid: 'player', name: 'Jugador' };
  const agent = { uid: 'agent', name: 'Agente', role: 'agent' };
  let current = player, failRequest = false, failProfile = null;
  const MC = {
    state: { cajaAgente: { saldo: 5000, entregado: 0, comisionCobrada: 0 }, caja: [] },
    STARTING_CHIPS: 1000, fmt: String, toast() {}, modal() {},
    sound: { win() {}, click() {} }, save() {},
    auth: {
      /* Doble de MC.auth.uidFirebase (src/core/auth.js), que es el
         unico lugar donde vive la convencion '<proveedor>:<id>'.
         Si cambia alla, estas pruebas se caen ruidosamente. */
      uidFirebase: u => { var i = u && u.uid ? String(u.uid).indexOf(':') : -1;
        return i < 0 ? '' : String(u.uid).slice(i + 1); },
      esRemoto: u => { var i = u && u.uid ? String(u.uid).indexOf(':') : -1; return i >= 0; },
      current: () => current, all: () => [player, agent],
      leerEstado: uid => states.has(uid) ? JSON.parse(states.get(uid)) : null,
      escribirEstado(uid, state) {
        if (failProfile === uid) return false;
        states.set(uid, JSON.stringify(state)); return true;
      }
    }
  };
  states.set(player.uid, JSON.stringify({ balance: 2000 }));
  const roles = { esAgente: u => u.role === 'agent', activoEsAgente: () => current.role === 'agent' };
  const context = vm.createContext({
    MC, MCRoles: roles, window: {}, document: { getElementById: () => null },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem(key, value) { if (failRequest) throw new Error('Storage full'); storage.set(key, value); }
    }
  });
  for (const path of ['progress/peticiones.js', 'progress/caja.js', 'progress/caja-agente.js', 'ui/agente.js']) {
    let source = readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
    if (path === 'ui/agente.js') {
      source = source.replace('return { init: init, open: open, render: render };',
        'return { mover: mover, aceptar: aceptar };');
    }
    vm.runInContext(source, context);
    Object.assign(context, context.window);
  }
  return {
    MC, player, agent, storage, states,
    requests: context.MCPeticiones, panel: context.MCAgente,
    as: u => { current = u; },
    failRequest: value => { failRequest = value; },
    failProfile: uid => { failProfile = uid; },
    balance: () => MC.auth.leerEstado(player.uid).balance
  };
}

const s = setup();
assert.equal(s.requests.pedir(1000, 'Prueba').ok, true);
const request = s.requests.miPendiente();
assert.ok(s.requests.pedir(1000).error, 'Only one pending request per player');
assert.equal(s.requests.resolver(request.id, 'aceptada'), null, 'Players cannot resolve requests');
s.as(s.agent);
s.panel.aceptar(request.id);
assert.equal(s.balance(), 3000);
assert.equal(s.MC.state.cajaAgente.saldo, 4000);
assert.equal(s.MC.state.caja[0].pedidoId, request.id);
assert.equal(s.requests.todas()[0].estado, 'aceptada');
s.panel.aceptar(request.id);
assert.equal(s.balance(), 3000, 'Double acceptance cannot credit twice');
assert.equal(s.MC.state.caja.length, 1);
assert.equal(s.panel.mover(s.player.uid, -3500), false);
assert.equal(s.balance(), 3000, 'Cannot withdraw more than the player owns');
assert.equal(s.MC.state.cajaAgente.saldo, 4000);
assert.equal(s.panel.mover(s.player.uid, -500), true);
assert.equal(s.balance(), 2500);
assert.equal(s.MC.state.cajaAgente.saldo, 4500);
assert.equal(s.MC.state.cajaAgente.entregado, 500);
assert.equal(s.panel.mover(s.player.uid, Infinity), false);
assert.equal(s.panel.mover(s.agent.uid, 100), false);
s.as(s.player);
assert.equal(s.panel.mover(s.player.uid, 100), false);
assert.ok(s.requests.pedir(Infinity).error);
s.failRequest(true);
assert.ok(s.requests.pedir(100).error, 'Failed persistence cannot report a sent request');

for (const failure of ['player', 'agent', 'request', 'funds', 'missing']) {
  const t = setup();
  t.requests.pedir(failure === 'funds' ? 6000 : 1000);
  const p = t.requests.miPendiente();
  t.as(t.agent);
  if (failure === 'request') t.failRequest(true);
  else if (failure === 'missing') t.MC.auth.all = () => [t.agent];
  else if (failure !== 'funds') t.failProfile(failure);
  t.panel.aceptar(p.id);
  assert.equal(t.requests.todas()[0].estado, 'pendiente', failure);
  assert.equal(t.balance(), failure === 'request' ? 3000 : 2000, failure);
  assert.equal(t.MC.state.cajaAgente.saldo, failure === 'request' ? 4000 : 5000, failure);
  if (failure === 'request') {
    t.failRequest(false);
    t.panel.aceptar(p.id);
    assert.equal(t.balance(), 3000, 'Retry after failed request persistence credits only once');
    assert.equal(t.MC.state.cajaAgente.saldo, 4000);
    assert.equal(t.requests.todas()[0].estado, 'aceptada');
  }
}

const rejected = setup();
rejected.requests.pedir(1000);
const rejectedId = rejected.requests.miPendiente().id;
rejected.as(rejected.agent);
assert.equal(rejected.requests.resolver(rejectedId, 'invalid'), null);
assert.equal(rejected.requests.resolver(rejectedId, 'rechazada').estado, 'rechazada');
assert.equal(rejected.balance(), 2000);
assert.equal(rejected.MC.state.cajaAgente.saldo, 5000);

const retained = setup();
retained.storage.set('bubba_peticiones_v1', JSON.stringify([
  ...Array.from({ length: 120 }, (_, i) => ({ id: 'done' + i, uid: 'other', estado: 'rechazada', at: i + 2 })),
  { id: 'old', uid: 'old-player', estado: 'pendiente', at: 1 }
]));
retained.requests.pedir(1000);
assert.ok(retained.requests.pendientes().some(p => p.id === 'old'), 'History pruning preserves pending requests');

console.log('Agent checks passed: transfers, request lifecycle, permissions, retries and storage failures.');
