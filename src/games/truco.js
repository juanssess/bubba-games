(function () {
  'use strict';
  var R=window.MCTrucoRules, el, timer=null, active=false, target=15;
  var suitArt={
    oros:'<circle cx="20" cy="20" r="15" fill="#dfac46" stroke="#91621b" stroke-width="2"/><circle cx="20" cy="20" r="10" fill="none" stroke="#fff0ac"/><path d="m20 11 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" fill="#9e6c20"/>',
    copas:'<path d="M10 7h20v9q0 12-10 12T10 16ZM20 27v8m-9 1h18M10 10H5v6q0 8 9 8m16-14h5v6q0 8-9 8" fill="#b5503c" stroke="#713b29" stroke-width="2"/><path d="M13 10h14" stroke="#edb36c" stroke-width="3"/>',
    espadas:'<path d="m20 2 5 8-3 17h-4l-3-17Z" fill="#adc4c2" stroke="#476b6b" stroke-width="2"/><path d="M11 27h18m-9 0v10m-4 0h8" stroke="#c08d37" stroke-width="4"/>',
    bastos:'<path d="m15 36 4-32 6 3 1 14-5 16Z" fill="#497449" stroke="#28492f" stroke-width="2"/><path d="m20 17-7-6m10 12 8-7m-11 7-7-4" stroke="#729048" stroke-width="3"/>'
  };
  function suit(s) {return '<svg viewBox="0 0 40 40" aria-hidden="true">'+suitArt[s]+'</svg>';}
  function card(c,hidden,click,index,played) {
    if(hidden) return '<div class="tc-card tc-back" aria-label="Carta de Ramón boca abajo"><span>◆</span></div>';
    var face='';
    if(c.n<8) {for(var i=0;i<c.n;i++) face+='<i>'+suit(c.s)+'</i>';}
    else {
      var coat=c.s==='copas'||c.s==='oros'?'#b45139':'#386a67';
      var hat=c.n===12?'<path d="m31 21-3-12 11 5 6-11 6 11 11-5-3 12Z" fill="#d6a53e"/>':'<path d="M27 22h37L55 9H36Z" fill="'+coat+'"/><path d="m53 12 10-9-1 13" fill="#d6a53e"/>';
      var person='<path d="M17 119 23 63 38 51h14l15 12 8 56Z" fill="'+coat+'"/><path d="m30 68 15 15 15-15-7 47H37Z" fill="#d8ae58"/><ellipse cx="45" cy="37" rx="14" ry="18" fill="#e2b58b"/><path d="M30 34q0-25 30-8l-3 8-23-3Z" fill="#493a2b"/>'+hat+'<path d="m21 70-8 36m55-36 9 36M40 46q5 4 10-1" fill="none" stroke="#684939" stroke-width="4"/>';
      if(c.n===11) person='<g transform="translate(8 -3) scale(.72)">'+person+'</g><path d="m12 76 15-18 7 1 3 10 29 11 7 24-6 12-5-22-30-5-5 27h-6l2-31-10-4Z" fill="#c59b65" stroke="#765b3b" stroke-width="2"/><path d="m26 63 4-10 5 12M16 77l12 2m8-6 21 12" fill="none" stroke="#594537" stroke-width="3"/><circle cx="25" cy="69" r="2" fill="#40382e"/>';
      face='<svg class="tc-court" viewBox="0 0 90 130" aria-hidden="true">'+person+'<path d="M13 119h65" stroke="#684939" stroke-width="2"/></svg><b class="tc-figure-name">'+({10:'SOTA',11:'CABALLO',12:'REY'})[c.n]+'</b>';
    }
    return '<'+(click?'button':'div')+' class="tc-card'+(played?' tc-used':'')+'"'+(click?' data-card="'+index+'"':'')+' aria-label="'+c.n+' de '+c.s+'"'+(played?' disabled':'')+'><span class="tc-corner">'+c.n+suit(c.s)+'</span><span class="tc-pips tc-pips-'+c.n+'">'+face+'</span><span class="tc-corner tc-corner-bottom">'+c.n+suit(c.s)+'</span></'+(click?'button':'div')+'>';
  }
  function game() {return MC.state.trucoMatch;}
  function save() {MC.save();}
  function cancel() {if(timer) clearTimeout(timer);timer=null;}
  function schedule() {
    cancel(); var g=game();
    if(!active || !g || g.phase!=='play' || !R.available(g,1).length || (!g.pending && g.turn!==1)) return;
    timer=setTimeout(function(){
      timer=null; var current=game();if(!active || current!==g || g.phase!=='play') return;
      var move=R.decide(R.botView(g));
      if(!g.pending) g.botOpened=true;
      if(R.action(g,1,move.type,move.index)) {MC.sound.card();save();}
      render();
    },1000);
  }
  function label(action,g) {
    return ({quiero:'¡Quiero!','no-quiero':'No quiero',envido:'Envido',real:'Real envido',falta:'Falta envido',mazo:'Al mazo',raise:g.pending?g.pending.value===2?'Retruco':'Vale cuatro':g.truco===1?'Truco':g.truco===2?'Retruco':'Vale cuatro'})[action];
  }
  function scoreMarks(n) {
    var out='';for(var i=0;i<Math.ceil(target/5);i++) out+='<span class="tc-tally" data-count="'+Math.min(5,Math.max(0,n-i*5))+'"><i></i><i></i><i></i><i></i><i></i></span>';
    return out;
  }
  function render() {
    var g=game();
    if(g && !R.valid(g)) {MC.state.trucoMatch=null;g=null;save();}
    el.setup.hidden=!!g;el.game.hidden=!g;
    if(!g) {cancel();el.score.textContent='';el.log.textContent='Ramón te está esperando.';el.speech.textContent='Las cartas se juegan. La mano se conversa.';return;}
    target=g.target;
    var ended=g.phase==='hand'||g.phase==='match', actions=R.available(g,0), canPlay=actions.indexOf('play')>=0;
    el.room.dataset.phase=g.phase;
    el.score.innerHTML=['Vos','Don Ramón'].map(function(name,p){return '<div><span>'+name+'</span><strong>'+g.scores[p]+'<small> / '+g.target+'</small></strong><div class="tc-tallies">'+scoreMarks(g.scores[p])+'</div></div>';}).join('');
    el.meta.textContent='MANO '+g.hand+' · '+(g.mano===0?'SOS MANO':'RAMÓN ES MANO')+' · VALE '+g.truco;
    el.bot.innerHTML=g.cards[1].map(function(c,i){return card(c,!ended,false,i,g.played[1].indexOf(i)>=0);}).join('');
    el.hand.innerHTML=g.cards[0].map(function(c,i){var used=g.played[0].indexOf(i)>=0;return card(c,false,canPlay&&!used,i,used);}).join('');
    el.table.innerHTML=[1,0].map(function(p){var idx=g.played[p][g.played[p].length-1], c=g.cards[p][idx];return '<div class="tc-play-slot"><small>'+(p===0?'VOS':'RAMÓN')+'</small>'+(c?card(c,false,false,idx,false):'<span class="tc-empty">◆</span>')+'</div>';}).join('');
    el.tricks.innerHTML=[0,1,2].map(function(i){return '<span class="'+(g.tricks[i]===0?'yours':g.tricks[i]===1?'theirs':'')+'">'+(i+1)+'ª <b>'+(g.tricks[i]===undefined?'—':g.tricks[i]===-1?'Parda':g.tricks[i]===0?'Tuya':'Ramón')+'</b></span>';}).join('');
    var pending=g.pending;
    el.message.textContent=g.phase==='match'?(g.winner===0?'¡El patio es tuyo!':'Ramón se lleva el partido'):pending?(pending.by===0?'Ramón está pensando…':g.message+' ¿Qué le decís?'):ended?g.message:canPlay?'Elegí una carta o cantá antes de jugar.':'Ramón está pensando su jugada…';
    el.speech.textContent=pending&&pending.by===1?g.message.replace('Ramón: ',''):g.phase==='match'?'¿Otra vuelta?':'Las cartas se juegan. La mano se conversa.';
    var order=['quiero','no-quiero','envido','real','falta','raise','mazo'];
    el.actions.innerHTML=actions.filter(function(a){return a!=='play';}).sort(function(a,b){return order.indexOf(a)-order.indexOf(b);}).map(function(a){return '<button class="btn '+(a==='quiero'?'btn-spin':'btn-ghost')+'" data-action="'+a+'">'+label(a,g)+'</button>';}).join('');
    el.next.hidden=!ended;el.next.textContent=g.phase==='match'?'Nuevo partido':'Siguiente mano';
    el.envido.textContent=g.envidoResult?(g.envidoResult.accepted?(ended?'Envido: vos '+g.envidoResult.values[0]+' · Ramón '+g.envidoResult.values[1]:'Envido resuelto · cartas al final de la mano'):'Envido no querido'):'Tu envido: '+R.envido(g.cards[0])+' · sin flor';
    el.log.textContent=g.log.slice(-7).join('\n');
    schedule();
  }
  function init() {
    el={room:document.getElementById('view-truco'),setup:document.getElementById('tcSetup'),game:document.getElementById('tcGame'),score:document.getElementById('tcScore'),meta:document.getElementById('tcMeta'),bot:document.getElementById('tcBot'),hand:document.getElementById('tcHand'),table:document.getElementById('tcTable'),tricks:document.getElementById('tcTricks'),message:document.getElementById('tcMessage'),speech:document.getElementById('tcSpeech'),actions:document.getElementById('tcActions'),next:document.getElementById('tcNext'),envido:document.getElementById('tcEnvido'),log:document.getElementById('tcLog')};
    el.setup.onclick=function(e){var b=e.target.closest('[data-target]');if(!b)return;MC.state.trucoMatch=R.create(Number(b.dataset.target));save();render();};
    el.hand.onclick=function(e){var b=e.target.closest('[data-card]');if(!b)return;if(R.action(game(),0,'play',Number(b.dataset.card))){MC.sound.card();save();render();}};
    el.actions.onclick=function(e){var b=e.target.closest('[data-action]');if(!b)return;if(R.action(game(),0,b.dataset.action)){MC.sound.click();save();render();}};
    el.next.onclick=function(){var g=game();if(g.phase==='match')MC.state.trucoMatch=null;else R.next(g);save();render();};
    MC.onEnter('truco',function(){active=true;render();});
    MC.onLeave('truco',function(){active=false;cancel();});
    render();
  }
  window.MCTruco={init:init};
})();
