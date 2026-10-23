/**
 * El tablero de racimos.
 *
 * Es el reemplazo de `ReelSet` para La Vendimia, y tiene la MISMA superficie
 * pública (`spinTo`, `stopNow`, `setGrid`, `cellSprite`, `update`, `running`,
 * `turbo`) más un método propio: `tumbleTo`. Esa coincidencia no es
 * casualidad ni comodidad — es lo que permite que `main.ts` arme la escena,
 * conecte el HUD, el sonido, el autoplay y la recuperación de ronda sin
 * saber cuál de los dos tableros le tocó. La rama en el orquestador queda
 * reducida a dos lugares: qué tablero construir y cómo reproducir un paso.
 *
 * ---------------------------------------------------------------------
 * ACÁ NO HAY RODILLOS
 * ---------------------------------------------------------------------
 * En un slot de líneas los símbolos van montados en una cinta que gira y
 * frena; el "resultado" es dónde para la cinta. Acá los símbolos CAEN, uno
 * por celda, y se quedan quietos. No hay cinta, no hay giro, no hay
 * desenfoque de movimiento. Los treinta sprites son fijos y lo único que se
 * anima es su posición vertical.
 *
 * Eso simplifica el modelo y complica otra cosa: hay que saber, celda por
 * celda, DE DÓNDE viene y ADÓNDE va. Una cascada no es un giro nuevo — es
 * una reorganización de lo que ya estaba, con relleno arriba.
 *
 * ---------------------------------------------------------------------
 * LA CAÍDA ES ESCALONADA POR COLUMNA Y POR FILA
 * ---------------------------------------------------------------------
 * Si las treinta celdas caen juntas, la grilla aparece de golpe y se siente
 * un corte de cámara en vez de una caída. Cada columna arranca un poco
 * después que la anterior (eso es lo que hereda del escalonado de rodillos y
 * es lo que hace posible la EXPECTATIVA), y dentro de la columna la fila de
 * abajo llega primero, porque es la que menos tiene que recorrer.
 */

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { SYM, type SymbolId } from '@casino/math';
import { PALETTE, TIMING } from './theme.ts';
import type { SymbolTextures } from './symbols.ts';
import { reducedMotion } from './motion.ts';

/** Los mismos eventos que emite ReelSet, para que el orquestador no cambie. */
export interface SpinEvents {
  onReelStop?: (reel: number, anticipated: boolean) => void;
  onAnticipation?: (reel: number) => void;
}

export interface ClusterBoardOptions {
  reels: number;
  rows: number;
  cellSize: number;
  gap: number;
  textures: SymbolTextures;
  scattersToTrigger: number;
  /**
   * Solo los juegos con BOMBAS (El Kiosco): color de la etiqueta según el
   * valor. Si está, cada celda lleva una etiqueta que viaja con su sprite.
   */
  valueColor?: (v: number) => number;
  /**
   * Juegos de CAMINOS (Las Cataratas): cada columna muestra de 2 a `rows`
   * símbolos según la caída. La grilla llega con `VOID` arriba de lo que la
   * columna muestra, y las celdas se estiran para llenar el alto.
   */
  variableHeight?: boolean;
}

/** Celda vacía de una grilla de caminos (ver `VOID` en el motor). */
const VOID = -1;

/** La etiqueta de valor de una celda: el "×25" encima de la bomba. */
interface ValueBadge {
  view: Container;
  face: Graphics;
  label: Text;
  value: number;
}

type AnimKind = 'fall' | 'pop';

interface Anim {
  s: Sprite;
  fromY: number;
  toY: number;
  t: number;
  delay: number;
  dur: number;
  kind: AnimKind;
  /** Lado del símbolo en su columna (en los juegos de caminos cambia con la altura). */
  size: number;
}

export class ClusterBoard {
  readonly view = new Container();
  turbo = false;

