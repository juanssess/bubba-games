/* ============================================================
   PROGRESO / CAJA — el libro de movimientos del agente.

   Hasta ahora el agente cargaba y descontaba fichas y no quedaba
   rastro de nada. Un panel que mueve saldos sin registro no sirve
   ni para revisar un error propio: "¿le cargué o no le cargué?" no
   tenía respuesta en ningún lado.

   Cada movimiento queda anotado con lo mínimo para reconstruirlo:

       { at, uid, nombre, delta, saldo }

   `nombre` se guarda AL MOMENTO, aunque se pueda sacar del uid.
   Si el jugador se renombra después, el asiento tiene que seguir
   diciendo a quién se le cargó ese día. Un registro que se reescribe
   solo cuando cambian los datos de al lado no es un registro.

   `saldo` es cómo quedó la cuenta después del movimiento. Sirve
   para leer el libro sin tener que ir sumando desde el principio.

   ---------------------------------------------------------------
   DÓNDE VIVE
   ---------------------------------------------------------------
   En el estado del AGENTE, no en el del jugador. Es su libro: lo
   que él hizo. Y así el jugador no puede tocarlo desde su cuenta.

   Con la salvedad de siempre: todo esto es localStorage y no hay
   servidor. Es un registro para trabajar, no una prueba ante nadie.

   Depende de: state, auth. Lo llama el panel de agente.
   ============================================================ */
window.MCCaja = (function () {
  'use strict';

  var MAX = 250;

  function libro() {
    if (!Array.isArray(MC.state.caja)) MC.state.caja = [];
    return MC.state.caja;
  }

  /**
   * Anota un movimiento. `delta` positivo carga, negativo descuenta.
   * `saldo` es como quedo el jugador despues.
   */
  function registrar(uid, nombre, delta, saldo) {
    if (!delta) return;
    var l = libro();
    l.unshift({
      at: Date.now(),
      uid: uid,
      nombre: nombre || '(sin nombre)',
      delta: delta,
      saldo: saldo
    });
    if (l.length > MAX) l.length = MAX;
    MC.save();
  }

  /** Todos los movimientos, del más nuevo al más viejo. */
  function movimientos() { return libro().slice(); }

  /** Los de un período. `desde`/`hasta` son ms; sin ellos, todos. */
  function enRango(desde, hasta) {
    return libro().filter(function (m) {
      if (desde && m.at < desde) return false;
      if (hasta && m.at > hasta) return false;
      return true;
    });
  }

  /** Cuánto se cargó y cuánto se descontó en un período. */
  function resumen(desde, hasta) {
    var r = { cargado: 0, descontado: 0, movimientos: 0 };
    enRango(desde, hasta).forEach(function (m) {
      r.movimientos++;
      if (m.delta > 0) r.cargado += m.delta;
      else r.descontado += -m.delta;
    });
    return r;
  }

  return {
    registrar: registrar, movimientos: movimientos,
    enRango: enRango, resumen: resumen, MAX: MAX
  };
})();
