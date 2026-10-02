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
   COMPARTIDO ENTRE JUGADORES, CUANDO SE PUEDE
   ---------------------------------------------------------------
   Si entraste con Google, el pozo es UNO SOLO para todos: vive en
   Firestore, lo alimentan todas las apuestas de todos y se lo lleva
   el primero al que le toque. Sin cuenta —o sin internet— se juega
   contra un pozo propio, guardado con tu progreso, que es como
   funcionaba antes.

   COMPARTIRLO NO LE CAMBIA EL RETORNO A NADIE, y esto no es una
   intuición: está medido en tools/bote-compartido.js. Con un pozo
   común, la probabilidad de cada uno baja en la misma proporción en
   que el pozo sube, así que el p × pozo de arriba sigue dando el 1%
   de lo que apostaste vos. Da igual que el otro apueste cien veces
   más.

   Lo que sí cambia es la VARIANZA. Con un pozo grande alimentado
   por todos, el que apuesta poco puede jugar millones de rondas sin
   ver un premio — y cuando cae, es enorme. Eso es exactamente un
   progresivo de verdad, y conviene saberlo antes y no después.

   ---------------------------------------------------------------
   QUÉ PROTEGE Y QUÉ NO
   ---------------------------------------------------------------
   Las reglas de Firestore acotan cuánto puede subir el pozo de una
   escritura, y obligan a que un premio quede registrado con el uid
   de quien lo cobró, a la vista de todos. Lo que NO pueden hacer es
   comprobar que la apuesta que generó el aporte haya existido: eso
   lo afirma el navegador del jugador.

   O sea: es a prueba de manotazos y deja rastro, no es a prueba de
   trampa. En este casino los saldos ya viven en el documento de
   cada jugador, que él mismo escribe, así que no habría nada que
   blindar que no estuviera ya abierto. Se dice y listo.

   Depende de: state, wallet, format, ui, rng, auth.
   ============================================================ */