  #o: ClusterBoardOptions;
  /** `#cells[columna][fila]`. Se REORDENA en cada cascada. */
  #cells: Sprite[][] = [];
  /**
   * El JUEGO ANTERIOR de sprites, uno por celda.
   *
   * Existe por un error que se ve enseguida y no se deduce leyendo el
   * codigo: si la caida usa los mismos sprites que ya estaban en pantalla,
   * hay que mandarlos arriba para que caigan, y en ese instante la columna
   * queda VACIA. Con seis columnas escalonadas, la ultima se queda en blanco
   * casi un segundo, y el tablero parece que se rompio.
   *
   * Con dos juegos, lo viejo se cae para abajo y se va mientras lo nuevo
   * entra por arriba. Los dos juegos se intercambian de rol en cada caida,
   * asi que no se crea ni un sprite de mas.
   */
  #ghosts: Sprite[][] = [];
  #cols: Container[] = [];
  #glow: Graphics[] = [];
  #anims: Anim[] = [];
  #running = false;
  #resolve: (() => void) | null = null;
  #slam = false;
  /** Columnas que ya avisaron que frenaron, para no repetir el evento. */
  #stopped: boolean[] = [];
  #events: SpinEvents | null = null;
  #antNotified: boolean[] = [];
  #antStarts: number[] = [];
  #elapsed = 0;
  /** Tiempo en el que cada columna termina de caer, para el aviso de frenada. */
  #colDone: number[] = [];
  #anticipating: boolean[] = [];
  /**
   * LAS ETIQUETAS DE LAS BOMBAS VIAJAN CON EL SPRITE, no con la celda.
   *
   * La bomba no se va con la cascada: baja con su columna. Si la etiqueta
   * fuera de la celda, en cada cascada quedaría un "×25" flotando en el
   * lugar donde ESTABA la bomba mientras la bomba cae sin número. Atada al
   * sprite, cae con él, explota con él y se recicla con él.
   */
  #badges = new Map<Sprite, ValueBadge>();
  /** Capa de etiquetas por columna, siempre encima de los sprites. */
  #badgeLayers: Container[] = [];
  /** Latido de "las bombas están por multiplicar" (ms restantes). */
  #pulse = 0;
  /** Cuántos símbolos muestra cada columna ahora (siempre `rows` salvo en caminos). */
  #heights: number[] = [];
  /** Las baldosas de cada columna de caminos: una por celda, se redibujan al cambiar el alto. */
  #tiles: Graphics[] = [];

  constructor(opts: ClusterBoardOptions) {
    this.#o = opts;
    const { reels, rows, cellSize, gap, textures } = opts;
    this.#heights = new Array<number>(reels).fill(rows);

    for (let r = 0; r < reels; r++) {
      const col = new Container();
      col.x = r * (cellSize + gap);

      // Máscara: durante la caída los símbolos vienen de arriba de la
      // ventana y sin esto se ven flotando sobre el marco.
      const mask = new Graphics().rect(0, 0, cellSize, rows * cellSize).fill(0xffffff);
      col.addChild(mask);
      col.mask = mask;

      col.addChild(
        new Graphics()
          .rect(0, 0, cellSize, rows * cellSize)
          .fill(r % 2 === 0 ? PALETTE.reelBg : PALETTE.reelBgAlt),
      );
      if (opts.variableHeight) {
        const tiles = new Graphics();
        col.addChild(tiles);
        this.#tiles.push(tiles);
      }

      const glow = new Graphics()
        .rect(0, 0, cellSize, rows * cellSize)
        .fill({ color: PALETTE.scatter, alpha: 1 });
      glow.alpha = 0;
      col.addChild(glow);

      const nuevo = (row: number, visible: boolean): Sprite => {
        const s = new Sprite(textures.get(SYM.L3) ?? textures.values().next().value!);
        s.anchor.set(0.5);
        s.width = cellSize;
        s.height = cellSize;
        s.x = cellSize / 2;
        s.y = visible ? row * cellSize + cellSize / 2 : -cellSize * 4;
        col.addChild(s);
        return s;
      };

      const list: Sprite[] = [];
      const fantasmas: Sprite[] = [];
      for (let row = 0; row < rows; row++) fantasmas.push(nuevo(row, false));
      for (let row = 0; row < rows; row++) list.push(nuevo(row, true));

      if (opts.valueColor) {
        const layer = new Container();
        col.addChild(layer);
        this.#badgeLayers.push(layer);
        for (const s of [...fantasmas, ...list]) this.#badges.set(s, this.#newBadge(layer));
      }

      this.#cells.push(list);
      this.#ghosts.push(fantasmas);
      this.#cols.push(col);
      this.#glow.push(glow);
      this.#stopped.push(true);
      this.#colDone.push(0);
      this.#anticipating.push(false);
      this.view.addChild(col);
    }
  }

