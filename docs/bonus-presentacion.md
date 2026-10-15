# Presentacion de bonus

Referencias de los fabricantes consultadas:

- https://www.pragmaticplay.com/en/games/sweet-bonanza-1000/ : bonus con giros gratis y multiplicadores.
- https://www.playngo.com/games/book-of-dead : simbolo expansivo durante los giros gratis.
- https://www.hacksawgaming.com/games/wanted-dead-or-a-wild : funciones diferenciadas, wilds persistentes y multiplicadores.

No se presenta esta seleccion como un ranking objetivo. Bubba utiliza sus
propias ilustraciones y reglas; no reproduce marcas, sonidos ni recursos de
los fabricantes. Esta mejora es de presentacion, no de matematica.

MCCinema presenta los bonus de Bubba Gold, Maverick, Se Busca y La Vendimia.
La entrada identifica la funcion de cada juego y sus giros. La salida muestra
el premio exacto y los giros jugados, incluso si no hubo premio.
Durante el conteo, la primera pulsacion revela el total y la siguiente continua.
Escape permite salir directamente. El cierre resuelve la promesa una sola vez,
restaura el foco y no acredita premios ni dispara otro giro.
Se mantienen las probabilidades, los RTP y las liquidaciones existentes.

## Durante la funcion

`MCCinema.featureStart/featureEnd` activa el estado visual del bonus sin crear
paneles adicionales. Los contadores originales del juego se conservan y los
rodillos recuperan todo el espacio disponible. No se alteran resultados ni
billetera. El fondo cambia de luz y color durante el bonus. Bubba Gold cambia el tablero
a verde y destaca cada comodin con su multiplicador real.
La limpieza tambien ocurre si la reproduccion del proveedor falla.
La reconstruccion utiliza `tools/build-illustrated-provider.mjs` y conserva
la capa de ambiente animado de Maverick. El proyecto fuente vecino se lee,
pero no se modifica. Los bundles anteriores se conservan para recuperacion.

Pruebas:

```text
node tools/test-cinema.mjs
node tools/test-cinema-ui.mjs <ruta-a-playwright>
node tools/test-bonus-live.mjs <ruta-a-playwright>
```
