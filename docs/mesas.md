# Mesas originales

- **Salón 21:** blackjack de seis mazos. Conserva las reglas y los pagos del motor anterior; el cartel del natural se deriva del factor vigente. Nueva baraja con cantidad real de pintas, reparto y vuelta de cartas, paño azul y controles accesibles.
- **La Cúpula:** ruleta europea de 37 casilleros. La rueda conserva el orden real y lleva el resultado al puntero; la bolita gira en sentido contrario. En celular el paño pasa a tres columnas de números. Se conserva el cálculo de pagos `factor × 36 / números cubiertos`. Repetir se bloquea si ya hay apuestas para evitar perder apuestas cobradas.
- **El Patio:** truco argentino mano a mano contra Don Ramón, sin flor, a 15 o 30. Se juega por puntos, sin descontar ni pagar fichas. La partida completa se guarda por perfil en `MC.state.trucoMatch`; salir pausa al rival y volver reanuda la misma mano. Los guardados incompatibles se descartan sin interrumpir el arranque del casino.

## Variante del truco

Baraja española de 40 cartas. Envido, envido-envido, real y falta; truco, retruco y vale cuatro. El último que acepta truco obtiene el derecho de subir. Un envido puede interrumpir el primer truco pendiente; resuelto el envido, vuelve la respuesta al truco. Las cartas del envido se muestran al cerrar la mano. Las pardas favorecen al ganador de la primera, salvo primera parda: decide la siguiente; tres pardas favorecen al mano.

La falta envido vale lo que le falta al que va adelante para alcanzar **el objetivo completo** de 15 o 30, sin corte adicional en las malas. Es una variante explícita en la ayuda de la mesa. Irse al mazo antes de jugar, sin cantos, entrega dos tantos.

Referencias de reglas: [Gran Truco Argentino](https://trucogame.com/pages/reglamento-de-truco-argentino), [Truco Argentino](https://www.trucoargentino.com.ar/reglas/) y [Truco.ar](https://truco.ar/reglas). El nombre, el arte vectorial, la interfaz y la implementación son propios. La IA recibe únicamente su mano y las cartas públicas, no las cartas ocultas del jugador.

## Verificación

```powershell
node tools/test-truco.mjs
node tools/rtp-verificar.js 10000
node tools/test-table-rooms.mjs <ruta-absoluta-al-modulo-playwright/index.mjs>
```

Las pruebas puras comprueban jerarquía, envido sin flor, escaladas y rechazos, falta, interrupciones, derecho a subir, pardas y privacidad de la IA, además de 300 partidos completos con serialización y recuperación de estado. Las pruebas de Chrome abren el casino real, comprueban escritorio y tres tamaños de pantalla, pagos y navegación de ruleta, división y apuesta doble de blackjack, privacidad de cartas, recarga y un partido completo de truco. Las capturas quedan en `tmp/table-redesign/` y no se publican.
