/* ============================================================
   UI / PREMIO — cómo se muestra lo que ganaste, en todos los juegos

   Esto vivía adentro de Bubba Gold. Sacarlo acá no es prolijidad: es
   que el mismo premio se contaba distinto según la mesa. En la
   tragamonedas de tres rodillos un golpe de 50x aparecía de una, en
   Mines salía un toast, en Crash una línea de texto. El jugador no
   tiene por qué aprender un idioma distinto por juego.

   Dos piezas:

   mostrar()   el número del premio en el lugar que el juego tenga.
               Cuenta hacia arriba, con el rótulo del escalón ARRIBA
               de la cifra: primero te enterás de que fue grande,
               después de cuánto.

   celebrar()  el festejo a pantalla completa de los premios grandes.
               No lo llama ningún juego: se dispara solo desde
               MC.recordRound(), que es por donde ya pasa toda ronda
               cerrada. Por eso lo heredan los ocho juegos —y los que
               vengan— sin escribir una línea en ninguno.

   Depende de: MC.veredicto, MC.fmt, MC.sound.
   ============================================================ */
window.MCPremio = (function () {
  'use strict';

  /* Escalones, en múltiplos de la apuesta. Se miden sobre la GANANCIA
     y no sobre lo devuelto: 105 sobre 100 no es un premio de 1x. */
  var TIERS = [
    { min: 150, nombre: 'Premio épico', ms: 3400, festejo: true },
    { min: 60,  nombre: 'Mega premio',  ms: 2500, festejo: true },
    { min: 25,  nombre: 'Gran premio',  ms: 1800, festejo: true },
    { min: 10,  nombre: 'Buena',        ms: 1200, festejo: false }
  ];
  var ROLL_MIN_MS = 500;
  var MIN_FESTEJO = 25;    // desde acá se toma la pantalla

  function escalon(multiplo) {
    for (var i = 0; i < TIERS.length; i++) if (multiplo >= TIERS[i].min) return TIERS[i];
    return null;
  }

  /* ---------------- conteo ----------------
     El timer se guarda en el propio elemento: dos juegos pueden estar
     contando a la vez sin pisarse, y volver a contar sobre el mismo
     cartel cancela lo anterior solo. */
  function contar(el, hasta, ms, alTerminar) {
    detener(el);
    var t0 = Date.now();
    var ultimoTick = 0;

    el.__rollTimer = setInterval(function () {
      var p = Math.min(1, (Date.now() - t0) / ms);
      var suave = 1 - Math.pow(1 - p, 3);   // frena al final, como un contador
      el.textContent = '+' + MC.fmt(Math.floor(hasta * suave)) + ' fichas';

      if (Date.now() - ultimoTick > 55) { MC.sound.tick(); ultimoTick = Date.now(); }

      if (p >= 1) {
        detener(el);
        el.textContent = '+' + MC.fmt(hasta) + ' fichas';
        if (alTerminar) alTerminar();
      }
    }, 40);
  }

  function detener(el) {
    if (el && el.__rollTimer) { clearInterval(el.__rollTimer); el.__rollTimer = null; }
  }

  /* ---------------- el cartel del premio ----------------
     opts: { win, tier, apostado, devuelto, turbo }
     `apostado` en 0 significa que la jugada no costó nada (un giro
     gratis): ahí cualquier pago es ganancia y el veredicto lo resuelve
     solo, sin que el juego necesite una bandera aparte.
     Devuelve el veredicto por si el juego quiere seguir usándolo. */
  function mostrar(opts) {
    var win = opts.win;
    var v = MC.veredicto(opts.apostado, opts.devuelto);
    var refer = opts.referencia || opts.apostado || 1;   // sobre qué se mide el escalón
    var esc = v.gano ? escalon(v.neto / refer) : null;

    detener(win);
    if (opts.tier) opts.tier.classList.remove('visible');

    if (!v.gano) {
      win.textContent = v.texto;
      win.className = 'premio visible flojo';
      if (opts.devuelto > 0) MC.sound.click();
      return v;
    }

    if (esc) {
      if (opts.tier) {
        opts.tier.textContent = esc.nombre;
        opts.tier.classList.add('visible');
      }
      win.className = 'premio visible grande';
      MC.sound.jackpot();
      contar(win, v.neto, opts.turbo ? esc.ms * 0.35 : esc.ms);
    } else {
      win.className = 'premio visible';
      MC.sound.win();
      contar(win, v.neto, opts.turbo ? 200 : ROLL_MIN_MS);
    }
    return v;
  }

  function limpiar(opts) {
    if (opts.win) { detener(opts.win); opts.win.textContent = ''; opts.win.className = 'premio'; }
    if (opts.tier) { opts.tier.textContent = ''; opts.tier.classList.remove('visible'); }
  }

  /* ---------------- festejo a pantalla completa ----------------
     Lo dispara MC.recordRound() al cerrar cualquier ronda. Un juego
     no tiene que saber que esto existe. */
  var capa = null;

  function caja() {
    if (capa) return capa;
    capa = document.createElement('div');
    capa.className = 'festejo';
    capa.innerHTML =
      '<div class="festejo-caja">' +
        '<span class="festejo-rotulo"></span>' +
        '<strong class="festejo-cifra"></strong>' +
        '<span class="festejo-pie"></span>' +
      '</div>';
    // Tocar en cualquier lado lo cierra: nunca bloquear al jugador.
    capa.addEventListener('click', ocultarFestejo);
    document.body.appendChild(capa);
    return capa;
  }

  var festejoTimer = null;

  function celebrar(apostado, devuelto, nombreJuego) {
    if (!apostado || devuelto <= 0) return;
    var neto = devuelto - apostado;
    if (neto <= 0) return;

    var esc = escalon(neto / apostado);
    if (!esc || !esc.festejo) return;

    var c = caja();
    c.querySelector('.festejo-rotulo').textContent = esc.nombre;
    c.querySelector('.festejo-pie').textContent =
      (nombreJuego ? nombreJuego + ' · ' : '') +
      Math.round(neto / apostado) + ' veces tu apuesta';

    var cifra = c.querySelector('.festejo-cifra');
    cifra.textContent = '+0';
    c.classList.add('visible');
    MC.sound.jackpot();

    contar(cifra, neto, esc.ms, function () {
      clearTimeout(festejoTimer);
      festejoTimer = setTimeout(ocultarFestejo, 1600);
    });
  }

  function ocultarFestejo() {
    if (!capa) return;
    clearTimeout(festejoTimer);
    detener(capa.querySelector('.festejo-cifra'));
    capa.classList.remove('visible');
  }

  return {
    TIERS: TIERS, escalon: escalon,
    contar: contar, detener: detener,
    mostrar: mostrar, limpiar: limpiar,
    celebrar: celebrar, ocultarFestejo: ocultarFestejo
  };
})();
