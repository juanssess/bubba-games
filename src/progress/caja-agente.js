/* ============================================================
   PROGRESO / CAJA DEL AGENTE — el agente deja de imprimir fichas.

   Hasta ahora "Cargar" creaba fichas de la nada. Eso alcanzaba para
   ver la mecánica, pero convertía al agente en un botón mágico: sin
   límite no hay decisión, y sin decisión no hay oficio.

   Ahora el agente tiene una caja:

     - Arranca con un flotante.
     - Cargarle a un jugador SALE de su caja. Sin saldo, no carga.
     - Descontarle a un jugador VUELVE a su caja.
     - Cobra comisión sobre el netwin de sus jugadores.

   ---------------------------------------------------------------
   LA COMISIÓN, Y POR QUÉ NO SE PUEDE COBRAR DOS VECES
   ---------------------------------------------------------------
   Se calcula sobre el netwin de toda la vida de sus jugadores:

       disponible = netwinTotal × COMISION − yaCobrado

   No se acumula sumando de a poco, que es donde aparecen los
   desfasajes. Se calcula siempre desde el total y se le resta lo
   ya pagado, así que la cuenta se puede rehacer desde cero en
   cualquier momento y da lo mismo.

   Si los jugadores tienen una buena racha el netwin baja, y el
   disponible puede quedar negativo: se muestra cero y no se le
   saca nada a nadie. Cuando el netwin vuelve a subir, el
   disponible vuelve solo. No hay forma de cobrar dos veces lo
   mismo porque la resta lo impide.

   La base es `stats` y no el diario: stats es de toda la vida y no
   se poda. Si la base se podara a 90 días, la comisión ya cobrada
   quedaría "sin respaldo" y el disponible se iría a negativo solo
   con que pase el tiempo.

   Depende de: state, auth, roles.
   ============================================================ */
window.MCCajaAgente = (function () {
  'use strict';

  var FLOTANTE = 500000;   // con lo que arranca un agente
  var COMISION = 0.03;     // 3% del netwin de sus jugadores

  function datos() {
    if (!MC.state.cajaAgente) {
      MC.state.cajaAgente = {
        saldo: FLOTANTE,
        entregado: 0,       // neto puesto en manos de jugadores
        comisionCobrada: 0
      };
    }
    return MC.state.cajaAgente;
  }

  function saldo() { return Math.floor(datos().saldo); }
  function entregado() { return Math.floor(datos().entregado); }

  /**
   * Netwin de la casa acumulado por los jugadores, de toda la vida.
   *
   * stats.net es el neto DEL JUGADOR (devuelto − apostado). El de la
   * casa es el mismo número al revés, por eso el signo cambiado.
   */
  function netwinTotal() {
    var t = 0;
    MC.auth.all().forEach(function (u) {
      if (MCRoles.esAgente(u)) return;
      var st = (u.uid === MC.auth.current().uid)
        ? MC.state : MC.auth.leerEstado(u.uid);
      if (st && st.stats) t += -(st.stats.net || 0);
    });
    return t;
  }

  function comisionDisponible() {
    var d = datos();
    return Math.max(0, Math.floor(netwinTotal() * COMISION - d.comisionCobrada));
  }

  /** ¿Alcanza la caja para cargar este monto? */
  function alcanza(monto) { return monto <= 0 || datos().saldo >= monto; }

  /**
   * Registra que salieron (delta>0) o volvieron (delta<0) fichas.
   * Devuelve false si no alcanzaba, y en ese caso no toca nada.
   */
  function mover(delta) {
    var d = datos();
    if (delta > 0 && d.saldo < delta) return false;
    d.saldo -= delta;
    d.entregado += delta;
    MC.save();
    return true;
  }

  function cobrarComision() {
    var disp = comisionDisponible();
    if (disp <= 0) return 0;
    var d = datos();
    d.comisionCobrada += disp;
    d.saldo += disp;
    MC.save();
    return disp;
  }

  function init() {
    if (MCRoles.activoEsAgente()) datos();
  }

  return {
    init: init, datos: datos, saldo: saldo, entregado: entregado,
    netwinTotal: netwinTotal, comisionDisponible: comisionDisponible,
    alcanza: alcanza, mover: mover, cobrarComision: cobrarComision,
    FLOTANTE: FLOTANTE, COMISION: COMISION
  };
})();
