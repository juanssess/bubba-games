/**
 * Presentación del proveedor DENTRO del casino Bubba.
 *
 * Reemplaza a `apps/client/src/presentation.ts` del proyecto Juegos Casinos al
 * compilar con `tools/build-illustrated-provider.mjs`. Cumple el contrato de
 * `apps/client/src/presentation-types.ts`; si ese contrato cambia, este
 * archivo tiene que cambiar con él (el typecheck del proveedor no lo ve,
 * porque vive acá).
 *
 * Lo que agrega sobre el juego suelto:
 *  - el fondo pintado de cada juego (environments.png o una escena propia),
 *    con la atmósfera animada de Maverick;
 *  - el fondo se ilumina y se tiñe durante la función;
 *  - las pantallas de entrada y resumen del bonus de MCCinema.
 *
 * Solo presentación: no decide resultados, no cobra ni acredita.
 *
 * `__CASINO_SRC__` lo reemplaza la herramienta de compilación por la ruta
 * absoluta de `src/` del casino.
 */

import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
// @ts-expect-error: módulo JS del casino, sin tipos.
import { createMaverickAtmosphere } from '__CASINO_SRC__/ui/maverick-atmosphere.js';

import type { ClientGame } from './games.ts';
import type { Presentation } from './presentation-types.ts';

export type { Presentation, Scenery } from './presentation-types.ts';

const ART = '../../assets/illustrated/';

/** Escena de cada juego: un panel de environments.png o un archivo propio. */
const SCENES: Record<string, { panel?: number; file?: string; tint: number }> = {
  classic20: { panel: 0, tint: 0xa9ffe0 },
  sebusca: { panel: 1, tint: 0xffbdaa },
  vendimia: { panel: 2, tint: 0xd9c0ff },
  kiosco: { file: 'kiosco-environment.jpg', tint: 0xffc8e6 },
};

/** Lo que dice MCCinema al abrir la función de cada juego. */
const DETAIL: Record<string, string> = {
  classic20: 'La Escalinata decidió tu bonus.',
  sebusca: 'Los wilds pegajosos acompañan la función.',
  vendimia: 'Cada cascada continúa la cosecha.',
  kiosco: 'Las bombas multiplican cada caída que paga.',
};

interface Cinema {
  show(o: Record<string, unknown>): Promise<void>;
  featureStart(o: Record<string, unknown>): void;
  featureEnd(): void;
}
const cinema = (): Cinema | undefined => (window as unknown as { MCCinema?: Cinema }).MCCinema;

export function createPresentation(): Presentation {
  return {
    antialias: true,
    async preload() {
      await Assets.load([
        `${ART}provider-atlas.png`, `${ART}environments.png`,
        `${ART}kiosco-atlas.png`, `${ART}kiosco-environment.jpg`,
      ]);
    },
    scenery(app, profile: ClientGame) {
      const scene = SCENES[profile.id] ?? SCENES.classic20!;
      let texture: Texture;
      if (scene.file) {
        texture = Texture.from(`${ART}${scene.file}`);
      } else {
        const env = Texture.from(`${ART}environments.png`);
        const p = scene.panel ?? 0;
        texture = new Texture({ source: env.source, frame: new Rectangle(p * env.width / 3, 0, env.width / 3, env.height) });
      }
      const sprite = new Sprite(texture);
      sprite.alpha = 0.83;
      app.stage.addChild(sprite);
      if (profile.id === 'classic20') createMaverickAtmosphere(app, { Container, Sprite, Texture }, sprite);

      return {
        layout(_bg, w, h) {
          // Cubre la pantalla sin deformar: la escena se recorta, no se estira.
          const s = Math.max(w / sprite.texture.width, h / sprite.texture.height);
          sprite.scale.set(s);
          sprite.position.set((w - sprite.width) / 2, (h - sprite.height) / 2);
        },
        setFree(free) {
          // El fondo se ilumina en la función; el tablero conserva su contraste.
          sprite.alpha = free ? 1 : 0.83;
          sprite.tint = free ? scene.tint : 0xffffff;
        },
      };
    },
    async featureIntro(profile, spins) {
      const c = cinema();
      if (!c) return false;
      await c.show({ theme: profile.id, spins, detail: DETAIL[profile.id] ?? DETAIL.classic20 });
      return true;
    },
    featureStart(profile) {
      cinema()?.featureStart({ theme: profile.id });
    },
    async featureSummary(profile, spins, total) {
      await cinema()?.show({ theme: profile.id, kind: 'summary', spins, total });
    },
    featureEnd() {
      cinema()?.featureEnd();
    },
  };
}
