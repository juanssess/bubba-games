/** Rebuild the sibling provider with a presentation overlay. Original source and math are unchanged.
 * Run: node tools/build-illustrated-provider.mjs [path-to-Juegos-Casinos]
 */
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, copyFileSync, existsSync, cpSync } from 'node:fs';

const casino = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const provider = resolve(process.argv[2] || resolve(casino, '../Juegos Casinos'));
const { build } = await import(pathToFileURL(resolve(provider, 'node_modules/vite/dist/node/index.js')).href);
const target = resolve(casino, 'games/slots');
const output = resolve(casino, 'tmp/illustrated-provider');
if (!output.startsWith(casino + '/') && !output.startsWith(casino + '\\')) throw new Error('Build output must stay in the workspace.');
const replacements = new Set();
const maps = {
  'symbols.ts': { fn:'createSymbolTextures', indices:[0,1,2,3,4,5,6,7,8,9,10] },
  'symbols-sebusca.ts': { fn:'createSebuscaTextures', indices:[11,12,13,14,15,16,17,18,19,20,21] },
  'symbols-vendimia.ts': { fn:'createVendimiaTextures', indices:[22,23,24,25,26,29,27,28,29,29,29] },
  // El Kiosco tiene su propio atlas: grilla regular de 6x2, en el orden de los simbolos.
  'symbols-kiosco.ts': { fn:'createKioscoTextures', atlas:'kiosco-atlas.png', cols:6, rows:2, indices:[0,1,2,3,4,5,6,7,8,9,10] }
};
function replaceOnce(source, before, after) {
  if (!source.includes(before)) throw new Error('Provider source changed; missing presentation anchor: ' + before);
  return source.replace(before,after);
}
await build({
  configFile:false,
  root:resolve(provider,'apps/client'),
  base:'./',
  cacheDir:resolve(casino,'tmp/illustrated-cache'),
  build:{outDir:output,emptyOutDir:true},
  plugins:[{
    name:'bubba-illustrated-presentation', enforce:'pre',
    transformIndexHtml(html) {
      return {html,tags:[
        {tag:'link',attrs:{rel:'stylesheet',href:'../../src/styles/games/cinema.css?v=4'},injectTo:'head'},
        {tag:'script',attrs:{src:'../../src/ui/cinema.js?v=4'},injectTo:'head-prepend'}
      ]};
    },
    transform(source,id) {
      const normalized = id.replaceAll('\\','/');
      if (normalized.endsWith('/apps/client/src/render/reels.ts')) {
        return replaceOnce(source,
          'const stretch = spinning ? 1 + Math.min(0.32, reel.speed / 13000) : 1;',
          `const braking = reel.phase === 'stopping' ? Math.max(0,1-reel.t/reel.duration) : 0;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stretch = quiet ? 1 : spinning ? 1 + Math.min(0.22, reel.speed / 15000) : 1 + .14 * braking * braking;`);
      }
      if (normalized.endsWith('/apps/client/src/render/cluster-board.ts')) {
        return replaceOnce(source, 'if (k >= 1) a.s.y = a.toY;',
          `if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && k > .8) {
          const landing = Math.sin((k-.8)/.2*Math.PI)*.055;
          a.s.width = cellSize*(1+landing);
          a.s.height = cellSize*(1-landing);
        }
        if (k >= 1) a.s.y = a.toY;`);
      }
      if (normalized.endsWith('/apps/client/src/render/fx.ts')) {
        let code = replaceOnce(source,'#plaque: Text;',`#halo = new Graphics();
  #plaque: Text;`);
        code = replaceOnce(code,'this.view.addChild(this.#g);',`this.view.addChild(this.#g);
    this.#halo.roundRect(12,h/2-90,w-24,150,16).fill({color:0x080a10,alpha:.94})
      .stroke({color:PALETTE.win,alpha:.85,width:2});
    this.#halo.roundRect(19,h/2-83,w-38,136,12).stroke({color:PALETTE.win,alpha:.22,width:1});
    this.#halo.alpha=0;
    this.view.addChild(this.#halo);`);
        code = replaceOnce(code,'this.#plaque.alpha = alpha;',`this.#halo.alpha = alpha;
      this.#plaque.alpha = alpha;`);
        code = replaceOnce(code,'this.#plaque.text = main;',`this.#plaque.style.fontSize = Math.min(54,(this.#w-46)/(main.length*.68));
    this.#plaque.text = main;`);
        code = replaceOnce(code,'burst(n: number): void {',`burst(n: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;`);
        code = replaceOnce(code,'shake(amp: number): void {',`shake(amp: number): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;`);
        return code;
      }
      if (normalized.includes('/apps/client/src/render/') && maps[basename(id)]) {
        const skin = maps[basename(id)];
        replacements.add(basename(id));
        // provider-atlas.png tiene filas de alto desparejo; un atlas propio es una grilla regular.
        const cols = skin.cols || 6;
        const bands = skin.rows ? Array.from({length:skin.rows+1},(_,i)=>i) : [0,253,455,690,897,1145];
        return `import { Texture } from 'pixi.js';
          export function ${skin.fn}(app) {
            const atlas = Texture.from('../../assets/illustrated/${skin.atlas || 'provider-atlas.png'}');
            const sheet=document.createElement('canvas');sheet.width=atlas.width;sheet.height=atlas.height;
            const ctx=sheet.getContext('2d');ctx.drawImage(atlas.source.resource,0,0);
            const bands=${JSON.stringify(bands)}, span=bands[bands.length-1], cols=${cols};
            return new Map(${JSON.stringify(skin.indices)}.map((cell,id) => {
              const row=Math.floor(cell/cols), x=Math.round(cell%cols*atlas.width/cols),y=Math.round(bands[row]*atlas.height/span);
              const w=Math.round(atlas.width/cols),h=Math.round((bands[row+1]-bands[row])*atlas.height/span);
              const pixels=ctx.getImageData(x,y,w,h).data;
              let l=w,t=h,r=0,b=0;
              for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) if(pixels[(yy*w+xx)*4+3]>80){l=Math.min(l,xx);r=Math.max(r,xx);t=Math.min(t,yy);b=Math.max(b,yy);}
              const sprite=document.createElement('canvas');sprite.width=256;sprite.height=256;
              if(r>=l){const sw=r-l+1,sh=b-t+1,s=224/Math.max(sw,sh);
                sprite.getContext('2d').drawImage(sheet,x+l,y+t,sw,sh,(256-sw*s)/2,(256-sh*s)/2,sw*s,sh*s);}
              return [id,Texture.from(sprite)];
            }));
          }`;
      }
      if (normalized.endsWith('/apps/client/src/main.ts')) {
        replacements.add('main.ts');
        let code = replaceOnce(source,'import { Application,','import { Assets, Texture, Rectangle, Application,');
        code = 'import { createMaverickAtmosphere } from ' + JSON.stringify(resolve(casino,'src/ui/maverick-atmosphere.js').replaceAll('\\','/')) + ';\n' + code;
        code = replaceOnce(code,'antialias: false','antialias: true');
        code = replaceOnce(code,'freeCounter.anchor.set(0.5, 1);',`freeCounter.style.fill = 0xffedc4;
  freeCounter.style.stroke = {color:0x100a08,width:4};
  freeCounter.anchor.set(0.5, 1);`);
        code = replaceOnce(code,'cascadaBadge.anchor.set(1, 1);',`cascadaBadge.style.stroke = {color:0x100a08,width:4};
  cascadaBadge.anchor.set(1, 1);`);
        code = replaceOnce(code,'const textures = profile.textures(app);',`await Assets.load([
          '../../assets/illustrated/provider-atlas.png', '../../assets/illustrated/environments.png',
          '../../assets/illustrated/kiosco-atlas.png', '../../assets/illustrated/kiosco-environment.jpg'
        ]);
        const textures = profile.textures(app);`);
        code = replaceOnce(code,'const bg = new Graphics();',`const environment = Texture.from('../../assets/illustrated/environments.png');
        const panel = profile.id === 'sebusca' ? 1 : profile.id === 'vendimia' ? 2 : 0;
        // El Kiosco tiene su escena en un archivo propio; los otros comparten environments.png.
        const scenery = profile.id === 'kiosco'
          ? new Sprite(Texture.from('../../assets/illustrated/kiosco-environment.jpg'))
          : new Sprite(new Texture({source:environment.source,
              frame:new Rectangle(panel*environment.width/3,0,environment.width/3,environment.height)}));
        scenery.alpha = .83;
        app.stage.addChild(scenery);
        if (profile.id === 'classic20') createMaverickAtmosphere(app,{Container,Sprite,Texture},scenery);
        const bg = new Graphics();`);
        code = replaceOnce(code,"window.addEventListener('resize', layout);", "window.addEventListener('resize', layout); app.renderer.on('resize',layout);");
        code = replaceOnce(code,'bg.clear().rect(0, 0, w, h).fill(PALETTE.bgBottom);',`const scenicScale = Math.max(w/scenery.texture.width,h/scenery.texture.height);
        scenery.scale.set(scenicScale);
        scenery.position.set((w-scenery.width)/2,(h-scenery.height)/2);
        bg.clear();`);
        code = replaceOnce(code,'profile.backdrop(bg, w, h);','// Illustrated environment replaces the procedural backdrop.');
        code = replaceOnce(code,'await playStep(step, roundBet);',`if (step.kind === 'free' && (i === 0 || steps[i-1].kind !== 'free' || i === from+1)) {
          await window.MCCinema.show({theme:profile.id,spins:step.freeTotal || 1,
            detail:profile.id === 'sebusca' ? 'Los wilds pegajosos acompañan la función.' :
              profile.id === 'vendimia' ? 'Cada cascada continúa la cosecha.' :
              profile.id === 'kiosco' ? 'Las bombas multiplican cada caída que paga.' : 'La Escalinata decidió tu bonus.'});
          skipRequested = false;
          window.MCCinema.featureStart({theme:profile.id});
        }
        await playStep(step, roundBet);`);
        code = replaceOnce(code,'hud.hideBanner();\n    setFreeMode(false);',`hud.hideBanner();
    const freeSteps = steps.filter(s => s.kind === 'free');
    if (freeSteps.length && from < steps.length-1) {
      await window.MCCinema.show({theme:profile.id,kind:'summary',spins:freeSteps.length,
        total:freeSteps.reduce((sum,s) => sum+s.win,0)});
    }
    window.MCCinema.featureEnd();
    setFreeMode(false);
    layout();`);
        // The background brightens during the feature; the board retains its contrast.
        code = replaceOnce(code,'freeMode = free;',`freeMode = free;
    scenery.alpha = free ? 1 : .83;`);
        code = replaceOnce(code,'scenery.alpha = free ? 1 : .83;',`scenery.alpha = free ? 1 : .83;
    scenery.tint = free ? (profile.id === 'sebusca' ? 0xffbdaa : profile.id === 'vendimia' ? 0xd9c0ff : profile.id === 'kiosco' ? 0xffc8e6 : 0xa9ffe0) : 0xffffff;`);
        if (!code.includes('busyState.value = false;')) throw new Error('Missing provider cleanup anchor');
        code = code.replaceAll('busyState.value = false;', 'window.MCCinema.featureEnd(); setFreeMode(false); layout(); busyState.value = false;');
        return code;
      }
    }
  }]
});
if (replacements.size !== 5) throw new Error('The five presentation modules were not all replaced. Nothing published.');
const backup = resolve(casino,'backups/provider-before-illustrated.html');
mkdirSync(dirname(backup),{recursive:true});
if (!existsSync(backup)) copyFileSync(resolve(target,'index.html'),backup);
// Keep older hashed assets so the previous index remains restorable.
cpSync(output,target,{recursive:true});
console.log('Illustrated provider ready in games/slots. Original provider source was not modified.');
