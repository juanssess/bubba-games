/* ============================================================
   PROGRESO / BOTE BUBBA — el pozo progresivo, ganable de verdad.

   Antes el bote era un número que subía y nadie podía ganar. En un
   casino donde todos los RTP están calculados sobre la tabla real,
   tener un pozo decorativo desentonaba.

   ---------------------------------------------------------------
   LA MATEMÁTICA, Y POR QUÉ CIERRA SOLA
   ---------------------------------------------------------------
   Cada ronda aporta el 1% de lo apostado al pozo:

       pozo += apostado × 0,01

   Y la probabilidad de ganarlo en esa ronda es:

       p = (apostado × 0,01) / pozo

   El retorno esperado por ronda es entonces:

       p × pozo = apostado × 0,01

   ...exactamente lo que aportaste. El bote devuelve el 1% de lo
   apostado, ni más ni menos, sin importar cómo apuestes ni cuán
   grande esté el pozo. No hay forma de jugarlo a favor ni en
   contra: apostar fuerte no mejora tu retorno, sólo adelanta el
   momento.

   Y como el pozo crece, ganarlo se hace más raro en la misma
   proporción — que es exactamente cómo funciona un progresivo de
   verdad.

   ---------------------------------------------------------------
   ES TU POZO
   ---------------------------------------------------------------
   Se alimenta de lo que apostás vos y se guarda con tu progreso.
   No es un pozo compartido entre jugadores: para eso haría falta
   que todos escribieran en el mismo lugar, y eso en un sitio sin
   servidor propio es imposible de hacer sin que cualquiera lo
   pueda alterar. Así que se dice lo que es.

   Depende de: state, wallet, format, ui, rng.
   ============================================================ */
window.MCBote = (function () {
  'use strict';

  var BASE = 250000;          // arranque del pozo
  var APORTE = 0.01;          // 1% de lo apostado
  var MINIMO_APUESTA = 10;    // apuestas más chicas no participan

  function datos() {
    if (!MC.state.bote) {
      MC.state.bote = { pozo: BASE, ganados: 0, ultimo: 0 };
    }
    // Cuentas viejas: el pozo se reconstruye de lo ya apostado, para que
    // nadie arranque de cero por haber jugado antes de que esto existiera.
    if (MC.state.bote.pozo === undefined) {
      MC.state.bote.pozo = BASE + Math.floor((MC.state.stats.wagered || 0) * APORTE);
    }
    return MC.state.bote;
  }

  function pozo() { return Math.floor(datos().pozo); }

  /** 1 en cuántas rondas, con esta apuesta y el pozo actual. */
  function unoEnCuantas(apuesta) {
    var p = probabilidad(apuesta);
    return p > 0 ? Math.round(1 / p) : Infinity;
  }

  function probabilidad(apuesta) {
    if (apuesta < MINIMO_APUESTA) return 0;
    var d = datos();
    if (d.pozo <= 0) return 0;
    return (apuesta * APORTE) / d.pozo;
  }

  /**
   * Se llama en el cierre de cada ronda, desde la billetera.
   * Devuelve el premio si tocó, o 0.
   *
   * ORDEN IMPORTANTE: primero se sortea contra el pozo que había cuando
   * se hizo la apuesta, y recién después se suma el aporte. Al revés, tu
   * propio aporte te empeoraría la chance de esa misma ronda.
   */
  function ronda(apostado) {
    if (!apostado || apostado < MINIMO_APUESTA) return 0;
    var d = datos();

    var gano = MC.rand() < probabilidad(apostado);
    d.pozo += apostado * APORTE;

    if (!gano) return 0;

    var premio = Math.floor(d.pozo);
    d.pozo = BASE;
    d.ganados += 1;
    d.ultimo = premio;

    // El pago lo hace la billetera después, para que quede registrado en
    // la misma ronda; acá sólo se resuelve y se avisa.
    setTimeout(function () {
      MC.sound.jackpot();
      MC.modal('¡GANASTE EL BOTE BUBBA!',
        '<p style="font-size:32px;color:var(--gold);margin:6px 0">' +
        MC.fmt(premio) + ' fichas</p>' +
        '<p>Cayó con una probabilidad de 1 en ' +
        MC.fmt(Math.round(1 / probabilidadCon(apostado, premio))) + '. ' +
        'El pozo vuelve a ' + MC.fmt(BASE) + ' y arranca de nuevo.</p>',
        [{ label: 'Impresionante', kind: 'primary' }]);
    }, 350);

    return premio;
  }

  /** La probabilidad que tenía esa ronda, para poder contarla después. */
  function probabilidadCon(apuesta, pozoQueHabia) {
    return (apuesta * APORTE) / pozoQueHabia;
  }

  function init() {
    datos();
  }

  return {
    init: init, ronda: ronda, pozo: pozo,
    probabilidad: probabilidad, unoEnCuantas: unoEnCuantas,
    BASE: BASE, APORTE: APORTE, MINIMO_APUESTA: MINIMO_APUESTA
  };
})();
