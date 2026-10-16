/* Smoke test for a bootable catalogue: a runtime data error must never ship
   unnoticed as an empty lobby. Pending provider entries stay out of the UI. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const root=resolve('.'), mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const viewport of [{width:1366,height:850},{width:390,height:844}]) {
    const page=await browser.newPage({viewport}),errors=[],missing=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).hostname==='127.0.0.1')missing.push(r.url());});
    await page.route('https://**',r=>r.abort());
    await page.goto('http://127.0.0.1:'+server.address().port+'/?nosync=1');
    await page.waitForFunction(()=>window.MCCatalog&&document.querySelectorAll('.gcard').length>0);
    await page.evaluate(()=>MC.closeModal());
    assert.ok(await page.locator('#rails .gcard').count()>0,'Lobby contains game cards');
    assert.ok(await page.locator('.promo-game').count()>0,'Game banners are present');
    const pending=await page.evaluate(()=>Object.values(MCCatalog.games).filter(g=>g.pending).map(g=>g.id));
    for(const id of pending) {
      assert.equal(await page.locator('[data-game="'+id+'"], [data-action="game:'+id+'"]').count(),0,'Pending game is not advertised: '+id);
      assert.equal(await page.evaluate(id=>{const before=MC.getCurrentGame();MC.showView(id);return before===MC.getCurrentGame();},id),true,'Pending game cannot open a missing frame');
    }
    await page.locator('.gcard[data-game="maverick"]').first().click();
    await page.frameLocator('#provFrame').locator('canvas').waitFor({timeout:30000});
    assert.equal(await page.evaluate(()=>MC.getCurrentGame()),'maverick','A published game opens from its card');
    await page.evaluate(()=>MC.showView('lobby'));
    assert.ok(await page.locator('#rails .gcard').count()>0,'Game cards remain after returning to the lobby');
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    console.log('PASS lobby',viewport.width+'px',pending.length+' pending entries isolated');
    await page.close();
  }
}finally{await browser.close();await new Promise(r=>server.close(r));}
