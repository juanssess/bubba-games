# Retorno de la casa — bajarle el RTP a los juegos

Panel: barra lateral → **Retorno de la casa** (cuentas de agente).
Código: `src/core/rtp.js` (la regla), `src/ui/casa.js` (la pantalla).
Verificación: `node tools/rtp-verificar.js`.

---

## La decisión de fondo

Lo fácil era recortar el premio al final: calcular lo que paga el juego
y entregar el 90%. **No se hizo así**, y el motivo es el que ordena todo
lo demás: la pantalla seguiría diciendo "paga 35:1" mientras la caja
paga 31,4:1. El jugador no tendría dónde ver el recorte.

En vez de eso, cada juego expresa su ventaja en **algún número propio**
—una constante, una tabla de pagos, una cuota— y el factor entra ahí,
*antes* de que ese número llegue a la pantalla. El resultado es que la
interfaz se corrige sola. No hay forma de que la vitrina y la caja digan
cosas distintas, porque salen del mismo número.

| Juego | Dónde entra el factor |
|---|---|
| Bubba Jet | el punto de reventón, `0,97/(1−r)` |
| Mines | la constante `EDGE = 0,97` |
| Ruleta Europea | el 36 del que se deriva todo pago |
| Bubba 777 | los multiplicadores de la tabla |
| Bubba Gold | la tabla de pagos, en `slots5-math.js` |
| Doble o Nada | el `1,95` del acierto |
| Liga Argentina | la cuota, en `poisson.js` |
| Blackjack | la ganancia (el empate **no** se toca) |

**Maverick, Se Busca y La Vendimia se ajustan en otro lado.** Corren
en un iframe con su matemática compilada en otro proyecto, así que el
factor no entra en su tabla de pagos: el casino recorta **al
acreditar**, en `proveedor.js`. Ver más abajo.

---

## Por qué el número que pedís es el que pagás

En los siete juegos que no son blackjack, el retorno esperado es una
suma de (probabilidad × pago). El factor multiplica cada pago y no toca
ninguna probabilidad, así que sale de factor común:

```
RTP(k) = Σ pᵢ · (k·cᵢ) = k · Σ pᵢ · cᵢ = k · RTP(1)
```

En Bubba Jet y en Mines sale todavía más directo: el RTP de esos dos
**es** la constante, para cualquier estrategia. En la ruleta, el factor
multiplica el total devuelto (`k·36/n`), así que las trece apuestas
siguen teniendo exactamente el mismo margen después de bajarlo — que es
la propiedad que hace honesta a esa mesa.

### Blackjack es la excepción, y se dice

El empate devuelve la apuesta y **no es un premio**: escalarlo haría que
empatar te saque fichas. Así que sólo se escala lo que está por encima
de la apuesta. Consecuencia: el retorno real queda un poco **por encima**
del objetivo, porque la parte que viene de los empates no baja. El panel
muestra ese número con `≈` y lo explica en la fila. Además, el retorno
de blackjack depende de cómo juegue el jugador, así que no hay un número
único que prometer.

---

## El redondeo, que no es un detalle

Con los multiplicadores enteros de antes, redondear era casi gratis. Con
un factor dejan de ser enteros: Doble o Nada pasa de pagar 1,95 a pagar
1,755, y `Math.floor(10 × 1,755)` da 17 cuando el pago justo es 17,55.
Sobre apuestas chicas eso es un 3% que se pierde **por el piso, no por
el factor**: el panel prometería 90% y la caja pagaría 87%.

`MC.rtp.fichas(x)` redondea al azar con la probabilidad del resto: 17,55
paga 18 el 55% de las veces y 17 el 45%. Así `E[fichas(x)] = x` exacto,
para cualquier apuesta. El jugador ve fichas enteras y la caja respeta la
matemática al decimal.

De paso arregla un sesgo que **ya existía**: el `Math.floor` de Mines,
Bubba Jet y la liga venía comiéndose una fracción en cada pago, así que
esos tres pagaban un poco menos que el RTP que publicaban.

---

## Las dos capas: lo que ve todo el mundo y lo que ves vos

Esta es la parte que más se presta a malentendido, así que va con
todas las letras: **mover una perilla del panel no le cambia el
retorno a nadie más.**

El panel escribe en el `localStorage` del navegador, y el
almacenamiento de un navegador no es de nadie más. No es una
limitación que se pueda programar alrededor: el casino corre entero
en la máquina del que lo abre y no hay servidor donde guardar una
decisión de la casa. Si el número tiene que valer para todos, tiene
que estar en un archivo que se publique.

Por eso hay dos capas:

| | Dónde vive | Quién lo ve |
|---|---|---|
| **Publicado** | `PUBLICADO`, arriba de `src/core/rtp.js` | todos los que abran el sitio |
| **Local** | el `localStorage` de tu navegador | sólo vos, en esa compu |

Lo local pisa a lo publicado, y el orden completo es: ajuste propio
de la mesa → global tuyo → ajuste publicado de la mesa → global
publicado.

### Cómo se publica

El panel no puede escribir en el disco —corre en el navegador—, así
que hace lo único honesto que puede: te da el texto exacto.

1. Movés las perillas y probás hasta que te guste.
2. **Publicar esto para todos** te devuelve el bloque `PUBLICADO`.
3. Lo pegás en `src/core/rtp.js`, reemplazando el que está.
4. Commit y push. Cuando GitHub Pages reconstruya, ese es el retorno
   de la casa.
5. Conviene después **borrar lo de este navegador**: si no, seguís
   viendo lo tuyo encima y no lo que ve el resto.

