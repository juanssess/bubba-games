import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root=resolve('.'), mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const game of (process.argv.includes('--house-only')?[]:['classic20','sebusca','vendimia','kiosco','feria','carnaval'])) {
    const page=await browser.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',r=>r.abort());
    await page.addInitScript(game=>{if(!localStorage.getItem('bubba.spin-pace.v1')) localStorage.setItem('turbo.'+game,'1');},game);
    await page.goto(base+'/games/slots/index.html?game='+game+'&debug=1');
    await page.waitForFunction(()=>window.__maverick);
    assert.equal(await page.evaluate(()=>__maverick.reelSet.turbo),false,game+' resets the previous saved fast mode');
    async function spin(turbo,skip=false) {
      await page.evaluate(turbo=>{__maverick.reelSet.turbo=turbo;window.spinStart=performance.now();__maverick.demoSpin(Array(30).fill(2));},turbo);
      if(skip){await page.waitForTimeout(120);await page.evaluate(()=>__maverick.reelSet.stopNow());}
      else if(!turbo){await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>__maverick.reelSet.running),true,game+' is visibly still turning after a second');}
      await page.waitForFunction(()=>!__maverick.reelSet.running);
      return page.evaluate(()=>performance.now()-spinStart);
    }
    const normal=await spin(false), turbo=await spin(true), skipped=await spin(false,true);
    assert.ok(normal>=3000&&normal<4500,game+' fluid normal duration: '+normal);
    assert.ok(turbo<normal*.85,game+' keeps an optional faster mode');
    assert.ok(skipped<normal*.5,game+' still responds to an explicit stop');
    assert.deepEqual(errors,[]);
    console.log(game,JSON.stringify({normal:Math.round(normal),turbo:Math.round(turbo),skipped:Math.round(skipped)}));
    if(game==='classic20') {
      await page.evaluate(()=>{
        const grid=Array(15).fill(2);grid[0]=1;grid[3]=1;
        __maverick.reelSet.turbo=false;window.anticipationEvents=0;window.anticipationStart=performance.now();
        void __maverick.reelSet.spinTo(grid,{onAnticipation:()=>{anticipationEvents++;}});
      });
      await page.waitForFunction(()=>!__maverick.reelSet.running);
      const expectation=await page.evaluate(()=>({events:anticipationEvents,duration:performance.now()-anticipationStart}));
      assert.ok(expectation.events>0,'Two scatters produce a visible anticipation phase');
      assert.ok(expectation.duration>normal+1000&&expectation.duration<8500,'Anticipation gives the final symbols time to land: '+expectation.duration);
      console.log('Anticipation',Math.round(expectation.duration));
    }
    if(game==='feria') {
      // A deliberate Turbo choice after migration must survive a reload.
      await page.evaluate(()=>localStorage.setItem('turbo.feria','1'));
      await page.reload();await page.waitForFunction(()=>window.__maverick);
      assert.equal(await page.evaluate(()=>__maverick.reelSet.turbo),true);
      await page.evaluate(()=>{localStorage.setItem('turbo.feria','0');});
      await page.reload();await page.waitForFunction(()=>window.__maverick);
      await page.evaluate(()=>{
        window.reSpins=[];window.lastSpin=0;window.featureDone=false;
        const event=MC.sound.event;
        MC.sound.event=function(name,value){if(name==='spin')lastSpin=performance.now();if(name==='motionEnd'&&lastSpin){reSpins.push(performance.now()-lastSpin);lastSpin=0;}return event(name,value);};
        void __maverick.buy().then(()=>{window.featureDone=true;});
      });
      const deadline=Date.now()+120000;
      while(Date.now()<deadline&&!await page.evaluate(()=>window.featureDone)) {
        const continueButton=page.locator('.cinema-continue');if(await continueButton.isVisible())await continueButton.click();
        await page.waitForTimeout(150);
      }
      assert.equal(await page.evaluate(()=>window.featureDone),true,'Feria bonus completes with the slower animation');
      const spins=await page.evaluate(()=>reSpins);
      assert.ok(spins.length>0&&spins.every(ms=>ms>=850),'Feria re-spins have visible movement: '+spins);
      assert.deepEqual(errors,[]);
      console.log('Feria re-spins',spins.map(Math.round).join(', '));
    }
    await page.close();
  }
  for(const [game,button,strip] of [['slots777','#spinBtn','#view-slots .reel-strip'],['slots5','#g5Spin','#view-slots5 .g5-strip']]) {
    const page=await browser.newPage();await page.route('https://**',r=>r.abort());await page.goto(base+'/?nosync=1');
    await page.waitForFunction(()=>window.MCSlots5&&window.MCSlots);
    await page.evaluate(game=>{MC.closeModal();MC.showView(game);},game);
    await page.locator(button).click();
    const transitions=await page.locator(strip).evaluateAll(els=>els.map(el=>parseFloat(getComputedStyle(el).transitionDuration)));
    assert.ok(transitions.length>=3&&Math.max(...transitions)>=3.1&&Math.max(...transitions)<=7,'House reels keep the longer final approach: '+game+' '+transitions);
    assert.ok(transitions.at(-1)-transitions.at(-2)>=.25,'The final reel has a distinct stopping interval');
    await page.close();
  }
  console.log('PASS: fluid base spins, staggered stops, optional Turbo, stop control, saved preferences, Feria bonus and both house slots.');
} finally {await browser.close();await new Promise(r=>server.close(r));}
