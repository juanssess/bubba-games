/* ============================================================
   CORE / AZAR — la única fuente de aleatoriedad de las partidas.
   Usa crypto cuando está disponible: reparto más parejo que
   Math.random y sin secuencias predecibles.
   Sin dependencias.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  function rand() {
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  function randInt(minInclusive, maxExclusive) {
    return minInclusive + Math.floor(rand() * (maxExclusive - minInclusive));
  }

  function pick(arr) {
    return arr[randInt(0, arr.length)];
  }

  // Fisher-Yates. Modifica el array recibido y lo devuelve.
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(0, i + 1);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------------- azar REPETIBLE ----------------
     Lo opuesto a rand(): dada la misma semilla devuelve siempre la
     misma secuencia. Se usa donde el resultado tiene que ser estable
     entre recargas: el catálogo de juegos, las misiones del día y el
     fixture de cada jornada. */
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Texto → entero, para poder sembrar con una fecha o un nombre.
  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  MC.rand = rand;
  MC.randInt = randInt;
  MC.pick = pick;
  MC.shuffle = shuffle;
  MC.seeded = seeded;
  MC.hashSeed = hashSeed;
})(window.MC);
