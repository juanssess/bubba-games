/* ============================================================
   UI / COMPARTIR — sacarle una foto al golpe y mandarlo.

   El casino tiene torneo, tabla de posiciones y medallas de oro,
   plata y bronce. Todo eso espera un segundo jugador. Este módulo
   existe para conseguirlo: es la única pieza del casino cuyo
   objetivo no es que juegues, sino que traigas a alguien.

   ---------------------------------------------------------------
   POR QUÉ UNA IMAGEN Y NO UN TEXTO
   ---------------------------------------------------------------
   "Pegué un ×45" en un chat es una frase que pasa. Una tarjeta
   negra y dorada con un ×45 gigante se mira, y sobre todo se
   reenvía. En WhatsApp —que es donde esto va a viajar— un texto
   con link se ve como spam y una imagen se ve como una captura de
   algo que pasó de verdad.

   Igual el texto va SIEMPRE junto con la imagen, porque es lo que
   lleva el link. Una imagen sola es linda y no se puede clickear.

   ---------------------------------------------------------------
   TRES CAMINOS, Y NO ES REDUNDANCIA
   ---------------------------------------------------------------
   1. `navigator.share` con archivo → abre el menú del sistema y
      manda la imagen. Es el bueno: en un celular sale directo a
      WhatsApp. Android e iOS lo tienen.
   2. `navigator.share` sin archivo → algunos navegadores comparten
      texto pero no archivos. Mejor el texto con el link que nada.
   3. Portapapeles + descarga → escritorio. Se copia el mensaje y
      se baja la imagen para arrastrarla a WhatsApp Web.

   El orden importa: se prueba de mejor a peor y se usa el primero
   que el navegador soporte DE VERDAD. Por eso se pregunta con
   `canShare({files})` y no por la existencia de `share`: Chrome de
   escritorio tiene `share` y rechaza archivos en varias
   plataformas.

   Depende de: torneo, router (para el nombre del juego).
   ============================================================ */
