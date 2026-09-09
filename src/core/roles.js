/* ============================================================
   NÚCLEO / ROLES — jugador y agente son dos oficios distintos.

   Hasta ahora una sola cuenta veía todo junto: apostaba, cobraba
   bonos, subía de nivel Y además tenía el panel para cargarle
   fichas a los demás. Mezclado no se entiende ninguno de los dos.

   Ahora cada perfil es una cosa o la otra:

     JUGADOR   apuesta, cobra bonos, hace misiones, sube de VIP,
               entra al ranking y juega por el bote.
               No ve el panel de agente ni los datos de nadie más.

     AGENTE    carga y descuenta fichas, mira el movimiento de sus
               jugadores y cobra comisión.
               NO apuesta. No tiene misiones, ni bono, ni VIP, ni
               bote, ni aparece en la tabla de posiciones.

   ---------------------------------------------------------------
   POR QUÉ EL AGENTE NO PUEDE APOSTAR
   ---------------------------------------------------------------
   Es quien crea las fichas. Si además pudiera jugarlas, el bote,
   el ranking y las estadísticas dejarían de significar algo: nada
   distingue una ficha ganada de una que se acreditó a sí mismo.
   Separarlo no es una restricción, es lo que hace que los números
   del jugador sigan queriendo decir algo.

   ---------------------------------------------------------------
   HASTA DÓNDE LLEGA ESTA SEPARACIÓN — IMPORTANTE
   ---------------------------------------------------------------
   El rol vive en el almacenamiento de este navegador, igual que
   todo lo demás. Cualquiera que abra las herramientas de desarrollo
   puede cambiarlo. O sea: esto separa DOS USOS, no es una barrera
   de seguridad.

   Y no puede serlo. Un permiso sólo es real cuando lo verifica algo
   que el usuario no controla, y acá no hay servidor propio: el
   casino corre entero en la máquina del que lo abre. Poner una
   contraseña le daría una sensación de resguardo que el código no
   puede sostener, así que no se pone y se dice por qué.

   El día que haya servidor, este módulo es el lugar donde el rol
   pasa a leerse de la sesión verificada y el resto del casino no
   se entera del cambio.

   Depende de: nada. Lo consultan auth, wallet, shell y agente.
   ============================================================ */
window.MCRoles = (function () {
  'use strict';

  var JUGADOR = 'jugador';
  var AGENTE = 'agente';

  /** El rol de un perfil. Todo lo que no diga "agente" es jugador. */
  function rol(u) {
    return u && u.rol === AGENTE ? AGENTE : JUGADOR;
  }

  function esAgente(u) { return rol(u) === AGENTE; }

  function activoEsAgente() {
    return MC.auth ? esAgente(MC.auth.current()) : false;
  }

  /**
   * Motivo por el que este perfil no puede apostar, o null si puede.
   * Devuelve el texto y no un booleano para que quien lo consulte
   * pueda explicar el porqué en vez de fallar en silencio.
   */
  function bloqueaApuesta(u) {
    if (!esAgente(u || (MC.auth && MC.auth.current()))) return null;
    return 'Las cuentas de agente no apuestan. Entrá con una cuenta de jugador.';
  }

  /* ---------------- qué ve cada uno ---------------- */
  // Los ids de la barra lateral que son sólo de un rol. Tenerlos acá
  // junto evita que agregar una sección mañana se olvide del rol.
  var SOLO_JUGADOR = [
    'sbRanking', 'sbTorneo', 'sbMissions', 'sbCajero', 'sbVip', 'sbStats',
    // De la barra de arriba: el saldo y el cajero son del que juega.
    // Un agente con "Saldo 5.000" y un boton de Cajero invita a apostar
    // justo a la cuenta que no puede hacerlo.
    'walletBox', 'depositBtn'
  ];
  var SOLO_AGENTE = ['sbAgente'];

  function mostrar(id, si) {
    var el = document.getElementById(id);
    if (el) el.hidden = !si;
  }

  /**
   * Acomoda la interfaz al rol del perfil activo. La llama el arranque
   * y cualquier cambio de perfil.
   */
  function aplicar() {
    var agente = activoEsAgente();

    SOLO_JUGADOR.forEach(function (id) { mostrar(id, !agente); });
    SOLO_AGENTE.forEach(function (id) { mostrar(id, agente); });

    // El bote es del jugador: lo alimenta lo que apuesta él.
    var bote = document.getElementById('sbJackpot');
    if (bote) bote.hidden = agente;

    // El nivel VIP tampoco corre para el agente.
    var nivel = document.getElementById('sbLevel');
    if (nivel) nivel.hidden = agente;

    document.body.classList.toggle('es-agente', agente);
    pintarAviso();

    // Si quedó parado en una vista que su rol no puede ver, vuelve al
    // salón en vez de mostrarle una pantalla vacía.
    var vista = document.querySelector('.view.active');
    if (vista && !puedeVer(vista.id.replace('view-', ''))) MC.showView('lobby');
  }

  /** Vistas cerradas por rol. El resto está abierto para los dos. */
  var VISTAS = {
    agente: AGENTE,
    ranking: JUGADOR,
    torneo: JUGADOR,
    missions: JUGADOR,
    cajero: JUGADOR,
    vip: JUGADOR,
    // El agente no juega: sus estadisticas son las del panel, no estas.
    stats: JUGADOR
  };

  function puedeVer(vista) {
    var pide = VISTAS[vista];
    if (!pide) return true;
    return rol(MC.auth && MC.auth.current()) === pide;
  }

  /**
   * Aviso fijo en el salón para el agente. No se le esconden los juegos
   * (mirar el catálogo es parte de su trabajo), pero tiene que quedar
   * claro de entrada por qué no puede jugarlos: descubrirlo recién al
   * apretar "girar" sería una sorpresa fea.
   */
  function pintarAviso() {
    var lobby = document.getElementById('view-lobby');
    if (!lobby) return;
    var el = document.getElementById('avisoAgente');

    if (!activoEsAgente()) { if (el) el.remove(); return; }
    if (el) return;

    el = document.createElement('div');
    el.id = 'avisoAgente';
    el.className = 'aviso-agente';
    el.innerHTML =
      '<span class="aa-ico">🗂️</span>' +
      '<div><strong>Estás como agente</strong>' +
      '<span>Podés mirar el catálogo, pero las cuentas de agente no apuestan. ' +
      'Para jugar, cambiá a tu cuenta de jugador.</span></div>' +
      '<button class="btn btn-ghost" id="aaPanel">Ir al panel</button>';
    lobby.insertBefore(el, lobby.firstChild);
    var b = document.getElementById('aaPanel');
    if (b) b.onclick = function () { MCAgente.open(); };
  }

  function init() {
    aplicar();
    if (MC.auth && MC.auth.onChange) MC.auth.onChange(aplicar);

    // El agente entra a trabajar: su pantalla de arranque es el panel.
    if (activoEsAgente() && window.MCAgente) MCAgente.open();
  }

  return {
    init: init, aplicar: aplicar,
    rol: rol, esAgente: esAgente, activoEsAgente: activoEsAgente,
    bloqueaApuesta: bloqueaApuesta, puedeVer: puedeVer,
    JUGADOR: JUGADOR, AGENTE: AGENTE
  };
})();
