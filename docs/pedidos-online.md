# Pedidos de fichas entre dispositivos

Los jugadores con Google pueden pedir fichas desde el Cajero. El agente
autorizado ve los pedidos en su panel, los acepta o los rechaza. El jugador
puede cancelar mientras el pedido siga pendiente. Se conserva el historial.
Las fichas son virtuales, sin valor monetario.

## Cuenta del agente

La cuenta autorizada se define en dos lugares, y son los unicos: `agentes()`
en `firestore.rules` (lo que de verdad autoriza) y `AGENTE` en
`src/progress/peticiones-nube.js` (lo que el navegador usa para la interfaz).
Va el UID **pelado** de Firebase, sin el `google:` que el casino le pone a sus
perfiles. Es el mismo que administra el retorno de la casa. Debe entrar con Google y
seleccionar el rol de agente desde su cuenta. Crear una cuenta local de agente
o cambiar el rol de otro perfil no concede permisos sobre los pedidos online.

La caja online comienza una sola vez con 500.000 fichas. Se comparte entre
dispositivos y es independiente de la caja local de practica. No se importan
los pedidos locales ni se trasladan sus movimientos a esta caja. Las cargas
online se hacen desde los pedidos; las comisiones locales no incrementan la
caja online.

## Acreditaciones

Cada aceptacion guarda en una transaccion el pedido, el historial, el descuento
de la caja y el acumulado recibido por el jugador. Si falla un paso, no se
aplica ninguno. Dos agentes abiertos en dispositivos distintos no pueden
acreditar el mismo pedido dos veces, ni cancelar una aceptacion ya completada.

`fichasRecibidas/{uid}` conserva el acumulado incluso con el jugador desconectado.
El campo `fichasNube` del progreso indica cuanto de ese acumulado ya se incluyo
en su saldo. La subida del progreso lee el acumulado en una transaccion, para
que una copia vieja no borre una carga que acaba de llegar. Esto protege las
acreditaciones; el progreso de juego mantiene su sincronizacion existente y
no ofrece juego simultaneo independiente en varios dispositivos.

## Activacion

La base de este proyecto se llama `default` literalmente, sin parentesis.
`firebase.json` apunta a esa base. Publicar el sitio en GitHub Pages no publica
las reglas ni los indices de Firebase.

```powershell
node tmp/firebase-cli/node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore --project bubba-games --dry-run --non-interactive
node tmp/firebase-cli/node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore --project bubba-games --non-interactive
```

Los indices de `historialPedidos` pueden tardar en quedar listos. Hasta entonces
el Cajero y el panel muestran un problema de conexion y permiten reintentar.
No se anuncian pedidos enviados ni cargas completadas antes de confirmarlos.

## Verificacion

```powershell
node tools/test-agent.mjs
node tools/test-requests-cloud.mjs
node tools/test-fichas-sync.mjs
```

`tools/test-requests-rules.mjs` usa Firebase real contra un emulador con el
proyecto aislado `demo-bubba`; nunca modifica las cuentas de produccion.
Requiere Firebase CLI, `firebase`, `@firebase/rules-unit-testing` y Java 21.
La configuracion del emulador esta en `firebase-test.json`.

```powershell
node tmp/firebase-cli/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --config firebase-test.json --project demo-bubba --only firestore "node tools/test-requests-rules.mjs"
```

La prueba de interfaz `tools/test-requests-ui.mjs` recibe como argumento la
ruta de Playwright y comprueba las vistas en escritorio y celular.
