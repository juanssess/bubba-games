/* Truco argentino, mano a mano y sin flor. Motor independiente de la interfaz. */
(function (root) {
  'use strict';
  var SUITS = ['oros', 'copas', 'espadas', 'bastos'];
  function deck() {
    var out = [];
    SUITS.forEach(function (s) { [1,2,3,4,5,6,7,10,11,12].forEach(function (n) { out.push({ n:n, s:s }); }); });
    return out;
  }
  function strength(c) {
    if(c.n===1 && c.s==='espadas') return 14;
    if(c.n===1 && c.s==='bastos') return 13;
    if(c.n===7 && c.s==='espadas') return 12;
    if(c.n===7 && c.s==='oros') return 11;
    return ({3:10,2:9,1:8,12:7,11:6,10:5,7:4,6:3,5:2,4:1})[c.n];
  }
  function envido(cards) {
    var best = 0;
    cards.forEach(function (a, i) {
      var av=a.n<8?a.n:0; best=Math.max(best,av);
      cards.slice(i+1).forEach(function(b) { if(a.s===b.s) best=Math.max(best,20+av+(b.n<8?b.n:0)); });
    });
    return best;
  }
  function log(g, text) { g.log.push(text); g.log=g.log.slice(-24); g.message=text; }
  function award(g,p,n,why) {
    g.scores[p]=Math.min(g.target,g.scores[p]+n);
    log(g,(p===0?'Vos':'Don Ramón')+' +'+n+' · '+why);
    if(g.scores[p]>=g.target) { g.phase='match'; g.winner=p; g.pending=null; g.suspended=null; }
  }
  function finish(g,p,n,why) { award(g,p,n,why); if(g.phase!=='match') g.phase='hand'; g.pending=null; g.suspended=null; }
  function next(g,random) {
    if(g.phase!=='hand' && g.phase!=='ready') return false;
    var d=deck(), rng=random||Math.random;
    for(var i=d.length-1;i>0;i--) { var j=Math.floor(rng()*(i+1)), c=d[i];d[i]=d[j];d[j]=c; }
    if(g.phase==='hand') g.mano=1-g.mano;
    g.hand++; g.cards=[[],[]];
    for(var k=0;k<6;k++) g.cards[(g.mano+k)%2].push(d.pop());
    g.played=[[],[]]; g.tricks=[];g.table=[null,null];g.turn=g.mano;
    g.truco=1;g.raiseOwner=null;g.envidoDone=false;g.envidoResult=null;
    g.pending=null;g.suspended=null;g.botOpened=false;g.phase='play';
    log(g,'Mano '+g.hand+' · '+(g.mano===0?'Sos mano':'Don Ramón es mano'));
    return true;
  }
  function create(target,random) {
    var g={version:1,target:target===30?30:15,scores:[0,0],mano:0,hand:0,phase:'ready',log:[]};
    next(g,random); return g;
  }
  function valid(g) {
    // El estado también llega desde el guardado en la nube: un dato viejo o
    // incompleto no debe interrumpir el arranque de los demás juegos.
    if(!g || g.version!==1 || [15,30].indexOf(g.target)<0 || ['play','hand','match'].indexOf(g.phase)<0) return false;
    var player=function(p){return p===0||p===1;};
    var legalCard=function(c){return c && SUITS.indexOf(c.s)>=0 && [1,2,3,4,5,6,7,10,11,12].indexOf(c.n)>=0;};
    if(!player(g.mano)||!player(g.turn)||!Number.isInteger(g.hand)||g.hand<1||[1,2,3,4].indexOf(g.truco)<0) return false;
    if(!Array.isArray(g.scores)||g.scores.length!==2||!g.scores.every(function(n){return Number.isInteger(n)&&n>=0&&n<=g.target;})) return false;
    if(!Array.isArray(g.cards)||g.cards.length!==2||!g.cards.every(function(h){return Array.isArray(h)&&h.length===3&&h.every(legalCard);})) return false;
    if(new Set(g.cards[0].concat(g.cards[1]).map(function(c){return c.n+':'+c.s;})).size!==6) return false;
    if(!Array.isArray(g.played)||g.played.length!==2||!g.played.every(function(h){return Array.isArray(h)&&h.length<=3&&new Set(h).size===h.length&&h.every(function(i){return [0,1,2].indexOf(i)>=0;});})) return false;
    if(!Array.isArray(g.tricks)||g.tricks.length>3||!g.tricks.every(function(p){return p===-1||player(p);})) return false;
    if(!Array.isArray(g.table)||g.table.length!==2||!g.table.every(function(c){return c===null||legalCard(c);})) return false;
    if(!Array.isArray(g.log)||!g.log.every(function(s){return typeof s==='string';})) return false;
    if(g.raiseOwner!==null&&!player(g.raiseOwner)) return false;
    function offer(q){return q===null || !!(q && player(q.by) && (q.kind==='truco'?[2,3,4].indexOf(q.value)>=0:q.kind==='envido'&&['envido','real','falta'].indexOf(q.name)>=0&&Number.isInteger(q.value)&&q.value>0&&Number.isInteger(q.refused)&&q.refused>0&&[0,1,2].indexOf(q.count)>=0));}
    if(!offer(g.pending)||!offer(g.suspended)) return false;
    if(g.envidoResult && (!player(g.envidoResult.winner)||!Array.isArray(g.envidoResult.values)||g.envidoResult.values.length!==2||!g.envidoResult.values.every(function(n){return Number.isInteger(n)&&n>=0&&n<=33;}))) return false;
    return g.phase!=='match'||player(g.winner);
  }
  function available(g,p) {
    if(g.phase!=='play') return [];
    if(g.pending) {
      if(g.pending.by===p) return [];
      var a=['quiero','no-quiero'];
      if(g.pending.kind==='envido') {
        if(g.pending.name==='envido' && g.pending.count<2) a.push('envido');
        if(g.pending.name==='envido') a.push('real');
        if(g.pending.name!=='falta') a.push('falta');
      } else {
        if(g.pending.value<4) a.push('raise');
        if(!g.envidoDone && !g.tricks.length && !g.played[p].length && g.truco===1) a.push('envido','real','falta');
      }
      return a;
    }
    var out=[];
    if(g.turn===p) out.push('play','mazo');
    if(g.truco<4 && (g.raiseOwner===null || g.raiseOwner===p)) out.push('raise');
    if(!g.envidoDone && !g.tricks.length && !g.played[p].length && g.truco===1) out.push('envido','real','falta');
    return out;
  }
  function action(g,p,type,index) {
    if(available(g,p).indexOf(type)<0) return false;
    var q=g.pending, other=1-p;
    if(type==='play') {
      if(!Number.isInteger(index) || index<0 || index>=g.cards[p].length || g.played[p].indexOf(index)>=0) return false;
      g.played[p].push(index);g.table[p]=g.cards[p][index];
      log(g,(p===0?'Jugás ':'Don Ramón juega ')+g.table[p].n+' de '+g.table[p].s);
      if(!g.table[other]) {g.turn=other;return true;}
      var delta=strength(g.table[0])-strength(g.table[1]), winner=delta===0?-1:delta>0?0:1;
      g.tricks.push(winner);
      var a=g.tricks, resolved=null;
      if(a.length===2) {
        if(a[0]===-1 && a[1]!==-1) resolved=a[1];
        else if(a[0]!==-1 && (a[1]===-1 || a[0]===a[1])) resolved=a[0];
      }
      if(a.length===3) resolved=a[2]!==-1?a[2]:a[0]!==-1?a[0]:g.mano;
      if(resolved!==null) finish(g,resolved,g.truco,'la mano');
      else {g.turn=winner===-1?g.mano:winner;g.table=[null,null];log(g,winner===-1?'Parda · sigue la mano':(winner===0?'Tuya':'De Ramón')+' la '+(a.length===1?'primera':'segunda'));}
    } else if(type==='mazo') {
      var points=g.truco;
      if(!g.played[0].length && !g.played[1].length && !g.envidoDone && g.truco===1) points=2;
      finish(g,other,points,'al mazo');
    } else if(type==='raise') {
      var v=q?q.value+1:g.truco+1;
      if(q) {g.truco=q.value;g.raiseOwner=p;}
      g.pending={kind:'truco',by:p,value:v};
      log(g,(p===0?'Vos: ':'Ramón: ')+['','','¡Truco!','¡Retruco!','¡Vale cuatro!'][v]);
    } else if(type==='envido' || type==='real' || type==='falta') {
      if(q && q.kind==='truco') {g.suspended=q;q=null;}
      var value=type==='falta'?g.target-Math.max.apply(null,g.scores):(q?q.value:0)+(type==='real'?3:2);
      g.pending={kind:'envido',by:p,name:type,value:value,refused:q?q.value:1,count:(q?q.count:0)+(type==='envido'?1:0)};
      log(g,(p===0?'Vos: ':'Ramón: ')+({envido:'¡Envido!',real:'¡Real envido!',falta:'¡Falta envido!'})[type]);
    } else if(q.kind==='truco') {
      if(type==='no-quiero') finish(g,q.by,q.value-1,'no quiso');
      else {g.truco=q.value;g.raiseOwner=p;g.pending=null;log(g,(p===0?'Vos':'Ramón')+': ¡Quiero! · la mano vale '+g.truco);}
    } else {
      g.envidoDone=true;
      var e=[envido(g.cards[0]),envido(g.cards[1])], ep=type==='no-quiero'?q.by:e[0]===e[1]?g.mano:e[0]>e[1]?0:1;
      g.envidoResult={values:e,winner:ep,accepted:type==='quiero'};
      award(g,ep,type==='no-quiero'?q.refused:q.value,type==='no-quiero'?'envido no querido':'envido querido');
      if(g.phase==='play') {g.pending=g.suspended;g.suspended=null;}
    }
    return true;
  }
  // La IA recibe sus cartas y la información pública; jamás la mano rival.
  function botView(g) {
    return {cards:g.cards[1],played:g.played[1],opponentPlayed:g.played[0].map(function(i){return g.cards[0][i];}),
      table:g.table,tricks:g.tricks,mano:g.mano,turn:g.turn,truco:g.truco,pending:g.pending,
      actions:available(g,1),opened:g.botOpened};
  }
  function decide(v,random) {
    var rng=random||Math.random, a=v.actions, remaining=v.cards.map(function(c,i){return {card:c,index:i};}).filter(function(x){return v.played.indexOf(x.index)<0;});
    remaining.sort(function(x,y){return strength(x.card)-strength(y.card);});
    var good=remaining.filter(function(x){return strength(x.card)>=9;}).length;
    if(v.pending) {
      if(v.pending.kind==='envido') {
        var e=envido(v.cards);
        if(e>=31 && a.indexOf('real')>=0 && rng()<.35) return {type:'real'};
        return {type:e>=(v.pending.name==='falta'?30:27)?'quiero':'no-quiero'};
      }
      if(a.indexOf('envido')>=0 && envido(v.cards)>=28) return {type:'envido'};
      if(a.indexOf('raise')>=0 && good>=2 && rng()<.3) return {type:'raise'};
      return {type:good || (v.tricks.indexOf(1)>=0 && remaining.some(function(x){return strength(x.card)>=7;})) || rng()<.15?'quiero':'no-quiero'};
    }
    if(!v.opened) {
      if(a.indexOf('envido')>=0 && envido(v.cards)>=27 && rng()<.75) return {type:'envido'};
      if(a.indexOf('raise')>=0 && (good>=2 || rng()<.08)) return {type:'raise'};
    }
    var pick=remaining[0], facing=v.table[0];
    if(facing) pick=remaining.find(function(x){return strength(x.card)>strength(facing);})||remaining[0];
    else if(!v.tricks.length) pick=remaining[remaining.length-1];
    return {type:'play',index:pick.index};
  }
  root.MCTrucoRules={deck:deck,strength:strength,envido:envido,create:create,valid:valid,next:next,action:action,available:available,botView:botView,decide:decide};
})(typeof window==='undefined'?globalThis:window);