window.MCCompartir = (function () {
  'use strict';

  var LADO = 1080;

  /** La dirección del casino, deducida y no escrita a mano.
      Si mañana hay dominio propio, esto lo sigue solo. */
  function sitio() {
    return new URL('.', location.href).href;
  }

  function equis(x) {
    var v = x >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
    return '×' + (v % 1 === 0 ? v : v.toFixed(1));
  }

  /** Los datos del golpe de la semana, o null si todavía no hay. */
  function golpe() {
    var t = MCTorneo.mio();
    if (!t.golpe) return null;
    var meta = t.juego ? MC.getGame(t.juego) : null;
    return {
      x: t.golpe,
      juego: meta ? meta.name : 'Bubba',
      emoji: meta ? meta.emoji : '🎰',
      apuesta: t.apuesta || 0,
      pago: t.pago || 0
    };
  }

  /* ---------------- la tarjeta ---------------- */

  function fondo(ctx) {
    var g = ctx.createLinearGradient(0, 0, LADO * 0.6, LADO);
    g.addColorStop(0, '#1b1512');
    g.addColorStop(0.55, '#0f0b09');
    g.addColorStop(1, '#0a0706');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LADO, LADO);

    // El halo dorado detrás del número. Es lo que hace que la tarjeta
    // se lea como un premio y no como una placa de texto.
    var r = ctx.createRadialGradient(LADO / 2, LADO * 0.46, 0, LADO / 2, LADO * 0.46, LADO * 0.62);
    r.addColorStop(0, 'rgba(245,196,81,.22)');
    r.addColorStop(0.5, 'rgba(245,196,81,.06)');
    r.addColorStop(1, 'rgba(245,196,81,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, LADO, LADO);

    // Marco fino por dentro del canto: le da borde a la captura.
    ctx.strokeStyle = 'rgba(245,196,81,.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, LADO - 60, LADO - 60);
  }

  function centrado(ctx, texto, y, font, fill, spacing) {
    ctx.font = font;
    ctx.fillStyle = fill;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (!spacing) { ctx.fillText(texto, LADO / 2, y); return; }

    /* Con espaciado hay que dibujar letra por letra: canvas no tiene
       letter-spacing en los navegadores viejos, y la propiedad
       `ctx.letterSpacing` recién existe hace poco. Esto anda en todos.

       OJO CON `texto[i]`: recorre unidades UTF-16, no caracteres. Un
       emoji ocupa DOS unidades, así que el bucle dibujaba cada mitad por
       separado y en la tarjeta salían dos cuadraditos en vez de la uva.
       `Array.from` parte por punto de código y el emoji queda entero. */
    var letras = Array.from(texto);
    var total = 0, i;
    for (i = 0; i < letras.length; i++) total += ctx.measureText(letras[i]).width + spacing;
    total -= spacing;
    var x = LADO / 2 - total / 2;
    ctx.textAlign = 'left';
    for (i = 0; i < letras.length; i++) {
      ctx.fillText(letras[i], x, y);
      x += ctx.measureText(letras[i]).width + spacing;
    }
    ctx.textAlign = 'center';
  }

  /**
   * Dibuja la tarjeta y devuelve un blob PNG.
   *
   * Espera a `document.fonts.ready` a propósito: sin eso, canvas dibuja
   * con la fuente de reserva la primera vez —Anton todavía no bajó— y la
   * tarjeta sale con Impact. Es el clásico error de generar imágenes con
   * fuentes web: en pantalla nunca se nota, porque para cuando mirás ya
   * cargaron.
   */
  async function tarjeta(g) {
    try { await document.fonts.ready; } catch (e) { /* sin API de fuentes */ }

    var c = document.createElement('canvas');
    c.width = LADO;
    c.height = LADO;
    var ctx = c.getContext('2d');
    if (!ctx) return null;

    fondo(ctx);

    centrado(ctx, 'BUBBA GAMES', 150, '800 34px Manrope, system-ui, sans-serif', '#f5c451', 12);
    centrado(ctx, 'EL GOLPE DE LA SEMANA', 210,
      '700 26px Manrope, system-ui, sans-serif', 'rgba(245,239,233,.55)', 7);

    // El número, que es toda la tarjeta.
    ctx.font = '400 320px Anton, Impact, sans-serif';
    var deg = ctx.createLinearGradient(0, 320, 0, 620);
    deg.addColorStop(0, '#ffe9a8');
    deg.addColorStop(0.5, '#f5c451');
    deg.addColorStop(1, '#c9922b');
    ctx.fillStyle = deg;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(245,196,81,.45)';
    ctx.shadowBlur = 60;
    ctx.fillText(equis(g.x), LADO / 2, 570);
    ctx.shadowBlur = 0;

    /* La pila lleva fuentes de emoji al final: Manrope no tiene ninguno,
       y sin eso el navegador no sabe con qué dibujarlo. */
    centrado(ctx, g.emoji + '  ' + g.juego.toUpperCase(), 668,
      '800 44px Manrope, "Apple Color Emoji", "Segoe UI Emoji", ' +
      '"Noto Color Emoji", system-ui, sans-serif', '#f5efe9', 3);

    // La cuenta. Es lo que vuelve creíble el número de arriba: sin esto un
    // ×45 puede ser cualquier cosa; con esto es una jugada concreta.
    if (g.apuesta > 0) {
      centrado(ctx, MC.fmt(g.apuesta) + ' fichas  →  ' + MC.fmt(g.pago), 740,
        '600 36px Manrope, system-ui, sans-serif', 'rgba(245,239,233,.62)', 1);
    }

    // El pie con el link, sobre una banda para que se despegue del fondo.
    ctx.fillStyle = 'rgba(245,196,81,.10)';
    ctx.fillRect(30, LADO - 190, LADO - 60, 160);
    centrado(ctx, 'Jugá gratis, con fichas virtuales', LADO - 118,
      '600 30px Manrope, system-ui, sans-serif', 'rgba(245,239,233,.6)', 1);
    centrado(ctx, sitio().replace(/^https?:\/\//, '').replace(/\/$/, ''), LADO - 68,
      '800 34px Manrope, system-ui, sans-serif', '#f5c451', 1);

    return await new Promise(function (res) { c.toBlob(res, 'image/png'); });
  }

  /* ---------------- el mensaje ---------------- */

  function mensaje(g) {
    var linea = g.emoji + ' Pegué un ' + equis(g.x) + ' en ' + g.juego;
    linea += g.apuesta > 0
      ? ': aposté ' + MC.fmt(g.apuesta) + ' y volvieron ' + MC.fmt(g.pago) + '.'
      : '.';
    return linea + '\n\n¿Me lo superás? Bubba es gratis, con fichas virtuales:\n' + sitio();
  }

  /* ---------------- compartir ---------------- */

  /**
   * Devuelve por dónde salió: 'imagen', 'texto', 'copiado', 'bajado' o
   * 'cancelado'. La pantalla usa eso para decir la verdad de lo que pasó
   * en vez de un "listo" que a veces sería mentira.
   */
  async function compartir() {
    var g = golpe();
    if (!g) return 'sin-golpe';

    var texto = mensaje(g);
    var blob = null;
    try { blob = await tarjeta(g); } catch (e) { /* sin canvas, va el texto */ }

    // 1. Imagen por el menú del sistema.
    if (blob && navigator.canShare) {
      try {
        var file = new File([blob], 'bubba-golpe.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: texto });
          return 'imagen';
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
      }
    }

    // 2. Solo texto.
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        return 'texto';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
      }
    }

    // 3. Escritorio: al portapapeles, y la imagen se baja para
    //    arrastrarla a WhatsApp Web.
    try {
      await navigator.clipboard.writeText(texto);
      if (blob) bajar(blob);
      return 'copiado';
    } catch (e) {
      if (blob) bajar(blob);
      return 'bajado';
    }
  }

  function bajar(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bubba-golpe.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sin esto el blob queda en memoria hasta que se cierre la pestaña.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  return { compartir: compartir, golpe: golpe, mensaje: mensaje, tarjeta: tarjeta };
})();
