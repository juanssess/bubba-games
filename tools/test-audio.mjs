import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = resolve('.');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'));
  if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  const page = await browser.newPage();
  await page.route('https://**', route => route.abort());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.audioTest = {contexts:[], notes:[]};
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(options) {
        super(options); this.gains = []; window.audioTest.contexts.push(this);
      }
      createGain() { const g = super.createGain(); this.gains.push(g); return g; }
      createBufferSource() {
        const src = super.createBufferSource(), start = src.start.bind(src);
        src.start = (...args) => { window.audioTest.notes.push([src.buffer && src.buffer.soundtrackInstrument, src.playbackRate.value]); start(...args); };
        return src;
      }
      createOscillator() {
        const o = super.createOscillator(), start = o.start.bind(o);
        o.start = t => { window.audioTest.notes.push([o.frequency.value, o.type]); start(t); };
        return o;
      }
    };
  });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.MC && MC.showView && window.MCAjustes);
  await page.evaluate(() => { MC.state.soundOn = true; MC.state.ajustes = {sonido:true, musica:true}; MC.sound.sync(); });
  await page.mouse.click(5, 5);
  await page.evaluate(() => MC.sound.unlock());
  const signatures = [];
  for (const id of ['bowling','mines','roulette','blackjack','slots777','g1001']) {
    const known = await page.evaluate(id => !!MC.getGame(id), id);
    if (!known) continue;
    await page.evaluate(id => { audioTest.notes.length = 0; MC.showView(id); }, id);
    await page.waitForTimeout(750);
    const notes = await page.evaluate(() => audioTest.notes);
    const state = await page.evaluate(() => ({view:MC.getCurrentView(), hidden:document.hidden, sound:MC.state.soundOn, contexts:audioTest.contexts.map(c=>({state:c.state,time:c.currentTime}))}));
    assert.ok(notes.length > 0, id + ' has music: ' + JSON.stringify(state));
    signatures.push(JSON.stringify(notes.slice(0, 3)));
  }
  assert.equal(new Set(signatures).size, signatures.length, 'Games have distinct musical signatures');
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => audioTest.notes.length);
  await page.waitForTimeout(1200);
  assert.ok(await page.evaluate(() => audioTest.notes.length) > before, 'Background music continues across bars');
  await page.evaluate(() => MC.toggleSound());
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => audioTest.contexts[0].gains[0].gain.value < 0.001), 'Master mute fades all audio');
  assert.equal(await page.evaluate(() => MC.state.ajustes.sonido), false);
  await page.evaluate(() => MC.toggleSound());
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => audioTest.contexts[0].gains[0].gain.value > 0.8));
  await page.evaluate(() => { MC.state.ajustes.musica = false; MC.sound.sync(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { audioTest.notes.length = 0; });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => audioTest.notes.length), 0, 'Music can be disabled separately');
  await page.evaluate(() => MC.sound.win());
  assert.ok(await page.evaluate(() => audioTest.notes.length > 0), 'Win effects remain enabled');
  await page.evaluate(() => { MC.state.ajustes.musica = true; MC.sound.sync(); MC.showView('lobby'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { audioTest.notes.length = 0; });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => audioTest.notes.length), 0, 'Leaving the game stops the music');
  await page.evaluate(() => MC.showView('maverick'));
  const frame = page.frameLocator('#provFrame');
  await frame.locator('canvas').waitFor({timeout:30000});
  await frame.locator('canvas').click({position:{x:10,y:10}});
  await page.waitForTimeout(800);
  assert.ok(await page.evaluate(() => audioTest.notes.length > 0), 'Provider gesture unlocks music');
  await page.evaluate(() => MC.toggleSound());
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#provFrame').evaluate(el => el.contentWindow.MCThemedAudio), true, 'Provider render events use the themed audio adapter');
  assert.ok(await page.evaluate(() => audioTest.contexts[0].gains[0].gain.value < 0.001), 'Provider effects obey the common master');
  await page.evaluate(() => { MC.toggleSound(); audioTest.notes.length = 0; });
  await page.locator('#provFrame').evaluate(el => {
    el.contentWindow.MCCinema.featureStart({theme:'classic20'});
    void el.contentWindow.MCCinema.show({theme:'classic20', spins:10});
  });
  await frame.locator('.cinema-continue').waitFor();
  assert.ok(await page.evaluate(() => audioTest.notes.length > 5), 'Bonus plays its musical cue');
  await frame.locator('.cinema-continue').click();
  await page.locator('#provFrame').evaluate(el => el.contentWindow.MCCinema.featureEnd());
  await page.evaluate(() => MC.showView('lobby'));
  await page.evaluate(() => {
    MC.addBalance(100000);
    window.audioEvents=[];
    const event=MC.sound.event;
    MC.sound.event=function(name,value){audioEvents.push(name);return event(name,value);};
    ['classic20','sebusca','vendimia','kiosco','feria','carnaval'].forEach(id=>localStorage.setItem('turbo.'+id,'1'));
  });
  async function openProvider(id) {
    await page.evaluate(id=>{MC.closeModal();MC.showView(id);const f=document.getElementById('provFrame');f.src+='&debug=1';},id);
    await page.waitForFunction(()=>document.getElementById('provFrame').contentWindow.__maverick);
  }
  async function finishProvider() {
    const deadline=Date.now()+90000;
    while(Date.now()<deadline) {
      const button=page.frameLocator('#provFrame').locator('.cinema-continue');
      if(await button.isVisible()) await button.click();
      if(await page.locator('#provFrame').evaluate(el=>el.contentWindow.__audioRoundDone)) return;
      await page.waitForTimeout(150);
    }
    throw new Error('Provider round did not finish');
  }
  for(const id of ['maverick','sebusca','vendimia','kiosco','feria','carnaval']) {
    await openProvider(id);
    await page.evaluate(()=>{audioEvents.length=0;const w=document.getElementById('provFrame').contentWindow;w.__audioRoundDone=false;Promise.resolve(w.__maverick.spin()).then(()=>{w.__audioRoundDone=true;});});
    await finishProvider();
    const events=await page.evaluate(()=>audioEvents.slice());
    assert.ok(events.includes('spin'),id+' sends actual reel movement events');
    assert.ok(events.includes('motionEnd'),id+' stops the movement sound when the reels stop');
    assert.ok(events.includes('reelStop')||events.includes('scatter'),id+' sends actual stop/landing events');
    await page.evaluate(()=>MC.showView('lobby'));
  }
  await openProvider('feria');
  await page.evaluate(()=>{audioEvents.length=0;const w=document.getElementById('provFrame').contentWindow;w.__audioRoundDone=false;Promise.resolve(w.__maverick.buy()).then(()=>{w.__audioRoundDone=true;});});
  await finishProvider();
  const bonusEvents=await page.evaluate(()=>audioEvents.slice());
  assert.ok(bonusEvents.includes('jackpot'),'Real Feria bonus has its own fanfare');
  assert.ok(bonusEvents.includes('scatter'),'Real Feria coins have landing sounds');
  await page.evaluate(()=>MC.showView('lobby'));
  await page.goto('http://127.0.0.1:'+server.address().port+'/games/slots/index.html?game=feria&debug=1');
  await page.waitForFunction(()=>window.__maverick);
  await page.locator('canvas').click({position:{x:10,y:10}});
  await page.waitForTimeout(900);
  assert.ok(await page.evaluate(()=>audioTest.notes.some(n=>n[0]==='accordion')),'Standalone Feria uses its full accordion arrangement');
  await page.evaluate(()=>localStorage.setItem('maverick.muted','1'));
  await page.waitForTimeout(400);
  await page.evaluate(()=>{audioTest.notes.length=0;});
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>audioTest.notes.length),0,'Standalone game mute stops the soundtrack');
  await page.evaluate(()=>localStorage.setItem('maverick.muted','0'));
  assert.deepEqual(errors, []);
  console.log('Audio OK: unique themes, effects, settings, master mute, all six real provider rounds and a complete Feria bonus.');
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
