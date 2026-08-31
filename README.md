# BUBBA GAMES

Casino de práctica con **fichas virtuales**. Sin registro, sin servidor, sin dinero real.

## Marca

El logo es una **ficha de casino vectorial (SVG)** escrita directo en
`index.html`: gajos rojo/negro, doble aro dorado y la "B" en el centro. Al ser
SVG se ve nítido en cualquier tamaño, pesa unos cientos de bytes y toma los
colores de la paleta, así que acompaña solo si cambiás el tema.

Para usar el PNG original en su lugar, mirá `assets/LEEME.md`.

La paleta sale del logo: negros cálidos de fondo, **rojo `#d81e34`** como color
de acción y **oro `#f5c451`** para los destacados. El rojo de "perdiste"
(`#ff5a5f`) es más claro a propósito, para que no se confunda con el rojo de
marca cuando aparecen juntos.

## Cómo ejecutarlo

Levantá un servidor estático desde esta carpeta:

```bash
python -m http.server 8123
```

y entrá a `http://localhost:8123`.

> **Hace falta el servidor**, no alcanza el doble clic en `index.html`.
> Maverick y Se Busca se embeben en un iframe y comparten la billetera por
> `postMessage`; con `file://` los orígenes no se pueden validar. El resto de
> los juegos sí anda con doble clic, pero el saldo también puede quedar
> bloqueado en `file://`.

## Juegos de proveedor (Maverick y Se Busca)

Las dos tragamonedas grandes no viven en este proyecto: se construyen aparte
(carpeta `Juegos Casinos`, TypeScript + PixiJS) y se sirven desde
`games/slots/`. Es el mismo esquema que usa cualquier casino real: los juegos
del proveedor se embeben en un iframe.

**La billetera sigue siendo una sola.** El juego resuelve la ronda con su
matemática, pero no tiene saldo: para cada giro le pide permiso a Bubba.

```
juego → 'debit'    ¿me cobrás 20 fichas?  → MC.canBet + MC.addBalance
juego → 'settle'   gané 350, registrala   → MC.addBalance + MC.recordRound
```

Ese `MC.recordRound()` es el mismo punto único de siempre, así que el
historial del lobby, las estadísticas, la XP, el rango VIP y las misiones
diarias cuentan lo jugado en Maverick y Se Busca **sin que hubiera que tocar
nada de la progresión**.

El motor está en `src/games/proveedor.js` y no conoce ningún juego en
particular: para sumar otro alcanza con una entrada en el catálogo con
`engine: 'proveedor'` y su `frameUrl`.

Para actualizar los juegos después de cambiarlos, desde la carpeta
`Juegos Casinos`:

```bash
npm run build:casino
```

Eso compila y copia el resultado a `games/slots/` de este proyecto.

## Agregar un juego propio

Copiá `src/games/plantilla.js`. Es un juego completo y funcionando
("Doble o Nada") escrito con lo mínimo indispensable, para que se vea el
contrato entero sin ruido alrededor.

Son cuatro cosas:

1. **HTML** — una `<section class="view" id="view-TUJUEGO">` dentro del
   escenario, en `index.html`.
2. **Registro** — `MC.registerEngine('TUJUEGO', { load: load })`.
3. **Plata** — `MC.canBet()` antes, `MC.addBalance()` para mover fichas y
   `MC.recordRound(apostado, devuelto, detalle)` **siempre** al cerrar la ronda.
4. **Catálogo** — una entrada en `src/catalog/catalog.js` con `engine: 'TUJUEGO'`.

Ese único `MC.recordRound()` te engancha gratis al historial del lobby, las
estadísticas, la XP, el rango VIP y las misiones diarias.

La estética sale sola si usás las clases que ya existen: `.panel`, `.btn-accent`,
`.btn-gold`, `.btn-spin`, `.field`, `.bet-control`, `.quick-bets`, `.hint`, y los
tokens `--gold`, `--accent`, `--bg-2`. Mirá `src/styles/games/plantilla.css`:
fijate cuánto **no** hay ahí.

Si tu juego tiene rondas que no se pueden abandonar a medias, agregá
`MC.guard('TUJUEGO', function () { return rondaEnCurso; })`.

## Juegos ocultos

Los cinco motores de casino (slots, crash, mines, ruleta, blackjack) están
**ocultos, no borrados**: el código queda como referencia. Se prenden y apagan
desde un único bloque al principio de `src/catalog/catalog.js`:

```javascript
var OCULTOS = ['crash', 'mines', 'slots777', 'roulette', 'blackjack'];
var MOSTRAR_TRAGAMONEDAS_GENERADAS = false;
```

Sacar un id de `OCULTOS` lo devuelve al lobby, al buscador y al catálogo. El
mapa `MCCatalog.games` sigue conteniendo **todo**, también lo oculto, porque el
historial guarda ids de juego y tiene que seguir sabiendo cómo se llamaba cada
uno. Los rieles que quedan sin juegos se descartan solos, y los botones del
sidebar que apuntaban a esos rieles se esconden.

