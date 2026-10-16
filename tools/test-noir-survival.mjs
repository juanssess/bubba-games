/** Visual and gameplay checks for the two isolated story scenes. */
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),root=resolve('../Juegos Casinos/apps/client/dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await mkdir('tmp/noir-survival',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const id of ['zonamuerta','lafamilia']){
   await page.addInitScript(id=>localStorage.setItem('turbo.'+id,'1'),id);
   await page.goto('http://127.0.0.1:'+server.address().port+'/?game='+id+'&debug=1');
   await page.waitForFunction(()=>window.__maverick&&window.__storyScene?.actors.every(a=>a.height>20));
   assert.equal(await page.evaluate(()=>__storyScene.kind),id);
   assert.deepEqual(await page.evaluate(()=>__storyScene.actors.map(a=>a.name)),id==='zonamuerta'?['zombie','superviviente']:['mafioso']);
   for(const [width,height] of [[1440,900],[390,844],[844,390]]){
     await page.setViewportSize({width,height});await page.waitForTimeout(250);
     assert.ok(await page.evaluate(()=>__storyScene.actors.every(a=>a.x>=0&&a.x<innerWidth&&a.y>0&&a.y<=innerHeight+5)),'Characters remain on screen');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     await page.locator('canvas').screenshot({path:'tmp/noir-survival/'+id+'-'+width+'.png'});
   }
   const before=await page.evaluate(()=>__storyScene.actors.map(a=>[a.x,a.y]));await page.waitForTimeout(700);
   assert.notDeepEqual(await page.evaluate(()=>__storyScene.actors.map(a=>[a.x,a.y])),before,'Actors actually animate');
   await page.emulateMedia({reducedMotion:'reduce'});const time=await page.evaluate(()=>__storyScene.time);await page.waitForTimeout(250);
   assert.equal(await page.evaluate(()=>__storyScene.time),time,'Reduced-motion preference is respected');await page.emulateMedia({reducedMotion:'no-preference'});
   await page.setViewportSize({width:1440,height:900});
   await page.evaluate(()=>{window.roundDone=false;void __maverick.spin().then(()=>{window.roundDone=true;});});
   await page.waitForFunction(()=>window.roundDone,{},{timeout:120000});
   assert.equal(await page.evaluate(()=>__maverick.busy),false);
   await page.evaluate(()=>__storyScene.setFree(true));assert.equal(await page.evaluate(()=>__storyScene.phase),'bonus');
   await page.locator('canvas').screenshot({path:'tmp/noir-survival/'+id+'-bonus.png'});await page.evaluate(()=>__storyScene.setFree(false));
   await page.evaluate(()=>{window.roundDone=false;void __maverick.buy().then(()=>{window.roundDone=true;});});
   await page.waitForFunction(()=>window.roundDone,{},{timeout:180000});
   assert.equal(await page.evaluate(()=>__storyScene.phase),'idle','The real bonus resets the scene');
   assert.equal(await page.evaluate(()=>__maverick.busy),false);
   console.log('PASS',id,'characters, motion, responsive layouts, reduced motion, spin and complete bonus');
 }
 await page.goto('http://127.0.0.1:'+server.address().port+'/?game=classic20&debug=1');await page.waitForFunction(()=>window.__maverick);
 assert.equal(await page.evaluate(()=>!!window.__storyScene),false,'Existing games keep their own scene');
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
