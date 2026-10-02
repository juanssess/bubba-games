/* ============================================================
   NÚCLEO / JUEGO JUSTO — que cada ronda se pueda recalcular.

   El casino ya publica RTP verificados: `tools/slots5-rtp.js` mide
   la misma matemática que se juega, exacto y por Monte Carlo. Pero
   eso prueba EL JUEGO, no TU RONDA. Si alguien sospecha que el giro
   que acaba de perder salió de otro lado, hoy no tiene con qué
   comprobarlo.

   Esto le da con qué. Cada ronda sale de tres cosas:

       semilla de la casa   un secreto, sorteado al abrir la tanda
       tu semilla           la escribís vos, o se sortea
       número de ronda      arranca en 0 y sube de a uno

   El hash SHA-256 de la semilla de la casa se muestra ANTES de
   apostar. Cuando cerrás la tanda, la semilla se revela: pegás las
   tres cosas en `node tools/verificar-ronda.js` y sale exactamente
   la grilla que viste. Si no sale, algo se tocó.

   ---------------------------------------------------------------
   HASTA DÓNDE LLEGA ESTO — IMPORTANTE
   ---------------------------------------------------------------
   En un casino de verdad el compromiso lo firma un servidor que el
   jugador no controla, y ahí la garantía es fuerte: la casa se ató
   a un resultado antes de saber cuánto ibas a apostar.

   Acá no hay servidor. El casino corre ENTERO en tu máquina, así
   que la "semilla secreta de la casa" está en tu navegador y la
   podés leer cuando quieras. O sea: esto NO prueba que la casa no
   pueda hacer trampa, porque la casa y el programa que corrés sos
   vos mismo.

   Lo que sí da, y no es poco:

     - REPETIBILIDAD. Cualquiera puede recalcular cualquier ronda y
       obtener el mismo resultado. Un bug que cambie los pagos deja
       de ser invisible.
     - A PRUEBA DE REINTENTO. El resultado es una función del nonce.
       El motor no puede tirar, mirar si te conviene y volver a
       tirar: eso rompería la cadena y se ve al verificar.
     - UN ARTEFACTO PARA RECLAMAR. Si algo sale raro, tenés tres
       números con los que cualquiera reproduce el caso.

   Lo que de verdad te protege de que la casa publique otro código
   es que el código es público y el sitio se sirve de ese repo. Eso
   se mira en GitHub, no acá. Prometer más sería vender como
   garantía algo que la arquitectura no sostiene, que es justo lo
   que este casino viene evitando con los RTP.

   ---------------------------------------------------------------
   POR QUÉ NO VIVE EN MC.state
   ---------------------------------------------------------------
   MC.state es el progreso del jugador y se sincroniza con la nube.
   Esto es papelería de verificación de ESTE navegador: no tiene por
   qué viajar entre dispositivos, y mezclarlo haría que una
   sincronía pisara una tanda abierta a mitad de camino.

   Depende de: rng (mulberry32), auth (para separar por perfil).
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var CLAVE = 'bubba.justo';
  var HISTORIAL = 25;        // rondas guardadas para poder verificar
  var TANDAS = 10;           // tandas reveladas que se recuerdan

  var datos = null;
  var alCambiar = [];

  /* ---------------- almacenamiento ---------------- */
  function clave() {
    var u = MC.auth && MC.auth.current ? MC.auth.current() : null;
    return CLAVE + '.' + (u && u.uid ? u.uid : 'invitado');
  }

  function leer() {
    try {
      var raw = localStorage.getItem(clave());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function guardar() {
    try { localStorage.setItem(clave(), JSON.stringify(datos)); }
    catch (e) { /* sin espacio o modo privado: se juega igual */ }
    alCambiar.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function onCambio(fn) { alCambiar.push(fn); }

  /* ---------------- semillas ---------------- */
  // 32 bytes en hexadecimal, del generador del sistema.
  function semillaNueva() {
    var b = new Uint8Array(32);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(b);
    } else {
      for (var i = 0; i < 32; i++) b[i] = Math.floor(Math.random() * 256);
    }
    var s = '';
    for (var j = 0; j < b.length; j++) s += ('0' + b[j].toString(16)).slice(-2);
    return s;
  }

  /* El compromiso es SHA-256 y no el hashSeed de rng.js. Ese es un
     FNV de 32 bits: alcanza para sembrar, no para comprometerse. Con
     32 bits se encuentra una colisión en un rato, así que un
     compromiso hecho con eso no comprometería a nada.

     Es asíncrono porque crypto.subtle lo es. No molesta: se calcula
     al abrir la tanda, mucho antes de que haya una apuesta. */
  function sha256(texto) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.resolve(null);
    }
    var bytes = new TextEncoder().encode(texto);
    return window.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      var a = new Uint8Array(buf), s = '';
      for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
      return s;
    });
  }

  /* ---------------- tandas ---------------- */
  function abrirTanda(semillaCliente) {
    var previa = datos;
    datos = {
      servidor: semillaNueva(),
      compromiso: '',            // lo completa el sha256 de abajo
      cliente: (semillaCliente || '').trim() || semillaNueva().slice(0, 16),
      nonce: 0,
      rondas: [],
      tandas: previa ? (previa.tandas || []) : []
    };

    /* Si había una tanda abierta se revela al cerrarse, que es lo
       que la vuelve verificable: una semilla que nunca se muestra no
       sirve para comprobar nada. */
    if (previa && previa.servidor && previa.nonce > 0) {
      datos.tandas.unshift({
        servidor: previa.servidor,
        compromiso: previa.compromiso,
        cliente: previa.cliente,
        rondas: previa.nonce,
        at: Date.now()
      });
      datos.tandas = datos.tandas.slice(0, TANDAS);
    }

    guardar();
    return sha256(datos.servidor).then(function (h) {
      datos.compromiso = h || '(este navegador no tiene SHA-256)';
      guardar();
      return datos.compromiso;
    });
  }

  function estado() {
    if (!datos) datos = leer();
    if (!datos || !datos.servidor) {
      // Primera vez con este perfil: se abre una tanda sola.
      abrirTanda();
    }
    return datos;
  }

  /* ---------------- el azar de una ronda ----------------
     De las tres cosas sale UN entero de 32 bits, y de ahí el mismo
     mulberry32 que ya usa el resto del casino. Determinista por
     construcción: las mismas tres cosas dan siempre la misma tirada.

     Acá sí alcanza un hash corto: no se está comprometiendo a nada,
     sólo mezclando tres valores en una semilla. El compromiso, que
     es donde importa, es el SHA-256 de arriba. */
  function semillaDeRonda(servidor, cliente, nonce) {
    return MC.hashSeed(servidor + ':' + cliente + ':' + nonce);
  }

  /**
   * Entrega el generador de UNA ronda y avanza el contador.
   *
   * El nonce sube ANTES de jugar, no después. Si subiera al final,
   * un giro que termina mal podría descartarse sin dejar hueco en la
   * numeración, que es justo lo que la cadena tiene que delatar.
   */
  function rondaNueva(juego) {
    var d = estado();
    var nonce = d.nonce;
    d.nonce += 1;

    d.rondas.unshift({ juego: juego || '', nonce: nonce, at: Date.now() });
    d.rondas = d.rondas.slice(0, HISTORIAL);
    guardar();

    return {
      nonce: nonce,
      cliente: d.cliente,
      compromiso: d.compromiso,
      rnd: MC.seeded(semillaDeRonda(d.servidor, d.cliente, nonce))
    };
  }

  /** Cambia tu semilla. Cierra la tanda y abre otra: si no, las
      rondas viejas quedarían sin forma de recalcularse. */
  function ponerSemillaCliente(texto) {
    return abrirTanda(texto);
  }

  /** Cierra la tanda a mano, para poder verificar lo jugado. */
  function revelar() { return abrirTanda(); }

  /** Recalcula una ronda. Es lo mismo que hace tools/verificar-ronda.js. */
  function recalcular(servidor, cliente, nonce) {
    return MC.seeded(semillaDeRonda(servidor, cliente, Number(nonce)));
  }

  MC.justo = {
    estado: estado,
    rondaNueva: rondaNueva,
    abrirTanda: abrirTanda,
    revelar: revelar,
    ponerSemillaCliente: ponerSemillaCliente,
    recalcular: recalcular,
    semillaDeRonda: semillaDeRonda,
    sha256: sha256,
    onCambio: onCambio
  };
})(window.MC);