## Juegos

**128 títulos en total**: 6 hechos a mano + 2 tragamonedas de proveedor +
120 tragamonedas generadas.

### Las dos de proveedor

Construidas aparte con TypeScript + PixiJS, servidas en iframe, billetera
compartida. Su RTP está verificado por simulación de 100-200 millones de
rondas, no estimado.

| Juego | Tipo | RTP | Volatilidad | Feature |
|---|---|---|---|---|
| **Maverick** | Tragamonedas 5x3, 20 líneas | 96,7% | Alta | La Escalinata: escalás una pirámide y el nivel define el paquete de giros gratis |
| **Se Busca** | Tragamonedas 5x5, 15 líneas | 96,4% | Extrema | Wilds pegajosos x2 a x50 que se multiplican entre sí; tope 10.000x |

Las dos tienen compra de bonus con el precio **derivado del valor esperado
medido**, no elegido a ojo: la compra rinde apenas menos que girar normal,
para que comprar no sea estrategia dominante.

### Los seis de la casa

| Juego | Tipo | Ventaja de la casa |
|---|---|---|
| **Bubba Jet** | Crash | 3% (RTP 97%) |
| **Mines** | Instantáneo, 5x5 | 3% (RTP 97%) |
| **Bubba 777** | Tragamonedas 3 rodillos | RTP 97,4% (jackpot 250x) |
| **Liga Bubba** | Apuestas deportivas | 5% (retorno 95,2%) |
| **Ruleta Europea** | Mesa, un solo cero | 2,7% |
| **Blackjack Clásico** | Mesa, zapato de 6 mazos | ~1% |

### El catálogo generado

No existe ninguna API pública que sirva juegos de casino jugables — las de los
proveedores reales son B2B con licencia, y las APIs abiertas de videojuegos
devuelven títulos comerciales con marcas ajenas. Así que el catálogo se genera
**en tu propia máquina**, sin red.

Los 120 títulos no son tarjetas decorativas: **cada uno se juega de verdad**.
Comparten el motor de tragamonedas, pero cada uno trae su propio set de 8
símbolos, sus pesos de rodillo, su tabla de pagos, su volatilidad y su estudio
ficticio. Diez temáticas (azteca, océano, oeste, frutas, Nilo, dragón, espacio,
selva, hielo, fiesta) y seis estudios inventados.

Dos garantías del generador (`js/gamegen.js`):

1. **Es determinista.** PRNG con semilla fija: el catálogo es idéntico en cada
   carga, así el historial guardado sigue teniendo sentido mañana.
2. **El RTP mostrado es real.** Se calcula sobre la tabla de pagos ya redondeada
   y se corrige por descenso hasta clavar el objetivo. Rango medido: 94,00% a
   96,99%, promedio 95,56%. Verificado contra simulación de 1,5 millones de
   giros por juego con desvío menor a 0,5%.

### Liga Bubba (apuestas deportivas)

Dieciséis clubes **inventados**, con fuerza de ataque y de defensa sorteadas con
semilla fija. Nada de esto sale de internet: no hay API, funciona offline y
ningún nombre corresponde a un club real.

Los goles de cada equipo se modelan como una **Poisson**:

```
λ_local    = 1,35 · (ataque_local / defensa_visitante) · 1,15   ← ventaja de local
λ_visitante = 1,35 · (ataque_visitante / defensa_local)
```

De la grilla de marcadores posibles salen las probabilidades de los tres
mercados (Ganador · Más/Menos 2.5 goles · Ambos marcan), y de esas
probabilidades salen las cuotas con un 5% de margen.

**La parte que importa: el partido después se simula muestreando esas mismas λ.**
La cuota y el resultado vienen del mismo modelo, así que el 95,2% declarado es
real. Verificado con 300.000 apuestas simuladas: retorno 95,31%, y el overround
de cada mercado da 1,05 exacto.

Reglas: una sola selección por partido en un cupón (dos mercados del mismo
partido están correlacionados), y en combinada entran todas o no cobra ninguna.
Los cupones quedan pendientes hasta que simulás la jornada y sobreviven a un F5.
El fixture se sortea con el número de jornada como semilla, así que las cuotas no
cambian al recargar.

### Misiones y rango VIP

**Tres objetivos por día**, sorteados con la fecha como semilla: son los mismos
toda la jornada aunque recargues, y cambian solos a la medianoche. Al
completarlos pagan fichas y XP.

**La XP sube con lo apostado, no con lo ganado**, así el rango refleja cuánto
jugaste y no si tuviste suerte. Seis rangos, de Aprendiz a Leyenda Bubba, y el
beneficio es concreto: cada uno agranda el bono recargable (hasta el doble).

