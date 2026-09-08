/* ============================================================
   NÚCLEO / TEMA — claro, oscuro, o el que use tu máquina.

   Tres estados y no dos. "Claro y oscuro" con un interruptor de dos
   posiciones obliga a elegir uno de entrada, y la mayoría de la
   gente ya eligió: lo tiene puesto en el sistema operativo. El
   tercer estado —"como el sistema"— es el que respeta esa decisión
   en vez de pedirla otra vez.

   ---------------------------------------------------------------
   POR QUÉ SE APLICA ANTES DE QUE PINTE LA PÁGINA
   ---------------------------------------------------------------
   Este archivo se carga en el <head>, antes que el resto. Si se
   aplicara después, con el casino ya dibujado, quien tiene el tema
   claro vería el fondo negro por una fracción de segundo y después
   el cambio de golpe. Ese destello es la marca de que el tema se
   pegó encima en vez de estar pensado.

   Por eso no depende de MC.state: el estado del jugador se carga
   más tarde. Lee su propia clave de localStorage, que es lo único
   disponible tan temprano.

   ---------------------------------------------------------------
   LAS MESAS DE JUEGO NO CAMBIAN
   ---------------------------------------------------------------
   Un paño de casino es verde con la luz que sea, y una ruleta es
   roja y negra. Forzarlas al tema claro las volvería otra cosa.
   Cambia el mueble, no el juego.

   Depende de: nada.
   ============================================================ */
window.MCTema = (function () {
  'use strict';

  var CLAVE = 'bubba_tema';
  var VALIDOS = ['sistema', 'claro', 'oscuro'];

  function leer() {
    try {
      var v = localStorage.getItem(CLAVE);
      return VALIDOS.indexOf(v) > -1 ? v : 'sistema';
    } catch (e) {
      return 'sistema';
    }
  }

  /**
   * Escribe el atributo en <html>.
   *
   * En 'sistema' el atributo se SACA en vez de ponerse en algo: así la
   * consulta `prefers-color-scheme` de tokens.css decide, y no hay un
   * valor nuestro compitiendo con el del navegador.
   */
  function aplicar(v) {
    var raiz = document.documentElement;
    if (v === 'claro' || v === 'oscuro') raiz.setAttribute('data-tema', v);
    else raiz.removeAttribute('data-tema');

    // Para que la barra del navegador en el celular acompañe.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', esClaro() ? '#efe7da' : '#0a0706');
  }

  /** El tema que efectivamente se está viendo, resuelto. */
  function esClaro() {
    var v = leer();
    if (v === 'claro') return true;
    if (v === 'oscuro') return false;
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    } catch (e) {
      return false;
    }
  }

  function poner(v) {
    if (VALIDOS.indexOf(v) === -1) return;
    try { localStorage.setItem(CLAVE, v); } catch (e) {}
    aplicar(v);
    escuchar.forEach(function (fn) { fn(v); });
  }

  var escuchar = [];
  function alCambiar(fn) { escuchar.push(fn); }

  // Se aplica YA, no en un init: para eso está cargado en el head.
  aplicar(leer());

  // Si está en 'sistema' y el sistema cambia, el casino acompaña sin
  // recargar. Es el caso del que tiene el tema atado al horario.
  try {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var alSistema = function () {
      if (leer() !== 'sistema') return;
      aplicar('sistema');
      escuchar.forEach(function (fn) { fn('sistema'); });
    };
    if (mq.addEventListener) mq.addEventListener('change', alSistema);
    else if (mq.addListener) mq.addListener(alSistema);
  } catch (e) {}

  return { leer: leer, poner: poner, esClaro: esClaro, alCambiar: alCambiar, VALIDOS: VALIDOS };
})();
