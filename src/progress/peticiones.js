/* ============================================================
   PROGRESO / PETICIONES — el jugador pide, el agente resuelve.

   Hasta ahora las fichas iban en un solo sentido: el agente
   empujaba y el jugador esperaba. Faltaba la mitad del circuito,
   que además es la que se usa todos los días.

       El jugador pide  →  al agente le llega  →  acepta o rechaza
                        →  si acepta, las fichas salen de SU caja
                        →  y queda asentado en el libro

   ---------------------------------------------------------------
   POR QUÉ NO VIVEN EN EL ESTADO DE NADIE
   ---------------------------------------------------------------
   Una petición tiene que ser escrita por un perfil y leída por
   otro. El estado es por perfil: si viviera adentro del jugador, el
   agente no la vería, y al revés. Así que van en su propia clave,
   compartida por todos los perfiles de este navegador.

   Es el mismo alcance que todo lo demás: este dispositivo. Un
   jugador en otro teléfono no le puede pedir nada a este agente, y
   no hay forma de que pueda sin un servidor en el medio. Se dice
   en pantalla en vez de dar a entender otra cosa.

   ---------------------------------------------------------------
   POR QUÉ LAS RESUELTAS NO SE BORRAN
   ---------------------------------------------------------------
   Un pedido rechazado es justamente el que alguien va a querer
   revisar después. Se quedan, marcadas, hasta que el tope las
   empuja afuera.

   Depende de: auth. Lo usan el cajero (jugador) y el panel (agente).
   ============================================================ */
window.MCPeticiones = (function () {
  'use strict';

  var CLAVE = 'bubba_peticiones_v1';
  var MAX = 120;
  var MIN = 100;
  var MAXIMO = 500000;

  function leer() {
    try {
      var raw = localStorage.getItem(CLAVE);
      var l = raw ? JSON.parse(raw) : [];
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }

  function escribir(l) {
    try { localStorage.setItem(CLAVE, JSON.stringify(l.slice(0, MAX))); } catch (e) {}
  }

  function id() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------------- del lado del jugador ---------------- */

  /** El pedido pendiente del perfil activo, si tiene uno. */
  function miPendiente() {
    var u = MC.auth.current();
    if (!u) return null;
    var l = leer();
    for (var i = 0; i < l.length; i++) {
      if (l[i].uid === u.uid && l[i].estado === 'pendiente') return l[i];
    }
    return null;
  }

  /** Los últimos pedidos del perfil activo, resueltos incluidos. */
  function mios(tope) {
    var u = MC.auth.current();
    if (!u) return [];
    return leer().filter(function (p) { return p.uid === u.uid; }).slice(0, tope || 10);
  }

  /**
   * Crea un pedido. Devuelve { ok } o { error } con el motivo.
   *
   * Uno por vez: si el jugador pudiera encolar diez, el agente
   * tendria que ir descartandolos a mano y el pedido dejaria de
   * querer decir algo.
   */
  function pedir(monto, nota) {
    var u = MC.auth.current();
    if (!u) return { error: 'No hay una cuenta activa.' };
    if (MCRoles.esAgente(u)) return { error: 'Un agente no se pide fichas a sí mismo.' };

    monto = Math.floor(Number(monto) || 0);
    if (monto < MIN) return { error: 'El mínimo es ' + MC.fmt(MIN) + ' fichas.' };
    if (monto > MAXIMO) return { error: 'El máximo por pedido es ' + MC.fmt(MAXIMO) + '.' };
    if (miPendiente()) return { error: 'Ya tenés un pedido esperando respuesta.' };

    var l = leer();
    l.unshift({
      id: id(), at: Date.now(),
      uid: u.uid, nombre: u.name,
      monto: monto, nota: String(nota || '').slice(0, 80),
      estado: 'pendiente'
    });
    escribir(l);
    return { ok: true };
  }

  /** El jugador se arrepiente antes de que le contesten. */
  function cancelar(pid) {
    var u = MC.auth.current();
    var l = leer(), toco = false;
    l.forEach(function (p) {
      if (p.id === pid && p.uid === u.uid && p.estado === 'pendiente') {
        p.estado = 'cancelada'; p.resueltaAt = Date.now(); toco = true;
      }
    });
    if (toco) escribir(l);
    return toco;
  }

  /* ---------------- del lado del agente ---------------- */

  function pendientes() {
    return leer().filter(function (p) { return p.estado === 'pendiente'; });
  }

  function todas(tope) { return leer().slice(0, tope || 40); }

  /** Marca una petición. El movimiento de fichas lo hace el panel. */
  function resolver(pid, estado, motivo) {
    var l = leer(), encontrada = null;
    l.forEach(function (p) {
      if (p.id === pid && p.estado === 'pendiente') {
        p.estado = estado;
        p.resueltaAt = Date.now();
        if (motivo) p.motivo = String(motivo).slice(0, 80);
        encontrada = p;
      }
    });
    if (encontrada) escribir(l);
    return encontrada;
  }

  return {
    pedir: pedir, cancelar: cancelar, miPendiente: miPendiente, mios: mios,
    pendientes: pendientes, todas: todas, resolver: resolver,
    MIN: MIN, MAXIMO: MAXIMO
  };
})();
