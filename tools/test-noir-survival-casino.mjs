import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),root=resolve('.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await mkdir('tmp/noir-survival',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).hostname==='127.0.0.1')missing.push(r.url());});
 await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/?nosync=1');await page.waitForFunction(()=>window.MCCatalog);
 await page.evaluate(()=>{MC.closeModal();MC.addBalance(1000000);window.sceneAudio=[];const event=MC.sound.event;MC.sound.event=function(name,value){sceneAudio.push(name);return event.call(MC.sound,name,value);};});
 assert.ok(await page.evaluate(()=>Object.values(MCProviderArt).every(a=>a.verified===true)),'Only approved games are exported');
 for(const id of ['zonamuerta','lafamilia']){
   assert.equal(await page.evaluate(id=>MC.getGame(id).pending,id),false);
   assert.ok(await page.locator('.gcard[data-game="'+id+'"]').count()>0);
   assert.equal(await page.evaluate(id=>MCSoundtracks.profile({id}).lead,id),id==='zonamuerta'?'pad':'piano','Own score is registered');
   await page.evaluate(id=>{localStorage.setItem('turbo.'+id,'1');MC.showView(id);document.getElementById('provFrame').src+='&debug=1';},id);
   await page.waitForFunction(()=>document.getElementById('provFrame').contentWindow.__storyScene&&document.getElementById('provFrame').contentWindow.__maverick);
   const frame=page.frameLocator('#provFrame');await frame.locator('canvas').click({position:{x:5,y:5}});
   for(const [width,height] of [[1440,900],[390,844],[844,390]]){
     await page.setViewportSize({width,height});await page.waitForTimeout(200);
     assert.ok(await page.locator('#provFrame').evaluate(el=>el.getBoundingClientRect().bottom<=el.parentElement.getBoundingClientRect().bottom+1));
     assert.ok(await page.locator('#provFrame').evaluate(el=>el.contentWindow.__storyScene.actors.every(a=>a.height>20&&a.x>=0&&a.x<el.contentWindow.innerWidth)));
     await frame.locator('canvas').screenshot({path:'tmp/noir-survival/casino-'+id+'-'+width+'.png'});
   }
   await page.setViewportSize({width:1440,height:900});
   for(const action of ['spin','buy']){
     const before=await page.evaluate(()=>({balance:MC.getBalance(),plays:MC.state.stats.plays}));
     await page.locator('#provFrame').evaluate((el,action)=>{const w=el.contentWindow;w.storyDone=false;void w.__maverick[action]().then(()=>{w.storyDone=true;});},action);
     await page.waitForTimeout(60);await page.evaluate(()=>MC.showView('lobby'));
     assert.equal(await page.evaluate(()=>MC.getCurrentView()),'proveedor','An active round prevents navigation');
     const deadline=Date.now()+180000;
     while(Date.now()<deadline&&!await page.locator('#provFrame').evaluate(el=>el.contentWindow.storyDone)){
       const b=frame.locator('.cinema-continue');if(await b.isVisible())await b.click();await page.waitForTimeout(100);
     }
     assert.ok(await page.locator('#provFrame').evaluate(el=>el.contentWindow.storyDone),'Real round finishes');
     const after=await page.evaluate(()=>({balance:MC.getBalance(),plays:MC.state.stats.plays,last:MC.state.history[0]}));
     assert.equal(after.plays,before.plays+1);assert.equal(after.last.game,id);assert.equal(after.balance,before.balance-after.last.staked+after.last.returned);
     assert.equal(await page.locator('#provFrame').evaluate(el=>el.contentWindow.__storyScene.phase),'idle','Scenery resets after bonus');
   }
   await page.evaluate(()=>MC.showView('lobby'));assert.equal(await page.evaluate(()=>MC.getCurrentView()),'lobby');
   console.log('PASS casino',id,'catalogue, own soundtrack, layouts, one debit/settlement and complete bonus');
 }
 assert.ok(await page.evaluate(()=>sceneAudio.includes('spin')&&sceneAudio.includes('motionEnd')),'Real render events reach the casino mixer');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
