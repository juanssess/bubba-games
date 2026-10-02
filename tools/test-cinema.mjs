import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Focus, interruption and completion are the risky parts of a bonus overlay.
const listeners = new Map(), frames = new Map();
let nextFrame = 0, reduced = false, now = 0, focused, dialog;
class Element {
  constructor() { this.children = new Map(); this.events = new Map(); this.isConnected = true; }
  setAttribute() {}
  querySelector(key) { if (!this.children.has(key)) this.children.set(key,new Element()); return this.children.get(key); }
  addEventListener(key,fn) { this.events.set(key,fn); }
  focus() { focused = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() { this.isConnected = false; }
}
const originalFocus = new Element();
const context = vm.createContext({
  window:{matchMedia:()=>({matches:reduced})},
  document:{activeElement:originalFocus,createElement:()=>dialog=new Element(),body:{appendChild(){}},
    addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)},
  performance:{now:()=>now},
  requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},
  cancelAnimationFrame:id=>frames.delete(id)
});
vm.runInContext(readFileSync(new URL('../src/ui/cinema.js',import.meta.url),'utf8'),context);
const cinema=context.window.MCCinema;
let completed=0;
const first=cinema.show({theme:'sebusca',spins:10});
first.then(()=>completed++);
assert.equal(cinema.active,true);
assert.equal(focused,dialog.querySelector('button'));
assert.equal(cinema.show({theme:'gold',spins:20}),first,'Repeated requests must not stack dialogs');
const closeClick=dialog.querySelector('button').events.get('click');
closeClick();closeClick();await first;
assert.equal(completed,1);
assert.equal(cinema.active,false);
assert.equal(focused,originalFocus);
assert.equal(listeners.size,0);

const summary=cinema.show({theme:'vendimia',kind:'summary',spins:17,total:2480});
assert.equal(frames.size,1);
const [id,callback]=frames.entries().next().value;frames.delete(id);callback(1450);
assert.equal(dialog.querySelector('.cinema-value').textContent,'2.480');
let intercepted=0;
listeners.get('keydown')({key:'Enter',repeat:false,preventDefault(){intercepted++},stopImmediatePropagation(){intercepted++}});
await summary;
assert.equal(intercepted,2,'Continue must not also spin the underlying game');
assert.equal(frames.size,0);

const interrupted=cinema.show({kind:'summary',total:9000,spins:10});
dialog.querySelector('button').events.get('click')();await interrupted;
assert.equal(frames.size,0,'Closing early cancels the number animation');
reduced=true;
const accessible=cinema.show({theme:'gold',kind:'summary',total:0,spins:10});
assert.equal(frames.size,0);
assert.equal(dialog.querySelector('.cinema-value').textContent,'0');
dialog.events.get('cancel')({preventDefault(){}});await accessible;
assert.equal(cinema.active,false);
console.log('PASS: duplicate requests, single completion, focus, keyboard isolation, exact totals, interruption, reduced motion, zero prize.');
