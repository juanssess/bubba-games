/* ============================================================
   DEPORTES / MODELO POISSON

   Los goles de cada equipo se modelan como una Poisson con media λ.
   De la grilla de resultados posibles salen TODAS las probabilidades
   de mercado, y de esas probabilidades salen las cuotas.

   ---------------------------------------------------------------
   EL MARGEN QUE SE COBRA NO ES EL QUE SE GANA
   ---------------------------------------------------------------
   Cuando los partidos se SIMULABAN con estas mismas λ, el retorno
   declarado era cierto por construcción: cuota y resultado salían
   del mismo modelo. Con datos reales dejó de serlo. Ahora la cuota
   sale de acá y el resultado sale de la cancha, y cada error del
   modelo se lo come el margen.

   Medido sobre 1.628 partidos de cinco temporadas
   (`node tools/probar-modelos.js`): con 5% de margen el casino
   PERDÍA 2,65%, y perdía en las cinco temporadas, no en una.

   Por eso ahora se cobra 8% para ganar ~3%. Los cinco puntos de
   diferencia son el precio de que el modelo no sea el fútbol.
   Subirlo no es "cobrar más y taparlo": es que el número declarado
   sea cierto. Un 5% que en la práctica es −2,65% miente más que un
   8% que en la práctica es 3%.

   Sin dependencias.
   ============================================================ */
window.MCPoisson = (function () {
  'use strict';

  var MAX_GOALS = 9;      // hasta 9 goles por lado cubre >99,99% de los casos
  /* Margen NOMINAL. El real, medido, ronda el 3%. Ver el encabezado y
     docs/liga-margen.md. Si se toca este número hay que volver a medir. */
  var MARGIN = 0.08;

  /**
   * Corrección de Dixon-Coles (1997).
   *
   * Dos Poisson independientes reparten mal los partidos de pocos goles:
   * el 0-0 y el 1-1 aparecen MÁS de lo que dice la independencia, y el
   * 1-0 y el 0-1 menos. Se nota en dos mercados concretos, y se notaba
   * acá: el modelo predecía 29,0% de empates cuando pasaban 31,2%, y
   * 39,7% de "ambos marcan" cuando pasaban 43,7%.
   *
   * Se arregla retocando esas cuatro casillas con un solo parámetro, sin
   * mover las λ ni el total de goles. Con ρ negativo suben 0-0 y 1-1 y
   * bajan 1-0 y 0-1: eso levanta los empates (las dos son empate) y de
   * paso levanta "ambos marcan" por el 1-1.
   *
   * ρ = −0,10 es el valor estándar del área. Se probaron −0,05, −0,10 y
   * −0,15 sobre las cinco temporadas y los tres dan casi lo mismo, así
   * que se deja el del medio en vez de afinar sobre el ruido.
   */
  var RHO = -0.10;

  /* ---------------- distribución ---------------- */
  function pmf(k, lambda) {
    var p = Math.exp(-lambda);
    for (var i = 1; i <= k; i++) p = p * lambda / i;
    return p;
  }

  /** El retoque de Dixon-Coles sobre las cuatro casillas de pocos goles. */
  function tau(i, j, lh, la) {
    if (i === 0 && j === 0) return 1 - lh * la * RHO;
    if (i === 0 && j === 1) return 1 + lh * RHO;
    if (i === 1 && j === 0) return 1 + la * RHO;
    if (i === 1 && j === 1) return 1 - RHO;
    return 1;
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
      for (var j = 0; j <= MAX_GOALS; j++) {
        // Math.max(0, ...): con λ grandes el retoque puede dar negativo.
        g[i].push(Math.max(0, home[i] * away[j] * tau(i, j, lambdaHome, lambdaAway)));
      }
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
