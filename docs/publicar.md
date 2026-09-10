# Publicar Bubba

Tres cosas, y las tres están hechas: **dónde vive hoy**, **cómo ponerle
un dominio propio** (pendiente, cuesta plata) y **cómo armar el Firebase
desde cero** (ya hecho; sirve para rearmarlo o para quien clone el repo).

## Dónde vive hoy

**https://juanssess.github.io/bubba-games/**

GitHub Pages, sirviendo la rama `master` desde la raíz del repo. Cada `git
push` dispara una reconstrucción sola: no hay que hacer nada más para
publicar.

Funciona porque el casino es **estático** — HTML, CSS y JavaScript. No hay
servidor que ejecute nada. Toda la lógica corre en el navegador del que
juega, y lo único que sale afuera es Firestore, que es de Google y está
prendido siempre. Por eso la computadora de nacho puede estar apagada.

El `python -m http.server 8123` que usamos para desarrollar es solo para
probar cambios ANTES de subirlos. No tiene nada que ver con el sitio
público.

### Lo único que hay que acordarse al publicar

Subir el `?v=` de `index.html`. Está explicado arriba de todo en ese
archivo: la CDN de GitHub Pages sigue sirviendo la versión vieja de cada
archivo después de una actualización, y si el número no cambia el sitio
queda mitad nuevo y mitad viejo — que es peor que quedar todo viejo,
porque falla en lugares raros y no se entiende por qué.

---

## Ponerle un dominio propio

No está hecho porque cuesta plata y no valía la pena todavía. Estos son
los pasos, en orden. Son cuatro y ninguno es difícil; el que se olvida
siempre es el último.

### 1. Comprarlo

