/**
 * HUD: saldo, apuesta, botón de giro y los carteles del centro.
 *
 * Dos detalles que parecen cosméticos y no lo son:
 *
 *  - El premio se CUENTA hacia arriba, no aparece. El conteo es el momento en
 *    que el jugador siente que ganó; mostrar el número final de una lo mata.
 *  - El botón se bloquea mientras la ronda no terminó. Si se puede volver a
 *    apretar, el jugador se saltea la animación y después no entiende por qué
 *    su saldo cambió.
 */

import { Container, Graphics, Text } from 'pixi.js';
import { TIMING } from './theme.ts';
import { vgrad } from './material.ts';

/* Casino-owned control surfaces. Only rendering changes; the provider keeps
   its input callbacks, prices, accounting and round lifecycle. */
type Shape = 'round' | 'cut' | 'hex' | 'badge' | 'ticket' | 'seal';
interface ControlSkin {
  name: string; detail: string; bg: number; surface: number; edge: number;
  accent: number; ink: number; text: number; muted: number;
  shape: Shape; motif: string; font: string;
}
const serif = 'Georgia, "Times New Roman", serif';
const sans = 'Arial, sans-serif';
const mono = 'Consolas, monospace';
const SKINS: Record<string, ControlSkin> = {
  aconcagua: { name:'EL ACONCAGUA', detail:'CAMINO A LA CUMBRE', bg:0x172835,surface:0x2f4654,edge:0xa69b84,accent:0xf0c49a,ink:0x263b47,text:0xf6ede0,muted:0xc2ced1,shape:'hex',motif:'summit',font:serif },
  classic20: { name:'MAVERICK', detail:'PIEDRA · SOL · ORO', bg:0x102421,surface:0x203c35,edge:0x9b7942,accent:0xe8be69,ink:0x172b25,text:0xfff0ce,muted:0xc1b390,shape:'hex',motif:'temple',font:serif },
  sebusca: { name:'SE BUSCA', detail:'OFICINA DEL SHERIFF', bg:0x281a12,surface:0x563724,edge:0xb17d4a,accent:0xefd4a1,ink:0x422719,text:0xffedcf,muted:0xc8ac85,shape:'badge',motif:'sheriff',font:serif },
  vendimia: { name:'LA VENDIMIA', detail:'RESERVA DE LA CASA', bg:0x251222,surface:0x4d2442,edge:0xa47d58,accent:0xe7bf87,ink:0x391729,text:0xffecdc,muted:0xcab0bf,shape:'seal',motif:'grapes',font:serif },
  kiosco: { name:'EL KIOSCO', detail:'DULCES DE BARRIO', bg:0x112e37,surface:0x174d58,edge:0xe788b1,accent:0x8ce1d4,ink:0x113b43,text:0xfff4e8,muted:0xb6d7d8,shape:'round',motif:'candy',font:sans },
  feria: { name:'LA FERIA', detail:'UNA NOCHE DE LUCES', bg:0x30152a,surface:0x651e42,edge:0xe9aa51,accent:0xffd66f,ink:0x4c1f34,text:0xfff2d4,muted:0xe1bdc4,shape:'ticket',motif:'marquee',font:serif },
  carnaval: { name:'EL CARNAVAL', detail:'RITMO DE COMPARSA', bg:0x211138,surface:0x4d2768,edge:0xbe77d9,accent:0x75edda,ink:0x211c43,text:0xf5e9ff,muted:0xcfb4e3,shape:'badge',motif:'feather',font:sans },
  cataratas: { name:'LAS CATARATAS', detail:'LA FUERZA DEL AGUA', bg:0x0b282b,surface:0x15464a,edge:0x478e87,accent:0x98e4d2,ink:0x103c3a,text:0xe5fff5,muted:0xb0d1c8,shape:'round',motif:'water',font:sans },
  zonamuerta: { name:'ZONA MUERTA', detail:'CONSOLA DE SUPERVIVENCIA', bg:0x141b16,surface:0x27332a,edge:0x61754b,accent:0xc4e36c,ink:0x1e2d18,text:0xeef2d7,muted:0xb4c49b,shape:'cut',motif:'hazard',font:mono },
  lafamilia: { name:'LA FAMILIA', detail:'CIRCOLO PRIVATO', bg:0x17191f,surface:0x2d2932,edge:0xa39170,accent:0xe4d3ac,ink:0x2b2227,text:0xf3ece0,muted:0xbfb2a7,shape:'hex',motif:'deco',font:serif },
  dunas: { name:'LAS DUNAS', detail:'BITÁCORA DEL DESIERTO', bg:0x30241b,surface:0x59422c,edge:0xbf8c55,accent:0xf1ce8c,ink:0x49321d,text:0xffedce,muted:0xd0b997,shape:'hex',motif:'compass',font:serif },
  granpremio: { name:'EL GRAN PREMIO', detail:'RACE CONTROL', bg:0x121c27,surface:0x233341,edge:0x637a89,accent:0xfa6555,ink:0x201b25,text:0xf1f5f6,muted:0xa9c1cc,shape:'cut',motif:'race',font:sans },
  glaciar: { name:'EL GLACIAR', detail:'EXPEDICIÓN PATAGÓNICA', bg:0x10283c,surface:0x234c64,edge:0x7da9c3,accent:0xb9ecff,ink:0x18384d,text:0xedfbff,muted:0xb2d1df,shape:'hex',motif:'ice',font:sans },
  milonga: { name:'LA MILONGA', detail:'SALÓN DE TANGO', bg:0x2a131a,surface:0x54242c,edge:0xad8757,accent:0xe5c08a,ink:0x3c1d24,text:0xffe9cf,muted:0xd5b6a7,shape:'seal',motif:'bandoneon',font:serif },
  asado: { name:'EL ASADO', detail:'FUEGO LENTO · BUENA MESA', bg:0x1e1d1b,surface:0x36332e,edge:0x946445,accent:0xffa15c,ink:0x352116,text:0xffedda,muted:0xc8b6a1,shape:'cut',motif:'grill',font:serif },
  hinchada: { name:'LA HINCHADA', detail:'LA PASIÓN SE JUEGA ACÁ', bg:0x102b25,surface:0x1c4d3b,edge:0x82ab81,accent:0xecedb7,ink:0x1c3e2c,text:0xf1f7df,muted:0xb9d2b5,shape:'badge',motif:'football',font:sans },
};
const skin = SKINS[new URLSearchParams(location.search).get('game') || 'classic20'] || SKINS.classic20!;

