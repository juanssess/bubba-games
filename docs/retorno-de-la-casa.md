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

**Maverick, Se Busca y La Vendimia quedan afuera.** Corren en un iframe
con su propia matemática, servida desde `games/slots/`. El panel los
lista como fuera de alcance en vez de ofrecer una perilla muerta: su RTP
se cambia en ese otro proyecto.

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
5. que las trece apuestas de la ruleta sigan teniendo el mismo margen.

Mines y Bubba Jet no están ahí a propósito: en esos dos el RTP **es** la
constante que el panel mueve, la demostración son dos líneas en el
encabezado de cada motor, y simular lo que ya está cerrado
algebraicamente significaría escribir una segunda copia de su matemática
dentro de la herramienta — justo lo que estas herramientas existen para
evitar.

> Si se toca la tabla de pagos de un juego, hay que volver a correr
> `node tools/slots5-rtp.js` y actualizar el `rtpValue` del catálogo. El
> panel calcula sobre ese número: si está viejo, el panel miente.
