/* ============================================================
   MOTOR / PROVEEDOR EXTERNO — juegos servidos en un iframe.

   Es el mismo patrón que usa cualquier casino real: los juegos de
   los proveedores no viven adentro del sitio, se embeben en un
   iframe y se comunican por mensajes. Acá pasa lo mismo con los
   juegos propios de Bubba hechos aparte (Maverick, Se Busca).

   ---------------------------------------------------------------
   LA BILLETERA ES UNA SOLA: LA DE BUBBA
   ---------------------------------------------------------------
   El juego resuelve la ronda con su matemática, pero NO tiene
   saldo. Para cada giro le pide permiso a este módulo:

     juego → 'debit'   ¿me cobrás 20 fichas?   → MC.canBet + MC.addBalance
     juego → 'settle'  gané 350, registrala    → MC.addBalance + MC.recordRound

   Ese único MC.recordRound() es lo que engancha gratis el
   historial del lobby, las estadísticas, la XP, el rango VIP y las
   misiones diarias — igual que cualquier juego de la casa.

   ---------------------------------------------------------------
   SEGURIDAD
   ---------------------------------------------------------------
   El juego se sirve desde ESTA MISMA carpeta, así que el origen es
   el mismo y la validación es una comparación estricta contra
   location.origin. Un mensaje de cualquier otro lado se descarta
   sin mirarlo.

   Requiere servidor http (no file://). Ver el README.

   ---------------------------------------------------------------
   PARA SUMAR OTRO JUEGO EXTERNO
   ---------------------------------------------------------------
   Una entrada en catalog.js con engine: 'proveedor' y su frameUrl.
   Nada más: este motor no conoce ningún juego en particular.
   ============================================================ */
window.MCProveedor = (function () {
  'use strict';

  var CHANNEL = 'bubba-rgs';
  var VERSION = 1;

  var el = {};
  var actual = null;      // entrada del catálogo abierta
  var jugando = false;    // el juego avisa si hay una ronda en curso
  var cargado = false;

  /* ---------------- respuesta al iframe ---------------- */
  function responder(id, ok, motivo) {
    if (!el.frame || !el.frame.contentWindow) return;
    el.frame.contentWindow.postMessage({
      ch: CHANNEL,
      v: VERSION,
      id: id,
      ok: ok !== false,
      balance: MC.getBalance(),
      reason: motivo || ''
    }, location.origin);
  }

  /* ---------------- mensajes del juego ---------------- */
  function onMessage(ev) {
    // Mismo origen o no es asunto nuestro.
    if (ev.origin !== location.origin) return;
    var d = ev.data;
    if (!d || d.ch !== CHANNEL || d.v !== VERSION || typeof d.id !== 'number') return;
    // Sólo escuchamos al iframe que está abierto.
    if (!el.frame || ev.source !== el.frame.contentWindow) return;

    switch (d.type) {
      case 'hello':
        ocultarCargando();
        responder(d.id, true);
        break;

      case 'balance':
        responder(d.id, true);
        break;

      case 'debit':
        // La billetera manda: si no alcanza, el juego no gira.
        if (!MC.canBet(d.amount)) {
          responder(d.id, false, 'Saldo insuficiente');
          MC.toast('No te alcanzan las fichas. Pedí el bono.', 'lose');
          break;
        }
        MC.addBalance(-d.amount);
        responder(d.id, true);
        break;

      case 'settle':
        if (d.returned > 0) MC.addBalance(d.returned);
        // El punto único de entrada: historial, estadísticas, XP y misiones.
        MC.recordRound(d.staked, d.returned, d.detail || '');
        responder(d.id, true);
        break;

      case 'busy':
        jugando = !!d.value;
        responder(d.id, true);
        break;

      default:
        responder(d.id, false, 'mensaje desconocido');
    }
  }

  /* ---------------- pantalla de carga ---------------- */
  function mostrarCargando(nombre) {
    cargado = false;
    el.loader.textContent = 'Cargando ' + nombre + '…';
    el.loader.classList.remove('oculto');
  }

  function ocultarCargando() {
    cargado = true;
    el.loader.classList.add('oculto');
  }

  /* ---------------- ciclo de vida ---------------- */
  function load(meta) {
    actual = meta;
    jugando = false;
    mostrarCargando(meta.name);

    // `wallet=parent` es lo que le dice al juego que use la billetera de
    // Bubba en vez de la suya propia.
    var sep = meta.frameUrl.indexOf('?') === -1 ? '?' : '&';
    el.frame.src = meta.frameUrl + sep + 'wallet=parent';
  }

  // Al salir se descarga el iframe. Sin esto el juego sigue corriendo
  // detrás del lobby: música sonando y animaciones comiendo batería.
  function unload() {
    el.frame.removeAttribute('src');
    actual = null;
    jugando = false;
    cargado = false;
  }

  function init() {
    el.frame = document.getElementById('provFrame');
    el.loader = document.getElementById('provLoader');
    if (!el.frame) return;

    window.addEventListener('message', onMessage);

    // No se puede salir con los rodillos girando: la ronda ya se cobró.
    MC.guard('proveedor', function () { return jugando; });
    MC.onLeave('proveedor', unload);

    MC.registerEngine('proveedor', { load: load });
  }

  return { init: init };
})();
