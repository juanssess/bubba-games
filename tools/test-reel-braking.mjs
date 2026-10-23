/* Deterministic display fixtures exercise the compiled boards. No wallet bets. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
const browser=await chromium.launch({channel:'chrome',headless:true});
const published=JSON.parse((await readFile('assets/illustrated/provider/index.js','utf8')).match(/window.MCProviderArt = ([\s\S]*);\s*$/)[1]);
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**',r=>r.abort());
 for(const id of Object.keys(published).filter(id=>!['ruta40','famatina','kermes'].includes(id))){
  const {MANIFEST:m}=await import(pathToFileURL(resolve('../Juegos Casinos/packages/games',id,'src/manifest.ts')).href);
  const opts={reels:m.game.reels,rows:m.game.rows,threshold:m.game.scattersToTrigger,cell:m.client.cellSize,cluster:['cluster','ways','bombs'].includes(m.kind)};
  await page.goto(`http://127.0.0.1:${server.address().port}/games/slots/index.html?game=${id}&debug=1`);
  await page.waitForFunction(()=>window.__maverick);
  await page.evaluate(o=>{
   __maverick.app.ticker.stop();
   const rs=__maverick.reelSet;
   window.runReelFixture=async(kind,dt=16)=>{
    const grid=Array(o.reels*o.rows).fill(2),scatter=1;
    if(kind!=='base'&&kind!=='turbo'&&kind!=='skip'){
     const need=o.threshold-1;
     for(let j=0;j<need;j++){const col=j%(o.reels-1),row=Math.floor(j/(o.reels-1));grid[col*o.rows+row]=scatter;}
     if(kind==='hit')grid[(o.reels-1)*o.rows]=scatter;
    }
    rs.setGrid(grid);
    const expected=Array.from({length:o.reels},(_,r)=>Array.from({length:o.rows},(_,j)=>rs.cellSprite(r,j).texture));
    rs.setGrid(Array(grid.length).fill(2));
    rs.turbo=kind==='turbo';
    const stopped=[],anticipation=[],speeds=[];
    let elapsed=0,settlements=0,prevY=rs.cellSprite(o.reels-1,0).y;
    const promise=rs.spinTo(grid,{
     onReelStop:(r,ant)=>stopped.push({r,t:elapsed,ant}),
     onAnticipation:r=>anticipation.push({r,t:elapsed,priorVisible:r===0||stopped.some(s=>s.r===r-1)})
    }).then(()=>settlements++);
    while(rs.running&&elapsed<12000){
     elapsed+=dt;
     if(kind==='skip'&&elapsed>=160)rs.stopNow();
     rs.update(dt);
     const y=rs.cellSprite(o.reels-1,0).y;
     let distance=prevY-y;
     if(distance<-.001)distance+=o.cell;
     speeds.push({t:elapsed,v:distance/dt});prevY=y;
    }
    await promise;
    const exact=expected.every((col,r)=>col.every((tex,j)=>rs.cellSprite(r,j).texture===tex));
    return {elapsed,settlements,exact,stopped,anticipation,speeds:speeds.slice(-32)};
   };
  },opts);
  const run=kind=>page.evaluate(kind=>runReelFixture(kind),kind);
  const normal=await run('base'),miss=await run('miss'),hit=await run('hit'),turbo=await run('turbo'),skipped=await run('skip');
  for(const [kind,r] of Object.entries({normal,miss,hit,turbo,skipped})){
   assert(r.exact,id+' '+kind+' preserves the supplied result');assert.equal(r.settlements,1,id+' resolves once');
   assert.equal(r.stopped.length,opts.reels,id+' emits one stop per reel');
   assert.deepEqual(r.stopped.map(s=>s.r),Array.from({length:opts.reels},(_,i)=>i),id+' ordered stops '+kind);
   assert(r.anticipation.every(e=>e.priorVisible),id+' anticipation requires actually stopped previous reels');
  }
  assert(normal.elapsed>=3000&&normal.elapsed<=4500,id+' ordinary duration '+normal.elapsed);
  assert(miss.elapsed>normal.elapsed+1000&&miss.elapsed<=8500,id+' bonus anticipation duration '+miss.elapsed);
  assert(miss.anticipation.length>0,id+' missing bonus still gets anticipation');
  assert.equal(hit.anticipation.length,miss.anticipation.length,id+' suspense does not depend on the unrevealed last result');
  assert(Math.abs(hit.elapsed-miss.elapsed)<=64,id+' win/loss use the same schedule');
  assert(turbo.elapsed<normal.elapsed*.6,id+' optional Turbo remains fast');
  assert(skipped.elapsed<600,id+' explicit stop remains responsive');
  assert.equal(turbo.anticipation.length,0,id+' Turbo skips suspense');
  const isCluster=await page.evaluate(()=>typeof __maverick.reelSet.tumbleTo==='function');
  if(!isCluster){
   const v=miss.speeds.map(s=>s.v).filter(v=>v>0.000001);
   assert(v.length>10,id+' has a visible gradual braking segment');
   assert(v.slice(-5).reduce((a,b)=>a+b,0)<v.slice(0,5).reduce((a,b)=>a+b,0)*.2,id+' last cells creep to a stop');
   assert(v.every((x,i)=>i===0||x<=v[i-1]+.003),id+' final approach never accelerates');
  }
  if(id==='classic20'){
   for(const dt of [8,33]){const r=await page.evaluate(dt=>runReelFixture('miss',dt),dt);assert(r.exact&&r.elapsed<8500&&r.settlements===1,'correct result at '+dt+'ms frames');}
   await page.emulateMedia({reducedMotion:'reduce'});
   const reduced=await run('miss');assert(reduced.elapsed<800&&reduced.anticipation.length===0,'Reduced motion skips the prolonged reveal');
   await page.emulateMedia({reducedMotion:'no-preference'});
  }
  console.log('PASS',id,JSON.stringify({base:normal.elapsed,anticipation:miss.elapsed,turbo:turbo.elapsed,skip:skipped.elapsed}));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS compiled boards: exact final grids, smooth braking, visible anticipation, matching hit/miss pacing, Turbo, stop, reduced motion.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