Hasta el paso 4 el cambio sigue siendo sólo tuyo. El panel lo dice en
pantalla en vez de dejarte creer que ya está hecho.

### La migración de las cuentas viejas

La primera versión de este panel guardaba `{global: 1, juegos: {}}` en
toda cuenta, tocara o no la perilla. Con las reglas de hoy eso sería
un jugador diciendo "quiero el 100%, ignorá lo publicado", y le
taparía a la casa cualquier recorte que publicara después. Se limpia
**una sola vez**, marcada con `v: 2`, para que un 100% elegido a mano
más adelante sí se respete.

---

## Cómo se usa

- **Todas las mesas**: un solo control, en porcentaje de lo que cada
  juego paga de fábrica.
- **Una mesa sola**: el deslizador de su fila, en puntos de RTP. El
  ajuste propio **gana** sobre el global, no se multiplican: el número
  que pusiste en un juego es el que corre. Para que vuelva a seguir al
  global, "seguir al global".
- Se puede bajar hasta el 50% de lo de fábrica. **No se puede subir por
  encima del RTP de diseño.**

Se guarda con el progreso del perfil, en este navegador.

---

## Dónde está, y por qué ahí

El panel vive del lado del agente, porque decidir el margen es trabajo
de la casa y no del que apuesta. Pero igual que el rol, **no es una
barrera de seguridad**: vive en el almacenamiento del navegador y quien
abra las herramientas de desarrollo puede cambiarlo. Separa dos usos.
Ver el encabezado de `src/core/roles.js`, que explica por qué no puede
ser otra cosa mientras el casino corra entero en la máquina del jugador.

Si lo querés ver siempre con tu cuenta de jugador: sacá `'sbCasa'` de
`SOLO_AGENTE` y `casa: AGENTE` de `VISTAS`, en `roles.js`. Dos líneas.

---

## Verificar

```bash
node tools/rtp-verificar.js
```

Carga los archivos del casino tal cual —no una copia— y comprueba:

1. que `MC.rtp.fichas` no tenga sesgo (contra su error estándar);
2. la aritmética del factor (el propio gana, los topes, los iframes);
3. que el RTP exacto de Bubba Gold dé `k × 95,46%` para todo `k`;
4. lo mismo jugando rondas completas con giros gratis y retriggers;
5. que las trece apuestas de la ruleta sigan teniendo el mismo margen;
6. **el circuito de publicar completo**: configura un retorno, pide las
   líneas, las pega de verdad en una copia del módulo, la carga en un
   navegador sin nada guardado y comprueba que las mesas paguen lo
   mismo. Si el generador se equivoca de coma, acá se cae — y un
   `PUBLICADO` con un error de sintaxis rompe `rtp.js` entero;
7. que la migración limpie el rastro viejo sin borrar una elección
   deliberada.

Mines y Bubba Jet no están ahí a propósito: en esos dos el RTP **es** la
constante que el panel mueve, la demostración son dos líneas en el
encabezado de cada motor, y simular lo que ya está cerrado
algebraicamente significaría escribir una segunda copia de su matemática
dentro de la herramienta — justo lo que estas herramientas existen para
evitar.

> Si se toca la tabla de pagos de un juego, hay que volver a correr
> `node tools/slots5-rtp.js` y actualizar el `rtpValue` del catálogo. El
> panel calcula sobre ese número: si está viejo, el panel miente.


---

## Las tres que corren aparte

Maverick, Se Busca y La Vendimia se sirven en un iframe desde
`games/slots/`. Su matemática está compilada en otro proyecto, así que
el casino no puede meter el factor en su tabla de pagos como hace con
las ocho mesas propias.

Hace las dos cosas que sí puede:

1. **Le pasa el factor al juego** — por la URL (`?rtp=0.85`) y en la
   respuesta a *cada* mensaje del protocolo, para que un cambio en vivo
   llegue sin recargar.
2. **Mientras el juego no lo aplique**, recorta al acreditar y lo avisa
   en un cartel arriba del juego, con el número concreto.

### El costo, dicho de frente

Con el recorte en la caja, **la pantalla del juego miente**: muestra sus
multiplicadores de fábrica y la billetera acredita menos. Es la única
mesa del casino donde eso pasa, y es exactamente lo que `MC.rtp` evita
en todas las demás. Por eso el cartel no es opcional ni se puede
apagar: sin él, el casino mostraría un premio y pagaría otro.

El cartel va **antes** del iframe en el DOM. Puesto después quedaba
fuera de pantalla —el juego mide más que la ventana— y un aviso que se
lee después de girar no es un aviso.

### El contrato, para cerrarlo del todo

Esto se arregla del lado del juego, y el casino ya está listo para
cuando pase. El juego tiene que:

1. Leer `rtp` del query string al arrancar, y el campo `rtp` que viene
   en cada respuesta del canal `bubba-rgs` (para los cambios en vivo).
2. Aplicarlo a su tabla de pagos, de modo que **lo que muestra sea lo
   que paga**.
3. Contestar el `hello` con `rtp: true`.

Ese `rtp: true` es el interruptor: el casino deja de recortar en la
caja y el cartel desaparece solo. Si el juego no lo manda, se asume que
no lo aplica — que es la suposición segura: recortar de más se nota y
se avisa, recortar de menos le regala plata a la casa sin que nadie se
entere.

> Mientras tanto, el `settle` que manda el juego se escala en
> `proveedor.js` y lo que entra al historial y a las estadísticas es lo
> **realmente acreditado**, no lo que dijo el juego. Si fuera al revés,
> las estadísticas publicarían un retorno que la caja nunca pagó.
