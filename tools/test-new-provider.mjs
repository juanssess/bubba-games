/* Approved-game integration: catalogue, responsive canvas, real wallet messages,
   one settlement per bet, navigation lock and shared presentation. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=resolve('.'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).hostname==='127.0.0.1')missing.push(r.url());});
  await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/?nosync=1');
  await page.waitForFunction(()=>window.MCCatalog&&document.querySelectorAll('.gcard').length>0);
  await page.evaluate(()=>{MC.closeModal();MC.addBalance(1000000);});
  const manifest=await page.evaluate(()=>Object.values(MCProviderArt));
  assert.equal(manifest.length,10,'All ten provider games were exported');
  assert.ok(manifest.every(m=>m.verified===true&&Number.isFinite(m.rtpValue)),'Export contains approved measured metadata');
  for(const id of ['cataratas','ruta40','famatina','kermes']) {
    const game=await page.evaluate(id=>({pending:MC.getGame(id).pending,rtp:MC.getGame(id).rtpValue,published:MCProviderArt[id].rtpValue}),id);
    assert.equal(game.pending,false,id+' is enabled after approved build');assert.equal(game.rtp,game.published);
    assert.ok(await page.locator('.gcard[data-game="'+id+'"]').count()>0,id+' is advertised in the lobby');
    await page.evaluate(id=>{MC.showView(id);const f=document.getElementById('provFrame');f.src+='&debug=1';},id);
    await page.waitForFunction(()=>{const w=document.getElementById('provFrame').contentWindow;return w.__maverick||w.__original;});
    const frame=page.frameLocator('#provFrame');
    for(const [width,height] of [[1366,850],[390,844],[844,390]]) {
      await page.setViewportSize({width,height});await page.waitForTimeout(200);
      const fit=await page.locator('#provFrame').evaluate(el=>{const w=el.contentWindow,c=w.document.querySelector('canvas'),r=c.getBoundingClientRect();return {overflow:w.document.documentElement.scrollWidth>w.innerWidth+1,canvas:r.width>100&&r.height>100,controls:el.getBoundingClientRect().bottom<=el.parentElement.getBoundingClientRect().bottom+1&&[...w.document.querySelectorAll('.o-main')].every(b=>{const x=b.getBoundingClientRect();return x.top>=0&&x.bottom<=w.innerHeight+1;})};});
      assert.deepEqual(fit,{overflow:false,canvas:true,controls:true},id+' '+width+'px fits');
      await page.locator('.prov-shell').screenshot({path:'tmp/requests-new-provider-'+id+'-'+width+'.png'});
    }
    await page.setViewportSize({width:1366,height:850});
    const before=await page.evaluate(()=>({balance:MC.getBalance(),plays:MC.state.stats.plays}));
    async function original(action) {return page.locator('#provFrame').evaluate((el,action)=>el.contentWindow.__original[action](),action);}
    async function blockedDuringRound(){await page.waitForTimeout(50);await page.evaluate(()=>MC.showView('lobby'));assert.equal(await page.evaluate(()=>MC.getCurrentView()),'proveedor','Exit waits for an active round');}
    if(id==='cataratas') {
      await page.locator('#provFrame').evaluate(el=>{const w=el.contentWindow;w.done=false;void w.__maverick.spin().then(()=>{w.done=true;});});
      await blockedDuringRound();
      const until=Date.now()+150000;
      while(Date.now()<until&&!await page.locator('#provFrame').evaluate(el=>el.contentWindow.done)) {
        const button=frame.locator('.cinema-continue');if(await button.isVisible())await button.click();await page.waitForTimeout(150);
      }
      assert.equal(await page.locator('#provFrame').evaluate(el=>el.contentWindow.done),true,'Cataratas finishes a complete real round');
    } else if(id==='famatina') {
      await original('bet');await blockedDuringRound();
      await page.locator('#provFrame').evaluate(async el=>{const a=el.contentWindow.__original,r=a.state.round,i=Array.from({length:25},(_,i)=>i).find(i=>!r.mines.includes(i));await a.reveal(i);await a.collect();});
      assert.equal(await page.locator('#provFrame').evaluate(el=>el.contentWindow.__original.state.round),null);
    } else if(id==='kermes') {
      await original('drop');await blockedDuringRound();
      await page.locator('#provFrame').evaluate(el=>el.contentWindow.__pump(5000));
      await page.waitForFunction(()=>document.getElementById('provFrame').contentWindow.__original.state.balls===0);
    } else {
      await page.locator('#provFrame').evaluate(async el=>{const a=el.contentWindow.__original;await Promise.all([a.start(),a.start(),a.start()]);});
      const state=await page.locator('#provFrame').evaluate(el=>el.contentWindow.__original.state);
      if(state.running){await blockedDuringRound();await page.locator('#provFrame').evaluate(el=>{const a=el.contentWindow.__original;a.pump(1000);if(a.state.running)a.cashout();for(let k=0;k<400&&a.state.running;k++)a.pump(500);});}
      await page.waitForFunction(()=>!document.getElementById('provFrame').contentWindow.__original.state.running);
    }
    await page.waitForFunction(plays=>MC.state.stats.plays===plays+1,before.plays);
    const after=await page.evaluate(()=>({balance:MC.getBalance(),last:MC.state.history[0],plays:MC.state.stats.plays}));
    assert.equal(after.last.game,id,'Settlement is attributed to the right game');
    assert.equal(after.balance,before.balance-after.last.staked+after.last.returned,'One debit and the credited payout match the wallet');
    assert.equal(after.plays,before.plays+1,'The round is recorded exactly once');
    await page.waitForTimeout(100);await page.evaluate(()=>MC.showView('lobby'));
    assert.equal(await page.evaluate(()=>MC.getCurrentView()),'lobby','Exit unlocks after settlement');
    console.log('PASS',id,'layout, wallet, settlement and exit');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
