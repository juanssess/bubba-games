# Assets

Hoy el logo es **vectorial (SVG)**, escrito directo en `index.html`. Por eso el
casino no depende de ningún archivo externo y sigue abriendo con doble clic.

## Usar el PNG original en vez del SVG

1. Guardá tu imagen acá como `assets/logo.png`.
2. En `index.html` hay dos bloques `<svg class="sb-mark" …>` (uno en la barra
   lateral, otro en el pie). Reemplazá cada uno por:

   ```html
   <img class="sb-mark" src="assets/logo.png" alt="Bubba Games">
   ```

El primero está señalado con un comentario `<!-- LOGO. … -->` para que lo
encuentres rápido.

## Qué conviene

- Para la **pestaña del navegador** (favicon) sí hace falta el archivo: guardá
  el PNG acá y agregá en el `<head>`:
  `<link rel="icon" href="assets/logo.png">`
- Para el **logo de la interfaz**, el SVG rinde mejor: se ve nítido en cualquier
  pantalla, pesa unos cientos de bytes en vez de cientos de kB, y toma los
  colores de la paleta (`--brand-red`, `--gold`), así que si cambiás el tema el
  logo acompaña solo.
