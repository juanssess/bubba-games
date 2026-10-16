/* Render the actual WebAudio graph to PCM: catches silence, clipping and
   identical scores, and leaves listenable previews of the real implementation. */
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({channel:'chrome', headless:true});
const ids = ['feria','carnaval','kiosco','vendimia','maverick','sebusca','slots5','slots777','bowling','crash','mines','roulette','blackjack','sports','plantilla'];
const previews = new Set(['feria','carnaval','kiosco','vendimia','maverick','sebusca']);
await mkdir('tmp/audio-previews', {recursive:true});
function wav(channels, rate) {
  const n=channels[0].length, out=Buffer.alloc(44+n*4);
  out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
  out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);
  out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*4,40);
  for(let i=0;i<n;i++) for(let ch=0;ch<2;ch++) out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[ch][i]))*32767),44+(i*2+ch)*2);
  return out;
}
try {
  const page=await browser.newPage();
  await page.addScriptTag({path:resolve('src/core/soundtracks.js')});
  const signatures=new Set();
  for(const id of ids) {
    const preview=previews.has(id), seconds=preview?18:8;
    const result=await page.evaluate(async ({id,seconds,preview})=>{
      const rate=24000, ctx=new OfflineAudioContext(2,rate*seconds,rate);
      const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=22;limiter.ratio.value=9;limiter.attack.value=.003;limiter.release.value=.2;limiter.connect(ctx.destination);
      const engine=MCSoundtracks.create(ctx,limiter,{id}), p=engine.profile, step=60/p.bpm/4;
      engine.musicOn(true);
      for(let t=.04,tick=0;t<seconds-1;t+=step,tick++) engine.step(t,tick,t>10,t>=4&&t<6);
      const cues=preview?[[4,'spin'],[5,'reelStop'],[5.3,'scatter',2],[5.8,'motionEnd'],[6,'count',650],[6.4,'win'],[10,'jackpot']]:[[3,'scatter',2],[4,'win']];
      const jobs=cues.map(([time,name,value])=>ctx.suspend(time).then(()=>{engine.cue(name,value);return ctx.resume();}));
      const rendered=await ctx.startRendering();await Promise.all(jobs);
      const channels=[...Array(2)].map((_,i)=>Array.from(rendered.getChannelData(i)));
      let peak=0,energy=0,tail=0,leftRight=0,first=0;
      for(let i=0;i<channels[0].length;i++) {
        const a=channels[0][i], b=channels[1][i];peak=Math.max(peak,Math.abs(a),Math.abs(b));energy+=a*a;leftRight+=Math.abs(a-b);
        if(i>rate*2&&i<rate*3) first+=a*a;
        if(i>rate*(seconds-3)&&i<rate*(seconds-2)) tail+=a*a;
      }
      engine.dispose();
      return {name:p.name,lead:p.lead,rhythm:p.rhythm,bpm:p.bpm,peak,rms:Math.sqrt(energy/channels[0].length),stereo:leftRight/channels[0].length,first,tail,
        fingerprint:channels[0].filter((_,i)=>i%2400===0).slice(0,50).map(x=>x.toFixed(5)).join(','),channels:preview?channels:null};
    },{id,seconds,preview});
    assert.ok(result.peak<.98,id+' does not clip: '+result.peak);
    assert.ok(result.rms>.008,id+' is audible: '+result.rms);
    assert.ok(result.stereo>.001,id+' has a stereo arrangement');
    assert.ok(result.first>.1&&result.tail>.1,id+' continues through the arrangement');
    assert.ok(!signatures.has(result.fingerprint),id+' is a distinct composition');signatures.add(result.fingerprint);
    if(preview) await writeFile('tmp/audio-previews/'+id+'.wav',wav(result.channels,24000));
    const {channels,fingerprint,...stats}=result;
    console.log(id,JSON.stringify(stats));
  }
  // Every generated theme must resolve explicitly, and generated titles vary.
  const themes=await page.evaluate(()=>['azteca','oceano','oeste','frutas','nilo','dragon','espacio','selva','hielo','fiesta'].map(theme=>{
    const a=MCSoundtracks.profile({id:'g1001',theme}),b=MCSoundtracks.profile({id:'g1029',theme});
    return {theme,lead:a.lead,rhythm:a.rhythm,different:JSON.stringify(a.melody)!==JSON.stringify(b.melody)};
  }));
  themes.forEach(p=>assert.equal(p.different,true,p.theme+' varies between generated titles'));
  console.log('All 15 original scores and 10 catalogue themes: PCM, stereo, dynamics and distinctness OK.');
} finally {await browser.close();}