Todo el seguimiento entra por un único punto —`recordRound()` en la billetera—,
así que **ningún juego tuvo que enterarse de que existen las misiones**.

Fórmulas usadas:

- **Crash**: punto de reventón = `0.97 / (1 - r)`. Verificado por simulación
  (200.000 rondas): RTP 97,1% a 1.5x, 97,2% a 2x, 97,9% a 5x.
- **Mines**: multiplicador = `0.97 · C(25,k) / C(25-minas,k)` con `k` gemas destapadas.
- **Slots**: rodillo ponderado de 8 símbolos, una línea de pago. Paga tres
  iguales, y par para los tres símbolos más raros. Con ese espacio muestral el
  RTP se calcula **exacto**, no estimado:
  `Σ p³·pago3 + Σ 3p²(1-p)·pago2`.
- **Blackjack**: el crupier se planta en 17, blackjack natural paga 3:2,
  se puede doblar y dividir hasta 4 manos (los ases divididos reciben una sola carta).

Los resultados salen de `crypto.getRandomValues()` cuando el navegador lo soporta.

## Estructura

Sin build ni bundler: scripts planos cargados por `<script>`, para que
`index.html` abra con doble clic. El orden de carga en el HTML es la única
dependencia declarada, y va de lo general a lo particular.

```
index.html
src/
  styles/
    tokens.css        variables de diseño y reset (carga primero: lo usa todo)
    base.css          botones, campos y piezas reutilizables
    layout.css        armazón: sidebar, topbar, contenido
    portal.css        lobby: carrusel, rieles, tarjetas, catálogo, historial
    components.css    piezas flotantes: buscador, avisos, modal
    games/            una hoja por juego
  core/
    format.js         formato de números y tiempos
    rng.js            azar: real (crypto) y repetible (con semilla)
    state.js          estado persistente y su carga/guardado
    audio.js          sonido sintetizado con WebAudio
    ui.js             avisos y modal
    wallet.js         saldo, apuestas, cierre de ronda y bono
    router.js         qué se muestra en pantalla (juego → motor)
  progress/
    levels.js         rango VIP por experiencia acumulada
    missions.js       objetivos diarios y su seguimiento
  sports/
    teams.js          los 16 clubes inventados y sus fuerzas
    poisson.js        modelo de goles, mercados y cuotas
    league.js         fixture, simulación y tabla de posiciones
  catalog/
    themes.js         temáticas, estudios y perfiles de volatilidad
    slot-math.js      pesos, tabla de pagos y RTP exacto
    generator.js      generación determinista de títulos
    catalog.js        juegos de la casa + catálogo + rieles + banners
  games/
    slots.js          motor de tragamonedas (lo comparten los 121 títulos)
    proveedor.js      motor de juegos externos en iframe + puente de billetera
    sportsbook.js     motor de la casa de apuestas
    crash.js  mines.js  roulette.js  blackjack.js
  ui/
    game-card.js      la tarjeta de juego, definida una sola vez
    actions.js        traduce data-action a comportamiento
    carousel.js  rails.js  catalog-view.js  search.js
    portal.js         historial y bote
    shell.js          sidebar y topbar
    modals.js         cuenta, ayuda y bienvenida
    missions-view.js  pantalla de misiones y rango
  main.js             único punto de entrada

games/
  slots/              build de Maverick y Se Busca (se genera desde
                      el proyecto "Juegos Casinos", no se edita acá)
```

Tres decisiones que sostienen la estructura:

- **El router no conoce juegos, conoce motores.** Cada entrada del catálogo
  declara con cuál se juega (`engine: 'slots'`) y le pasa su configuración al
  abrirse. Por eso 121 tragamonedas distintas comparten un motor y sumar cien
  títulos más no toca una línea de código de juego.
- **Ningún juego toca el saldo directamente.** Todo pasa por `core/wallet.js`, y
  por eso el saldo en pantalla nunca se desincroniza del guardado.
- **La tarjeta de juego se define una sola vez** (`ui/game-card.js`) y la usan
  los rieles, el catálogo y el buscador.
- **La progresión se engancha en un solo lugar.** XP y misiones se alimentan
  desde `recordRound()`, el punto por el que ya pasaba toda ronda cerrada.

Sin dependencias ni build: JavaScript plano cargado con `<script>`, para que el
archivo abra directo desde el disco.

## Datos y privacidad

Saldo, estadísticas e historial se guardan en el `localStorage` de tu navegador
(clave `bubba_casino_v2`). No hay backend, no se envía nada a ningún lado.
Si borrás los datos del navegador, la cuenta arranca de cero.

La tabla "Tus últimas jugadas" muestra **solo tus resultados reales**; no hay
ganadores ni contadores de jugadores inventados.

## Aviso

Producto de entretenimiento. No se apuesta ni se gana dinero real. Solo para
mayores de 18 años.