function contour(g: Graphics, shape: Shape, x: number, y: number, w: number, h: number): Graphics {
  if (shape === 'round' && w === h) return g.circle(x+w/2,y+h/2,w/2);
  if (shape === 'seal' && w === h) {
    const points: number[] = [];
    for(let i=0;i<40;i++){const a=i*Math.PI/20-Math.PI/2,r=w/2*(i%2? .94:1);points.push(x+w/2+Math.cos(a)*r,y+h/2+Math.sin(a)*r);}
    return g.poly(points);
  }
  if (shape === 'badge' && w === h) {
    const points: number[]=[];
    for(let i=0;i<12;i++){const a=i*Math.PI/6-Math.PI/2,r=w/2*(i%2?.79:1);points.push(x+w/2+Math.cos(a)*r,y+h/2+Math.sin(a)*r);}
    return g.poly(points);
  }
  const cut=shape==='hex'?Math.min(w,h)*.25:Math.min(w,h)*.14;
  if (shape==='cut'||shape==='hex') return g.poly([x+cut,y,x+w-cut,y,x+w,y+cut,x+w,y+h-cut,x+w-cut,y+h,x+cut,y+h,x,y+h-cut,x,y+cut]);
  return g.roundRect(x,y,w,h,shape==='ticket'?3:Math.min(14,h*.3));
}

