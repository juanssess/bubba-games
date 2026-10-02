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

   Los perfiles locales usan esa clave. Las cuentas de Google usan
   peticiones-nube.js: pedidos e historial compartidos en Firestore.
   Un error de conexion nunca convierte un pedido online en uno local.

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
  var proveedorNube = null;

  function usaNube() {
    var u = MC.auth.current();
    return MC.auth.esRemoto(u);
  }
  function nube() { return usaNube() ? proveedorNube : null; }
  function noConectado() { return Promise.resolve({ error: 'Los pedidos todavia no estan conectados. Intenta de nuevo en unos segundos.' }); }

  function leer() {
    if (usaNube()) return proveedorNube && proveedorNube.disponible() ? proveedorNube.todas(Number.MAX_SAFE_INTEGER) : [];
    try {
      var raw = localStorage.getItem(CLAVE);
      var l = raw ? JSON.parse(raw) : [];
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }

  function escribir(l) {
    var pendientes = l.filter(function (p) { return p.estado === 'pendiente'; });
    var resueltas = l.filter(function (p) { return p.estado !== 'pendiente'; });
    var conservar = pendientes.concat(resueltas.slice(0, Math.max(0, MAX - pendientes.length)));
    conservar.sort(function (a, b) { return b.at - a.at; });
    try {
      localStorage.setItem(CLAVE, JSON.stringify(conservar));
      return true;
    } catch (e) { return false; }
  }

  function id() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------------- del lado del jugador ---------------- */

  /* ¿Este pedido es del perfil activo?
     Hay que mirar las dos formas del uid porque los pedidos guardados
     en este navegador llevan el del PERFIL ('google:abc') y los que
     vienen de la nube llevan el de Firebase pelado ('abc'). Ver
     MC.auth.uidFirebase, que es el único lugar que conoce esa
     diferencia. */
  function esMio(p, u) {
    return p.uid === u.uid || p.uid === MC.auth.uidFirebase(u);
  }

  /** El pedido pendiente del perfil activo, si tiene uno. */
  function miPendiente() {
    var u = MC.auth.current();
    if (!u) return null;
    var l = leer();
    for (var i = 0; i < l.length; i++) {
      if (esMio(l[i], u) && l[i].estado === 'pendiente') return l[i];
    }
    return null;
  }

  /** Los últimos pedidos del perfil activo, resueltos incluidos. */
  function mios(tope) {
    var u = MC.auth.current();
    if (!u) return [];
    return leer().filter(function (p) { return esMio(p, u); }).slice(0, tope || 10);
  }

  /**
   * Crea un pedido. Devuelve { ok } o { error } con el motivo.
   *
   * Uno por vez: si el jugador pudiera encolar diez, el agente
   * tendria que ir descartandolos a mano y el pedido dejaria de
   * querer decir algo.
   */
  function pedir(monto, nota) {
    if (usaNube()) {
      if (!proveedorNube) return noConectado();
      return proveedorNube.pedir(monto, nota).catch(function (e) { return { error: e.message }; });
    }
    var u = MC.auth.current();
    if (!u) return { error: 'No hay una cuenta activa.' };
    if (MCRoles.esAgente(u)) return { error: 'Un agente no se pide fichas a sí mismo.' };

    monto = Math.floor(Number(monto) || 0);
    if (!Number.isSafeInteger(monto)) return { error: 'Ingresa un monto valido.' };
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
    if (!escribir(l)) return { error: 'No se pudo guardar el pedido. Intenta de nuevo.' };
    return { ok: true };
  }

  /** El jugador se arrepiente antes de que le contesten. */
  function cancelar(pid) {
    if (usaNube()) {
      if (!proveedorNube) return Promise.reject(new Error('Los pedidos todavia no estan conectados.'));
      return proveedorNube.resolver(pid, 'cancelada');
    }
    var u = MC.auth.current();
    if (!u) return false;
    var l = leer(), toco = false;
    l.forEach(function (p) {
      if (p.id === pid && p.uid === u.uid && p.estado === 'pendiente') {
        p.estado = 'cancelada'; p.resueltaAt = Date.now(); toco = true;
      }
    });
    return toco && escribir(l);
  }

  /* ---------------- del lado del agente ---------------- */

  function pendientes() {
    return leer().filter(function (p) { return p.estado === 'pendiente'; });
  }

  function todas(tope) { return leer().slice(0, tope || 40); }

  /** Marca una petición. El movimiento de fichas lo hace el panel. */
  function resolver(pid, estado, motivo) {
    if (usaNube()) {
      if (!proveedorNube) return Promise.reject(new Error('Los pedidos todavia no estan conectados.'));
      return proveedorNube.resolver(pid, estado);
    }
    if (!MCRoles.activoEsAgente() || ['aceptada', 'rechazada'].indexOf(estado) === -1) return null;
    var l = leer(), encontrada = null;
    l.forEach(function (p) {
      if (p.id === pid && p.estado === 'pendiente') {
        p.estado = estado;
        p.resueltaAt = Date.now();
        if (motivo) p.motivo = String(motivo).slice(0, 80);
        encontrada = p;
      }
    });
    return encontrada && escribir(l) ? encontrada : null;
  }

  return {
    pedir: pedir, cancelar: cancelar, miPendiente: miPendiente, mios: mios,
    pendientes: pendientes, todas: todas, resolver: resolver,
    MIN: MIN, MAXIMO: MAXIMO,
    usaNube: usaNube, nube: nube, attachNube: function (p) { proveedorNube = p; }
  };
})();
