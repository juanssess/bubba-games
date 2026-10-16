import assert from 'node:assert/strict';
await import('../src/games/truco-rules.js');
const R=globalThis.MCTrucoRules,c=(n,s='oros')=>({n,s});
assert.equal(R.deck().length,40);assert.equal(new Set(R.deck().map(c=>c.n+c.s)).size,40);
assert.equal(R.valid(R.create(30)),true);assert.equal(R.valid({version:1}),false);
let corrupted=R.create(15);corrupted.cards[0][0].s='<invalid>';assert.equal(R.valid(corrupted),false);
const order=[c(1,'espadas'),c(1,'bastos'),c(7,'espadas'),c(7),c(3),c(2),c(1),c(12),c(11),c(10),c(7,'copas'),c(6),c(5),c(4)];
for(let i=1;i<order.length;i++)assert.ok(R.strength(order[i-1])>R.strength(order[i]));
assert.equal(R.envido([c(7),c(6),c(5)]),33,'Three of a suit use best two, without flor');
assert.equal(R.envido([c(12),c(11),c(10,'copas')]),20);
assert.equal(R.envido([c(7),c(6,'copas'),c(12,'bastos')]),7);
function fixture(){const g=R.create(15,()=>.5);g.cards=[[c(3),c(2),c(4)],[c(5,'copas'),c(6,'copas'),c(7,'copas')]];return g;}
let g=fixture();assert.ok(R.action(g,0,'raise'));assert.ok(R.action(g,1,'envido'));assert.equal(g.suspended.kind,'truco');assert.ok(R.action(g,0,'quiero'));assert.deepEqual(g.scores,[0,2]);assert.equal(g.pending.kind,'truco');assert.ok(R.action(g,1,'quiero'));assert.equal(g.truco,2);assert.ok(!R.available(g,0).includes('raise'));assert.ok(R.available(g,1).includes('raise'));
assert.ok(R.action(g,1,'raise'));assert.ok(R.action(g,0,'no-quiero'));assert.deepEqual(g.scores,[0,4]);assert.equal(g.phase,'hand');
g=fixture();R.action(g,0,'envido');R.action(g,1,'envido');R.action(g,0,'real');R.action(g,1,'no-quiero');assert.deepEqual(g.scores,[4,0],'Refusing real after envido-envido pays four');
g=fixture();g.scores=[10,5];R.action(g,0,'falta');assert.equal(g.pending.value,5);R.action(g,1,'quiero');assert.deepEqual(g.scores,[10,10]);
g=fixture();g.cards[1]=g.cards[0];R.action(g,1,'envido');R.action(g,0,'quiero');assert.equal(g.scores[0],2,'Mano wins tied envido');
g=fixture();R.action(g,0,'play',0);assert.ok(!R.available(g,0).includes('envido'));assert.equal(R.action(g,0,'play',0),false);
g=fixture();R.action(g,0,'mazo');assert.equal(g.scores[1],2);R.next(g,()=>.5);assert.equal(g.mano,1);
function playHand(a,b){let g=fixture();g.cards=[a,b];for(let safety=0;g.phase==='play'&&safety<6;safety++){let p=g.turn;let i=[0,1,2].find(i=>!g.played[p].includes(i));assert.ok(R.action(g,p,'play',i));}return g;}
g=playHand([c(4),c(3),c(5)],[c(4,'copas'),c(5,'copas'),c(6,'copas')]);assert.equal(g.scores[0],1,'First parda: second decides');
g=playHand([c(3),c(4),c(5)],[c(4,'copas'),c(3,'copas'),c(5,'copas')]);assert.equal(g.scores[0],1,'Split first two, third parda: first wins');
g=playHand([c(3),c(4),c(5)],[c(3,'copas'),c(4,'copas'),c(5,'copas')]);assert.equal(g.scores[0],1,'Three pardas: mano');
g=playHand([c(3),c(4),c(5)],[c(4,'copas'),c(4,'copas'),c(3,'copas')]);assert.equal(g.scores[0],1,'Second parda: first decides');
g=fixture();const view=R.botView(g),before=R.decide(view,()=>.5);g.cards[0]=[c(1,'espadas'),c(1,'bastos'),c(7,'espadas')];assert.deepEqual(R.decide(R.botView(g),()=>.5),before,'Changing hidden player cards cannot change AI decision');assert.ok(!('opponentCards' in view));
let seed=91234;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let match=0;match<300;match++){
 g=R.create(match%2?30:15,rng);let steps=0;
 while(g.phase!=='match'){
  assert.ok(++steps<1800,'Match must finish');
  if(g.phase==='hand'){R.next(g,rng);continue;}
  let p=g.pending?1-g.pending.by:g.turn;
  let v=R.botView(g);
  if(p===0)v={...v,cards:g.cards[0],played:g.played[0],table:[g.table[1],g.table[0]],opponentPlayed:g.played[1].map(i=>g.cards[1][i]),actions:R.available(g,0),tricks:g.tricks.map(t=>t===-1?-1:1-t),opened:g.botOpened};
  const move=R.decide(v,rng);assert.ok(R.action(g,p,move.type,move.index),JSON.stringify({p,move,available:R.available(g,p)}));
  if(!g.pending)g.botOpened=true;
  if(steps%7===0)g=JSON.parse(JSON.stringify(g)); // serialized matches remain playable
  assert.ok(R.valid(g),'Every live state can be safely restored');
 }
 assert.equal(g.scores[g.winner],g.target);
}
console.log('PASS Truco: deck, ranking, envido chains, falta, interrupted truco, raise ownership, pardas, AI privacy and 300 complete saved matches.');