  #newBadge(layer: Container): ValueBadge {
    const view = new Container();
    const face = new Graphics();
    const label = new Text({
      text: '',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: Math.round(this.#o.cellSize * 0.27),
        fontWeight: '700',
        fill: 0xffffff,
        stroke: { color: 0x1a0606, width: 4 },
      },
    });
    label.anchor.set(0.5);
    view.addChild(face, label);
    view.visible = false;
    layer.addChild(view);
    return { view, face, label, value: 0 };
  }

  /** Pone (o saca, con 0) el valor que lleva un sprite. */
  #setValue(s: Sprite, v: number): void {
    const b = this.#badges.get(s);
    if (!b) return;
    if (b.value === v) return;
    b.value = v;
    b.view.visible = v > 0;
    if (v <= 0) return;
    const color = this.#o.valueColor!(v);
    const cs = this.#o.cellSize;
    b.label.text = `×${v}`;
    b.label.style.fill = color;
    b.label.style.fontSize = Math.round(cs * (v >= 100 ? 0.23 : 0.27));
    const w = b.label.width + cs * 0.14;
    const h = cs * 0.3;
    b.face.clear()
      .roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill({ color: 0x140606, alpha: 0.78 })
      .roundRect(-w / 2, -h / 2, w, h, h / 2)
      .stroke({ width: 2, color, alpha: 0.95 });
  }

  /** Los valores de una grilla, o todo en cero si el paso no trae. */
  #valueAt(values: readonly number[] | undefined, i: number): number {
    return values ? values[i] ?? 0 : 0;
  }

  /** Suma de las bombas que hay en pantalla ahora mismo. */
  get valueSum(): number {
    let sum = 0;
    for (const col of this.#cells) for (const s of col) sum += this.#badges.get(s)?.value ?? 0;
    return sum;
  }

  /**
   * El latido de las bombas antes de multiplicar. Es el momento de la
   * jugada —"¿cuánto suman?"— y merece que todas se muevan juntas.
   */
  pulseValues(ms = 700): void {
    this.#pulse = ms;
  }

  /** Cada etiqueta sigue a su sprite: posición, tamaño y transparencia. */
  #syncBadges(dtMs: number): void {
    if (this.#badges.size === 0) return;
    if (this.#pulse > 0) this.#pulse = Math.max(0, this.#pulse - dtMs);
    const cs = this.#o.cellSize;
    const latido = this.#pulse > 0 ? 1 + 0.28 * Math.sin((this.#pulse / 700) * Math.PI) : 1;
    for (const [s, b] of this.#badges) {
      if (!b.view.visible) continue;
      b.view.x = s.x;
      b.view.y = s.y + cs * 0.06;
      b.view.scale.set((s.width / cs) * latido);
      b.view.alpha = s.alpha;
    }
  }

  /** Las etiquetas arriba de todo, después de reordenar los sprites. */
  #badgesOnTop(r: number): void {
    const layer = this.#badgeLayers[r];
    if (layer) this.#cols[r]!.addChild(layer);
  }

  get running(): boolean {
    return this.#running;
  }

  /** El sprite de una celda visible. Lo usa el presentador de premios. */
  cellSprite(reel: number, row: number): Sprite {
    return this.#cells[reel]![row]!;
  }

  /** Factor de tiempos: turbo acorta todo sin tocar ninguna probabilidad. */
  #f(): number {
    return reducedMotion() ? 0.15 : this.turbo ? 0.45 : 1;
  }

  #tex(sym: number): Texture {
    return this.#o.textures.get(sym as SymbolId) ?? this.#cells[0]![0]!.texture;
  }

  /* ── Geometría de una columna ─────────────────────────────────────────
     En un juego de racimos todas las columnas miden `rows` y esto da lo de
     siempre: celdas de `cellSize`. En uno de caminos la columna muestra
     `h` símbolos y cada celda mide el alto del tablero dividido `h`; el
     símbolo es cuadrado, así que su lado es el menor entre el ancho y ese alto. */

  /** Primera fila que la columna muestra (lo de arriba es VOID). */
  #topOf(r: number): number {
    return this.#o.rows - this.#heights[r]!;
  }

  #cellH(r: number): number {
    return (this.#o.rows * this.#o.cellSize) / this.#heights[r]!;
  }

  #sizeOf(r: number): number {
    return Math.min(this.#o.cellSize, this.#cellH(r));
  }

  #restY(r: number, row: number): number {
    const ch = this.#cellH(r);
    return (row - this.#topOf(r)) * ch + ch / 2;
  }

  /** Cuántos símbolos trae una columna de la grilla. */
  #heightIn(grid: readonly number[], r: number): number {
    const { rows } = this.#o;
    let h = 0;
    for (let row = 0; row < rows; row++) if (grid[r * rows + row] !== VOID) h++;
    return h || rows;
  }

  /** Fija el alto de una columna y redibuja sus baldosas. */
  #setHeight(r: number, h: number): void {
    this.#heights[r] = h;
    const tiles = this.#tiles[r];
    if (!tiles) return;
    const { cellSize } = this.#o;
    const ch = this.#cellH(r);
    tiles.clear();
    for (let k = 0; k < h; k++) {
      tiles.roundRect(3, k * ch + 3, cellSize - 6, ch - 6, 8)
        .fill({ color: PALETTE.frameLight, alpha: k % 2 === 0 ? 0.05 : 0.025 });
    }
  }

  /** Lo que muestra cada columna ahora mismo (caminos = el producto). */
  get heights(): readonly number[] {
    return this.#heights;
  }

  /**
   * Dónde está una celda y cuánto mide, para el presentador de premios: en
   * un juego de caminos no se puede deducir de `cellSize`.
   */
  cellBox(reel: number, row: number): { x: number; y: number; w: number; h: number; size: number } {
    const { cellSize, gap } = this.#o;
    const ch = this.#cellH(reel);
    return { x: reel * (cellSize + gap), y: this.#restY(reel, row) - ch / 2, w: cellSize, h: ch, size: this.#sizeOf(reel) };
  }

  /** Pinta la grilla sin animación (arranque y recuperación de ronda). */
  setGrid(grid: readonly number[], values?: readonly number[]): void {
    const { reels, rows, cellSize } = this.#o;
    this.#anims.length = 0;
    for (let r = 0; r < reels; r++) {
      this.#setHeight(r, this.#heightIn(grid, r));
      const size = this.#sizeOf(r);
      for (let row = 0; row < rows; row++) {
        const s = this.#cells[r]![row]!;
        const sym = grid[r * rows + row]!;
        s.visible = sym !== VOID;
        if (sym !== VOID) s.texture = this.#tex(sym);
        this.#setValue(s, this.#valueAt(values, r * rows + row));
        s.y = this.#restY(r, row);
        s.alpha = 1;
        s.width = size;
        s.height = size;
        // Los del otro juego se estacionan bien arriba, fuera de la mascara.
        this.#ghosts[r]![row]!.y = -cellSize * 4;
        this.#setValue(this.#ghosts[r]![row]!, 0);
      }
    }
    this.#syncBadges(0);
  }

  /**
   * La caída inicial de una jugada.
   *
   * La expectativa se conserva igual que en los rodillos: si las columnas ya
   * caídas traen las barricas justas para que la siguiente pueda completar
   * el disparo, esa columna tarda bastante más. No cambia ninguna
   * probabilidad —el resultado ya vino resuelto del servidor— pero es
   * probablemente el detalle que más separa un juego que engancha de uno que
   * solo funciona.
   */
  spinTo(grid: readonly number[], events?: SpinEvents, values?: readonly number[]): Promise<void> {
    const { reels, rows, cellSize, scattersToTrigger } = this.#o;
    const f = this.#f();
    this.#anims.length = 0;
    this.#running = true;
    this.#slam = false;
    this.#events = events ?? null;
    this.#antNotified = new Array(reels).fill(false);
    this.#elapsed = 0;

    // Barricas en las columnas anteriores a cada una.
    let acc = 0;
    let extra = 0;
    let anticipationCount = 0;

    for (let r = 0; r < reels; r++) {
      const antes = acc;
      for (let row = 0; row < rows; row++) {
        if (grid[r * rows + row] === SYM.SCATTER) acc++;
      }

      const faltan = reels - r;
      const anticipa = !this.turbo && !reducedMotion() &&
        antes === scattersToTrigger - 1 &&
        antes + faltan * rows >= scattersToTrigger;
      this.#anticipating[r] = anticipa;
      this.#stopped[r] = false;

      /* LA DEMORA DE LA EXPECTATIVA SE SUMA ANTES, no despues.
         Puesta despues, la columna que puede completar el disparo caia a su
         hora y las demoradas eran las de atras: el juego dudaba en el lugar
         equivocado. La que tiene que hacerse esperar es JUSTAMENTE esa. */
      this.#antStarts[r] = r > 0 ? this.#colDone[r-1]! : 0;
      if (anticipa) {
        extra = Math.min(3000 * f, extra + (anticipationCount === 0 ? 1700 : 450) * f);
        anticipationCount++;
      }
      const colDelay = r * TIMING.reelStagger * f + extra;

      /* LA COLUMNA BAJA ENTERA, como un bloque.
         La primera version tiraba lo viejo para abajo y traia lo nuevo desde
         arriba con 90 ms de diferencia, y entre una cosa y la otra la columna
         se veia VACIA por un cuarto de segundo. Se nota muchisimo.

         Si los dos bloques se mueven juntos —el viejo sale por abajo mientras
         el nuevo entra por arriba, misma velocidad, pegados— la columna nunca
         tiene un hueco: es una sola cinta de diez celdas que baja cinco. Que
         es, ademas, lo que pasaria de verdad. */
      const dur = (TIMING.firstReelStop + 150) * f;
      const salto = rows * cellSize;
      const viejos = this.#cells[r]!;
      const entran = this.#ghosts[r]!;

      // Lo que sale conserva su tamaño; lo que entra toma el de la altura nueva.
      const sizeOut = this.#sizeOf(r);
      for (let row = 0; row < rows; row++) {
        const sale = viejos[row]!;
        sale.width = sizeOut;
        sale.height = sizeOut;
        sale.alpha = 1;
        const y0 = this.#restY(r, row);
        this.#anims.push({
          s: sale, fromY: y0, toY: y0 + salto,
          t: 0, delay: colDelay, dur, kind: 'fall', size: sizeOut,
        });
      }

      // La columna toma su altura nueva (caminos): cambian las baldosas y el tamaño.
      this.#setHeight(r, this.#heightIn(grid, r));
      const sizeIn = this.#sizeOf(r);
      for (let row = 0; row < rows; row++) {
        const entra = entran[row]!;
        const sym = grid[r * rows + row]!;
        entra.visible = sym !== VOID;
        if (sym !== VOID) entra.texture = this.#tex(sym);
        this.#setValue(entra, this.#valueAt(values, r * rows + row));
        entra.alpha = 1;
        entra.width = sizeIn;
        entra.height = sizeIn;
        const y0 = this.#restY(r, row);
        entra.y = y0 - salto;
        this.#anims.push({
          s: entra, fromY: y0 - salto, toY: y0,
          t: 0, delay: colDelay, dur, kind: 'fall', size: sizeIn,
        });
      }

      for (const sp of entran) this.#cols[r]!.addChild(sp);
      this.#badgesOnTop(r);
      this.#cells[r] = entran;
      this.#ghosts[r] = viejos;

      const last = colDelay + dur;
      this.#colDone[r] = last;
    }

    return new Promise<void>((res) => { this.#resolve = res; });
  }

  /**
   * Una cascada: explota lo premiado, cae lo que queda, entra lo nuevo.
   *
   * `remove` son los índices planos que ganaron; `grid` es cómo queda el
   * tablero después. Los dos vienen del servidor: el cliente no decide nada,
   * solo averigua QUÉ SPRITE va a dónde para poder animar el movimiento en
   * vez de reemplazar la grilla de golpe.
   */
  tumbleTo(remove: readonly number[], grid: readonly number[], values?: readonly number[]): Promise<void> {
    const { reels, rows } = this.#o;
    const f = this.#f();
    this.#anims.length = 0;
    this.#running = true;
    this.#events = null;

    const fuera = new Set(remove);
    const POP = 135 * f;

    for (let r = 0; r < reels; r++) {
      const viejos = this.#cells[r]!;
      const sobreviven: Sprite[] = [];
      const explotan: Sprite[] = [];
      // Las filas vacías de arriba (caminos) no participan: ni explotan ni caen.
      const top = this.#topOf(r);
      const size = this.#sizeOf(r);
      const ch = this.#cellH(r);

      for (let row = top; row < rows; row++) {
        if (fuera.has(r * rows + row)) explotan.push(viejos[row]!);
        else sobreviven.push(viejos[row]!);
      }

      if (explotan.length === 0) continue;

      // Los que explotan se apagan y quedan libres para reusarse arriba.
      for (const s of explotan) {
        this.#anims.push({ s, fromY: s.y, toY: s.y, t: 0, delay: 0, dur: POP, kind: 'pop', size });
      }

      /* Los sprites que explotaron se RECICLAN como los nuevos de arriba.
         Podrían destruirse y crearse otros, pero treinta sprites nuevos por
         cascada, en una jugada que puede tener seis, son doscientos objetos
         por ronda que el recolector después tiene que juntar justo mientras
         corre la animación. */
      const nuevos = explotan;
      const orden: Sprite[] = [...viejos.slice(0, top), ...nuevos, ...sobreviven];

      for (let row = top; row < rows; row++) {
        const s = orden[row]!;
        const esNuevo = row - top < nuevos.length;
        s.texture = this.#tex(grid[r * rows + row]!);
        this.#setValue(s, this.#valueAt(values, r * rows + row));
        const destino = this.#restY(r, row);

        /* Todo lo que se mueve en esta columna recorre EXACTAMENTE lo mismo
           —la cantidad de celdas que explotaron— y tarda lo mismo. Es lo que
           mantiene la columna pegada mientras cae: si los nuevos entraran
           desde mas arriba o mas rapido, se abriria un hueco entre ellos y
           los que sobrevivieron. */
        const caida = (165 + explotan.length * 22) * f;

        if (esNuevo) {
          /* OJO: la posicion NO se escribe ahora.
             Este sprite es uno de los que estan explotando, y la explosion
             pasa DONDE ESTABA. Si le movemos la `y` aca, salta arriba antes
             de reventar y el jugador ve desaparecer un simbolo que nunca
             estuvo ahi. La escribe la animacion de caida cuando le toca. */
          const desde = destino - explotan.length * ch;
          this.#anims.push({
            s, fromY: desde, toY: destino,
            t: 0, delay: POP, dur: caida, kind: 'fall', size,
          });
        } else if (Math.abs(s.y - destino) > 0.5) {
          this.#anims.push({
            s, fromY: s.y, toY: destino,
            t: 0, delay: POP, dur: caida, kind: 'fall', size,
          });
        } else {
          s.y = destino;
          s.width = size;
          s.height = size;
          s.alpha = 1;
        }
      }

      this.#cells[r] = orden;
      // Reordenamos también en la escena para que la profundidad acompañe:
      // los nuevos entran DETRÁS, así se ven aparecer desde el fondo.
      for (const s of orden) this.#cols[r]!.addChild(s);
      this.#badgesOnTop(r);
    }

    if (this.#anims.length === 0) {
      this.#running = false;
      return Promise.resolve();
    }
    return new Promise<void>((res) => { this.#resolve = res; });
  }

  /**
   * Frenada de emergencia. Igual que en los rodillos: el jugador que apura
   * no quiere teatro, y el resultado ya estaba decidido antes de que se
   * moviera nada.
   */
  stopNow(): void {
    if (!this.#running) return;
    this.#slam = true;
    for (const a of this.#anims) {
      a.delay = 0;
      a.dur = Math.min(a.dur, 70);
    }
    for (const g of this.#glow) g.alpha = 0;
  }

  update(dtMs: number): void {
    if (!this.#running) {
      this.#syncBadges(dtMs);
      return;
    }
    this.#elapsed += dtMs;
    let vivos = 0;

    for (let i = this.#anims.length - 1; i >= 0; i--) {
      const a = this.#anims[i]!;
      a.t += dtMs;
      const local = a.t - a.delay;
      if (local < 0) {
        vivos++;
        continue;
      }
      const k = Math.min(1, local / a.dur);

      if (a.kind === 'pop') {
        /* La explosión: primero crece un pelo y después se va a cero. Ese
           tironcito de más es lo que la hace leer como "reventó" en vez de
           "desapareció". */
        const p = k < 0.3 ? 1 + k * 0.9 : 1.27 * (1 - (k - 0.3) / 0.7);
        a.s.width = a.size * Math.max(0, p);
        a.s.height = a.size * Math.max(0, p);
        a.s.alpha = 1 - k;
      } else {
        // Caída con rebote corto al aterrizar.
        const eased = 1 - Math.pow(1-k,3);
        a.s.y = a.fromY + (a.toY - a.fromY) * eased;
        a.s.alpha = 1;
        /* El tamano se restablece AL EMPEZAR a caer, no al aterrizar.
           Los sprites que entran despues de una cascada son los mismos que
           acaban de explotar, y la explosion los dejo en tamano cero: si el
           tamano se arregla recien al final, el simbolo cae invisible y
           aparece de golpe ya puesto. Se veia como un tablero medio vacio. */
        a.s.width = a.size;
        a.s.height = a.size;
        // El último tramo de la caída aplasta apenas el símbolo: aterriza, no aparece.
        if (!reducedMotion() && k > 0.8) {
          const landing = Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.055;
          a.s.width = a.size * (1 + landing);
          a.s.height = a.size * (1 - landing);
        }
        if (k >= 1) a.s.y = a.toY;
      }

      if (k >= 1) this.#anims.splice(i, 1);
      else vivos++;
    }

    // Expectativa y aviso de frenada por columna: el sonido y el cartel de
    // "¡casi!" son los mismos que en los otros dos juegos.
    for (let r = 0; r < this.#cols.length; r++) {
      if (this.#stopped[r]) continue;
      const anticipa = this.#anticipating[r] && !this.#slam;
      if (anticipa) {
        const arranca = this.#antStarts[r]!;
        if (this.#elapsed >= arranca && (r===0 || this.#stopped[r-1])) {
          this.#glow[r]!.alpha = 0.12 + Math.sin(this.#elapsed / 240) * 0.025;
          if (!this.#antNotified[r]) {
            this.#antNotified[r] = true;
            this.#events?.onAnticipation?.(r);
          }
        }
      }
      if (this.#elapsed >= this.#colDone[r]!) {
        this.#stopped[r] = true;
        this.#glow[r]!.alpha = 0;
        this.#events?.onReelStop?.(r, this.#anticipating[r]!);
      }
    }

    // Las etiquetas se acomodan DESPUÉS de mover los sprites: si no, van
    // un cuadro atrasadas y en una caída rápida se ven despegadas.
    this.#syncBadges(dtMs);

    if (vivos === 0) {
      this.#running = false;
      for (let r = 0; r < this.#cols.length; r++) {
        if (this.#stopped[r]) continue;
        this.#stopped[r] = true;
        this.#glow[r]!.alpha = 0;
        this.#events?.onReelStop?.(r, this.#anticipating[r]!);
      }
      const done = this.#resolve;
      this.#resolve = null;
      done?.();
    }
  }
}
