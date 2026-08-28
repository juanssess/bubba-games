/* ============================================================
   DEPORTES / MODELO POISSON

   Los goles de cada equipo se modelan como una Poisson con media λ.
   De la grilla de resultados posibles salen TODAS las probabilidades
   de mercado, y de esas probabilidades salen las cuotas.

   Lo importante: el partido después se simula muestreando LAS MISMAS
   λ. Por eso el retorno declarado (100% menos el margen) es real y
   no un cartel: la cuota y el resultado vienen del mismo modelo.

   Sin dependencias.
   ============================================================ */
window.MCPoisson = (function () {
  'use strict';

  var MAX_GOALS = 9;      // hasta 9 goles por lado cubre >99,99% de los casos
  var MARGIN = 0.05;      // margen de la casa: 5%

  /* ---------------- distribución ---------------- */
  function pmf(k, lambda) {
    var p = Math.exp(-lambda);
    for (var i = 1; i <= k; i++) p = p * lambda / i;
    return p;
  }

  // Matriz de probabilidad de cada marcador exacto.
  function grid(lambdaHome, lambdaAway) {
    var home = [], away = [], g = [];
    for (var k = 0; k <= MAX_GOALS; k++) {
      home.push(pmf(k, lambdaHome));
      away.push(pmf(k, lambdaAway));
    }
    for (var i = 0; i <= MAX_GOALS; i++) {
      g.push([]);
      for (var j = 0; j <= MAX_GOALS; j++) g[i].push(home[i] * away[j]);
    }
    return g;
  }

  /* ---------------- mercados ---------------- */
  function markets(lambdaHome, lambdaAway) {
    var g = grid(lambdaHome, lambdaAway);
    var home = 0, draw = 0, away = 0, over = 0, btts = 0;

    for (var i = 0; i <= MAX_GOALS; i++) {
      for (var j = 0; j <= MAX_GOALS; j++) {
        var p = g[i][j];
        if (i > j) home += p; else if (i === j) draw += p; else away += p;
        if (i + j >= 3) over += p;          // más de 2.5 goles
        if (i >= 1 && j >= 1) btts += p;    // ambos marcan
      }
    }

    // La grilla se corta en 9 goles: se renormaliza para que sume 1.
    var total = home + draw + away;
    return {
      home: home / total, draw: draw / total, away: away / total,
      over: over / total, under: 1 - over / total,
      btts: btts / total, nobtts: 1 - btts / total
    };
  }

  /* ---------------- cuotas ----------------
     Con margen, las inversas de las cuotas de un mercado suman
     1 + margen. El jugador recibe, a la larga, 1/(1+margen). */
  function oddsFor(probs) {
    return probs.map(function (p) {
      var o = 1 / (p * (1 + MARGIN));
      return Math.max(1.01, Math.round(o * 100) / 100);
    });
  }

  /* ---------------- muestreo (algoritmo de Knuth) ---------------- */
  function sample(lambda, rnd) {
    var L = Math.exp(-lambda);
    var k = 0;
    var p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > L);
    return k - 1;
  }

  return {
    MARGIN: MARGIN,
    pmf: pmf, grid: grid, markets: markets, oddsFor: oddsFor, sample: sample
  };
})();
