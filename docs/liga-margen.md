# La Liga Argentina: cómo se fijan las cuotas y cuánto gana la casa

Documento de referencia del sportsbook. Todo número de acá sale de
`tools/medir-liga.js` y `tools/probar-modelos.js`, medido sobre **1.628
partidos de cinco temporadas** de la Liga Profesional.

## El problema que había

Cuando la liga era **simulada**, el margen declarado era cierto por
construcción: las cuotas salían de un modelo Poisson y los resultados se
sorteaban de **las mismas λ**. Un 5% de margen era un 5% de ventaja, punto.

Al pasar a **datos reales** eso dejó de valer y nadie lo revisó. La cuota
sigue saliendo del modelo, pero el resultado sale de la cancha, así que cada
error del modelo se lo come el margen. Medido:

| | |
|---|---|
| Margen declarado | +5,0 % |
| **Margen real** | **−2,65 %** |

La casa **perdía**, y perdía en las cinco temporadas. No fue mala suerte de
un año.

### La causa

```
goles que esperaba el modelo .. 1,868
goles que hubo de verdad ...... 2,090
```

Subestimaba los goles un 11 %, y de ahí caía todo: "más de 2.5" devolvía
124 % y "ambos marcan" 121 %.

## Qué se probó, en orden

Cada candidato se midió **sobre los mismos partidos**, con la diferencia
apareada partido a partido — sin eso, el error de ±3 puntos de cada modelo
tapa cualquier mejora de menos de seis.

| modelo | RTP | qué cambia |
|---|--:|---|
| viejo | 102,65 % | constantes 1,35 y 1,15, sin corrección |
| sin constantes | 110,43 % | promedios sacados de la temporada |
| **splits crudos** | **124,11 %** | historial de local y visitante por equipo |
| + encogido | 100,65 % | fuerzas encogidas hacia el promedio |
| + mezclado | 99,40 % | mitad split, mitad total |
| + Dixon-Coles | 99,24 % | retoca 0-0, 1-1, 1-0 y 0-1 |
| **+ margen 8 %** | **96,97 %** | el precio paga el error del modelo |

### Las tres cosas que enseñó

**Cambiar la constante sola EMPEORA.** Poner el promedio real (1,038 en vez
de 1,35) llevó el RTP a 110 %. `LEAGUE_AVG` aparecía tres veces con papeles
que se peleaban —normalizaba el ataque dividiendo, la defensa multiplicando,
y después volvía a escalar λ— y los recortes rompían la cancelación. No se
podía razonar sobre ella: había que medirla.

**Más información puede ser peor.** Separar el historial de local y de
visitante *debería* discriminar mejor, y devolvió **124 %**: con dos partidos
de local la razón es ruido, y el ruido en λ se paga carísimo. Encogerlas
hacia el promedio bajó eso a 100 %. Fue el cambio que más rindió y el que
menos parece.

**El margen es un precio, no una promesa.** Después de arreglar todo lo
arreglable, al modelo le seguía faltando. Un Poisson con dos números por
equipo no le va a ganar al fútbol. Cobrar 8 % nominal para ganar ~3 % real no
es "cobrar más y taparlo": es que el número declarado sea cierto.

## Lo que juega hoy

```
λ local   = promedio de local     × ataque(local)  × flojera(visita)
λ visita  = promedio de visitante × ataque(visita) × flojera(local)
```

- Los **promedios salen de los partidos bajados**, no de constantes.
- Las **fuerzas se encogen** hacia el promedio de la liga con K = 6 partidos
  de prior.
- El marcador se reparte con **Dixon-Coles, ρ = −0,10**.
- El **margen nominal es 8 %**.

`OJO con el signo`: `flojera` son goles **recibidos** — más es peor. La vieja
`defense` era al revés. Mezclarlas invierte el modelo y no se nota hasta que
el margen se va a negativo.

### La trampa de los datos

`lookuptable.php` con la clave gratuita devuelve **cinco equipos, no treinta**
— y son los cinco primeros, o sea los que más goles hacen. Sacar el promedio
de ahí lo daba en **1,375** cuando el real es **1,038**, y dejaba a los otros
veinticinco sin datos, tratados como exactamente promedio: el modelo no
distinguía a nadie.

Por eso las fuerzas se arman con **los partidos** (seis fechas hacia atrás,
unos 90) y la tabla se usa sólo para los pocos equipos que trae, donde son 16
fechas contra 5.

## El resultado, temporada por temporada

Un promedio de cinco años puede esconder cualquier cosa, así que:

| temporada | modelo viejo | el que juega hoy |
|---|--:|--:|
| 2022 | 108,04 % | 99,58 % |
| 2023 | 100,39 % | 95,29 % |
| 2024 | 100,48 % | 94,56 % |
| 2025 | 103,50 % | 99,38 % |
| 2026 | 102,45 % | 95,91 % |
| **promedio** | **102,65 %** | **97,04 %** |

El retorno real va de 94,6 % a 99,6 % según el año. **No es un 3 % fijo: es
una ventaja de entre 0 y 5 puntos con esperanza 3.** Por eso la ficha del
juego dice "Retorno 97,0 %" y no un margen redondo.

La medición usa la **misma memoria que el sitio** (seis fechas). Con la
temporada entera daría 96,97 %, prácticamente lo mismo: el encogido hace el
trabajo y la historia extra no aporta.

## Cómo se comprueba que la medición no miente

`medir-liga.js` trae una cuarta corrida de **control**: rehace la temporada
sorteando los resultados de las mismas λ que generan la cuota. Si el modelo
tuviera razón, apostar a los dos lados de un mercado tiene que devolver
exactamente `1/(1+margen)`. Da 96,87 % contra 95,24 % teórico, dentro de un
error estándar.

Las dos herramientas **cargan el `poisson.js` del sitio y lo ejecutan**. Una
copia de la matemática acá se separaría de la que juega el casino, y la
medición pasaría a medir otra cosa.

## Lo que queda pendiente

**Los partidos que no terminan en los 90.** `finished()` acepta `FT`, `AET` y
`PEN`, y el casino los liquida con el marcador final. Para un mercado de 90
minutos eso está mal: un partido que se define por penales fue empate. Hay
dos en la temporada 2026.

**Los partidos suspendidos.** Un `PPD` nunca entra a `finished()`, así que el
cupón queda pendiente para siempre y la ficha no vuelve. Una casa de verdad
lo anula y devuelve.

## Reproducir

```bash
node tools/medir-liga.js
```

```bash
node tools/probar-modelos.js
```

El volcado de la API se guarda en `tools/.cache/` y no va al repo. Para
bajarlo de nuevo, `node tools/.cache/bajar.js`.
