# Cómo está publicado Bubba, y cómo ponerle un dominio propio

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
