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

  /* ============================================================
     EL RETORNO DE LA CASA EN UN JUEGO QUE NO ES NUESTRO

     En las ocho mesas de la casa el factor entra donde el juego
     expresa su ventaja, antes de que el número llegue a la pantalla.
     Acá no se puede: la matemática está compilada en otro proyecto.

     Así que se hacen las dos cosas que sí se pueden:

       1. SE LE PASA EL FACTOR AL JUEGO, por la URL (`rtp=0.85`) y en
          la respuesta al saludo. Un juego que lo soporte lo aplica a
          su propia tabla, contesta `hello` con `rtp: true`, y
          entonces no hay ninguna diferencia entre lo que muestra y
          lo que cobra. Ese es el final bueno.

       2. MIENTRAS NO LO SOPORTE, el casino recorta al acreditar y lo
          DICE en pantalla, arriba del juego. Es un parche y se
          presenta como un parche: el juego va a mostrar "x40" y la
          caja va a acreditar x34.

     Lo que no se hace es recortar en silencio. Un casino que te
     muestra un premio y te acredita otro, sin avisar, es exactamente
     lo que este módulo viene evitando en todas las demás mesas.

     El contrato para el proyecto del juego está en
     docs/retorno-de-la-casa.md.
     ============================================================ */
  var loAplicaElJuego = false;   // ¿el juego dijo que lo aplica él?

  function factor() {
    return actual ? MC.rtp.factor(actual.id) : 1;
  }

  /** ¿Hay que recortar acá porque el juego no lo hace? */
  function recortaLaCaja() {
    return !loAplicaElJuego && Math.abs(factor() - 1) > 0.0005;
  }

  /* ---------------- respuesta al iframe ---------------- */
  function responder(id, ok, motivo) {
    if (!el.frame || !el.frame.contentWindow) return;
    el.frame.contentWindow.postMessage({
      ch: CHANNEL,
      v: VERSION,
      id: id,
      ok: ok !== false,
      balance: MC.getBalance(),
      // El factor viaja en CADA respuesta y no sólo en el saludo: la
      // casa puede moverlo en vivo desde el panel, y un juego que lo
      // aplique tiene que poder enterarse sin que lo recarguen.
      rtp: factor(),
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
        /* El juego declara acá si aplica el factor en su propia tabla.
           Si no dice nada —como los tres bundles de hoy— se asume que
           no, que es la suposición segura: recortar de más se nota y
           se avisa, recortar de menos le regala plata a la casa sin
           que nadie se entere. */
        loAplicaElJuego = d.rtp === true;
        pintarAviso();
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
        /* Si el juego ya aplicó el factor en su tabla, lo que manda
           viene recortado y tocarlo otra vez sería cobrarlo dos
           veces. Si no, se recorta acá. */
        var devuelto = recortaLaCaja()
          ? MC.rtp.fichas(d.returned * factor())
          : d.returned;

        if (devuelto > 0) MC.addBalance(devuelto);
        /* El punto único de entrada: historial, estadísticas, XP y
           misiones. Va lo REALMENTE acreditado: si fuera lo que dijo
           el juego, las estadísticas publicarían un retorno que la
           caja nunca pagó. */
        MC.recordRound(d.staked, devuelto, d.detail || '');
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

  /* ---------------- el aviso del recorte ----------------
     Mientras el juego no aplique el factor él mismo, su pantalla
     muestra los multiplicadores de fábrica y la caja acredita menos.
     Eso se dice acá, arriba del juego, con el número concreto. Sin
     este cartel el casino estaría mostrando un premio y pagando
     otro, que es la mentira que todo el resto de MC.rtp evita. */
  function pintarAviso() {
    if (!el.aviso) return;

    if (!recortaLaCaja()) {
      el.aviso.hidden = true;
      return;
    }
    var k = factor();
    el.aviso.hidden = false;
    el.aviso.innerHTML =
      '<strong>Esta mesa paga el ' + Math.round(k * 100) + '% de lo que muestra.</strong> ' +
      'Los multiplicadores de la pantalla son los de fábrica: el juego corre aparte y ' +
      'todavía no aplica el retorno de la casa, así que el recorte se hace al acreditar. ' +
      'Un premio de 1.000 fichas te deposita ' + MC.fmt(Math.round(1000 * k)) + '.';
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
    /* Se asume que NO lo aplica hasta que el saludo diga lo
       contrario. Si quedara el valor del juego anterior, abrir una
       mesa que sí lo soporta y después una que no dejaría a la
       segunda pagando de más sin aviso. */
    loAplicaElJuego = false;
    mostrarCargando(meta.name);
    pintarAviso();

    /* `wallet=parent` le dice al juego que use la billetera de Bubba en
       vez de la suya. `rtp` le pasa el retorno que la casa publica, para
       que pueda aplicarlo en su propia tabla: ver el contrato arriba. */
    var sep = meta.frameUrl.indexOf('?') === -1 ? '?' : '&';
    el.frame.src = meta.frameUrl + sep + 'wallet=parent&rtp=' + factor();
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
    el.aviso = document.getElementById('provAviso');
    if (!el.frame) return;

    window.addEventListener('message', onMessage);

    // Si la casa mueve el retorno mientras hay una mesa abierta, el
    // cartel se corrige solo: el número que dice tiene que ser el que
    // se va a acreditar, no el que había cuando se abrió el juego.
    MC.rtp.onCambio(pintarAviso);

    // No se puede salir con los rodillos girando: la ronda ya se cobró.
    MC.guard('proveedor', function () { return jugando; });
    MC.onLeave('proveedor', unload);

    MC.registerEngine('proveedor', { load: load });
  }

  return { init: init };
})();