window.MCBote = (function () {
  'use strict';

  var BASE = 250000;          // arranque del pozo
  var APORTE = 0.01;          // 1% de lo apostado
  var MINIMO_APUESTA = 10;    // apuestas más chicas no participan
  var ESPERA_APORTE = 4000;   // cada cuánto se manda lo juntado, en ms

  /* ---------------- el pozo compartido ----------------
     Lo llena la capa de Firestore (auth-firebase.js) y lo deja acá.
     `null` quiere decir "no hay pozo común disponible": sin cuenta de
     Google, sin internet, o con las reglas todavía sin publicar. En
     ese caso se juega con el de siempre, que es el local. */
  var comun = null;
  var aportePendiente = 0;    // lo que falta mandar a la nube
  var mandar = null;          // función que inyecta la capa de Firestore
  var alCambiar = [];

  function conectar(api) {
    mandar = api;
    if (aportePendiente > 0) enviarAporte();
  }

  function recibir(doc) {
    comun = (doc && typeof doc.pozo === 'number') ? doc : null;
    alCambiar.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function onCambio(fn) { alCambiar.push(fn); }

  /** ¿Estamos jugando contra el pozo de todos? */
  function esCompartido() { return !!(comun && mandar); }

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

  /* El pozo contra el que se juega AHORA. Una sola función para que
     ningún lado se olvide de mirar si hay pozo común: la pantalla
     tiene que mostrar el mismo número contra el que se sortea. */
  function valor() {
    return esCompartido() ? comun.pozo : datos().pozo;
  }

  function pozo() { return Math.floor(valor()); }

  /** 1 en cuántas rondas, con esta apuesta y el pozo actual. */
  function unoEnCuantas(apuesta) {
    var p = probabilidad(apuesta);
    return p > 0 ? Math.round(1 / p) : Infinity;
  }

  function probabilidad(apuesta) {
    if (apuesta < MINIMO_APUESTA) return 0;
    var p = valor();
    if (p <= 0) return 0;
    return (apuesta * APORTE) / p;
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

    var aporte = apostado * APORTE;
    var pozoQueHabia = valor();
    var gano = MC.rand() < probabilidad(apostado);

    /* ---------------- pozo compartido ----------------
       El premio NO se acredita acá. Se intenta cerrar contra
       Firestore, y recién si esa escritura entra se cobra.

       El motivo es una carrera real: dos jugadores pueden sacar el
       bote contra la misma foto del pozo, y el pozo es uno solo. La
       regla exige que el premio salga del pozo que estaba al momento
       de escribir, así que el segundo rebota — y tiene que NO cobrar.
       Si se acreditara acá y se escribiera después, el casino pagaría
       dos veces el mismo pozo. */
    if (esCompartido()) {
      aportePendiente += aporte;
      if (!gano) { enviarAporte(); return 0; }
      /* Se anota CUÁNTOS premios llevaba el pozo cuando salió este.
         Ese número es el testigo de la carrera: ver intentarCobrar. */
      intentarCobrar(apostado, pozoQueHabia, comun.ganados || 0);
      return 0;
    }

    /* ---------------- pozo propio ---------------- */
    var d = datos();
    d.pozo += aporte;
    if (!gano) return 0;

    var premio = Math.floor(d.pozo);
    d.pozo = BASE;
    d.ganados += 1;
    d.ultimo = premio;
    festejar(premio, apostado, pozoQueHabia);
    return premio;
  }

  /* Cierra el premio contra el pozo de todos. Si otro llegó primero,
     no hubo premio: se dice y no se acredita nada. */
  /* ============================================================
     LA CARRERA POR EL MISMO POZO

     Dos jugadores pueden sacar el bote contra la misma foto, y el
     pozo es uno. El testigo de quién llegó primero es `ganados`: si
     al momento de escribir ya subió, es porque otro lo cobró y acá
     no hubo premio.

     El primer intento comparaba el monto —"si el pozo ya está en la
     base, perdí"— y estaba mal: el aporte pendiente de la propia
     ronda empujaba el total por encima de la base, así que el
     segundo se llevaba el pozo recién reiniciado. El casino pagaba
     dos veces un pozo que existe una vez. Lo encontró la prueba 2 de
     tools/bote-compartido.js.

     Con el contador no hay ventana: o el pozo tiene los premios que
     tenía cuando se sorteó, o no es el mismo pozo.
     ============================================================ */
  function intentarCobrar(apostado, pozoQueHabia, ganadosAlSortear) {
    mandar.cobrar(ganadosAlSortear, aportePendiente).then(function (premio) {
      aportePendiente = 0;
      if (!premio) {
        MC.toast('Se te adelantaron por milésimas: el bote ya lo cobró otro.', 'info');
        return;
      }
      /* Acá sí: la escritura entró, el pozo es nuestro. La billetera
         ya cerró la ronda, así que esto se acredita aparte. */
      MC.addBalance(premio);
      var d = datos();
      d.ganados += 1;
      d.ultimo = premio;
      MC.save();
      festejar(premio, apostado, pozoQueHabia);
    }, function () {
      // La nube no contestó: no se cobra y el aporte queda para el próximo.
      MC.toast('No pude confirmar el bote con el servidor. No se acreditó nada.', 'lose');
    });
  }

  /* Manda lo acumulado. Se junta en vez de escribir en cada ronda
     porque es UN documento para todos: Firestore aguanta cerca de una
     escritura por segundo sobre el mismo papel, y una tragamonedas en
     turbo hace varias. Juntar no cambia el valor esperado —el aporte
     llega igual—, sólo hace que el número en pantalla vaya unos
     segundos atrás del real. */
  var reloj = null;
  function enviarAporte() {
    if (!mandar || aportePendiente <= 0 || reloj) return;
    reloj = setTimeout(function () {
      reloj = null;
      var monto = aportePendiente;
      aportePendiente = 0;
      mandar.aportar(monto).then(null, function () {
        // No entró: se reintenta con el siguiente aporte.
        aportePendiente += monto;
      });
    }, ESPERA_APORTE);
  }

  function festejar(premio, apostado, pozoQueHabia) {
    // El pago lo hace la billetera; acá sólo se avisa.
    setTimeout(function () {
      MC.sound.jackpot();
      MC.modal('¡GANASTE EL BOTE BUBBA!',
        '<p style="font-size:32px;color:var(--gold);margin:6px 0">' +
        MC.fmt(premio) + ' fichas</p>' +
        '<p>Cayó con una probabilidad de 1 en ' +
        MC.fmt(Math.round(1 / probabilidadCon(apostado, pozoQueHabia))) + '. ' +
        'El pozo vuelve a ' + MC.fmt(BASE) + ' y arranca de nuevo' +
        (esCompartido() ? ' para todos.' : '.') + '</p>',
        [{ label: 'Impresionante', kind: 'primary' }]);
    }, 350);
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
    // La capa de Firestore entra por acá; el resto del casino no se entera.
    conectar: conectar, recibir: recibir, onCambio: onCambio,
    esCompartido: esCompartido, comun: function () { return comun; },
    BASE: BASE, APORTE: APORTE, MINIMO_APUESTA: MINIMO_APUESTA
  };
})();