/** Small vector signatures remain crisp at every canvas resolution. */
function emblem(g: Graphics, x: number, y: number, size: number, color: number): void {
  const s=size/24;
  const line=(points:number[],width=1.5)=>g.poly(points.map((v,i)=>i%2?y+v*s:x+v*s),false).stroke({color,width:width*s});
  switch(skin.motif){
    case 'summit': line([-12,10,0,-11,12,10,-12,10]);line([-4,-4,0,0,4,-4]);line([0,-11,0,-17,7,-14,0,-11]);break;
    case 'temple': for(let i=0;i<3;i++)line([-10+i*3,8-i*5,10-i*3,8-i*5]);line([-10,8,-10,3,-6,3,-6,-2,-2,-2,-2,-7,2,-7,2,-2,6,-2,6,3,10,3,10,8]);break;
    case 'sheriff': {const p:number[]=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?5:11;p.push(Math.cos(a)*r,Math.sin(a)*r);}line([...p,p[0]!,p[1]!]);break;}
    case 'grapes': [[-5,-3],[4,-3],[-1,4],[0,10]].forEach(([a,b])=>g.circle(x+a!*s,y+b!*s,3.4*s).fill(color));line([0,-7,5,-12,10,-10]);break;
    case 'candy': g.circle(x,y,7*s).stroke({color,width:1.6*s});line([-7,-3,-12,-7,-12,7,-7,3]);line([7,-3,12,-7,12,7,7,3]);line([-4,4,4,-4]);break;
    case 'marquee': line([-10,8,0,-10,10,8,-10,8]);g.circle(x,y+3*s,2*s).fill(color);break;
    case 'feather': line([-8,10,7,-10,11,-8,10,-1,5,5,-8,10]);line([-8,10,5,-5]);line([-1,1,7,1]);break;
    case 'water': for(let i=0;i<3;i++)g.arc(x,y+(i-1)*6*s,9*s,.15,Math.PI-.15).stroke({color,width:1.6*s});break;
    case 'hazard': line([-11,9,0,-10,11,9,-11,9],2);line([0,-3,0,3],2);g.circle(x,y+6*s,s).fill(color);break;
    case 'deco': line([-11,9,-11,-5,-6,-10,6,-10,11,-5,11,9]);line([-6,9,-6,-5,0,-9,6,-5,6,9]);line([-2,9,-2,0,2,0,2,9]);break;
    case 'compass': line([0,-12,4,-3,11,0,3,4,0,12,-4,3,-11,0,-3,-4,0,-12]);line([0,-12,0,12]);break;
    case 'race': for(let i=0;i<4;i++)for(let j=0;j<3;j++)if((i+j)%2===0)g.rect(x+(i-2)*5*s,y+(j-1.5)*5*s,5*s,5*s).fill(color);line([-11,-9,-11,11]);break;
    case 'ice': for(let i=0;i<6;i++){const a=i*Math.PI/3,c=Math.cos(a),d=Math.sin(a);line([0,0,c*12,d*12]);line([c*7-d*3,d*7+c*3,c*9,d*9,c*7+d*3,d*7-c*3]);}break;
    case 'bandoneon': line([-12,-6,-7,-9,-7,9,-12,6,-12,-6]);line([12,-6,7,-9,7,9,12,6,12,-6]);for(let i=-4;i<=4;i+=2)line([i,-7,i,7],1);break;
    case 'grill': line([-11,3,11,3]);for(let i=-8;i<=8;i+=4)line([i,0,i,6]);line([-7,-2,-9,-6,-6,-11]);line([1,-2,-1,-6,2,-11]);line([8,-2,6,-6,9,-11]);break;
    case 'football': g.circle(x,y,11*s).stroke({color,width:1.3*s});line([0,-5,5,-1,3,5,-3,5,-5,-1,0,-5]);line([0,-5,0,-11]);line([5,-1,10,-4]);line([3,5,6,9]);line([-3,5,-6,9]);line([-5,-1,-10,-4]);break;
  }
}