| Dónde | Qué | Costo aproximado |
|---|---|---|
| [NIC.ar](https://nic.ar) | un `.com.ar` | AR$ 1.500-2.000 al año, se paga con tarjeta local y se gestiona con AFIP / Mi Argentina |
| [Cloudflare](https://cloudflare.com) o [Porkbun](https://porkbun.com) | un `.com` | USD 10-12 al año, tarjeta internacional |

Cloudflare vende los dominios **al costo**, sin recargo de renovación, y
te da el DNS gratis. Si el pago en dólares no es problema, es la opción
más limpia.

### 2. Apuntar el DNS

En el panel del registrador, en la zona DNS del dominio. Los valores
salen de la API de GitHub (`gh api meta --jq .pages`), no de un blog:

**Para el dominio pelado** (`bubbagames.com.ar`) — cuatro registros `A`:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

y, si el registrador soporta IPv6, cuatro `AAAA`:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

**Para el `www`** (`www.bubbagames.com.ar`) — un solo registro `CNAME`
apuntando a `juanssess.github.io.` (con el punto final).

Lo más cómodo es hacer los dos: el pelado con los `A` y el `www` con el
`CNAME`. GitHub redirige uno al otro solo.

El DNS tarda entre unos minutos y unas horas en propagarse. Se comprueba
con `nslookup bubbagames.com.ar` — cuando devuelva esas IPs, está.

### 3. Decírselo a GitHub

Repositorio `juanssess/bubba-games` → **Settings → Pages → Custom
domain** → escribir el dominio → **Save**. Después, cuando se habilite,
tildar **Enforce HTTPS** (el certificado lo emite GitHub solo, gratis,
pero tarda un rato en estar listo).

Eso crea un archivo `CNAME` en la raíz del repo con el dominio adentro.
**No borrarlo**: si desaparece, GitHub se olvida del dominio.

### 4. Autorizarlo en Firebase — EL QUE SE OLVIDA

Consola de Firebase → **Authentication → Settings → Dominios autorizados**
→ **Agregar dominio** → el dominio nuevo.

Este es el paso que hay que hacer sí o sí y el que no avisa. Firebase
solo deja entrar con Google desde dominios que están en esa lista. Si
falta, **el sitio va a andar perfecto en todo salvo el login**, y el
login va a fallar solo en el dominio nuevo. Andar en `localhost` no
prueba nada, porque `localhost` está autorizado de fábrica.

El casino ya avisa cuando pasa: `auth-firebase.js` captura el error
`auth/unauthorized-domain` y muestra "Falta autorizar este dominio en
Firebase". Si aparece ese cartel, es exactamente esto.

Hoy la lista tiene: `localhost`, `bubba-games.firebaseapp.com`,
`bubba-games.web.app` y `juanssess.github.io`.

---

## Armar el Firebase desde cero

Esto **ya está hecho** en `bubba-games` y no hay que volver a tocarlo. Sirve
el día que alguien clone el repo y quiera su propio backend, o el día que
haya que rearmar el proyecto.

El orden importa: cada paso rompe de una forma distinta, y saber **cómo se
ve cada falla** es lo que ahorra la tarde. Un paso saltado casi nunca dice
lo que le falta.

### 0. El proyecto y la configuración

Crear el proyecto en la consola de Firebase y copiar su configuración a
`CONFIG`, arriba de `src/core/auth-firebase.js`.

La `apiKey` que está ahí es **pública por diseño** y está bien que se vea en
el repo: identifica al proyecto, no autoriza nada. Lo que autoriza son las
reglas de Firestore y la lista de dominios — los dos pasos de abajo.

> **Si esto falla:** nada arranca y la consola del navegador muestra un error
> de `initializeApp`. Es el único paso que falla de forma obvia.

### 1. Authentication → Sign-in method → Google

Habilitar el proveedor Google y guardar.

> **Si falta:** el botón de entrar abre el popup y se cierra solo. El casino
> muestra "No se pudo entrar con Google" y en la consola aparece
> `auth/operation-not-allowed`. Todo lo demás del casino anda perfecto —
> las fichas de invitado no pasan por Firebase— así que es fácil creer que
> el problema está en el login y no en la consola.

### 2. Firestore Database → crear la base

**Ojo con el nombre.** La base que Firebase crea por defecto se llama
`(default)`, **con paréntesis**, y el SDK la asume sola. La de este proyecto
se llama literalmente `default`, **sin paréntesis**, que es una base
*distinta*: por eso `auth-firebase.js` la pasa explícita.

```js
const DB_ID = 'default';
```

Si al crear la tuya la dejás como `(default)`, poné `DB_ID = '(default)'` o
sacá el segundo argumento de `getFirestore()`. Lo que no se puede es que el
nombre del código y el de la consola no coincidan.

> **Si no coincide:** todo falla con `NOT_FOUND` y sin decir por qué. Es el
> peor de los errores de esta lista porque no menciona la base en ningún
> lado. La forma de distinguirlo: pedir `databases/(default)` devuelve
> `NOT_FOUND` y `databases/default` devuelve `PERMISSION_DENIED`. El segundo
> error solo aparece **si la base existe**, así que ahí está la que sirve.

### 3. Firestore → Rules → pegar `firestore.rules` y publicar

El archivo está en la raíz del repo. Son dos colecciones con permisos
distintos: `players/{uid}` privada del dueño, y `leaderboard/{uid}` de
lectura pública y escritura del dueño. Están separadas para que mostrar el
ranking no obligue a abrir la lectura de todo el progreso de todos.

> **Si falta:** el login anda, el juego anda, y **la tabla de posiciones
> tira `permission-denied`**. El casino ya lo traduce en pantalla: si dice
> "Falta publicar las reglas", es exactamente esto. El progreso tampoco
> sube, y aparece el aviso "Tu progreso no se está guardando en la nube".

### 4. Authentication → Settings → Authorized domains

Agregar el dominio donde va a vivir el casino. Hoy la lista tiene
`localhost`, `bubba-games.firebaseapp.com`, `bubba-games.web.app` y
`juanssess.github.io`.

> **Si falta:** este es el que no avisa. **El sitio anda perfecto en todo
> salvo el login, y solo en el dominio nuevo.** Probar en `localhost` no
> prueba nada, porque `localhost` viene autorizado de fábrica. El casino
> captura `auth/unauthorized-domain` y muestra "Falta autorizar este dominio
> en Firebase", que es la pista.

### Cómo comprobar que quedó bien

Sin abrir la consola de Firebase: entrar con Google, jugar una ronda, y
abrir la tabla de posiciones. Si aparece tu nombre, **los cuatro pasos
funcionan** — esa fila no puede existir si falta alguno. Requiere estar
logueado (1), que la base sea la correcta (2), que las reglas dejen escribir
(3), desde un dominio autorizado (4).

---

## Lo que este modelo NO da

El repositorio es público y el sitio también, así que **la matemática de
los juegos corre en el navegador del jugador y se puede editar**. Para
fichas de práctica está bien y es el mismo modelo de confianza que tiene
todo el casino desde el día uno.

Es la línea que hay que cruzar el día que haya plata de verdad, y
cruzarla significa un servidor que resuelva las rondas — no un dominio
más lindo. Está preparado para eso: el cliente de los slots habla el
contrato `RgsClient` y no sabe de dónde salen las rondas. Ver
`packages/protocol` en el repo de los juegos.
