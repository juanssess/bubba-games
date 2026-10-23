/**
 * Los rodillos.
 *
 * Todo lo de acá es TEATRO. El resultado ya vino resuelto del servidor antes
 * de que el primer rodillo se moviera; esta clase solo elige cómo revelarlo.
 * Vale la pena tenerlo presente porque explica el truco central:
 *
 * ANTICIPACIÓN. Si los rodillos ya frenados traen 2 scatters, el siguiente
 * gira mucho más lento y bastante más tiempo. El jugador siente que el juego
 * duda. No cambia ni una probabilidad — es el mismo resultado revelado con
 * otro ritmo — y es probablemente el detalle que más separa a un slot que
 * engancha de uno que aburre.
 *
 * Modelo de movimiento: cada rodillo tiene una cinta virtual `visual` y una
 * posición fraccional `pos`. Los sprites se reciclan por módulo, así que se
 * dibujan siempre `rows + 2` sprites por rodillo (dos de colchón, arriba y
 * abajo) sin importar cuánto haya girado.
 */

import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { SYM, type SymbolId } from '@casino/math';
import { PALETTE, TIMING } from './theme.ts';
import type { SymbolTextures } from './symbols.ts';
import { reducedMotion } from './motion.ts';

/** Largo de la cinta virtual de cada rodillo. */
const TAPE = 32;

/** Símbolos que se muestran mientras gira (sin scatter: no queremos falsas alarmas). */
const FILLER: SymbolId[] = [SYM.H1, SYM.H2, SYM.H3, SYM.H4, SYM.L1, SYM.L2, SYM.L3, SYM.L4, SYM.L5, SYM.WILD];

type ReelPhase = 'idle' | 'spinning' | 'stopping';

interface Reel {
  index: number;
  container: Container;
  sprites: Sprite[];
  tape: SymbolId[];
  pos: number;
  speed: number;
  phase: ReelPhase;
  /** Momento (ms desde el inicio del giro) en que debe empezar a frenar. */
  stopAt: number;
  /** En expectativa: gira lento y más tiempo. */
  anticipating: boolean;
  /** Ya se avisó al orquestador que este rodillo entró en expectativa. */
  antNotified: boolean;
  glow: Graphics;
  /** Interpolación de la frenada. */
  from: number;
  to: number;
  t: number;
  duration: number;
  slowAt: number;
  brakeMs: number;
  slope: number;
  result: SymbolId[];
}

export interface SpinEvents {
  onReelStop?: (reel: number, anticipated: boolean) => void;
  /** Se dispara UNA vez cuando un rodillo entra en modo expectativa. */
  onAnticipation?: (reel: number) => void;
}

export interface ReelSetOptions {
  reels: number;
  rows: number;
  cellSize: number;
  gap: number;
  textures: SymbolTextures;
  scattersToTrigger: number;
  /**
   * Con cuántos scatters ya a la vista empieza la expectativa. Por defecto,
   * cuando falta uno. En Hold & Win caen de a varios por rodillo, y con
   * "falta una" el juego dudaría casi en cada giro: ahí arranca cuando faltan dos.
   */
  anticipateAt?: number;
}

export class ReelSet {
  readonly view = new Container();
  /**
   * Modo turbo: giros más cortos y rápidos. Es un ajuste de TIEMPOS, no de
   * probabilidades — el resultado ya está decidido igual.
   */
  turbo = false;
  #o: ReelSetOptions;
  #reels: Reel[] = [];
  #elapsed = 0;
  #running = false;
  #resolve: (() => void) | null = null;
  #events: SpinEvents | null = null;
  /** Frenada de emergencia pedida por el jugador (slam stop). */
  #slam = false;
  /** Factor de tiempos del giro actual (turbo = 0.45). */
  #f = 1;
  /** Velocidad crucero del giro actual. */
  #cruise = TIMING.spinSpeed;

  constructor(opts: ReelSetOptions) {
    this.#o = opts;
    const { reels, rows, cellSize, gap } = opts;

    for (let r = 0; r < reels; r++) {
      const container = new Container();
      container.x = r * (cellSize + gap);

      // Máscara: sin esto se ven los símbolos de colchón fuera de la ventana.
      const mask = new Graphics().rect(0, 0, cellSize, rows * cellSize).fill(0xffffff);
      container.addChild(mask);
      container.mask = mask;

      const bg = new Graphics()
        .rect(0, 0, cellSize, rows * cellSize)
        .fill(r % 2 === 0 ? PALETTE.reelBg : PALETTE.reelBgAlt);
      container.addChild(bg);

      const glow = new Graphics()
        .rect(0, 0, cellSize, rows * cellSize)
        .fill({ color: PALETTE.scatter, alpha: 1 });
      glow.alpha = 0;
      container.addChild(glow);

      const tape: SymbolId[] = Array.from(
        { length: TAPE },
        () => FILLER[Math.floor(Math.random() * FILLER.length)]!,
      );

      const sprites: Sprite[] = [];
      for (let j = 0; j < rows + 2; j++) {
        const s = new Sprite(opts.textures.get(SYM.L5)!);
        s.anchor.set(0.5);
        s.width = cellSize;
        s.height = cellSize;
        s.x = cellSize / 2;
        container.addChild(s);
        sprites.push(s);
      }

      this.#reels.push({
        index: r, container, sprites, tape,
        pos: Math.random() * TAPE, speed: 0, phase: 'idle',
        stopAt: 0, anticipating: false, antNotified: false, glow,
        from: 0, to: 0, t: 0, duration: 0,
        slowAt: Infinity, brakeMs: 900, slope: 3, result: [],
      });

