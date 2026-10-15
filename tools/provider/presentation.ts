/**
 * Presentación del proveedor DENTRO del casino Bubba.
 *
 * Reemplaza a `apps/client/src/presentation.ts` del proyecto Juegos Casinos al
 * compilar con `tools/build-illustrated-provider.mjs`, y se construye sobre
 * `presentation-base.ts` del proveedor: el fondo pintado de cada juego y su
 * tinte en la función ya los pone el juego (vienen en su paquete, `art/`).
 * Lo que agrega el casino es lo que es SUYO:
 *
 *  - las pantallas de entrada y resumen del bonus de MCCinema;
 *  - la atmósfera animada sobre el templo de Maverick.
 *
 * Solo presentación: no decide resultados, no cobra ni acredita.
 *
 * `__CASINO_SRC__` lo reemplaza la herramienta de compilación por la ruta
 * absoluta de `src/` del casino.
 */

import { Container, Sprite, Texture } from 'pixi.js';
// @ts-expect-error: módulo JS del casino, sin tipos.
import { createMaverickAtmosphere } from '__CASINO_SRC__/ui/maverick-atmosphere.js';

import type { ClientGame } from './games.ts';
import type { Presentation } from './presentation-types.ts';
import { createBasePresentation, paintedScenery } from './presentation-base.ts';

export type { Presentation, Scenery } from './presentation-types.ts';

interface Cinema {
  show(o: Record<string, unknown>): Promise<void>;
  featureStart(o: Record<string, unknown>): void;
  featureEnd(): void;
}
const cinema = (): Cinema | undefined => (window as unknown as { MCCinema?: Cinema }).MCCinema;

export function createPresentation(profile: ClientGame): Presentation {
  const base = createBasePresentation(profile);
  return {
    ...base,
    scenery(app, p) {
      if (p.id !== 'classic20' || !p.art) return base.scenery(app, p);
      const scene = paintedScenery(app, p);
      createMaverickAtmosphere(app, { Container, Sprite, Texture }, scene.sprite);
      return scene;
    },
    async featureIntro(p, spins) {
      const c = cinema();
      if (!c) return false;
      await c.show({ theme: p.id, spins, detail: p.featureDetail ?? '' });
      return true;
    },
    featureStart(p) {
      cinema()?.featureStart({ theme: p.id });
    },
    async featureSummary(p, spins, total) {
      await cinema()?.show({ theme: p.id, kind: 'summary', spins, total });
    },
    featureEnd() {
      cinema()?.featureEnd();
    },
  };
}
