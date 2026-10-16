import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const {chromium}=await import(pathToFileURL(process.argv[2]).href),root=resolve('.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!p.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await mkdir('tmp/table-redesign',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).hostname==='127.0.0.1')missing.push(r.url());});
 await page.route('https://**',r=>r.abort());
 const url='http://127.0.0.1:'+server.address().port+'/?nosync=1';
 await page.goto(url);await page.waitForFunction(()=>window.MCTruco && window.MCCatalog);
 await page.evaluate(()=>{MC.closeModal();MC.state.balance=100000;MC.save();MC.renderBalance(false);});
 assert.equal(await page.evaluate(()=>MC.getGame('truco').engine),'truco');
 assert.ok(await page.locator('.gcard[data-game="truco"]').count()>0,'Truco appears in lobby');
 await page.locator('.gcard[data-game="truco"]').first().screenshot({path:'tmp/table-redesign/truco-cover.png'});
 for(const id of ['blackjack','roulette','truco']){
  await page.evaluate(id=>MC.showView(id),id);await page.waitForTimeout(350);
  await page.locator('#view-'+id).screenshot({path:'tmp/table-redesign/'+id+'-desktop.png'});
  for(const [width,height] of [[390,844],[320,740],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(120);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+id+' '+width);
   await page.locator('#view-'+id).screenshot({path:'tmp/table-redesign/'+id+'-'+width+'.png'});
  }
  await page.setViewportSize({width:1440,height:1080});
 }
 // Real roulette debit/settlement, navigation guard, repeat cannot discard existing bets.
 await page.evaluate(()=>MC.showView('roulette'));
 const before=await page.evaluate(()=>({balance:MC.state.balance,plays:MC.state.stats.plays}));
 await page.locator('[data-cell="n-7"]').click();
 assert.equal(await page.evaluate(()=>MC.state.balance),before.balance-25);
 await page.evaluate(()=>MC.showView('blackjack'));assert.equal(await page.evaluate(()=>MC.getCurrentGame()),'roulette');
 await page.evaluate(()=>{window.savedRand=MC.randInt;MC.randInt=(min,max)=>max===37?4:0;}); // index 4 = 4, losing 7
 await page.locator('#rouletteSpin').click();await page.waitForTimeout(5100);
 assert.equal(await page.locator('#wheelResult').textContent(),'4');
 assert.equal(await page.evaluate(()=>MC.state.balance),before.balance-25);
 assert.equal(await page.evaluate(()=>MC.state.stats.plays),before.plays+1);
 await page.locator('#rouletteRepeat').click();assert.equal(await page.evaluate(()=>MC.state.balance),before.balance-50);
 assert.equal(await page.locator('#rouletteRepeat').isDisabled(),true);
 await page.locator('#rouletteClear').click();assert.equal(await page.evaluate(()=>MC.state.balance),before.balance-25);
 await page.evaluate(()=>{MC.randInt=(min,max)=>max===37?4:0;});
 await page.locator('[data-cell="n-4"]').click();
 const winBefore=await page.evaluate(()=>MC.state.balance);
 const expected=await page.evaluate(()=>Math.round(25*36*MC.rtp.factor('roulette')));
 await page.locator('#rouletteSpin').click();await page.waitForTimeout(5100);
 assert.equal(await page.evaluate(()=>MC.state.balance),winBefore+expected);
 assert.equal(await page.locator('[data-cell="n-4"]').evaluate(c=>c.classList.contains('win-flash')),true);
 await page.evaluate(()=>{MC.randInt=savedRand;MC.showView('blackjack');});
 const plays=await page.evaluate(()=>MC.state.stats.plays);
 await page.locator('#bjDeal').click();await page.waitForTimeout(1250);
 if(await page.locator('#bjStand').isVisible()){
  await page.evaluate(()=>MC.showView('truco'));assert.equal(await page.evaluate(()=>MC.getCurrentGame()),'blackjack');
  await page.locator('#view-blackjack').screenshot({path:'tmp/table-redesign/blackjack-hand.png'});
  await page.locator('#bjStand').click();
 }
 await page.waitForFunction(n=>MC.state.stats.plays===n+1,plays);assert.ok(await page.locator('#bjDeal').isVisible());
 // A controlled shoe still runs through the production deal/split/double and wallet.
 const splitBefore=await page.evaluate(()=>{
  const draws=[['9','♠'],['10','♥'],['9','♣'],['7','♠'],['2','♥'],['3','♣'],['10','♦']];
  window.shuffleBefore=MC.shuffle;
  MC.shuffle=a=>{draws.forEach(([rank,suit],i)=>{a[a.length-1-i]={rank,suit,red:suit==='♥'||suit==='♦'};});};
  MCBlackjack.init();return {balance:MC.state.balance,plays:MC.state.stats.plays,factor:MC.rtp.factor('blackjack')};
 });
 await page.locator('#bjDeal').click();await page.waitForTimeout(1250);
 await page.locator('#bjSplit').click();assert.equal(await page.locator('#playerHands .hand-box').count(),2);
 await page.locator('#bjDouble').click();
 await page.locator('#view-blackjack').screenshot({path:'tmp/table-redesign/blackjack-hand.png'});
 await page.locator('#bjStand').click();await page.waitForFunction(n=>MC.state.stats.plays===n+1,splitBefore.plays);
 assert.equal(await page.evaluate(()=>MC.state.history[0].staked),300);
 assert.equal(await page.evaluate(()=>MC.state.balance),splitBefore.balance-300+Math.round(200*(1+splitBefore.factor)));
 await page.evaluate(()=>{MC.shuffle=shuffleBefore;});
 await page.evaluate(()=>MC.showView('truco'));await page.locator('[data-target="15"]').click();
 await page.locator('#tcHand [data-card]').first().click();
 assert.equal(await page.evaluate(()=>MC.state.trucoMatch.played[0].length),1);
 await page.locator('#view-truco').screenshot({path:'tmp/table-redesign/truco-hand.png'});
 const frozen=await page.evaluate(()=>({cards:MC.state.trucoMatch.cards,hand:MC.state.trucoMatch.hand,balance:MC.state.balance}));
 await page.reload();await page.waitForFunction(()=>window.MCTruco);await page.evaluate(()=>{MC.closeModal();MC.showView('truco');});
 assert.deepEqual(await page.evaluate(()=>MC.state.trucoMatch.cards),frozen.cards);assert.equal(await page.evaluate(()=>MC.state.trucoMatch.hand),frozen.hand);
 await page.setViewportSize({width:390,height:844});await page.locator('#view-truco').screenshot({path:'tmp/table-redesign/truco-hand-mobile.png'});
 assert.equal(await page.locator('#tcBot .tc-back').count(),3,'AI cards stay hidden');
 // Finish an actual UI match: folding exercises AI turns, canto responses and next-hand flow.
 let steps=0;
 while(await page.evaluate(()=>MC.state.trucoMatch.phase!=='match')){
  assert.ok(++steps<140,'UI match progresses');
  if(await page.locator('#tcNext').isVisible())await page.locator('#tcNext').click();
  else if(await page.locator('[data-action="no-quiero"]').count())await page.locator('[data-action="no-quiero"]').click();
  else if(await page.locator('[data-action="mazo"]').count())await page.locator('[data-action="mazo"]').click();
  else await page.waitForTimeout(300);
 }
 assert.equal(await page.evaluate(()=>MC.state.balance),frozen.balance,'Truco points never debit the wallet');
 assert.ok(await page.locator('#tcNext').isVisible());
 assert.deepEqual(errors,[],'No browser exceptions');assert.deepEqual(missing,[],'No missing local resources');
 console.log('PASS table rooms: lobby integration, 3 responsive sizes, roulette wallet/guard/repeat, blackjack settlement, Truco privacy/save/resume and complete UI match.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