      this.view.addChild(container);
      this.#layout(this.#reels[r]!);
    }
  }

  /** Sprite de una celda visible, para poder resaltarla al ganar. */
  cellSprite(reel: number, row: number): Sprite {
    return this.#reels[reel]!.sprites[row + 1]!;
  }

  /** Pinta la ventana sin animación (arranque y recuperación de ronda). */
  setGrid(grid: readonly number[]): void {
    const { rows } = this.#o;
    for (const reel of this.#reels) {
      reel.pos = Math.floor(reel.pos);
      for (let row = 0; row < rows; row++) {
        const idx = (Math.floor(reel.pos) + row + 1) % TAPE;
        reel.tape[idx] = grid[reel.index * rows + row] as SymbolId;
      }
      this.#layout(reel);
    }
  }

  /**
   * Gira y frena mostrando `grid`. Resuelve cuando frenó el último rodillo.
   * Los `events` avisan al orquestador cuándo frena cada rodillo y cuándo
   * arranca la expectativa (sonido, banners).
   */
  spinTo(grid: readonly number[], events?: SpinEvents): Promise<void> {
    const { reels, rows, scattersToTrigger } = this.#o;
    const anticipateAt = this.#o.anticipateAt ?? scattersToTrigger - 1;
    this.#elapsed = 0;
    this.#running = true;
    this.#events = events ?? null;
    this.#slam = false;
    this.#f = reducedMotion() ? 0.12 : this.turbo ? 0.45 : 1;
    this.#cruise = TIMING.spinSpeed * (this.turbo ? 1.3 : 1);

    // Cuántos scatters hay en los rodillos anteriores a cada uno.
    const scattersBefore: number[] = [];
    let acc = 0;
    for (let r = 0; r < reels; r++) {
      scattersBefore.push(acc);
      for (let row = 0; row < rows; row++) {
        if (grid[r * rows + row] === SYM.SCATTER) acc++;
      }
    }

    let previousEnd = 0;
    let previousAnticipated = false;
    let anticipationCount = 0;
    for (let r = 0; r < reels; r++) {
      const reel = this.#reels[r]!;

      // Expectativa: este rodillo puede completar el disparo, y los que faltan
      // después alcanzan para llegar. Ahí es cuando el juego "duda".
      const remaining = reels - r;
      const before = scattersBefore[r]!;
      reel.anticipating = this.#o.anticipateAt === undefined
        // La regla de siempre: falta uno, y este rodillo puede ponerlo.
        ? before === scattersToTrigger - 1 && before + remaining * rows >= scattersToTrigger
        // Varios por rodillo: desde el umbral, mientras todavía no disparó.
        : before >= anticipateAt && before < scattersToTrigger && before + remaining * rows >= scattersToTrigger;
      if (this.turbo || reducedMotion()) reel.anticipating = false;

      reel.phase = 'spinning';
      reel.antNotified = false;
      reel.speed = this.#cruise;
      reel.brakeMs = (reel.anticipating ? anticipationCount === 0 ? 1450 : 980 : 900) * this.#f;
      reel.slowAt = reel.anticipating ? previousEnd : Infinity;
      if (reel.anticipating) {
        reel.stopAt = previousEnd + (anticipationCount === 0 ? 520 : 160) * this.#f;
        anticipationCount++;
      } else {
        reel.stopAt = previousAnticipated ? previousEnd + 80 * this.#f
          : Math.max((TIMING.firstReelStop + r * TIMING.reelStagger) * this.#f,
              previousEnd + TIMING.reelStagger * this.#f - reel.brakeMs);
      }
      previousEnd = reel.stopAt + reel.brakeMs;
      previousAnticipated = reel.anticipating;
      // Results only enter the visual tape for the final approach. A scatter
      // from the previous spin must not circle past again during cruise.
      reel.tape = Array.from({length:TAPE},(_,j)=>FILLER[(j+r*3)%FILLER.length]!);
      reel.result = [];
      for (let row = 0; row < rows; row++) {
        reel.result.push(grid[r * rows + row] as SymbolId);
      }
    }

    return new Promise<void>((resolve) => {
      this.#resolve = resolve;
    });
  }

  /**
   * Slam stop: frena TODO ya mismo.
   *
   * Es la diferencia entre un juego que responde y uno que te tiene de
   * rehén. Apretar el botón mientras gira salta directo al resultado — que,
   * recordemos, ya estaba decidido antes de que se moviera nada. También
   * cancela la expectativa: el jugador que apura no quiere teatro.
   */
  stopNow(): void {
    if (!this.#running || this.#slam) return;
    this.#slam = true;
    for (const reel of this.#reels) {
      if (reel.phase === 'spinning') {
        reel.stopAt = this.#elapsed;
        reel.anticipating = false;
        reel.glow.alpha = 0;
      } else if (reel.phase === 'stopping') {
        reel.from = reel.pos;
        reel.duration = 90;
        reel.t = 0;
        reel.slope = 2;
      }
    }
  }

  get running(): boolean {
    return this.#running;
  }

  update(dtMs: number): void {
    if (!this.#running) return;
    this.#elapsed += dtMs;
    const cell = this.#o.cellSize;
    let allIdle = true;

    for (const reel of this.#reels) {
      if (reel.phase === 'spinning') {
        allIdle = false;
        // Al entrar en expectativa el rodillo frena a un tercio de velocidad.
        const wantSlow =
          reel.anticipating &&
          this.#elapsed >= reel.slowAt &&
          (reel.index === 0 || this.#reels[reel.index - 1]!.phase === 'idle');
        if (wantSlow && !reel.antNotified) {
          reel.antNotified = true;
          this.#events?.onAnticipation?.(reel.index);
        }
        const targetSpeed = wantSlow ? TIMING.anticipationSpeed : this.#cruise;
        reel.speed += (targetSpeed - reel.speed) * (1 - Math.exp(-dtMs / (wantSlow ? 170 : 120)));
        reel.glow.alpha = wantSlow
          ? 0.12 + Math.sin(this.#elapsed / 240) * 0.025
          : Math.max(0, reel.glow.alpha - dtMs / 400);

        reel.pos += (reel.speed * dtMs) / 1000 / cell;

        if (this.#elapsed >= reel.stopAt && (!reel.anticipating || reel.antNotified)) {
          const duration = this.#slam ? 100 : reel.brakeMs;
          // Match the starting velocity of the brake to the moving strip.
          // A distant fixed target previously made a slow reel accelerate again.
          const travel = Math.max(1, reel.speed / cell * duration / 3000);
          const to = Math.ceil(reel.pos + travel);
          reel.from = reel.pos;
          reel.to = to;
          for (let row=0;row<this.#o.rows;row++) reel.tape[(to+row+1)%TAPE]=reel.result[row]!;
          reel.t = 0;
          reel.duration = duration;
          reel.slope = this.#slam ? 2 : Math.min(3, reel.speed / cell * duration / 1000 / (to-reel.pos));
          reel.phase = 'stopping';
        }
      } else if (reel.phase === 'stopping') {
        allIdle = false;
        reel.t += dtMs;
        const k = Math.min(1, reel.t / reel.duration);
        // Monotone Hermite brake: continuous entry speed, zero exit speed.
        const m=reel.slope;
        const eased = (m-2)*k*k*k+(3-2*m)*k*k+m*k;
        reel.pos = reel.from + (reel.to - reel.from) * eased;

        if (k >= 1) {
          reel.pos = reel.to % TAPE;
          reel.phase = 'idle';
          reel.glow.alpha = 0;
          this.#events?.onReelStop?.(reel.index, reel.anticipating);
        }
      }
      this.#layout(reel);
    }

    if (allIdle && this.#running) {
      this.#running = false;
      const done = this.#resolve;
      this.#resolve = null;
      done?.();
    }
  }

  /** Coloca los sprites según `pos` y les asigna el símbolo de la cinta. */
  #layout(reel: Reel): void {
    const { rows, cellSize, textures } = this.#o;
    const base = Math.floor(reel.pos);
    const frac = reel.pos - base;

    // Motion blur fingido: mientras el rodillo va rápido, los símbolos se
    // estiran verticalmente y bajan un poco de opacidad. El ojo lo lee como
    // desenfoque de movimiento; es lo que hace que el giro se vea "de slot"
    // en vez de "de PowerPoint". Solo corre durante el giro, así que no pelea
    // con el resaltado de premios (que dimea y agranda estos mismos sprites).
    const spinning = reel.phase === 'spinning';
    // Al frenar, el estiramiento se recoge de a poco en vez de cortarse de
    // golpe: es lo que hace que el rodillo parezca tener peso.
    const progress = reel.phase === 'stopping' ? Math.min(1,reel.t/reel.duration) : 0;
    const m=reel.slope;
    const speed = reel.phase === 'stopping'
      ? Math.max(0,(3*(m-2)*progress*progress+2*(3-2*m)*progress+m)*(reel.to-reel.from)*cellSize*1000/reel.duration)
      : reel.phase === 'spinning' ? reel.speed : 0;
    const stretch = reducedMotion()
      ? 1
      : 1 + Math.min(0.22, speed / 15000);
    const alpha = spinning ? 0.88 : 1;

    for (let j = 0; j < rows + 2; j++) {
      const s = reel.sprites[j]!;
      const sym = reel.tape[(((base + j) % TAPE) + TAPE) % TAPE]!;
      const tex = textures.get(sym);
      if (tex && s.texture !== tex) s.texture = tex as Texture;
      s.y = (j - 1 - frac) * cellSize + cellSize / 2;
      s.height = cellSize * stretch;
      s.alpha = alpha;
    }
  }
}
