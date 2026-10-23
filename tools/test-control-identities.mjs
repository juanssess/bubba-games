/* Exercises the compiled controls, not a separate mockup. */
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=resolve('.'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
  if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
await mkdir('tmp/control-identities',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const manifest=JSON.parse((await readFile('assets/illustrated/provider/index.js','utf8')).match(/window.MCProviderArt = ([\s\S]*);\s*$/)[1]);
const signatures=new Set(),reports=[];
try{
  for(const id of Object.keys(manifest)){
    const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**',r=>r.abort());
    await page.goto(base+'/games/slots/index.html?game='+id+'&debug=1');
    await page.waitForFunction(()=>window.__maverick||window.__original);
    const original=await page.locator('.o-bar').count()>0;
    const sizes=[[1200,850],[390,844],[844,390]];
    for(const [width,height] of sizes){
      await page.setViewportSize({width,height});await page.waitForTimeout(180);
      if(original){
        assert.equal(await page.locator('body').getAttribute('data-control-theme'),id);
        assert(await page.locator('.o-brand').textContent());
        assert(await page.locator('.o-main').evaluate(el=>{const b=el.getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;}),id+' main control fits '+width);
        await page.screenshot({path:`tmp/control-identities/${id}-${width}.png`});
      }else{
        const fit=await page.evaluate(()=>{
          const walk=n=>n.label?.startsWith('themed-controls-')?n:(n.children||[]).map(walk).find(Boolean);
          const hud=walk(__maverick.app.stage);window.controlHud=hud;
          const b=hud.getBounds(),spin=hud.children.find(c=>c.label==='control-spin').getBounds();
          return {signature:hud.label,fit:b.x>=-1&&b.y>=-1&&b.x+b.width<=innerWidth+1&&b.y+b.height<=innerHeight+1,spin:{x:spin.x,y:spin.y,w:spin.width,h:spin.height},bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};
        });
        assert(fit.fit,id+' HUD fits '+width+' '+JSON.stringify(fit));
        if(width===1200){signatures.add(fit.signature);reports.push({id,...fit});}
        const b=fit.bounds;
        await page.screenshot({path:`tmp/control-identities/${id}-${width}.png`,clip:{x:Math.max(0,b.x-2),y:Math.max(0,b.y-2),width:Math.min(width-b.x,b.width+4),height:Math.min(height-b.y,b.height+4)}});
      }
    }
    if(!original){
      const checks=await page.evaluate(()=>{
        const button=name=>controlHud.children.find(c=>c.label===name);
        const text=n=>(n.children||[]).flatMap(c=>typeof c.text==='string'?[c.text]:text(c));
        const before=text(controlHud).join('|');
        button('control-bet-plus').emit('pointertap');
        const after=text(controlHud).join('|');
        button('control-bet-minus').emit('pointertap');
        const restored=text(controlHud).join('|');
        const turboBefore=__maverick.reelSet.turbo;
        button('control-turbo').emit('pointertap');
        const turboAfter=__maverick.reelSet.turbo;
        button('control-turbo').emit('pointertap');
        const muteBefore=text(button('control-sound')).join();
        button('control-sound').emit('pointertap');
        const muteAfter=text(button('control-sound')).join();
        button('control-sound').emit('pointertap');
        return {bet:before!==after&&before===restored,turbo:turboBefore!==turboAfter,sound:muteBefore!==muteAfter};
      });
      assert.deepEqual(checks,{bet:true,turbo:true,sound:true},id+' controls keep their callbacks');
    }
    assert.deepEqual(errors,[],id+' has no runtime errors');
    await page.close();console.log('PASS',id,'identity, desktop/mobile/landscape, controls');
  }
  const slotCount=Object.keys(manifest).filter(id=>!['ruta40','famatina','kermes'].includes(id)).length;
  assert.equal(signatures.size,slotCount,'Every published slot has a distinct visual signature');
  console.log(`PASS all ${Object.keys(manifest).length} published games; ${Object.keys(manifest).length*3} responsive captures; ${slotCount} distinct canvas control identities.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
