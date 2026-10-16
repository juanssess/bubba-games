/** Deterministic visual fixtures come from the actual engines. Real wallets are tested separately. */
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const provider=resolve('../Juegos Casinos');
const {Sfc32Rng}=await import(pathToFileURL(resolve(provider,'packages/math/src/index.ts')).href);
const {roundToSteps}=await import(pathToFileURL(resolve(provider,'apps/client/src/rgs/local.ts')).href);
const root=resolve(provider,'apps/client/dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await mkdir('tmp/story-bonuses',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['zonamuerta','lafamilia']){
    const {MANIFEST:m}=await import(pathToFileURL(resolve(provider,'packages/games',id,'src/manifest.ts')).href);
    const seeded=new Sfc32Rng(7);
    const rng=id==='lafamilia'?{nextInt:max=>max===1000?999:max===1e6?0:seeded.nextInt(max)}:seeded;
    const result=m.engine().playBonus(rng,20),steps=roundToSteps(m.game,result);
    assert.ok(steps.slice(1).every(s=>s.story));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?game='+id+'&debug=1');
    await page.waitForFunction(()=>window.__maverick&&window.__storyScene);
    await page.evaluate(({steps,totalWin})=>{
      const round={roundId:'story-visual-fixture',bet:20,steps,totalWin,bought:true,acknowledgedStep:-1,complete:false};
      // Explicit visual fixture; no production or casino wallet is involved.
      __maverick.rgs.buyBonus=async()=>({round,balance:100000});
      __maverick.rgs.acknowledge=async(_id,i)=>{round.acknowledgedStep=i;round.complete=i===steps.length-1;};
      window.fixtureDone=false;void __maverick.buy().then(()=>{window.fixtureDone=true;});
    },{steps,totalWin:result.totalWin});
    await page.waitForFunction(()=>window.__storyBonus?.visible&&__storyScene.phase==='bonus');
    if(id==='zonamuerta'){
      await page.waitForFunction(()=>__storyScene.alarm>.85);
      assert.deepEqual(await page.evaluate(()=>__storyScene.actionFrames),[8,8]);
      const pose=await page.evaluate(()=>__storyScene.actors.map(a=>a.pose));await page.waitForTimeout(350);
      assert.notDeepEqual(await page.evaluate(()=>__storyScene.actors.map(a=>a.pose)),pose,'Action frames change during the chase');
    }
    for(const [width,height] of [[1440,900],[390,844],[844,390]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(180);
      const b=await page.evaluate(()=>__storyBonus.bounds);
      assert.ok(b.x>=-2&&b.y>=-2&&b.x+b.width<=width+2&&b.y+b.height<=height+2,JSON.stringify({id,width,height,b}));
      await page.locator('canvas').screenshot({path:'tmp/story-bonuses/'+id+'-bonus-'+width+'.png'});
    }
    await page.setViewportSize({width:1440,height:900});
    if(id==='lafamilia'){
      await page.waitForFunction(()=>__storyBonus.data.cashHit===true&&__storyBonus.data.safes.length===3,{},{timeout:120000});
      assert.deepEqual(await page.evaluate(()=>__storyBonus.data.hp),[0,0,0,0]);
      const shown=await page.evaluate(()=>{
        const find=node=>node.label==='story-spin-overlays'?node:(node.children??[]).map(find).find(Boolean);
        const layer=find(__maverick.app.stage);
        return (layer?.children??[]).filter(c=>typeof c.text==='string'&&c.text.startsWith('+')).reduce((sum,c)=>sum+Number(c.text.replace(/\D/g,'')),0);
      });
      assert.equal(shown,await page.evaluate(()=>__storyBonus.data.collect),'Vault labels match the actual collection after the cap');
      await page.locator('canvas').screenshot({path:'tmp/story-bonuses/mafia-vault.png'});
    }
    await page.waitForFunction(()=>window.fixtureDone,{},{timeout:180000});
    assert.equal(await page.evaluate(()=>__storyScene.phase),'idle');
    assert.equal(await page.evaluate(()=>__storyBonus.visible),false);
    assert.equal(await page.evaluate(()=>__maverick.busy),false);
    if(id==='zonamuerta'){await page.waitForFunction(()=>__storyScene.alarm<.02);}
    console.log('PASS',id,'engine-authored feature, responsive progress HUD, action scene and reset');
  }
  // A saved Hold & Win from the previous mafia release remains a valid result.
  await page.goto('http://127.0.0.1:'+server.address().port+'/?game=lafamilia&debug=1');
  await page.waitForFunction(()=>window.__maverick&&window.__storyScene);
  await page.evaluate(()=>{
    const values=[1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],grid=values.map(v=>v?1:-1);
    const base={kind:'base',grid:grid.map(s=>s<0?10:s),stops:[0,0,0,0,0],lineWins:[],scatterCells:[0,1,2,3,4,5],scatterWin:0,multiplier:1,awarded:3,win:0};
    const free={...base,kind:'free',grid,awarded:0,freeIndex:1,freeTotal:1,mults:values,hold:{left:0,fresh:[],collect:120},win:120};
    const round={roundId:'old-mafia-fixture',bet:20,steps:[base,free],totalWin:120,bought:true,acknowledgedStep:-1,complete:false};
    __maverick.rgs.buyBonus=async()=>({round,balance:100000});
    __maverick.rgs.acknowledge=async()=>{};
    window.legacyDone=false;void __maverick.buy().then(()=>{window.legacyDone=true;});
  });
  await page.waitForFunction(()=>window.legacyDone,{},{timeout:60000});
  assert.equal(await page.evaluate(()=>__maverick.busy),false);
  assert.equal(await page.evaluate(()=>__storyScene.phase),'idle');
  assert.ok(await page.evaluate(()=>Array.from({length:15},(_,c)=>__maverick.reelSet.cellSprite(Math.floor(c/3),c%3).alpha).every(a=>a===1)));
  console.log('PASS saved mafia Hold & Win finishes using its original result');
  assert.deepEqual(errors,[]);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
