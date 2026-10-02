# Ambiente animado de Maverick

La escena conserva `assets/illustrated/environments.png`. La capa decorativa
de `src/ui/maverick-atmosphere.js` agrega llamas, humo y reflejos de agua,
anclados a coordenadas de esa imagen. Usa los mismos objetos Pixi del juego,
debajo de los rodillos y controles, sin eventos de entrada ni acceso a la
billetera, resultados, apuestas o tiempos de las rondas.

La capa actualiza a un maximo de 30 FPS, se pausa con la pagina oculta y
se elimina al descargar el iframe. Respeta `prefers-reduced-motion` y la
opcion Animaciones de Ajustes, incluida la del casino padre.

## Integracion Del Bundle

El proyecto fuente del proveedor no esta en este repositorio. Por eso,
`games/slots/assets/index-Dq-D1F78.js` importa la funcion y la llama solo
para `classic20`, despues de insertar el sprite del fondo. Maverick tambien
escucha el evento `resize` del renderer para reencuadrar despues de que
Pixi actualice sus dimensiones. Los otros juegos conservan su comportamiento.

Al reconstruir o reemplazar el bundle del proveedor, trasladar estos dos
puntos de integracion al proyecto fuente. No agregar un parametro de version
solo al script de entrada: los modulos del bundle tienen referencias circulares
a su URL original y eso ejecutaria dos veces el registro de extensiones Pixi.

## Verificacion

Con el servidor local activo, ejecutar:

```text
node tools/test-maverick-atmosphere.mjs <ruta-absoluta-a-playwright/index.mjs> [URL-del-servidor]
```

La prueba compara pixeles para confirmar movimiento y rodillos intactos,
verifica el encuadre en escritorio, vertical y horizontal, las preferencias
de movimiento y un giro completo. Comprueba que Se Busca y La Vendimia no
reciban la capa. Las capturas se guardan en `tmp/requests-maverick-*.png`.
