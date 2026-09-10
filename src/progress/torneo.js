/* ============================================================
   PROGRESO / TORNEO — El Golpe de la Semana.

   Una competencia semanal por el MEJOR MULTIPLICADOR de una sola
   ronda: lo que te volvió dividido lo que apostaste. Se resetea
   todos los lunes.

   ---------------------------------------------------------------
   POR QUÉ MULTIPLICADOR Y NO FICHAS
   ---------------------------------------------------------------
   La tabla de posiciones ya ordena por total apostado, y eso
   premia al que más juega y al que más saldo tiene. Un torneo que
   midiera lo mismo sería la misma tabla con fecha.

   El multiplicador iguala bancas: el que apuesta 20 fichas y saca
   ×80 le gana al que apuesta 2.000 y saca ×3. Es la única métrica
   de este casino donde entrar con poco no te deja afuera.

   ---------------------------------------------------------------
   EL PREMIO ES CONTRA UNA MARCA, NO CONTRA LA GENTE
   ---------------------------------------------------------------
   Esta es LA decisión del módulo y va contra lo que uno esperaría
   de un torneo. Hay tres razones, y las tres son concretas:

   1. HOY HAY UN JUGADOR. Un podio con un participante le regala el
      primer puesto todas las semanas por existir. El premio tiene
      que significar algo desde la primera semana, no desde que
      aparezca gente.

   2. NO HAY SERVIDOR QUE CIERRE LA SEMANA. Cada jugador publica su
      propia fila desde su navegador. Si el premio dependiera del
      puesto final, el puesto cambiaría según quién haya abierto el
      casino y sincronizado — dos jugadores podrían ver podios
      distintos, y el que cobró primero cobró un puesto que después
      no era suyo. Contra una marca fija eso no puede pasar: tu
      premio depende de lo que hiciste vos y de nada más.

   3. SE PUEDE VERIFICAR. "Llegaste a ×100" es comprobable mirando
      tu propio historial. "Saliste segundo" no lo es sin confiar
      en lo que publicaron los demás.

   La tabla igual existe y ordena por puesto: eso es la competencia
   de verdad —a quién hay que superar— y el día que jueguen cinco
   personas va a ser lo primero que miren. Lo que no hace es decidir
   la plata.

   ---------------------------------------------------------------
   LA SEMANA
   ---------------------------------------------------------------
   Lunes 00:00 a domingo 23:59, hora LOCAL. Como el diario: el
   jugador que mira "esta semana" quiere la suya, no la de
   Greenwich.

   Depende de: state, wallet (lo llama en el cierre de ronda).
   ============================================================ */
