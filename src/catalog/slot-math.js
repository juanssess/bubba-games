/* ============================================================
   CATÁLOGO / MATEMÁTICA DE TRAGAMONEDAS

   Tres rodillos, una línea de pago, ocho símbolos. Con ese espacio
   muestral el RTP no se estima: se calcula EXACTO.

       RTP = Σ p³·pago3  +  Σ 3p²(1-p)·pago2

   (tres iguales, y exactamente dos iguales)

   El RTP que se publica sale siempre de la tabla de pagos final,
   ya redondeada. Nunca es un número de adorno.
   ============================================================ */
window.MCSlotMath = (function () {
  'use strict';

  var TOLERANCE = 0.0005;   // margen aceptable contra el RTP objetivo
  var STEP = 0.1;           // paso mínimo de ajuste de un pago

  /* ---------------- RTP de un set de símbolos ---------------- */
  function exactRTP(symbols) {
    var total = symbols.reduce(function (s, x) { return s + x.weight; }, 0);
    var rtp = 0;
    symbols.forEach(function (s) {
      var p = s.weight / total;
      rtp += Math.pow(p, 3) * s.triple;
      rtp += 3 * p * p * (1 - p) * (s.pair || 0);
    });
    return rtp;
  }

  /* ---------------- redondeo de la tabla ---------------- */
  function roundPay(x) {
    if (x >= 100) return Math.round(x);
    if (x >= 10) return Math.round(x * 2) / 2;
    return Math.round(x * 10) / 10;
  }

  /* ---------------- corrección del desvío por redondeo ----------------
     Redondear mueve el RTP varios puntos. Se corrige con un descenso:
     primero se tocan los pagos de mayor impacto (los de los símbolos
     comunes) y después los más finos, revirtiendo cualquier paso que
     empeore el error. Así el objetivo se clava con precisión decimal. */
  function tune(pay3, pay2, probs, target) {
    var rtpOf = function () {
      var r = 0;
      for (var i = 0; i < probs.length; i++) {
        r += Math.pow(probs[i], 3) * pay3[i];
        r += 3 * probs[i] * probs[i] * (1 - probs[i]) * pay2[i];
      }
      return r;
    };

    var levers = [];
    for (var j = 0; j < probs.length; j++) {
      levers.push({ arr: pay3, i: j, imp: Math.pow(probs[j], 3) });
      if (pay2[j] > 0) levers.push({ arr: pay2, i: j, imp: 3 * probs[j] * probs[j] * (1 - probs[j]) });
    }
    levers.sort(function (x, y) { return y.imp - x.imp; });

    levers.forEach(function (lv) {
      for (var k = 0; k < 80; k++) {
        var err = target - rtpOf();
        if (Math.abs(err) < TOLERANCE) return;

        var prev = lv.arr[lv.i];
        var next = Math.round((prev + (err > 0 ? STEP : -STEP)) * 10) / 10;
        if (next <= 0) return;

        lv.arr[lv.i] = next;
        if (Math.abs(target - rtpOf()) > Math.abs(err)) {
          lv.arr[lv.i] = prev;   // se pasó de largo: revertir y seguir con el próximo
          return;
        }
      }
    });

    return rtpOf();
  }

  /* ---------------- armado completo de un modelo ----------------
     symbols: [{ face, name }] del más común al más raro
     volatility: clave de MCThemes.VOLATILITY
     targetRTP: 0..1                                             */
  function build(symbols, volatility, targetRTP) {
    var vol = MCThemes.VOLATILITY[volatility];
    var n = symbols.length;

    // Pesos decrecientes: el primer símbolo es el más común del rodillo.
    var weights = [];
    var w = 30;
    for (var i = 0; i < n; i++) {
      weights.push(Math.max(2, Math.round(w)));
      w *= vol.steep;
    }

    var total = weights.reduce(function (s, x) { return s + x; }, 0);
    var probs = weights.map(function (x) { return x / total; });

    // Pago de tres iguales inversamente proporcional a la probabilidad.
    var pay3 = probs.map(function (p) { return Math.pow(1 / p, vol.exp); });
    // Par: sólo los tres símbolos más raros, y bastante más flaco.
    var pay2 = probs.map(function (_, k) { return k >= n - 3 ? pay3[k] / 16 : 0; });

    // Escalar a grandes rasgos, redondear y recién después afinar.
    var raw = 0;
    for (var j = 0; j < n; j++) {
      raw += Math.pow(probs[j], 3) * pay3[j];
      raw += 3 * probs[j] * probs[j] * (1 - probs[j]) * pay2[j];
    }
    var scale = targetRTP / raw;

    pay3 = pay3.map(function (x) { return Math.max(0.5, roundPay(x * scale)); });
    pay2 = pay2.map(function (x) { return x > 0 ? Math.max(0.5, roundPay(x * scale)) : 0; });

    var rtp = tune(pay3, pay2, probs, targetRTP);

    return {
      symbols: symbols.map(function (s, k) {
        return {
          id: s.name.toLowerCase() + k,
          face: s.face, name: s.name,
          weight: weights[k], triple: pay3[k], pair: pay2[k]
        };
      }),
      rtp: rtp,
      maxWin: Math.max.apply(null, pay3)
    };
  }

  return { build: build, exactRTP: exactRTP };
})();
