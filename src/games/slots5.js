/* ============================================================
   MOTOR / BUBBA GOLD — 5 rodillos, 3 filas, 20 líneas

   Toda la matemática vive en slots5-math.js, que es el archivo que
   mide `node tools/slots5-rtp.js`. Acá sólo hay presentación y
   manejo de la ronda: este archivo NO decide cuánto paga nada.

   ---------------------------------------------------------------
   CÓMO SE CUENTA UNA RONDA
   ---------------------------------------------------------------
   Una ronda es el giro pago MÁS todos los giros gratis que dispare,
   con sus retriggers. Se cobra una sola apuesta al principio y se
   llama a MC.recordRound() una sola vez al final, con lo apostado y
   lo devuelto por el conjunto.

   Si se registrara cada giro gratis como una ronda aparte, el
   historial mostraría veinte "apuestas de 0 fichas" y las
   estadísticas quedarían sin sentido.
   ============================================================ */
window.MCSlots5 = (function () {
  'use strict';

  var M = window.MCSlots5Math;

  var LINE_BETS = [1, 2, 5, 10, 25, 50];
  var betIndex = 2;

  var REEL_MS = [700, 900, 1100, 1300, 1500];   // frenada escalonada
  /* La función va al doble de velocidad. Con retriggers una función puede
     pasar de 90 giros: a ritmo del juego base eso son más de tres minutos
     mirando sin poder tocar nada, que es exactamente al revés de lo que
     tiene que sentirse ganar. */
  var REEL_MS_FREE = [340, 430, 520, 610, 700];
  var STOP_AT = 18;                              // símbolos que "pasan" antes de frenar
  var WIN_STEP_MS = 620;                         // cuánto dura cada línea encendida

  var spinning = false;
  var freeLeft = 0;
  var freeTotal = 0;
  var freeWin = 0;
  var roundReturn = 0;

  /* DOS relojes distintos, a propósito. Antes compartían variable y el
     ciclo de líneas ganadoras pisaba al que programa el próximo giro
     gratis: el clearTimeout de arriba cancelaba el que estuviera último,
     no el que correspondía. Separados, cada uno se cancela solo. */
  var winTimer = null;    // ciclo que enciende las líneas ganadoras
  var nextTimer = null;   // próximo giro de la función

  var el = {};

  function lineBet() { return LINE_BETS[betIndex]; }
  function totalBet() { return lineBet() * M.LINES; }
  function inFreeMode() { return freeLeft > 0 || freeTotal > 0; }

  /* ---------------- armado de los rodillos ---------------- */
  function cellHTML(id, extra) {
    var cls = 'g5-cell' + (id === M.WILD ? ' es-wild' : '') +
                          (id === M.SCATTER ? ' es-scatter' : '') + (extra || '');
    return '<div class="' + cls + '" data-sym="' + id + '">' + M.FACE[id] + '</div>';
  }

  function randomSymbol(reel) {
    var strip = M.STRIPS[reel];
    return strip[MC.randInt(0, strip.length)];
  }

  // Estado quieto: tres símbolos por rodillo, sin animación.
  function seedReels() {
    el.strips.forEach(function (strip, reel) {
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      var cells = '';
      for (var r = 0; r < M.ROWS; r++) cells += cellHTML(randomSymbol(reel));
      strip.innerHTML = cells;
    });
  }

  function cellHeight() {
    return el.strips[0].parentElement.clientHeight / M.ROWS;
  }

  /* El giro visual: la tira termina con los tres símbolos que ya salieron. */
  function animateReel(reel, column, duration) {
    var strip = el.strips[reel];
    var cells = [];
    for (var i = 0; i < STOP_AT; i++) cells.push(cellHTML(randomSymbol(reel)));
    for (var r = 0; r < M.ROWS; r++) cells.push(cellHTML(column[r]));
    cells.push(cellHTML(randomSymbol(reel)));

    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.innerHTML = cells.join('');
    void strip.offsetWidth;   // reflow: que la transición arranque desde 0

    strip.style.transition = 'transform ' + duration + 'ms cubic-bezier(.12,.66,.16,1)';
    strip.style.transform = 'translateY(' + (-STOP_AT * cellHeight()) + 'px)';
  }

  /* ---------------- una ronda ---------------- */
  function spin() {
    if (spinning) return;

    // Un giro gratis no cobra; el pago sale de la ronda que lo disparó.
    if (freeLeft <= 0) {
      var cost = totalBet();
      if (!MC.canBet(cost)) { MC.toast('No te alcanzan las fichas. Pedí el bono.', 'lose'); return; }
      MC.addBalance(-cost);
      roundReturn = 0;
    }

    spinning = true;
    clearTimeout(winTimer);
    clearTimeout(nextTimer);
    limpiarGanadoras();
    el.win.textContent = '';
    el.win.className = 'g5-win';
    el.msg.textContent = freeLeft > 0
      ? 'Giro gratis ' + (freeTotal - freeLeft + 1) + ' de ' + freeTotal
      : 'Girando...';
    actualizarControles();
    MC.sound.spin();

    // EL RESULTADO SE DECIDE ACÁ. Lo de abajo es sólo mostrarlo.
    var result = M.spin(MC.rand);
    var mult = freeLeft > 0 ? M.FS_WILD_MULT : 1;
    var evaluated = M.evaluate(result.grid, mult);

    var ritmo = freeLeft > 0 ? REEL_MS_FREE : REEL_MS;
    for (var reel = 0; reel < M.REELS; reel++) {
      var column = [];
      for (var r = 0; r < M.ROWS; r++) column.push(result.grid[r][reel]);
      animateReel(reel, column, ritmo[reel]);
    }

    setTimeout(function () { resolver(evaluated); }, ritmo[M.REELS - 1] + 120);
  }

  function resolver(ev) {
    spinning = false;

    var lineaGanada = ev.lineTotal * lineBet();
    var scatterGanado = ev.scatterPay * totalBet();
    var ganado = lineaGanada + scatterGanado;

    if (ganado > 0) MC.addBalance(ganado);
    roundReturn += ganado;
    if (freeLeft > 0) freeWin += ganado;

    pintarResultado(ev, ganado);

    if (freeLeft > 0) {
      freeLeft--;
      if (ev.freeSpins > 0) {          // retrigger
        freeLeft += ev.freeSpins;
        freeTotal += ev.freeSpins;
        MC.toast('+' + ev.freeSpins + ' giros gratis', 'win');
        MC.sound.win();
      }
      actualizarControles();
      if (freeLeft > 0) {
        nextTimer = setTimeout(spin, ev.wins.length ? 750 : 420);
      } else {
        cerrarFuncion();
      }
      return;
    }

    if (ev.freeSpins > 0) {
      abrirFuncion(ev.freeSpins, ev.scatters);
      return;
    }

    cerrarRonda(ev, ganado);
  }

  /* ---------------- giros gratis ---------------- */
  function abrirFuncion(spins, scatters) {
    freeLeft = spins;
    freeTotal = spins;
    freeWin = 0;
    MC.sound.jackpot();
    actualizarControles();

    MC.modal('¡GIROS GRATIS!',
      '<p>Cayeron <strong>' + scatters + ' bolsas</strong>: te ganaste ' +
      '<strong style="color:var(--gold)">' + spins + ' giros gratis</strong>.</p>' +
      '<p>Durante la función, cada premio con el tigre paga <strong>x' +
      M.FS_WILD_MULT + '</strong>.</p>',
      [{ label: 'Que giren', kind: 'primary', onClick: function () {
        nextTimer = setTimeout(spin, 350);
      } }]);
  }

  function cerrarFuncion() {
    var ganado = freeWin;
    var giros = freeTotal;
    freeLeft = 0;
    freeTotal = 0;
    freeWin = 0;
    actualizarControles();

    MC.sound.win();
    MC.modal('Función terminada',
      '<p>En ' + giros + ' giros gratis juntaste ' +
      '<strong style="color:var(--gold)">' + MC.fmt(ganado) + ' fichas</strong>.</p>',
      [{ label: 'Seguir', kind: 'primary' }]);

    cerrarRonda(null, roundReturn, giros);
  }

  // Cierre contable de la ronda: una sola vez, con el total.
  function cerrarRonda(ev, ganado, giros) {
    var detalle;
    if (giros) detalle = 'función de ' + giros + ' giros gratis';
    else if (!ev || !ev.wins.length) detalle = 'sin premio';
    else if (ev.wins.length === 1) detalle = ev.wins[0].count + ' ' + M.NAME[ev.wins[0].symbol];
    else detalle = ev.wins.length + ' líneas premiadas';

    MC.recordRound(totalBet(), roundReturn, detalle);
    roundReturn = 0;
    actualizarControles();
  }

  /* ---------------- pintado del resultado ---------------- */
  function pintarResultado(ev, ganado) {
    if (ganado > 0) {
      var apuesta = totalBet();
      /* Un giro gratis no costó nada: se le pasa apuesta 0 y el veredicto
         lo trata como ganancia pura, sin necesidad de un caso especial.
         En el juego base el costo es real, así que un pago menor a la
         apuesta se informa en vez de festejarse. */
      var v = MC.veredicto(freeLeft > 0 ? 0 : apuesta, ganado);
      var grande = ganado >= apuesta * 20;

      el.win.textContent = v.texto;
      if (v.gano) {
        el.win.className = 'g5-win visible' + (grande ? ' grande' : '');
        if (grande) MC.sound.jackpot(); else MC.sound.win();
      } else {
        el.win.className = 'g5-win visible flojo';
        MC.sound.click();
      }
    } else {
      el.win.textContent = '';
      el.win.className = 'g5-win';
    }

    if (ev.scatters >= 3) {
      el.msg.textContent = ev.scatters + ' bolsas — ¡función!';
    } else if (ev.wins.length) {
      var top = ev.wins.slice().sort(function (a, b) { return b.pay - a.pay; })[0];
      el.msg.textContent = top.count + ' ' + M.NAME[top.symbol] +
        (ev.wins.length > 1 ? ' y ' + (ev.wins.length - 1) + ' línea' + (ev.wins.length > 2 ? 's' : '') + ' más' : '');
    } else {
      el.msg.textContent = freeLeft > 0 ? 'Sin premio en este giro' : 'Sin premio. Probá de nuevo.';
    }

    if (ev.wins.length) encenderGanadoras(ev.wins);
    marcarScatters();
  }

  // Enciende las líneas ganadoras de a una, en bucle.
  function encenderGanadoras(wins) {
    var i = 0;
    function paso() {
      limpiarGanadoras();
      var w = wins[i % wins.length];
      w.rows.forEach(function (row, reel) {
        if (reel >= w.count) return;
        var cell = celdaVisible(reel, row);
        if (cell) cell.classList.add('ganadora');
      });
      el.lineTag.textContent = 'Línea ' + (w.line + 1) + ' · ' +
        w.count + ' ' + M.NAME[w.symbol] + ' · ' + MC.fmt(w.pay * lineBet()) +
        (w.wild && freeLeft > 0 ? ' (x' + M.FS_WILD_MULT + ')' : '');
      el.lineTag.classList.add('visible');
      i++;
      /* Acotado: con varias líneas el ciclo se repetía para siempre, y si la
         función terminaba ahí nadie lo cancelaba nunca. Veinticuatro vueltas
         son unos quince segundos, de sobra para leerlas todas. */
      if ((wins.length > 1 || i < 2) && i < 24) winTimer = setTimeout(paso, WIN_STEP_MS);
    }
    paso();
  }

  function celdaVisible(reel, row) {
    var strip = el.strips[reel];
    // Tras la animación, las tres visibles son las de índice STOP_AT..STOP_AT+2.
    var base = strip.children.length > M.ROWS ? STOP_AT : 0;
    return strip.children[base + row] || null;
  }

  function marcarScatters() {
    for (var reel = 0; reel < M.REELS; reel++) {
      for (var row = 0; row < M.ROWS; row++) {
        var c = celdaVisible(reel, row);
        if (c && c.dataset.sym === M.SCATTER) c.classList.add('ganadora');
      }
    }
  }

  function limpiarGanadoras() {
    el.board.querySelectorAll('.ganadora').forEach(function (c) { c.classList.remove('ganadora'); });
    el.lineTag.classList.remove('visible');
  }

  /* ---------------- controles ---------------- */
  function actualizarControles() {
    var libre = !spinning && freeLeft === 0;
    el.lineBet.textContent = MC.fmt(lineBet());
    el.totalBet.textContent = MC.fmt(totalBet());
    el.betUp.disabled = !libre || betIndex === LINE_BETS.length - 1;
    el.betDown.disabled = !libre || betIndex === 0;
    el.spin.disabled = !libre;
    el.spin.textContent = freeLeft > 0 ? 'GIRANDO GRATIS' : 'GIRAR';

    el.freeBox.classList.toggle('visible', freeLeft > 0);
    if (freeLeft > 0) {
      el.freeCount.textContent = freeLeft;
      el.freeSum.textContent = MC.fmt(freeWin);
    }
  }

  /* ---------------- tabla de pagos ---------------- */
  function pintarTabla() {
    var orden = ['W', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
    el.paytable.innerHTML = orden.map(function (id) {
      var p = M.PAYS[id];
      return '<div class="g5-pt">' +
               '<span class="g5-pt-sym">' + M.FACE[id] + '</span>' +
               '<span class="g5-pt-name">' + M.NAME[id] + '</span>' +
               '<span class="g5-pt-vals"><b>3</b>' + p[3] + ' <b>4</b>' + p[4] + ' <b>5</b>' + p[5] + '</span>' +
             '</div>';
    }).join('') +
    '<div class="g5-pt especial">' +
      '<span class="g5-pt-sym">' + M.FACE[M.SCATTER] + '</span>' +
      '<span class="g5-pt-name">' + M.NAME[M.SCATTER] + '</span>' +
      '<span class="g5-pt-vals">3+ en cualquier lado → giros gratis</span>' +
    '</div>';
  }

  /* ---------------- ciclo de vida ---------------- */
  function load() {
    limpiarGanadoras();
    seedReels();
    el.win.textContent = '';
    el.win.className = 'g5-win';
    el.msg.textContent = 'Apostá y girá. 20 líneas, siempre activas.';
    pintarTabla();
    actualizarControles();
  }

  function init() {
    el.board = document.getElementById('g5Board');
    el.strips = Array.prototype.slice.call(document.querySelectorAll('.g5-strip'));
    el.spin = document.getElementById('g5Spin');
    el.lineBet = document.getElementById('g5LineBet');
    el.totalBet = document.getElementById('g5TotalBet');
    el.betUp = document.getElementById('g5BetUp');
    el.betDown = document.getElementById('g5BetDown');
    el.win = document.getElementById('g5Win');
    el.msg = document.getElementById('g5Msg');
    el.lineTag = document.getElementById('g5LineTag');
    el.paytable = document.getElementById('g5Paytable');
    el.freeBox = document.getElementById('g5Free');
    el.freeCount = document.getElementById('g5FreeCount');
    el.freeSum = document.getElementById('g5FreeSum');

    el.spin.onclick = spin;
    el.betUp.onclick = function () {
      if (betIndex < LINE_BETS.length - 1) { betIndex++; MC.sound.click(); actualizarControles(); }
    };
    el.betDown.onclick = function () {
      if (betIndex > 0) { betIndex--; MC.sound.click(); actualizarControles(); }
    };

    document.addEventListener('keydown', function (e) {
      if (MC.getCurrentView() !== 'slots5') return;
      if (e.code === 'Space') { e.preventDefault(); spin(); }
    });

    // No se sale con los rodillos girando ni con la función abierta.
    MC.guard('slots5', function () { return spinning || inFreeMode(); });
    MC.registerEngine('slots5', { load: load });
  }

  return { init: init };
})();