window.MCTorneo = (function () {
  'use strict';

  /**
   * Las marcas y lo que pagan.
   *
   * Los números salen de las fichas técnicas de los juegos, no de
   * la intuición. En La Vendimia un premio de 20-50× entra en el
   * 0,31 % de las rondas y uno de 100-500× en el 0,14 %; en Se
   * Busca, que tiene índice de volatilidad 59, la cola es mucho más
   * larga. Con eso, en una semana de unas cientas de rondas:
   *
   *   ×25   una buena tarde
   *   ×100  una buena semana
   *   ×300  se cuenta
   *
   * Se cobran de a una y una sola vez por semana: llegar a ×300
   * paga las tres, porque también pasaste por ×25 y por ×100.
   */
  var MARCAS = [
    { x: 25, premio: 2000, nombre: 'Golpe' },
    { x: 100, premio: 12000, nombre: 'Golpazo' },
    { x: 300, premio: 60000, nombre: 'Golpe maestro' }
  ];

  /* ---------------- la semana ---------------- */

  /**
   * Identificador de la semana, tipo '2026-W37'.
   *
   * Es la semana ISO: arranca el LUNES. `getDay()` devuelve 0 para
   * domingo, así que hay que correrlo — el domingo pertenece a la
   * semana que empezó el lunes anterior, no a la que empieza mañana.
   */
  function lunesDe(ts) {
    var d = new Date(ts || Date.now());
    d.setHours(0, 0, 0, 0);
    var dia = d.getDay();              // 0 domingo … 6 sábado
    var atras = dia === 0 ? 6 : dia - 1;
    d.setDate(d.getDate() - atras);
    return d;
  }

  function claveDe(ts) {
    var l = lunesDe(ts);
    // El número de semana sale de contar lunes desde el primer lunes
    // del año. Es más simple que la fórmula ISO completa y para
    // identificar una semana alcanza: lo único que importa es que dos
    // fechas de la misma semana den la misma clave.
    var eneUno = new Date(l.getFullYear(), 0, 1);
    var semanas = Math.floor((l - lunesDe(eneUno)) / 604800000) + 1;
    return l.getFullYear() + '-W' + (semanas < 10 ? '0' : '') + semanas;
  }

  function semanaActual() { return claveDe(Date.now()); }

  /** Cuándo cierra la semana en curso (lunes que viene, 00:00). */
  function cierra() {
    var l = lunesDe(Date.now());
    l.setDate(l.getDate() + 7);
    return l.getTime();
  }

  /** Lo que falta para el cierre, en texto corto. */
  function faltan() {
    var ms = cierra() - Date.now();
    if (ms <= 0) return 'cerrando';
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  /* ---------------- el registro ---------------- */

  /**
   * La ficha del jugador en la semana en curso.
   *
   * Si la clave guardada no es la de hoy, la semana cambió: se
   * archiva lo que había y se arranca de cero. El archivo (`prev`)
   * existe para poder mostrar "la semana pasada llegaste a ×40" sin
   * guardar un historial entero.
   */
  function mio() {
    var st = MC.state;
    if (!st.torneo || typeof st.torneo !== 'object') {
      st.torneo = { sem: '', golpe: 0, apostado: 0, rondas: 0, cobradas: [], prev: null };
    }
    var t = st.torneo;
    if (!Array.isArray(t.cobradas)) t.cobradas = [];

    var hoy = semanaActual();
    if (t.sem !== hoy) {
      t.prev = t.sem ? { sem: t.sem, golpe: t.golpe || 0, apostado: t.apostado || 0 } : null;
      t.sem = hoy;
      t.golpe = 0;
      t.apostado = 0;
      t.rondas = 0;
      t.cobradas = [];
    }
    return t;
  }

  /**
   * Cierre de ronda. Lo llama wallet, en el mismo punto por donde ya
   * pasan las stats, la XP y las misiones.
   *
   * Ojo con `staked <= 0`: una ronda gratis (un giro de bonificación,
   * un premio acreditado suelto) tiene multiplicador infinito. No
   * cuenta.
   */
  function registrar(staked, returned) {
    if (!(staked > 0)) return;
    var t = mio();
    t.apostado += staked;
    t.rondas += 1;

    var x = returned / staked;
    if (x <= t.golpe) { pintarBadge(); return; }

    /* CRUZAR UNA MARCA TIENE QUE AVISARSE EN EL MOMENTO.
       Sin esto el torneo es invisible mientras jugás: podés pegar un
       ×120 en la ronda 40 y no enterarte de que ganaste 14.000 fichas
       hasta que se te ocurra abrir la pantalla del torneo. Un premio del
       que no te enterás no es un premio, es un dato.
       Se compara ANTES contra DESPUÉS para avisar una sola vez por marca
       y no en cada ronda que la supere. */
    var antes = alcanzadas(t.golpe);
    t.golpe = x;
    var ahora = alcanzadas(t.golpe);

    if (ahora > antes) {
      var m = MARCAS[ahora - 1];
      MC.toast('¡' + m.nombre + ' ×' + m.x + '! Pasá por el torneo a cobrar ' +
               MC.fmt(m.premio) + ' fichas.', 'win');
      if (MC.sound && MC.sound.win) MC.sound.win();
    }
    pintarBadge();
  }

  /** Cuántas marcas cubre un multiplicador. */
  function alcanzadas(x) {
    var n = 0;
    for (var i = 0; i < MARCAS.length; i++) if (x >= MARCAS[i].x) n++;
    return n;
  }

  /**
   * El puntito de la barra lateral: encendido = tenés fichas sin cobrar.
   *
   * Mismo criterio que el de Misiones, y por lo mismo: es la única señal
   * que ve alguien que está en el lobby y no pensó en el torneo.
   */
  function pintarBadge() {
    var b = document.getElementById('sbTorneoBadge');
    if (b) b.classList.toggle('off', porCobrar().length === 0);
  }

  /* ---------------- los premios ---------------- */

  /** Las marcas que ya alcanzó esta semana y todavía no cobró. */
  function porCobrar() {
    var t = mio();
    var out = [];
    for (var i = 0; i < MARCAS.length; i++) {
      var m = MARCAS[i];
      if (t.golpe >= m.x && t.cobradas.indexOf(m.x) === -1) out.push(m);
    }
    return out;
  }

  /**
   * Cobra TODO lo que haya alcanzado. Devuelve las fichas acreditadas.
   *
   * Se marca antes de acreditar. Si el orden fuera al revés y algo
   * fallara en el medio, la marca quedaría sin marcar y se podría
   * cobrar dos veces; así, en el peor caso se pierde un premio, que
   * es el error que se puede reclamar en vez del que no se nota.
   */
  function cobrar() {
    var pendientes = porCobrar();
    if (!pendientes.length) return 0;
    var t = mio();
    var total = 0;
    for (var i = 0; i < pendientes.length; i++) {
      t.cobradas.push(pendientes[i].x);
      total += pendientes[i].premio;
    }
    MC.save();
    MC.addBalance(total);
    pintarBadge();
    return total;
  }

  /** La marca más alta alcanzada esta semana (null si ninguna). */
  function marcaAlcanzada() {
    var t = mio();
    var mejor = null;
    for (var i = 0; i < MARCAS.length; i++) {
      if (t.golpe >= MARCAS[i].x) mejor = MARCAS[i];
    }
    return mejor;
  }

  /** La próxima marca a alcanzar (null si ya están todas). */
  function proximaMarca() {
    var t = mio();
    for (var i = 0; i < MARCAS.length; i++) {
      if (t.golpe < MARCAS[i].x) return MARCAS[i];
    }
    return null;
  }

  return {
    MARCAS: MARCAS,
    semanaActual: semanaActual,
    cierra: cierra,
    faltan: faltan,
    mio: mio,
    registrar: registrar,
    porCobrar: porCobrar,
    cobrar: cobrar,
    marcaAlcanzada: marcaAlcanzada,
    proximaMarca: proximaMarca,
    pintarBadge: pintarBadge
  };
})();
