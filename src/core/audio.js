/* ============================================================
   CORE / SONIDO — el casino sintetizado, sin un solo archivo.

   Antes esto eran pitidos: `beep(520, 0.06, 'triangle')`. Funcionaba,
   pero sonaba a arcade de los 80 mientras la pantalla ya se veía como
   un casino. El oído nota esa contradicción antes que el ojo.

   Ahora cada efecto se construye desde el MATERIAL que representa:
   una ficha de arcilla, una carta que roza otra, un rodillo que
   frena. Un casino no hace "bip": hace clic, roce y tintineo.

   ---------------------------------------------------------------
   CÓMO SE FABRICA UN SONIDO DE OBJETO
   ---------------------------------------------------------------
   Un objeto chico y duro golpeando algo produce dos cosas a la vez:

     1. Un golpe de ruido muy corto, teñido por el tamaño del objeto.
        Eso es ruido blanco pasado por un filtro pasabanda: la
        frecuencia del filtro es "qué tan chico" suena, y la Q es
        "qué tan metálico".
     2. Unos pocos armónicos INARMÓNICOS —no múltiplos exactos— que
        se apagan enseguida. Los múltiplos exactos suenan a nota
        musical; una ficha no es una nota.

   Un oscilador solo nunca va a sonar a ficha, por mucho que se le
   elija la forma de onda. Por eso lo de antes sonaba a juguete.

   ---------------------------------------------------------------
   TRES COSAS QUE ARREGLA ADEMÁS
   ---------------------------------------------------------------
   1. TODO PASA POR UN BUS CON COMPRESOR. Antes cada sonido se
      conectaba derecho a la salida: el bote disparaba doce
      osciladores juntos, las ganancias se sumaban y el resultado
      saturaba. Saturar suena a distorsión barata, y encima tapaba
      los sonidos chicos. Ahora hay un limitador en el medio.

   2. EL RUIDO SE FABRICA UNA SOLA VEZ. Antes cada llamada creaba un
      buffer nuevo —un array de miles de muestras— y lo tiraba. Con
      un `click` cada vez que alguien toca algo, eso es basura
      constante para el recolector.

   3. VARIACIÓN. Dos fichas nunca suenan exactamente igual. Sin un
      poco de azar en el tono, apostar diez veces seguidas suena a
      ametralladora. Es la diferencia entre un efecto y un sonido.

   Depende de: state.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var ac = null;        // AudioContext
  var bus = null;       // ganancia maestra
  var ruido = null;     // buffer de ruido, fabricado una sola vez
  var VOL = 0.85;       // volumen general del casino

  function activo() {
    return !MC.state || MC.state.soundOn !== false;
  }

  /* ---------------- el bus ---------------- */
  function ctx() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ac = new AC(); } catch (e) { return null; }

      /* Limitador. No es un lujo: sin esto, el bote —que dispara doce
         voces a la vez— suma ganancias por encima de 1 y satura. La
         saturación suena a distorsión barata y encima aplasta los
         sonidos chicos que suenan al mismo tiempo. */
      var comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 9;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;

      bus = ac.createGain();
      bus.gain.value = VOL;
      bus.connect(comp).connect(ac.destination);
    }
    // Los navegadores arrancan el audio suspendido hasta el primer gesto.
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  /** Un segundo de ruido blanco, reutilizado por todos los efectos. */
  function bufferRuido(c) {
    if (ruido) return ruido;
    var n = c.sampleRate;
    ruido = c.createBuffer(1, n, c.sampleRate);
    var d = ruido.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ruido;
  }

  /* ---------------- ladrillos ---------------- */

  /** Envolvente percusiva: sube rapidísimo y cae exponencial. */
  function env(g, t0, pico, ataque, caida) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t0 + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ataque + caida);
  }

  /**
   * Golpe de ruido filtrado: el cuerpo de cualquier objeto que golpea.
   * `freq` es el tamaño que aparenta; `q`, cuán metálico suena.
   */
  function golpe(t0, dur, freq, q, vol, tipo) {
    var c = ctx(); if (!c) return;
    var src = c.createBufferSource();
    src.buffer = bufferRuido(c);
    src.loop = true;
    // Arranca en un punto al azar del ruido: si siempre empezara en el
    // mismo lugar, dos golpes seguidos serían idénticos y se notaría.
    var off = Math.random() * 0.9;

    var f = c.createBiquadFilter();
    f.type = tipo || 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;

    var g = c.createGain();
    env(g, t0, vol, 0.002, dur);

    src.connect(f).connect(g).connect(bus);
    src.start(t0, off);
    src.stop(t0 + dur + 0.05);
  }

  /** Golpe de ruido cuyo filtro barre de una frecuencia a otra. */
  function barrido(t0, dur, desde, hasta, vol, tipo) {
    var c = ctx(); if (!c) return;
    var src = c.createBufferSource();
    src.buffer = bufferRuido(c);
    src.loop = true;

    var f = c.createBiquadFilter();
    f.type = tipo || 'lowpass';
    f.frequency.setValueAtTime(desde, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, hasta), t0 + dur);
    f.Q.value = 1;

    var g = c.createGain();
    env(g, t0, vol, 0.008, dur);

    src.connect(f).connect(g).connect(bus);
    src.start(t0, Math.random() * 0.9);
    src.stop(t0 + dur + 0.05);
  }

  /** Un parcial: una senoidal corta. Varios juntos dan el timbre. */
  function parcial(t0, freq, dur, vol, tipo) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    env(g, t0, vol, 0.004, dur);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Un tono que se desliza de una frecuencia a otra. */
  function desliz(t0, f1, f2, dur, vol, tipo) {
    var c = ctx(); if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    env(g, t0, vol, 0.01, dur);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Azar centrado en 1: para que dos golpes nunca sean idénticos. */
  function var_(p) { return 1 + (Math.random() * 2 - 1) * p; }

  function ahora(retraso) {
    var c = ctx();
    return c ? c.currentTime + (retraso || 0) : 0;
  }

  /* ============================================================
     LOS SONIDOS
     ============================================================ */

  /**
   * Una ficha de arcilla golpeando la mesa.
   * Cuerpo de ruido corto y agudo, más tres parciales inarmónicos que
   * le dan el "tin". Los múltiplos exactos sonarían a nota musical, y
   * una ficha no es una nota.
   */
  function ficha(t0, vol) {
    var v = var_(0.06);
    golpe(t0, 0.045, 3000 * v, 9, 0.16 * vol);
    parcial(t0, 1880 * v, 0.05, 0.05 * vol);
    parcial(t0, 2790 * v, 0.04, 0.035 * vol);
    parcial(t0, 4130 * v, 0.03, 0.02 * vol);
  }

  var sound = {

    /* El más usado del casino: 39 llamadas. Tiene que ser corto, sordo
       y SIN altura tonal definida. Un clic con nota se vuelve insoportable
       a la décima vez, y acá alguien lo escucha cien veces por sesión. */
    click: function () {
      if (!activo()) return;
      var t = ahora();
      /* OJO CON LA GANANCIA DE UN GOLPE FILTRADO.
         Un pasabanda tira casi todo el espectro del ruido, asi que un
         `golpe` suena MUCHO mas bajo de lo que sugiere su numero: subirlo
         de 0,075 a 0,30 —cuatro veces— movio el pico medido apenas de
         0,008 a 0,016. Lo que se oye de verdad en un clic es el parcial,
         que es una senoidal y pasa entera: subirlo a 0,22 lo disparo a
         0,234, mas fuerte que apostar y casi como una explosion.

         Calibrado en 0,05, medido en 0,078 de pico contra 0,094 de una
         ficha. Se oye, y queda apenas por debajo de apostar, que es el
         orden que corresponde: tocar un boton no puede sonar mas que
         poner plata. */
      golpe(t, 0.03, 2400 * var_(0.05), 3, 0.30);
      parcial(t, 620, 0.032, 0.05, 'triangle');
      parcial(t, 1240, 0.018, 0.015, 'triangle');
    },

    /* Apostar: la ficha sobre el paño. */
    chip: function () {
      if (!activo()) return;
      ficha(ahora(), 1);
    },

    /* Una carta rozando otra al repartirse. */
    card: function () {
      if (!activo()) return;
      barrido(ahora(), 0.11, 7000, 1400, 0.075);
    },

    /* El diente del rodillo al pasar. */
    tick: function () {
      if (!activo()) return;
      var t = ahora();
      golpe(t, 0.014, 3400 * var_(0.08), 6, 0.22);
      parcial(t, 1900 * var_(0.06), 0.012, 0.09);
    },

    /* Mines: cada gema sube medio tono. Timbre de campana —fundamental
       más la tercera parcial— en vez de un pitido triangular. */
    gem: function (paso) {
      if (!activo()) return;
      var n = Math.min(paso || 0, 14);
      var f = 660 * Math.pow(1.0595, n);   // medio tono por gema
      var t = ahora();
      parcial(t, f, 0.42, 0.085);
      parcial(t, f * 2.76, 0.22, 0.03);    // inarmónica: le da el brillo
      golpe(t, 0.02, f * 3, 4, 0.03);
    },

    /* El rodillo girando: un roce cuyo filtro sube y baja, con los
       dientes marcando el ritmo encima. */
    spin: function () {
      if (!activo()) return;
      var t = ahora();
      // Medido en 0,031 de pico: el roce se perdia debajo de todo lo
      // demas. Sigue siendo fondo, pero ahora se oye que gira.
      barrido(t, 0.34, 900, 2600, 0.14, 'bandpass');
      barrido(t + 0.34, 0.42, 2600, 700, 0.12, 'bandpass');
      for (var i = 0; i < 11; i++) {
        golpe(t + i * 0.062, 0.01, 3200 * var_(0.1), 7, 0.13);
      }
    },

    /* Ganar: un acorde cálido con las voces desafinadas entre sí, y
       encima una lluvia corta de fichas. La lluvia es lo que lo hace
       sonar a casino y no a videojuego: el dinero hace ruido de dinero. */
    win: function () {
      if (!activo()) return;
      var t = ahora();
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        parcial(t + i * 0.012, f, 0.5, 0.055, 'triangle');
        parcial(t + i * 0.012, f * 1.004, 0.5, 0.04, 'triangle');  // batido
        parcial(t + i * 0.012, f * 2, 0.3, 0.018);
      });
      for (var k = 0; k < 5; k++) ficha(t + 0.05 + k * 0.055 * var_(0.3), 0.5);
    },

    /* Perder: un golpe sordo y grave que se apaga rápido. Corto a
       propósito: alargarlo sería regodearse, y quien perdió ya lo sabe. */
    lose: function () {
      if (!activo()) return;
      var t = ahora();
      desliz(t, 210, 96, 0.22, 0.09);
      golpe(t, 0.09, 320, 1.4, 0.05, 'lowpass');
    },

    /* La mina: aire desplazado —el filtro cae de 5 kHz a 80 Hz— con un
       golpe grave abajo. Un ruido plano no explota; lo que explota es
       la caída. */
    blast: function () {
      if (!activo()) return;
      var t = ahora();
      /* Medido: con el barrido arrancando en 5 kHz el brillo promedio daba
         4.655 Hz, o sea que lo que se oia era el aire y no el golpe. Una
         explosion la define el GRAVE; el agudo es solo el chasquido del
         principio. Ahora el barrido arranca mas abajo y dura menos, y el
         cuerpo grave pesa el doble y se extiende. */
      barrido(t, 0.16, 2600, 400, 0.10);          // el chasquido
      barrido(t + 0.03, 0.55, 700, 60, 0.22, 'lowpass');   // el cuerpo
      desliz(t, 120, 28, 0.6, 0.26);              // el golpe grave
      desliz(t + 0.02, 62, 22, 0.5, 0.16);        // sub, le da el pecho
    },

    /* El bote. Lo único que puede durar más de un segundo: una subida
       que promete, la campana que confirma y una cascada de fichas que
       se va apagando. */
    jackpot: function () {
      if (!activo()) return;
      var t = ahora();

      desliz(t, 300, 1250, 0.5, 0.07, 'triangle');       // la promesa
      barrido(t, 0.5, 700, 6000, 0.05, 'bandpass');

      [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) {   // la campana
        parcial(t + 0.5 + i * 0.045, f, 1.5, 0.075, 'triangle');
        parcial(t + 0.5 + i * 0.045, f * 2.01, 0.7, 0.022);
      });

      for (var k = 0; k < 20; k++) {                      // la cascada
        var d = 0.55 + k * 0.06 * var_(0.35);
        ficha(t + d, 0.75 * (1 - k / 26));
      }
    }
  };

  /* ---------------- el interruptor ---------------- */
  function toggleSound() {
    MC.state.soundOn = !MC.state.soundOn;
    MC.save();
    pintarBoton();
    if (MC.state.soundOn) sound.chip();   // se prueba solo al prenderse
    return MC.state.soundOn;
  }

  /* El icono del botón. Dibujado y no emoji, por lo mismo que el resto
     de la interfaz: cada sistema dibuja 🔊 distinto. */
  function pintarBoton() {
    var b = document.getElementById('soundBtn');
    if (!b) return;
    var on = !MC.state || MC.state.soundOn !== false;
    b.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">' +
        '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z"/>' +
        (on
          ? '<path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>'
          : '<path d="m16.5 10 4 4M20.5 10l-4 4"/>') +
      '</svg>';
    b.setAttribute('aria-label', on ? 'Silenciar' : 'Activar sonido');
    b.setAttribute('aria-pressed', on ? 'false' : 'true');
  }

  MC.sound = sound;
  MC.toggleSound = toggleSound;
  MC.pintarBotonSonido = pintarBoton;
})(window.MC);
