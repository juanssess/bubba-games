/* Original arrangements and instrument bank. Presentation only: no game RNG.
   Each score owns its rhythm, harmony, instrumentation and event vocabulary. */
(function (global) {
  'use strict';
  var MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
  function score(name, bpm, root, lead, backing, rhythm, melody, minor, chords) {
    return {name:name, bpm:bpm, root:root, lead:lead, backing:backing, rhythm:rhythm,
      melody:melody, scale:minor ? MINOR : MAJOR, minor:!!minor, chords:chords || [0, 5, 3, 7], meter:16};
  }
  var SCORES = {
    feria: score('Cumbia de la feria', 104, 62, 'accordion', 'guitar', 'cumbia',
      [0,-1,4,7,9,-1,7,4,2,-1,4,-1,7,4,2,-1,0,-1,4,7,12,9,7,-1,4,2,0,-1,2,-1,7,-1], false, [0,5,7,0]),
    carnaval: score('Comparsa de medianoche', 112, 67, 'brass', 'flute', 'samba',
      [7,-1,9,7,4,-1,2,0,-1,4,-1,7,9,12,9,-1,7,-1,4,2,0,-1,2,4,7,-1,9,12,14,12,9,-1], false, [0,9,5,7]),
    cataratas: score('Garganta del Diablo', 96, 57, 'marimba', 'flute', 'jungle',
      [0,-1,4,7,-1,9,7,-1,12,-1,11,9,7,-1,4,-1,5,-1,9,-1,12,14,12,-1,9,7,5,-1,4,-1,2,-1], false, [0,5,9,7]),
    ruta40: score('Ruta del desierto', 116, 52, 'guitar', 'organ', 'rock',
      [0,-1,3,5,7,-1,5,3,0,-1,-1,7,10,-1,7,-1,12,-1,10,7,5,-1,3,5,7,-1,10,12,15,12,10,-1], true, [0,5,7,3]),
    famatina: score('Socavón de Famatina', 78, 50, 'crystal', 'pad', 'cave',
      [0,-1,-1,3,-1,7,-1,-1,8,-1,7,-1,3,-1,-1,-1,0,-1,-1,5,-1,8,-1,10,12,-1,10,-1,8,7,-1,-1], true, [0,8,5,7]),
    dunas: score('Travesía de arena', 104, 50, 'guitar', 'pad', 'desert',
      [0,-1,3,-1,7,8,7,-1,3,-1,0,-1,-1,3,5,-1,7,-1,10,8,7,-1,5,3,2,-1,0,-1,3,-1,-1,-1], true, [0,8,5,7]),
    granpremio: score('Vuelta final', 120, 55, 'brass', 'organ', 'rock',
      [0,-1,4,7,-1,7,9,-1,12,-1,9,7,4,-1,7,-1,9,-1,12,14,12,-1,9,7,4,-1,7,9,12,-1,7,-1], false, [0,5,7,5]),
    kermes: score('Kermés de barrio', 110, 60, 'accordion', 'guitar', 'cumbia',
      [0,-1,4,-1,7,9,7,-1,4,-1,2,-1,4,7,-1,-1,9,-1,7,-1,4,2,0,-1,2,-1,4,-1,7,4,0,-1], false, [0,5,7,0]),
    kiosco: score('Caramelos eléctricos', 114, 64, 'marimba', 'epiano', 'pop',
      [0,-1,7,-1,12,11,7,-1,4,-1,2,4,7,-1,4,-1,9,-1,7,4,2,-1,0,-1,4,7,12,-1,11,7,4,-1], false, [0,9,5,7]),
    vendimia: score('Tango entre viñedos', 92, 57, 'bandoneon', 'strings', 'tango',
      [0,-1,7,8,7,-1,3,-1,2,-1,0,2,3,-1,7,-1,8,-1,7,5,3,-1,2,0,-1,2,3,7,5,3,2,-1], true, [0,5,7,0]),
    maverick: score('Cámara del sol', 82, 50, 'panflute', 'marimba', 'temple',
      [0,-1,-1,3,7,-1,10,-1,7,-1,5,-1,3,-1,-1,-1,0,-1,3,-1,5,7,-1,10,12,-1,10,-1,7,5,3,-1], true, [0,8,5,7]),
    sebusca: score('Polvo y recompensa', 92, 57, 'whistle', 'guitar', 'western',
      [0,-1,-1,7,10,-1,7,-1,3,-1,2,0,-1,-1,7,-1,12,-1,10,7,5,-1,3,-1,2,-1,0,-1,7,3,2,-1], true, [0,0,5,7]),
    slots5: score('El oro del tigre', 88, 55, 'bell', 'harp', 'cinema',
      [0,-1,3,-1,7,-1,10,12,-1,-1,10,7,5,-1,3,-1,7,-1,10,-1,14,12,10,-1,7,5,3,-1,2,-1,0,-1], true, [0,8,3,7]),
    slots777: score('Fiebre setecientos setenta y siete', 112, 60, 'brass', 'clav', 'disco',
      [0,-1,4,7,-1,9,7,-1,12,-1,9,7,4,-1,2,-1,4,-1,7,9,12,-1,14,12,9,-1,7,4,2,-1,0,-1], false, [0,9,5,7]),
    bowling: score('Strike de medianoche', 126, 57, 'guitar', 'organ', 'rock',
      [0,-1,3,4,7,-1,9,10,9,-1,7,4,3,-1,0,-1,12,-1,10,9,7,-1,4,3,0,-1,3,4,7,4,3,-1], false, [0,5,0,7]),
    crash: score('Vuelo de neón', 118, 45, 'synth', 'pad', 'electro',
      [12,-1,7,-1,10,-1,3,-1,7,-1,0,-1,3,7,10,-1,12,-1,14,-1,15,-1,10,-1,7,-1,3,0,7,10,7,-1], true, [0,8,3,10]),
    mines: score('Cristales bajo tierra', 74, 62, 'crystal', 'pad', 'cave',
      [0,-1,-1,-1,7,-1,-1,10,-1,-1,5,-1,3,-1,-1,-1,12,-1,-1,10,7,-1,-1,-1,5,-1,3,-1,2,-1,-1,-1], true, [0,5,8,0]),
    roulette: score('Vals del paño verde', 102, 55, 'piano', 'vibes', 'waltz',
      [0,-1,4,-1,7,9,7,-1,4,-1,2,-1,4,-1,7,-1,11,12,9,-1,7,-1,4,-1], false, [0,9,2,7]),
    blackjack: score('Veintiuno después de las doce', 96, 53, 'epiano', 'vibes', 'swing',
      [0,-1,3,-1,7,10,-1,9,7,-1,5,-1,3,-1,2,-1,0,-1,7,-1,10,12,-1,10,7,-1,5,3,2,-1,0,-1], true, [0,5,2,7]),
    sports: score('La tribuna', 108, 48, 'brass', 'organ', 'stadium',
      [0,-1,-1,0,7,-1,7,-1,9,-1,7,5,4,-1,-1,-1,4,-1,4,5,7,-1,9,7,5,-1,4,2,0,-1,-1,-1], false, [0,5,0,7]),
    plantilla: score('Doble o nada', 94, 60, 'epiano', 'guitar', 'soul',
      [0,-1,4,-1,7,-1,9,7,4,-1,2,-1,0,-1,-1,-1,9,-1,7,4,2,-1,4,-1,7,-1,12,9,7,-1,4,-1], false, [0,9,5,7])
  };
  SCORES.roulette.meter = 12;
  var THEMES = {
    azteca:'maverick', oeste:'sebusca', frutas:'slots777', fiesta:'carnaval',
    selva:'maverick', espacio:'crash', hielo:'mines', nilo:'vendimia', dragon:'slots5', oceano:'mines'
  };
  var themeChanges = {
    selva:['marimba','flute','jungle',96], espacio:['synth','pad','space',102],
    hielo:['celesta','strings','snow',72], nilo:['oud','reed','desert',90],
    dragon:['koto','flute','taiko',84], oceano:['harp','pad','ocean',70]
  };
  function hash(text) { var n = 0; for (var i=0;i<text.length;i++) n=(31*n+text.charCodeAt(i))>>>0; return n; }
  function profile(meta) {
    var id = meta.id || '', theme = meta.theme, source = SCORES[id] || SCORES[THEMES[theme]] || SCORES.slots777;
    var p = Object.assign({}, source), seed = hash(id);
    p.id = id; p.seed = seed; p.melody = source.melody.slice();
    if (!SCORES[id]) {
      p.root += seed % 4; p.bpm += (seed % 7) - 3;
      var melodicIndex=0, melodySeed=seed || 1;
      p.melody = p.melody.map(function(n) {
        if(n<0) return n;
        melodySeed^=melodySeed<<13;melodySeed^=melodySeed>>>17;melodySeed^=melodySeed<<5;
        return melodicIndex++%3===0 ? source.scale[(melodySeed>>>0)%7]+12*Math.floor(n/12) : n;
      });
      if (themeChanges[theme]) {
        var change = themeChanges[theme];
        p.lead=change[0]; p.backing=change[1]; p.rhythm=change[2]; p.bpm=change[3]+seed%5;
      }
    }
    return p;
  }
  var banks = new WeakMap();
  function bank(c) {
    if (banks.has(c)) return banks.get(c);
    var cache = {}, randomState = 197903;
    function random() { randomState=(Math.imul(randomState,1664525)+1013904223)>>>0; return randomState/4294967296*2-1; }
    function buffer(name) {
      if (cache[name]) return cache[name];
      var drum = /^(kick|snare|hat|shaker|guiro|conga|tom|rim|clap|tamborim|surdo|agogo|brush|wood|gong|impact|roll)$/.test(name);
      var duration = drum ? (name==='gong'?2: name==='roll'?1.7:0.65) : 2.1;
      var b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate), d=b.getChannelData(0);
      var f=drum?110:261.625565, phase=0, smooth=0;
      var plucked=/^(guitar|harp|koto|oud|clav)$/.test(name), delay=plucked?new Float32Array(Math.round(c.sampleRate/f)):null;
      if (delay) for(var j=0;j<delay.length;j++) delay[j]=random()*0.65;
      for(var i=0;i<d.length;i++) {
        var t=i/c.sampleRate, n=random(), x=0, a=1, ph=2*Math.PI*f*t;
        smooth=0.8*smooth+0.2*n;
        if (drum) {
          if(name==='kick'||name==='surdo') { phase+=2*Math.PI*(name==='kick'?44+110*Math.exp(-t*35):62+38*Math.exp(-t*28))/c.sampleRate; x=Math.sin(phase)*Math.exp(-t*10)+n*Math.exp(-t*160)*0.2; }
          else if(name==='snare'||name==='clap'||name==='brush') x=(n-smooth)*Math.exp(-t*(name==='brush'?14:24))*0.65+Math.sin(t*2*Math.PI*185)*Math.exp(-t*30)*0.25;
          else if(name==='hat'||name==='shaker'||name==='guiro') x=(n-smooth)*Math.exp(-t*(name==='hat'?70:30))*(name==='guiro'?Math.pow(Math.sin(t*2*Math.PI*75),8):1)*0.65;
          else if(name==='roll') x=smooth*Math.exp(-t*0.8)*(0.5+0.5*Math.sin(t*2*Math.PI*24));
          else if(name==='gong') x=(Math.sin(ph*.7)+Math.sin(ph*1.043)*.6+Math.sin(ph*1.77)*.4+Math.sin(ph*2.71)*.2)*Math.exp(-t*2.6)*.3;
          else if(name==='impact') x=(smooth*.8+Math.sin(ph*.43)*.7)*Math.exp(-t*8);
          else { var hz=name==='agogo'?720:name==='wood'?850:name==='rim'?1100:name==='tamborim'?340:name==='tom'?110:210;
            phase+=2*Math.PI*(hz+hz*.6*Math.exp(-t*40))/c.sampleRate;
            x=(Math.sin(phase)+.25*Math.sin(phase*1.73))*Math.exp(-t*(name==='tom'?13:27))*.6+n*Math.exp(-t*90)*.12;
          }
        } else if(plucked) {
          var pos=i%delay.length, next=(pos+1)%delay.length;
          x=delay[pos]; delay[pos]=(delay[pos]+delay[next])*(name==='guitar'?.496:name==='clav'?.478:.493);
          x=x*(name==='koto'?1.2:1)+Math.sin(ph*2.01)*Math.exp(-t*13)*.09;
        } else if(name==='bass') x=(Math.sin(ph)+.28*Math.sin(ph*2)+.12*Math.sin(ph*3))*Math.exp(-t*3)*.65;
        else if(name==='piano'||name==='epiano'||name==='vibes'||name==='marimba'||name==='celesta'||name==='crystal'||name==='bell') {
          var ratio=name==='bell'?2.76:name==='crystal'?3.99:name==='marimba'?3.01:name==='epiano'?1:2;
          var depth=name==='epiano'?2.6:name==='piano'?1.5:name==='marimba'?1.8:1.1;
          x=(Math.sin(ph+Math.sin(ph*ratio)*depth*Math.exp(-t*5))*.65+Math.sin(ph*2.002)*Math.exp(-t*9)*.18)*Math.exp(-t*(name==='marimba'?5:name==='celesta'?2.4:2));
        } else if(name==='flute'||name==='panflute'||name==='whistle') {
          var breath=name==='panflute'?.045:.015;
          x=(Math.sin(ph+Math.sin(t*2*Math.PI*5)*.018)+.12*Math.sin(ph*2)+breath*smooth)*.55;
          a=Math.min(1,t/.055)*Math.exp(-t*.9);
        } else {
          var harmonics=name==='pad'||name==='strings'?8:name==='synth'?10:name==='brass'?7:9;
          for(var h=1;h<=harmonics;h++) {
            var amp=name==='organ'?(h===1?1:h===2?.45:h===3?.25:.025):name==='accordion'||name==='bandoneon'||name==='reed'?1/Math.pow(h,1.35):1/Math.pow(h,1.7);
            x+=amp*Math.sin(ph*h+Math.sin(t*2*Math.PI*4.8)*.018*h);
            if(name==='accordion'||name==='bandoneon'||name==='strings'||name==='pad') x+=amp*.38*Math.sin(ph*h*1.003);
          }
          x*=.35; a=Math.min(1,t/(name==='pad'||name==='strings'?.16:.025))*Math.exp(-t*(name==='brass'?1.9:.8));
        }
        a*=Math.min(1,(duration-t)/.05); d[i]=Math.tanh(x*a*1.15)*.75;
      }
      b.soundtrackInstrument=name; cache[name]=b; return b;
    }
    var impulse=c.createBuffer(2,Math.ceil(c.sampleRate*1.5),c.sampleRate);
    for(var ch=0;ch<2;ch++) {var data=impulse.getChannelData(ch); for(var k=0;k<data.length;k++) data[k]=random()*Math.exp(-k/c.sampleRate*5)*.3;}
    var result={get:buffer, impulse:impulse}; banks.set(c,result); return result;
  }
  function create(c, output, meta) {
    var p=profile(meta), samples=bank(c), disposed=false, sources=new Set(), nodes=[];
    var music=c.createGain(), duck=c.createGain(), fx=c.createGain(), dry=c.createGain();
    music.gain.value=0; duck.gain.value=1; fx.gain.value=1; dry.gain.value=.82;
    music.connect(duck).connect(dry); fx.connect(dry); dry.connect(output);
    var verb=c.createConvolver(), wet=c.createGain(); verb.buffer=samples.impulse; wet.gain.value=p.rhythm==='cave'||p.rhythm==='ocean'?.28:.12;
    dry.connect(verb).connect(wet).connect(output);
    var echo=c.createDelay(1), feedback=c.createGain(), echoVol=c.createGain();
    echo.delayTime.value=60/p.bpm*.75; feedback.gain.value=.18; echoVol.gain.value=.075;
    duck.connect(echo).connect(feedback).connect(echo); echo.connect(echoVol).connect(output);
    nodes.push(music,duck,fx,dry,verb,wet,echo,feedback,echoVol);
    function sample(name,t,note,length,vol,pan,target) {
      if(disposed) return;
      var src=c.createBufferSource(), g=c.createGain(), stereo=c.createStereoPanner();
      src.buffer=samples.get(name); src.playbackRate.value=Math.pow(2,((note==null?60:note)-60)/12);
      t=Math.max(c.currentTime,t); length=Math.max(.025,length);
      var attack=/pad|strings/.test(name)?.09:.006;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+Math.min(attack,length*.3));
      g.gain.setValueAtTime(vol,t+length*.65); g.gain.exponentialRampToValueAtTime(.0001,t+length+.08);
      stereo.pan.value=pan||0; src.connect(g).connect(stereo).connect(target||music);
      sources.add(src); src.onended=function(){src.disconnect();g.disconnect();stereo.disconnect();sources.delete(src);};
      src.start(t); src.stop(t+length+.1); return src;
    }
    function drum(name,t,vol,pan,target) { return sample(name,t,60,name==='gong'?1.6:name==='roll'?1.5:.32,vol,pan,target); }
    function musicOn(on) { music.gain.setTargetAtTime(on?.72:0,c.currentTime,.065); }
    function percussion(t,s,bar,bonus) {
      var r=p.rhythm, latin=/cumbia|samba|jungle|desert/.test(r), sparse=/cave|ocean|snow|space/.test(r);
      if(r==='cumbia') {
        if(s===0||s===8||s===11) drum('kick',t,.17);
        if(s===4||s===12) drum('rim',t,.12,.18);
        if(s%2===0) drum('guiro',t,.14,-.35);
        if([3,6,10,14].indexOf(s)>=0) drum('conga',t,.13,s%4?.3:-.25);
        if(bonus&&s%2===1) drum('tamborim',t,.07,.35);
      } else if(r==='samba') {
        if(s===0||s===6||s===8||s===14) drum('surdo',t,s===8?.2:.13);
        if([0,3,6,10,12,15].indexOf(s)>=0) drum('tamborim',t,.12,.3);
        if(s%2===0) drum('agogo',t,.045,-.32);
        drum('shaker',t,s%2?.06:.095,-.2);
      } else if(r==='tango') {
        if([0,3,6,8,12].indexOf(s)>=0) drum('kick',t,.12);
        if(s===4||s===12) drum('brush',t,.1,.25);
        if(s===7||s===15) drum('rim',t,.055,-.3);
      } else if(r==='waltz') {
        if(s===0) drum('kick',t,.1);
        if(s===4||s===8) drum('brush',t,.1,.3);
        if(s%2===0) drum('shaker',t,.035,-.3);
      } else if(r==='temple'||r==='cinema'||r==='taiko') {
        if(s===0||s===10) drum('tom',t,r==='taiko'?.24:.17,-.2);
        if(s===6||s===14) drum('conga',t,.075,.3);
        if(s%2===0) drum('shaker',t,.05,.2);
        if(bar%8===0&&s===0) drum('gong',t,.07);
      } else if(sparse) {
        if(s===0&&bar%2===0) drum('tom',t,.065,-.4);
        if(s===10) drum('shaker',t,.035,.45);
        if(bonus&&s%4===0) drum('hat',t,.045,.2);
      } else if(latin) {
        if(s===0||s===8) drum('kick',t,.13);
        if(s%2===0) drum('shaker',t,.075,-.3);
        if([3,6,10,14].indexOf(s)>=0) drum('conga',t,.12,.3);
      } else {
        if(s===0||s===8||((r==='disco'||r==='electro')&&s%4===0)) drum('kick',t,.16);
        if(s===4||s===12) {drum(r==='swing'||r==='western'?'brush':'snare',t,.12,.1); if(r==='stadium') drum('clap',t+.025,.1,-.1);}
        if(s%2===0||bonus) drum(r==='swing'?'brush':'hat',t,s%4===2?.08:.045,-.3);
        if(r==='western'&&(s===6||s===14)) drum('wood',t,.09,.35);
      }
      if(bonus&&bar%4===3&&s>=12) drum('tom',t,.075+(s-12)*.015,(s-13)*.2);
    }
    function step(t,tick,bonus,moving) {
      var s=tick%p.meter, bar=Math.floor(tick/p.meter), quarter=60/p.bpm;
      if(p.rhythm==='swing'||p.rhythm==='western') t+=(s%4===2?quarter*.1:0);
      var chord=p.chords[bar%p.chords.length], root=p.root+chord;
      var section=Math.floor(bar/4)%4, density=section===2?.8:1;
      percussion(t,s,bar,bonus);
      var sparse=/cave|ocean|snow/.test(p.rhythm);
      var bassSteps=p.rhythm==='cumbia'?[0,6,8,14]:p.rhythm==='tango'?[0,3,6,8,12]:p.meter===12?[0,4,8]:[0,6,8,14];
      if(bassSteps.indexOf(s)>=0&&(!sparse||s===0)) {
        var bassNote=root-24+(s===6||s===14?7:s===8&&p.rhythm==='rock'?12:0);
        sample('bass',t,bassNote,quarter*.72,.19,0);
      }
      if(s===0||(!sparse&&(s===6||s===10||s===14))) {
        var third=p.minor?([0,2,5].indexOf(chord)>=0?3:4):([2,4,9].indexOf(chord)>=0?3:4);
        [0,third,7].forEach(function(n,i){sample(p.backing,t+i*.012,root+n-12,sparse?quarter*3:quarter*.65,.05* density,(i-1)*.32);});
      }
      var melodyIndex=(tick+(section===3?8:0))%p.melody.length, note=p.melody[melodyIndex];
      if(note>=0&&(!moving||s%2===0)&&!(section===2&&s%4===3)) {
        sample(p.lead,t,p.root+note+(bonus?12:0),quarter*(sparse?1.6:.65),sparse?.12:.115,Math.sin(bar*.7)*.17);
        if(bonus&&s%4===0) sample(p.backing,t+.018,p.root+note,quarter*.8,.055,-.2);
      }
      if((section===1||bonus)&&s%4===2) sample(p.backing,t,root+7+(bar%2?12:0),quarter*.5,.045,.35);
    }
    var movingSource=null, movingFilter=null, movingTicks=[], tensionSource=null, lastCue={}, countUntil=0;
    function duckMusic(seconds) { duck.gain.cancelScheduledValues(c.currentTime);duck.gain.setTargetAtTime(.38,c.currentTime,.025);duck.gain.setTargetAtTime(1,c.currentTime+seconds,.2); }
    function stopMotion() {
      if(movingSource) {try{movingSource.stop();}catch(_){} movingSource=null;}
      movingTicks.forEach(function(s){try{s.stop();}catch(_){}}); movingTicks=[];movingFilter=null;
    }
    function motion() {
      stopMotion();
      var src=c.createBufferSource(), filter=c.createBiquadFilter(), g=c.createGain();
      src.buffer=samples.get('roll');src.loop=true;filter.type='bandpass';movingFilter=filter;
      filter.frequency.value=p.id==='bowling'?180:p.id==='roulette'?850:p.id==='crash'?110:420+p.seed%220;
      filter.Q.value=1.2; g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(p.id==='crash'?.26:.15,c.currentTime+.12);
      src.connect(filter).connect(g).connect(fx);sources.add(src);
      src.onended=function(){src.disconnect();filter.disconnect();g.disconnect();sources.delete(src);};
      if(p.id==='bowling') {src.playbackRate.setValueAtTime(.6,c.currentTime);src.playbackRate.linearRampToValueAtTime(1.3,c.currentTime+1.6);}
      if(p.id==='roulette') {
        for(var pos=.02,index=0;pos<5.4;index++) {
          movingTicks.push(sample('wood',c.currentTime+pos,58+(index%3),.035,.08+(pos/5.4)*.04,Math.sin(index*.7)*.45,fx));
          pos+=.035+.0045*index;
        }
      }
      src.start();src.stop(c.currentTime+120);movingSource=src;
    }
    function tensionEnd() {if(tensionSource){try{tensionSource.stop();}catch(_){}tensionSource=null;}}
    function cue(name,value) {
      var t=c.currentTime, root=p.root, melody=p.melody.filter(function(n){return n>=0;});
      if(disposed) return;
      if(name==='motionEnd') {stopMotion();return;}
      if(name==='motionLevel') {if(movingFilter) movingFilter.frequency.setTargetAtTime(110+Math.min(12,value||1)*65,t,.15);return;}
      if(name==='tensionEnd') {tensionEnd();return;}
      if(name==='spin') {motion();drum(p.id==='bowling'?'impact':'wood',t,.16,0,fx);return;}
      if(name==='tension') {
        tensionEnd(); var riser=c.createOscillator(), filter=c.createBiquadFilter(), rg=c.createGain();
        riser.type='sawtooth';riser.frequency.setValueAtTime(55,t);riser.frequency.exponentialRampToValueAtTime(220,t+2);
        filter.type='lowpass';filter.frequency.setValueAtTime(160,t);filter.frequency.exponentialRampToValueAtTime(1600,t+2);
        rg.gain.setValueAtTime(0,t);rg.gain.linearRampToValueAtTime(.045,t+.2);rg.gain.linearRampToValueAtTime(0,t+2.4);
        riser.connect(filter).connect(rg).connect(fx);sources.add(riser);riser.onended=function(){riser.disconnect();filter.disconnect();rg.disconnect();sources.delete(riser);};
        riser.start(t);riser.stop(t+2.5);tensionSource=riser;return;
      }
      if(name==='win'||name==='jackpot'||name==='lose'||name==='blast') {stopMotion();tensionEnd();}
      if((name==='jackpot'||name==='win')&&lastCue[name]!=null&&t-lastCue[name]<(name==='jackpot'?1.4:.4)) return;
      lastCue[name]=t;
      if(name==='click'||name==='chip'||name==='card'||name==='tick'||name==='reelStop') {
        var material=name==='card'?'brush':p.rhythm==='cumbia'?'wood':p.rhythm==='electro'?'rim':p.rhythm==='tango'?'brush':p.rhythm==='temple'?'tom':'wood';
        drum(material,t,name==='reelStop'?.24:name==='click'?.07:.12,p.rhythm==='western'?-.2:.15,fx);
        if(name==='chip'||name==='reelStop') sample(p.id==='feria'?'bell':p.backing,t,root+(name==='chip'?19:0),.1,.075,.2,fx);
        return;
      }
      if(name==='count') {
        if(t<countUntil) return;
        var count=Math.min(16,Math.max(1,Math.floor((value||500)/65)));countUntil=t+count*.065;
        for(var k=0;k<count;k++) sample(p.id==='feria'?'bell':p.backing,t+k*.065,root+12+p.scale[k%7],.075,.055,(k%3-1)*.3,fx);
        return;
      }
      if(name==='impact'||name==='blast'||name==='lose'||name==='drum') {
        drum(name==='blast'?'impact':name==='lose'?'tom':name==='impact'?'wood':'surdo',t,name==='blast'?.5:.3,0,fx);
        if(name==='impact') for(var j=0;j<5;j++) drum('wood',t+.025*j,.24-j*.03,(j%2-.5)*.5,fx);
        if(name==='lose') sample(p.backing,t,root-12,.25,.09,-.2,fx);
        return;
      }
      if(name==='scatter'||name==='gem'||name==='climb') {
        var n=Math.min(12,Math.max(0,Math.floor(value||0))), deg=p.scale[n%7]+12*Math.floor(n/7);
        sample(p.id==='feria'?'bell':p.lead,t,root+deg+12,.45,.19,-.2,fx);
        sample(p.backing,t+.045,root+deg+19,.3,.075,.25,fx);
        if(name==='scatter') drum('agogo',t,.06,0,fx);
        return;
      }
      if(name==='win'||name==='jackpot') {
        var big=name==='jackpot', notes=big?melody.slice(0,10):[0,p.minor?3:4,7,12];
        duckMusic(big?1.8:.7);
        notes.forEach(function(n,i){sample(p.lead,t+i*(big?.115:.085),root+n+(big?12:0),big?.48:.35,big?.21:.18,(i%3-1)*.3,fx);});
        [0,p.minor?3:4,7,12].forEach(function(n,i){sample(big?'brass':p.backing,t+(big?.9:.2)+i*.01,root+n,.7,.1,(i-1.5)*.2,fx);});
        if(big) {drum('gong',t,.17,0,fx);drum('clap',t+.95,.2,0,fx);}
        if(p.id==='feria'||p.id==='slots777') for(var m=0;m<(big?16:7);m++) sample('bell',t+.1+m*.06,root+24+p.scale[m%7],.18,.085*(1-m/(big?22:12)),Math.sin(m)*.5,fx);
      }
    }
    function dispose() {
      if(disposed) return;disposed=true;stopMotion();tensionEnd();
      sources.forEach(function(s){try{s.stop();}catch(_){}});sources.clear();
      nodes.forEach(function(n){n.disconnect();});
    }
    return {profile:p, step:step, cue:cue, musicOn:musicOn, dispose:dispose};
  }
  global.MCSoundtracks={profile:profile, create:create, scores:SCORES};
})(window);
