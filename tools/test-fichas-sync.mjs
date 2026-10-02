import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const storage = new Map();
let total = 1000, remote, changeWhileUploading = false;
const MC = {
  state: { balance: 5000, fichasNube: 0, at: 10 },
  auth: {
    current: () => ({ uid: 'google:player' }), claveEstado: uid => uid,
    escribirEstado(uid, st) { st.at = 20; storage.set(uid, JSON.stringify(st)); return true; }
  },
  renderBalance() {}, save() { storage.set('google:player', JSON.stringify(MC.state)); },
  fmt: String, toast() {}
};
const sdk = {
  doc: (_db, col, id) => ({ col, id }),
  async runTransaction(_db, fn) {
    async function run() {
      let written;
      const value = await fn({
        async get() { return { exists: () => true, data: () => ({ total }) }; },
        set(_ref, st) { written = st; }
      });
      return { value, written };
    }
    let result = await run();
    if (changeWhileUploading) {
      changeWhileUploading = false;
      total += 500;
      MC.state.balance -= 100;
      result = await run();
    }
    remote = result.written;
    return result.value;
  }
};
const context = vm.createContext({
  MC, sdk, window: {}, console: { warn() {} },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  location: { search: '?nosync=1' }, URLSearchParams, setTimeout, clearTimeout
});
vm.runInContext(readFileSync(new URL('../src/progress/peticiones-nube.js', import.meta.url), 'utf8'), context);
context.MCPeticionesNube = context.window.MCPeticionesNube;
vm.runInContext(readFileSync(new URL('../src/core/auth-firebase.js', import.meta.url), 'utf8'), context);
vm.runInContext("storeNube = sdk; db = {}; uidPerfil = 'google:player'; uidNube = 'player';", context);
MC.save();
await vm.runInContext('subirEstado(null, sdk.doc, true)', context);
assert.equal(JSON.parse(remote.state).balance, 6000, 'Upload integrates server credits into a stale local copy');
assert.equal(JSON.parse(remote.state).fichasNube, 1000);
assert.equal(MC.state.balance, 6000, 'Live state receives the same credit');
assert.equal(MC.state.fichasNube, 1000);
await vm.runInContext('subirEstado(null, sdk.doc, true)', context);
assert.equal(MC.state.balance, 6000, 'Saving again cannot credit twice');

changeWhileUploading = true;
await vm.runInContext('subirEstado(null, sdk.doc, true)', context);
assert.equal(JSON.parse(remote.state).balance, 6500, 'Transaction retry includes a credit received during upload');
assert.equal(JSON.parse(remote.state).fichasNube, 1500);
assert.equal(MC.state.balance, 6400, 'Applying the credit preserves a bet placed during upload');
assert.equal(MC.state.fichasNube, 1500);
await vm.runInContext('subirEstado(null, sdk.doc, true)', context);
assert.equal(JSON.parse(remote.state).balance, 6400);

MC.auth.current = () => ({ uid: 'local' });
total += 1000;
await vm.runInContext("aplicarFichas(2500, 'google:player', 'player')", context);
assert.equal(MC.state.balance, 6400, 'A late credit cannot change a different active profile');
console.log('Cloud balance checks passed: upload races, cumulative credits, repeated snapshots and profile changes.');
