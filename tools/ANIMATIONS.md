# Presentación de juegos

`src/ui/cinema.js` y `src/styles/games/cinema.css` presentan entradas y resúmenes de bonus para Bubba Gold, Maverick, Se Busca y La Vendimia. El diálogo recibe resultados ya calculados. No genera premios ni escribe en la billetera. Enter, espacio, Escape o el botón completan la presentación una sola vez. El foco vuelve al control anterior; se cancela el contador al cerrar. Se respeta la preferencia de movimiento reducido en los efectos nuevos.

`src/styles/games/motion.css` contiene las revelaciones de Mines, reparto y volteo de Blackjack, lanzamiento de Doble o Nada, respuesta de ruleta, símbolos premiados y cupón deportivo. Los rodillos nativos usan desenfoque temporal; Jet agrega una estela sobre su reloj de vuelo existente. Los contadores compartidos usan requestAnimationFrame.

La capa del proveedor se reconstruye con `node tools/build-illustrated-provider.mjs`. Además de las ilustraciones, aplica las transiciones de bonus, legibilidad del contador, aterrizaje de cascadas, frenada de rodillos y carteles de premios. El código hermano, las tablas, RNG y puente de pagos permanecen fuera de esta capa.

Vista previa sin apuestas: `/tools/animation-preview.html`.

Prueba de ciclo de vida: `node tools/test-cinema.mjs`.

Referencias consultadas: páginas oficiales de [Sweet Bonanza](https://www.pragmaticplay.com/es/games/sweet-bonanza-slot/) y [Gates of Olympus 1000](https://www.pragmaticplay.com/en/news/zeus-strikes-mighty-multipliers-in-pragmatic-plays-latest-release-gates-of-olympus-1000/). La demo visual oficial no cargó por resolución de dominio. Se tomó como referencia la estructura de giros, cascadas y multiplicadores descrita; el arte y las animaciones son propios, sin afirmar equivalencia de producción.
