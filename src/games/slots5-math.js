/* ============================================================
   MATEMÁTICA DE "BUBBA GOLD" — 5 rodillos, 3 filas, 20 líneas

   Este archivo corre en el navegador Y en Node. No es un capricho:
   el script que mide el RTP (tools/slots5-rtp.js) importa ESTE
   archivo, así que lo que se verifica es exactamente lo que se
   juega. Si el tool tuviera su propia copia de la tabla de pagos,
   estaría validando otro juego.

   ---------------------------------------------------------------
   POR QUÉ EL RTP SE PUEDE CALCULAR EXACTO
   ---------------------------------------------------------------
   Parece que no: hay 40^5 = 102 millones de posiciones de parada.
   Pero no hace falta recorrerlas.

   1. Cada rodillo para en una posición uniforme, así que el símbolo
      que cae en CUALQUIERA de sus tres filas tiene exactamente la
      frecuencia del rodillo. Las 20 líneas tienen entonces la misma
      distribución marginal.

   2. La esperanza es lineal aunque las líneas estén correlacionadas
      (comparten rodillos). Entonces:

          pago esperado de 20 líneas = 20 × pago esperado de 1 línea

      y el de una línea son 10^5 = 100.000 combinaciones de símbolos.
      Se recorren enteras en milisegundos.

   3. Los scatter no pagan por línea sino por cantidad visible, y ahí
      las tres filas de un mismo rodillo SÍ están correlacionadas
      (son posiciones consecutivas de la tira). Eso se resuelve
      enumerando las 40 paradas de cada rodillo y convolucionando.

   4. Los giros gratis se retroalimentan: un giro gratis puede dar
      más giros gratis. Si cada giro agrega `g` giros en esperanza,
      el total es N/(1-g) — la progenie de un proceso de ramificación.

   El resultado es un RTP exacto, no una simulación. Igual el tool
   corre además un Monte Carlo independiente: dos métodos distintos
   que coinciden es verificación de verdad; uno solo es una hipótesis.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MCSlots5Math = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REELS = 5;
  var ROWS = 3;
  var LINES = 20;
  var STRIP_LEN = 40;

  /* ---------------- símbolos ---------------- */
  var WILD = 'W';
  var SCATTER = 'S';

  var SYMBOLS = [
    { id: 'A', face: '🍒', name: 'Cereza' },
    { id: 'B', face: '🍋', name: 'Limón' },
    { id: 'C', face: '🍀', name: 'Trébol' },
    { id: 'D', face: '🍇', name: 'Uva' },
    { id: 'E', face: '🔔', name: 'Campana' },
    { id: 'F', face: '⭐', name: 'Estrella' },
    { id: 'G', face: '💎', name: 'Diamante' },
    { id: 'H', face: '👑', name: 'Corona' },
    { id: 'W', face: '🐯', name: 'Tigre Bubba' },
    { id: 'S', face: '💰', name: 'Bolsa' }
  ];

  var FACE = {};
  var NAME = {};
  SYMBOLS.forEach(function (s) { FACE[s.id] = s.face; NAME[s.id] = s.name; });

  /* ---------------- composición de los rodillos ----------------
     Cada rodillo tiene su propia mezcla, como en una máquina real.
     El comodín vive sólo en los rodillos 2, 3 y 4: por eso nunca
     arranca una línea de comodines desde el 1, y por eso que caiga
     en el 3 se siente distinto. El scatter va de a dos por tira. */
  var COUNTS = [
    { A: 7, B: 7, C: 6, D: 6, E: 5, F: 4, G: 2, H: 1, W: 0, S: 2 },
    { A: 6, B: 6, C: 6, D: 6, E: 5, F: 4, G: 2, H: 1, W: 2, S: 2 },
    { A: 6, B: 6, C: 5, D: 5, E: 5, F: 4, G: 3, H: 1, W: 3, S: 2 },
    { A: 6, B: 6, C: 6, D: 6, E: 5, F: 4, G: 2, H: 1, W: 2, S: 2 },
    { A: 7, B: 7, C: 6, D: 6, E: 5, F: 4, G: 2, H: 1, W: 0, S: 2 }
  ];

  /* Reparto en rondas: evita bloques del mismo símbolo (feo al girar)
     y de paso deja los dos scatter de cada tira bien separados, que es
     lo que hace que no haya dos en la misma ventana de tres filas. */
  function buildStrip(counts) {
    var pools = [];
    Object.keys(counts).forEach(function (id) {
      if (counts[id] > 0) pools.push({ id: id, left: counts[id] });
    });

    var strip = [];
    while (strip.length < STRIP_LEN) {
      var movedSomething = false;
      for (var i = 0; i < pools.length && strip.length < STRIP_LEN; i++) {
        if (pools[i].left > 0) { strip.push(pools[i].id); pools[i].left--; movedSomething = true; }
      }
      if (!movedSomething) break;
    }
    return strip;
  }

  var STRIPS = COUNTS.map(buildStrip);

  /* ---------------- tabla de pagos ----------------
     3, 4 y 5 iguales. Multiplica la APUESTA POR LÍNEA.
     El comodín también paga por sí mismo, y es lo que más paga. */
  var PAYS = {
    A: [0, 0, 0, 3, 16, 55],
    B: [0, 0, 0, 3, 16, 55],
    C: [0, 0, 0, 5, 22, 80],
    D: [0, 0, 0, 5, 22, 80],
    E: [0, 0, 0, 10, 45, 165],
    F: [0, 0, 0, 20, 80, 275],
    G: [0, 0, 0, 40, 160, 650],
    H: [0, 0, 0, 60, 325, 1300],
    W: [0, 0, 0, 125, 650, 2750]
  };

  /* El scatter paga por cantidad visible y multiplica la APUESTA TOTAL,
     no la de línea: por eso aparece "en cualquier lado" y no en una línea. */
  var SCATTER_PAYS = [0, 0, 0, 2, 10, 50];

  /* Giros gratis por cantidad de scatter, y multiplicador del comodín
     mientras duran. El x3 es lo que hace que la función se sienta
     distinta al juego base y no "más de lo mismo, gratis". */
  var FREE_SPINS = [0, 0, 0, 10, 15, 20];
  var FS_WILD_MULT = 3;

  var PAYING = Object.keys(PAYS);   // todos menos el scatter

  /* ---------------- líneas de pago ----------------
     Cada línea dice qué fila toma de cada rodillo (0 arriba, 2 abajo).
     Las 20 clásicas: rectas, en V, en zigzag. */
  var PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
    [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
    [1, 0, 1, 0, 1], [1, 2, 1, 2, 1],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
    [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
    [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [0, 2, 0, 2, 0]
  ];

  /* ---------------- evaluación de una línea ----------------
     Izquierda a derecha, arrancando SIEMPRE en el rodillo 1.
     Para cada símbolo se cuenta cuántos rodillos seguidos lo tienen
     (o tienen comodín) y se paga el mejor resultado. Evaluar también
     el comodín como símbolo propio es lo que hace que tres comodines
     paguen 50x y no 25x por sustituir a la corona. */
  function lineWin(line) {
    var best = 0;
    var bestSym = null;
    var bestCount = 0;
    var usedWild = false;

    for (var i = 0; i < PAYING.length; i++) {
      var s = PAYING[i];
      var n = 0;
      while (n < REELS && (line[n] === s || line[n] === WILD)) n++;
      if (n < 3) continue;

      var pay = PAYS[s][n];
      if (pay > best) {
        best = pay;
        bestSym = s;
        bestCount = n;
        usedWild = false;
        for (var k = 0; k < n; k++) if (line[k] === WILD) usedWild = true;
      }
    }
    return { pay: best, symbol: bestSym, count: bestCount, wild: usedWild };
  }

  /* ---------------- probabilidades por rodillo ---------------- */
  function symbolProbs() {
    return STRIPS.map(function (strip) {
      var p = {};
      SYMBOLS.forEach(function (s) { p[s.id] = 0; });
      strip.forEach(function (id) { p[id] += 1 / strip.length; });
      return p;
    });
  }

  /* ---------------- valor esperado de UNA línea ----------------
     Recorre las 10^5 combinaciones de símbolos. `wildMult` aplica el
     multiplicador de los giros gratis a las jugadas con comodín. */
  function expectedLineWin(wildMult) {
    var probs = symbolProbs();
    var ids = SYMBOLS.map(function (s) { return s.id; });
    var total = 0;
    var line = new Array(REELS);

    (function walk(reel, prob) {
      if (prob === 0) return;
      if (reel === REELS) {
        var r = lineWin(line);
        if (r.pay > 0) total += prob * r.pay * (r.wild ? wildMult : 1);
        return;
      }
      for (var i = 0; i < ids.length; i++) {
        line[reel] = ids[i];
        walk(reel + 1, prob * probs[reel][ids[i]]);
      }
    })(0, 1);

    return total;
  }

  /* ---------------- distribución de scatter visibles ----------------
     Acá las tres filas de un rodillo NO son independientes: son
     posiciones consecutivas de la tira. Se enumeran las 40 paradas de
     cada rodillo y después se convolucionan los cinco rodillos. */
  function scatterDistribution() {
    var perReel = STRIPS.map(function (strip) {
      var dist = [0, 0, 0, 0];
      for (var stop = 0; stop < strip.length; stop++) {
        var c = 0;
        for (var r = 0; r < ROWS; r++) {
          if (strip[(stop + r) % strip.length] === SCATTER) c++;
        }
        dist[c] += 1 / strip.length;
      }
      return dist;
    });

    var acc = [1];
    perReel.forEach(function (d) {
      var next = new Array(acc.length + d.length - 1).fill(0);
      for (var i = 0; i < acc.length; i++) {
        for (var j = 0; j < d.length; j++) next[i + j] += acc[i] * d[j];
      }
      acc = next;
    });
    return acc;   // acc[k] = P(k scatter visibles)
  }

  /* ---------------- RTP exacto, con desglose ---------------- */
  function exactRTP() {
    var baseLine = expectedLineWin(1);          // en unidades de apuesta por línea
    var fsLine = expectedLineWin(FS_WILD_MULT);
    var dist = scatterDistribution();

    // La apuesta total son 20 líneas, así que 20 líneas × (pago/apuesta de
    // línea) / 20 = el valor esperado de una línea. Queda elegante.
    var lineRTP = baseLine;
    var fsLineRTP = fsLine;

    var scatterRTP = 0;
    for (var k = 0; k < dist.length; k++) {
      scatterRTP += dist[k] * (SCATTER_PAYS[k] || 0);
    }

    // Giros que se agregan, en esperanza, por cada giro gratis jugado.
    var growth = 0;
    for (var k2 = 3; k2 < dist.length; k2++) {
      growth += dist[k2] * (FREE_SPINS[k2] || 0);
    }

    var perFreeSpin = fsLineRTP + scatterRTP;
    var freeRTP = 0;
    if (growth < 1) {
      for (var k3 = 3; k3 < dist.length; k3++) {
        var spins = (FREE_SPINS[k3] || 0) / (1 - growth);
        freeRTP += dist[k3] * spins * perFreeSpin;
      }
    }

    return {
      base: lineRTP,
      scatter: scatterRTP,
      free: freeRTP,
      total: lineRTP + scatterRTP + freeRTP,
      triggerProb: dist.slice(3).reduce(function (a, b) { return a + b; }, 0),
      scatterDist: dist,
      growth: growth,
      perFreeSpin: perFreeSpin
    };
  }

  /* ---------------- un giro concreto ----------------
     `rnd` es la fuente de azar (MC.rand en el casino, Math.random en
     el tool). El resultado se decide acá; la animación sólo lo muestra. */
  function spin(rnd) {
    var stops = STRIPS.map(function (strip) {
      return Math.floor(rnd() * strip.length);
    });

    var grid = [];
    for (var r = 0; r < ROWS; r++) {
      grid.push(STRIPS.map(function (strip, i) {
        return strip[(stops[i] + r) % strip.length];
      }));
    }
    return { stops: stops, grid: grid };
  }

  /* Evalúa una grilla ya generada. Devuelve el detalle de cada línea
     ganadora para que la interfaz pueda encenderlas de a una. */
  function evaluate(grid, wildMult) {
    var mult = wildMult || 1;
    var wins = [];
    var lineTotal = 0;

    PAYLINES.forEach(function (rows, index) {
      var line = rows.map(function (row, reel) { return grid[row][reel]; });
      var r = lineWin(line);
      if (r.pay <= 0) return;

      var pay = r.pay * (r.wild ? mult : 1);
      lineTotal += pay;
      wins.push({
        line: index, rows: rows, symbol: r.symbol,
        count: r.count, pay: pay, wild: r.wild
      });
    });

    var scatters = 0;
    for (var r2 = 0; r2 < ROWS; r2++) {
      for (var c = 0; c < REELS; c++) if (grid[r2][c] === SCATTER) scatters++;
    }

    return {
      wins: wins,
      lineTotal: lineTotal,                       // en apuestas por línea
      scatters: scatters,
      scatterPay: SCATTER_PAYS[scatters] || 0,    // en apuestas totales
      freeSpins: FREE_SPINS[scatters] || 0
    };
  }

  return {
    REELS: REELS, ROWS: ROWS, LINES: LINES, STRIP_LEN: STRIP_LEN,
    WILD: WILD, SCATTER: SCATTER,
    SYMBOLS: SYMBOLS, FACE: FACE, NAME: NAME,
    STRIPS: STRIPS, COUNTS: COUNTS,
    PAYS: PAYS, SCATTER_PAYS: SCATTER_PAYS,
    FREE_SPINS: FREE_SPINS, FS_WILD_MULT: FS_WILD_MULT,
    PAYLINES: PAYLINES,
    lineWin: lineWin, expectedLineWin: expectedLineWin,
    scatterDistribution: scatterDistribution, symbolProbs: symbolProbs,
    exactRTP: exactRTP, spin: spin, evaluate: evaluate
  };
});