/** Mezcla dos colores. Para derivar los tonos de un boton de su color base. */
function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function label(text: string, size: number, color: number, weight: '400' | '700' = '400'): Text {
  return new Text({
    text,
    style: {
      fontFamily: skin.font,
      fontSize: size,
      fontWeight: weight,
      fill: color,
      letterSpacing: 0.5,
    },
  });
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR');

export class Hud {
  readonly view = new Container();
  readonly onSpin: (() => void)[] = [];
  readonly onBetChange: ((delta: number) => void)[] = [];
  readonly onTurbo: (() => void)[] = [];
  readonly onMute: (() => void)[] = [];
  readonly onBuy: (() => void)[] = [];
  readonly onAuto: (() => void)[] = [];
  readonly onInfo: (() => void)[] = [];
  readonly onAnte: (() => void)[] = [];
  #chassis = new Graphics();
  #identity = label(skin.name + '  /  ' + skin.detail, 8, skin.muted, '700');

  #balance = label('0', 21, skin.text, '700');
  #balanceCap = label('SALDO', 9, skin.muted);
  #bet = label('0', 21, skin.text, '700');
  #betCap = label('APUESTA', 9, skin.muted);
  #win = label('', 24, skin.accent, '700');
  #winCap = label('', 9, skin.muted);
  #button = new Container();
  #buttonFace = new Graphics();
  #buttonText = label('GIRAR', 13, skin.ink, '700');
  #banner = label('', 30, skin.accent, '700');
  #bannerSub = label('', 15, skin.text);
  #enabled = true;
  #busy = false;
  #minus: Container;
  #plus: Container;
  #betCx = 0;
  #anteBtn: Container | null = null;
  #anteFace = new Graphics();
  #anteText: Text;
  #anteOn = false;
  #turboBtn: Container;
  #turboFace = new Graphics();
  #muteBtn: Container;
  #muteFace = new Graphics();
  #muteText = label('🔊', 15, skin.text);
  #turboText = label('⚡', 15, skin.text);
  #autoBtn: Container;
  #autoFace = new Graphics();
  #autoText = label('AUTO', 10, skin.text, '700');
  #infoBtn: Container;
  #infoFace = new Graphics();
  #infoText = label('ⓘ', 16, skin.text);
  #buyBtn = new Container();
  #buyFace = new Graphics();
  #buyCap = label('COMPRAR BONUS', 9, skin.text, '700');
  #buyPrice = label('', 19, skin.accent, '700');
  #buyEnabled = true;
  #countDur = TIMING.countUp;

  #countFrom = 0;
  #countTo = 0;
  #countT = 0;
  #counting = false;

  private width: number;

  constructor(width: number, anteCostX?: number) {
    this.width = width;
    const v = this.view;
    v.label = 'themed-controls-' + skin.motif;
    this.#chassis.eventMode = 'none';
    this.#identity.eventMode = 'none';
    v.addChild(this.#chassis, this.#identity);
    this.#identity.position.set(8, -4);
    this.#minus = this.#betButton('−', -1);
    this.#plus = this.#betButton('+', 1);

    for (const t of [this.#balanceCap, this.#balance, this.#betCap, this.#bet, this.#winCap, this.#win]) {
      v.addChild(t);
    }

    this.#button.eventMode = 'static';
    this.#button.cursor = 'pointer';
    this.#button.label = 'control-spin';
    this.#button.addChild(this.#buttonFace);
    this.#buttonText.anchor.set(0.5);
    this.#button.addChild(this.#buttonText);
    // El botón de giro NUNCA se bloquea: durante una ronda pasa a "PARAR" y
    // el orquestador decide (girar vs saltar la animación). Un botón muerto
    // durante dos segundos es la principal causa de que un slot se sienta lento.
    this.#button.on('pointertap', () => {
      for (const cb of this.onSpin) cb();
    });
    this.#press(this.#button);
    v.addChild(this.#button);

    v.addChild(this.#minus, this.#plus);

    this.#turboBtn = this.#toggle(this.#turboFace, this.#turboText, () => {
      for (const cb of this.onTurbo) cb();
    });
    this.#muteBtn = this.#toggle(this.#muteFace, this.#muteText, () => {
      for (const cb of this.onMute) cb();
    });
    this.#autoBtn = this.#toggle(this.#autoFace, this.#autoText, () => {
      for (const cb of this.onAuto) cb();
    });
    this.#infoBtn = this.#toggle(this.#infoFace, this.#infoText, () => {
      for (const cb of this.onInfo) cb();
    });
    this.#turboBtn.label='control-turbo';
    this.#muteBtn.label='control-sound';
    this.#autoBtn.label='control-auto';
    this.#infoBtn.label='control-info';
    v.addChild(this.#turboBtn, this.#muteBtn, this.#autoBtn, this.#infoBtn);
    this.#toggleFace(this.#turboFace, false);
    this.#toggleFace(this.#muteFace, true);
    this.#toggleFace(this.#autoFace, false);
    this.#toggleFace(this.#infoFace, false);

    // Compra del bonus: la entrada directa a la Escalinata, con el precio
    // siempre visible — el jugador decide sabiendo cuánto cuesta.
    this.#buyCap.anchor.set(0.5, 0);
    this.#buyPrice.anchor.set(0.5, 0);
    this.#buyBtn.addChild(this.#buyFace, this.#buyCap, this.#buyPrice);
    this.#buyBtn.eventMode = 'static';
    this.#buyBtn.cursor = 'pointer';
    this.#buyBtn.label = 'control-buy';
    this.#press(this.#buyBtn);
    this.#buyBtn.on('pointertap', () => {
      if (this.#buyEnabled) for (const cb of this.onBuy) cb();
    });
    this.#drawBuy();
    v.addChild(this.#buyBtn);

    /* El boton de ante solo existe si el juego tiene tiras de ante. No se
       dibuja gris ni deshabilitado: un control apagado que nunca se prende
       es peor que no tenerlo, porque el jugador lo busca y no entiende. */
    this.#anteText = label('ANTE', 12, skin.text, '700');
    if (anteCostX) {
      this.#anteText.text = `ANTE ×${anteCostX.toString().replace('.', ',')}`;
      this.#anteBtn = new Container();
      this.#anteText.anchor.set(0.5);
      this.#anteBtn.addChild(this.#anteFace, this.#anteText);
      this.#anteBtn.eventMode = 'static';
      this.#anteBtn.cursor = 'pointer';
      this.#anteBtn.on('pointertap', () => {
        if (!this.#enabled) return;
        for (const cb of this.onAnte) cb();
      });
      this.#drawAnte();
      v.addChild(this.#anteBtn);
    }

    this.#banner.anchor.set(0.5);
    this.#bannerSub.anchor.set(0.5);
    this.#banner.alpha = 0;
    this.#bannerSub.alpha = 0;
    v.addChild(this.#banner, this.#bannerSub);

    this.#drawButton();
    this.layout(width);
  }

  #betButton(glyph: string, delta: number): Container {
    const c = new Container();
    /* Tecla con relieve, no recuadro plano. Un rectangulo del mismo color
       en los cuatro lados no se lee como algo que se hunde al apretarlo. */
    const g = new Graphics()
      .roundRect(0, 1.5, 30, 30, 8)
      .fill({ color: 0x000000, alpha: 0.4 })
      .roundRect(0, 0, 30, 30, 8)
      .fill(vgrad([
        [0, mixHex(skin.surface, skin.edge, 0.45)],
        [0.55, skin.surface],
        [1, mixHex(skin.surface, 0x000000, 0.3)],
      ]))
      .roundRect(0, 0, 30, 30, 8)
      .stroke({ width: 1.2, color: 0x140d06, alpha: 0.7 })
      .moveTo(7, 1.6).lineTo(23, 1.6)
      .stroke({ width: 1.4, color: 0xffffff, alpha: 0.22 });
    const t = label(glyph, 17, skin.text, '700');
    t.anchor.set(0.5);
    t.x = 15;
    t.y = 15;
    c.addChild(g, t);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.label = delta < 0 ? 'control-bet-minus' : 'control-bet-plus';
    this.#press(c);
    c.on('pointertap', () => {
      if (this.#enabled) for (const cb of this.onBetChange) cb(delta);
    });
    return c;
  }

  #toggle(face: Graphics, text: Text, cb: () => void): Container {
    const c = new Container();
    text.anchor.set(0.5);
    text.x = 17;
    text.y = 17;
    c.addChild(face, text);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    text.style.fill = skin.text;
    this.#press(c);
    c.on('pointertap', cb);
    return c;
  }

  /**
   * Un interruptor: apagado se hunde, prendido sobresale y se ilumina.
   *
   * Que el estado se lea por la FORMA y no solo por el color importa: mudo
   * y turbo son decisiones que el jugador toma de reojo, sin frenar la
   * partida, y de reojo un cambio de tono se pierde.
   */
  #toggleFace(g: Graphics, active: boolean): void {
    g.clear();
    contour(g, skin.shape, 0, 0, 34, 34).fill(active ? mixHex(skin.surface, skin.accent, .27) : skin.bg)
      .stroke({width:1,color:active ? skin.accent : skin.edge,alpha:active ? 1 : .6});
    if(active)g.moveTo(10,30).lineTo(24,30).stroke({width:2,color:skin.accent});
  }

  #press(button: Container): void {
    let pressed=false;
    const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    button.on('pointerover',()=>{if(!pressed&&!reduced())button.scale.set(1.025);});
    button.on('pointerout',()=>{pressed=false;button.scale.set(1);});
    button.on('pointerdown',()=>{pressed=true;if(!reduced())button.scale.set(.965);});
    const release=()=>{pressed=false;button.scale.set(1);};
    button.on('pointerup',release);button.on('pointerupoutside',release);
  }

  /**
   * El interruptor de ante.
   *
   * Prendido se ilumina y sobresale, apagado se hunde. Es la misma gramatica
   * que turbo y mudo, y a proposito: el jugador ya aprendio que en esta fila
   * lo que brilla esta activo.
   */
  #drawAnte(): void {
    const on = this.#anteOn;
    const w = this.#anteText.width + 26;
    const h = 30;
    this.#anteFace.clear();
    if (on) {
      this.#anteFace.roundRect(0, 1.5, w, h, 9).fill({ color: 0x000000, alpha: 0.4 });
      this.#anteFace.roundRect(0, 0, w, h, 9).fill(vgrad([
        [0, mixHex(skin.accent, 0xffffff, 0.4)],
        [0.55, skin.accent],
        [1, mixHex(skin.accent, 0x000000, 0.4)],
      ]));
      this.#anteFace.roundRect(0, 0, w, h, 9).stroke({ width: 1.2, color: 0x081412, alpha: 0.8 });
    } else {
      this.#anteFace.roundRect(0, 0, w, h, 9).fill(vgrad([[0, 0x140e07], [1, 0x2a1f12]]));
      this.#anteFace.roundRect(0, 0, w, h, 9)
        .stroke({ width: 1.2, color: skin.accent, alpha: 0.4 });
    }
    this.#anteText.style.fill = on ? 0x06201d : skin.muted;
    this.#anteText.x = w / 2;
    this.#anteText.y = h / 2;
  }

  setAnte(on: boolean): void {
    this.#anteOn = on;
    if (this.#anteBtn) this.#drawAnte();
  }

  #drawBuy(): void {
    const w = 150;
    const h = 48;
    const on = this.#buyEnabled;
    this.#buyFace.clear();
    contour(this.#buyFace, skin.shape, 0, 2, w, h).fill({color:0x000000,alpha:.35});
    contour(this.#buyFace, skin.shape, 0, 0, w, h)
      .fill(vgrad([[0,mixHex(skin.surface,skin.edge,.18)],[1,skin.bg]]))
      .stroke({width:1.3,color:skin.edge});
    this.#buyFace.moveTo(24,2).lineTo(w-24,2).stroke({width:1.5,color:skin.accent,alpha:.7});
    if(skin.motif==='marquee')for(let x=8;x<w;x+=13)this.#buyFace.circle(x,44,1.3).fill(skin.accent);
    if(skin.motif==='grill')for(let x=8;x<w;x+=9)this.#buyFace.moveTo(x,44).lineTo(x+3,40).stroke({width:1,color:skin.edge,alpha:.6});
    this.#buyCap.position.set(w / 2, 7);
    this.#buyPrice.position.set(w / 2, 21);
    this.#buyBtn.alpha = on ? 1 : 0.55;
    this.#buyBtn.cursor = on ? 'pointer' : 'default';
  }

  /**
   * EL BOTON DE GIRAR — la pieza mas mirada del juego.
   *
   * Eran dos circulos de color plano, uno adentro del otro. Un disco plano
   * no invita a apretarse: para que un boton pida el dedo tiene que
   * SOBRESALIR, y eso son cuatro cosas en orden — sombra abajo, aro de
   * metal, cara con degradado que va de claro arriba a oscuro abajo, y un
   * reflejo en el tercio superior.
   *
   * Ese degradado es el que hace todo el trabajo: claro arriba es como se
   * ve una superficie convexa iluminada desde arriba, que es de donde viene
   * la luz en el resto del juego. Al reves se veria hundido.
   */
  #drawButton(): void {
    const g=this.#buttonFace, s=skin, busy=this.#busy;
    g.clear();
    contour(g,s.shape,0,4,84,84).fill({color:0x000000,alpha:.5});
    contour(g,s.shape,0,0,84,84).fill(vgrad([[0,mixHex(s.edge,0xffffff,.3)],[.5,s.edge],[1,s.bg]]));
    contour(g,s.shape,4,4,76,76).fill(vgrad([[0,mixHex(s.accent,0xffffff,.22)],[.5,s.accent],[1,mixHex(s.accent,s.ink,.28)]]))
      .stroke({color:s.text,width:1,alpha:.5});
    contour(g,s.shape,9,9,66,66).stroke({color:s.ink,width:1,alpha:.25});
    if(s.motif==='marquee')for(let i=0;i<16;i++){const a=i*Math.PI/8;g.circle(42+Math.cos(a)*39,42+Math.sin(a)*39,1.4).fill(s.text);}
    if(s.motif==='ice')g.poly([10,22,42,5,72,22,42,16]).fill({color:0xffffff,alpha:.35});
    if(s.motif==='grill')for(let i=0;i<4;i++)g.moveTo(18+i*12,70).lineTo(26+i*12,62).stroke({color:s.ink,width:2,alpha:.25});
    if(s.motif==='race')g.moveTo(13,63).lineTo(29,63).stroke({color:s.ink,width:2,alpha:.5});
    if(busy){g.roundRect(35,22,14,14,2).fill(s.ink);}
    else emblem(g,42,28,23,s.ink);
    this.#buttonText.position.set(42,52);
    this.#button.alpha=busy?.88:1;
  }

  layout(width: number): void {
    this.width = width;
    this.#drawChassis(width);
    const r = 42;

    // El botón manda: se ubica primero y todo lo demás se acomoda alrededor,
    // con separación garantizada. Antes se posicionaba cada cosa por su cuenta
    // y en pantallas angostas el botón se comía los controles de apuesta.
    const buttonCx = width - r - 10;
    this.#button.x = buttonCx - r;
    this.#button.y = 4;

    this.#balanceCap.x = 4;
    this.#balanceCap.y = 20;
    this.#balance.x = 4;
    this.#balance.y = 36;

    // Bloque de apuesta centrado entre el saldo y el botón.
    const betCx = Math.min(width * 0.46, buttonCx - r - 110);
    this.#betCx = betCx;
    this.#betCap.x = betCx - this.#betCap.width / 2;
    this.#betCap.y = 20;
    this.#bet.y = 36;
    this.#centerBet();

    this.#minus.x = betCx - 62;
    this.#minus.y = 32;
    this.#plus.x = betCx + 32;
    this.#plus.y = 32;

    this.#winCap.anchor.set(0.5, 0);
    this.#win.anchor.set(0.5, 0);
    const winCx = (betCx + buttonCx - r) / 2 + 30;
    this.#winCap.x = winCx;
    this.#winCap.y = 20;
    this.#win.x = winCx;
    this.#win.y = 34;

    // Toggles chicos bajo el botón de giro: [⚡][🔊][AUTO][ⓘ]
    const toggleY = 96;
    this.#turboBtn.position.set(buttonCx - 118, toggleY);
    this.#muteBtn.position.set(buttonCx - 76, toggleY);
    this.#autoBtn.position.set(buttonCx - 34, toggleY);
    this.#infoBtn.position.set(buttonCx + 8, toggleY);

    // Compra del bonus, bajo el saldo.
    this.#buyBtn.position.set(4, 72);
    // El ante va pegado a la compra: las dos son decisiones de plata, y
    // conviene que se lean juntas y lejos del boton de girar.
    if (this.#anteBtn) this.#anteBtn.position.set(174, 89);

    this.#banner.x = width / 2;
    this.#banner.y = -180;
    this.#bannerSub.x = width / 2;
    this.#bannerSub.y = -144;
  }

  #drawChassis(width: number): void {
    const g=this.#chassis, s=skin;
    g.clear();
    contour(g,s.shape,-12,-12,width+24,154).fill(vgrad([[0,mixHex(s.surface,s.bg,.55)],[1,s.bg]]))
      .stroke({color:s.edge,width:1.2,alpha:.8});
    g.moveTo(7,12).lineTo(width-105,12).stroke({color:s.accent,width:.7,alpha:.35});
    g.moveTo(168,78).lineTo(width-212,78).stroke({color:s.edge,width:1,alpha:.4});
    // Material and construction belong to each game's world.
    switch(s.motif){
      case 'summit':
        for(let i=0;i<3;i++)g.moveTo(175+i*40,129).lineTo(200+i*40,98-i*5).lineTo(225+i*40,129).stroke({color:s.text,width:1,alpha:.2});break;
      case 'grill':
        for(let x=174;x<width-205;x+=9)g.moveTo(x,91).lineTo(x,127).stroke({color:s.edge,width:2,alpha:.22});
        for(let x=14;x<width;x+=width-28)g.circle(x,133,2).fill(s.edge);
        break;
      case 'race':
        for(let x=175;x<width-205;x+=14)for(let j=0;j<2;j++)if((Math.floor(x/14)+j)%2)g.rect(x,119+j*7,7,7).fill({color:s.text,alpha:.15});
        g.moveTo(8,136).lineTo(width-8,136).stroke({color:s.accent,width:3});break;
      case 'hazard':
        for(let x=0;x<width;x+=18)g.poly([x,136,x+7,136,x+12,141,x+5,141]).fill({color:s.accent,alpha:.55});break;
      case 'ice':
        g.poly([-10,-10,140,-10,90,8]).fill({color:s.accent,alpha:.1});
        for(let x=175;x<width-205;x+=34){g.moveTo(x,130).lineTo(x+17,101).lineTo(x+34,130).stroke({color:s.accent,width:.8,alpha:.2});}break;
      case 'marquee':
        for(let x=5;x<width;x+=17)g.circle(x,136,1.7).fill({color:s.accent,alpha:.85});break;
      case 'water':
        for(let j=0;j<3;j++)for(let x=170;x<width-205;x+=28)g.arc(x,110+j*7,14,0,Math.PI).stroke({color:s.accent,width:1,alpha:.14});break;
      case 'bandoneon':
        for(let x=175;x<width-205;x+=8)g.moveTo(x,93).lineTo(x+3,126).stroke({color:s.edge,width:1,alpha:.25});break;
      case 'football':
        g.roundRect(175,96,Math.max(20,width-390),32,2).stroke({color:s.text,width:1,alpha:.14});
        g.circle(width/2-20,112,13).stroke({color:s.text,width:1,alpha:.14});break;
      case 'deco':
        for(let i=0;i<3;i++){g.moveTo(174+i*8,129).lineTo(174+i*8,98+i*5).lineTo(width-215-i*8,98+i*5).lineTo(width-215-i*8,129).stroke({color:s.edge,width:1,alpha:.3});}break;
      case 'sheriff':
        for(let j=0;j<4;j++)g.moveTo(-8,89+j*14).lineTo(width+8,89+j*14).stroke({color:s.edge,width:.7,alpha:.13});break;
      case 'temple':
        for(let i=0;i<3;i++)g.moveTo(177+i*8,128-i*7).lineTo(width-213-i*8,128-i*7).stroke({color:s.edge,width:2,alpha:.25});break;
      case 'compass':
        for(let x=176;x<width-210;x+=8)g.moveTo(x,136).lineTo(x,Math.floor(x/8)%5===0?126:132).stroke({color:s.accent,width:1,alpha:.35});break;
      case 'candy':
        for(let x=175;x<width-205;x+=22)g.circle(x,120,6).stroke({color:s.edge,width:2,alpha:.23});break;
      case 'grapes':
        g.moveTo(174,126).bezierCurveTo(205,84,width-240,146,width-210,98).stroke({color:s.edge,width:1.2,alpha:.35});break;
      case 'feather':
        for(let i=0;i<7;i++)g.moveTo(width/2-10,132).lineTo(175+i*18,93).stroke({color:i%2?s.accent:s.edge,width:1,alpha:.2});break;
    }
    this.#identity.style.fontSize=width<500?7:8;
  }

  setBalance(v: number): void {
    this.#balance.text = fmt(v);
  }

  setBet(v: number): void {
    this.#bet.text = fmt(v);
    // El ancho del texto cambia con la cifra, así que hay que recentrar cada
    // vez; si no, la apuesta "camina" al pasar de 20 a 2.000.
    this.#centerBet();
  }

  #centerBet(): void {
    this.#bet.x = this.#betCx - this.#bet.width / 2;
  }

  /** Habilita/deshabilita SOLO los controles de apuesta (el giro no se bloquea). */
  setEnabled(v: boolean): void {
    this.#enabled = v;
    this.#minus.alpha = v ? 1 : 0.4;
    this.#plus.alpha = v ? 1 : 0.4;
  }

  /** Durante una ronda el botón pasa a "PARAR" (salta la animación). */
  setBusy(v: boolean): void {
    this.#busy = v;
    this.#buttonText.text = v ? 'PARAR' : 'GIRAR';
    this.#drawButton();
  }

  setTurbo(on: boolean): void {
    this.#toggleFace(this.#turboFace, on);
    this.#turboText.alpha = on ? 1 : 0.55;
  }

  setMuted(muted: boolean): void {
    this.#muteText.text = muted ? '🔇' : '🔊';
    this.#toggleFace(this.#muteFace, !muted);
  }

  /** 0 = auto apagado; >0 = giros automáticos restantes. */
  setAuto(remaining: number): void {
    this.#autoText.text = remaining > 0 ? String(remaining) : 'AUTO';
    this.#autoText.style.fontSize = remaining > 0 ? 14 : 10;
    this.#toggleFace(this.#autoFace, remaining > 0);
  }

  setBuyPrice(credits: number): void {
    this.#buyPrice.text = fmt(credits);
  }

  setBuyEnabled(v: boolean): void {
    this.#buyEnabled = v;
    this.#drawBuy();
  }

  /** Arranca el conteo del premio. Es el momento emocional del giro. */
  countTo(amount: number, durationMs = TIMING.countUp): void {
    this.#countFrom = this.#countTo;
    this.#countTo = amount;
    this.#countT = 0;
    this.#countDur = durationMs;
    this.#counting = amount > 0;
    this.#winCap.text = amount > 0 ? 'GANANCIA' : '';
    if (amount <= 0) this.#win.text = '';
  }

  resetWin(): void {
    this.#countFrom = 0;
    this.#countTo = 0;
    this.#counting = false;
    this.#win.text = '';
    this.#winCap.text = '';
  }

  showBanner(main: string, sub = ''): void {
    this.#banner.text = main;
    this.#bannerSub.text = sub;
    this.#banner.alpha = 1;
    this.#bannerSub.alpha = sub ? 1 : 0;
    this.#banner.scale.set(0.7);
  }

  hideBanner(): void {
    this.#banner.alpha = 0;
    this.#bannerSub.alpha = 0;
  }

  update(dtMs: number): void {
    if (this.#counting) {
      this.#countT += dtMs;
      const k = Math.min(1, this.#countT / this.#countDur);
      const eased = 1 - Math.pow(1 - k, 3);
      this.#win.text = fmt(this.#countFrom + (this.#countTo - this.#countFrom) * eased);
      if (k >= 1) this.#counting = false;
    }
    if (this.#banner.alpha > 0 && this.#banner.scale.x < 1) {
      this.#banner.scale.set(Math.min(1, this.#banner.scale.x + dtMs / 220));
    }
  }
}
