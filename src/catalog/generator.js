/* ============================================================
   CATÁLOGO / GENERADOR — arma los títulos ficticios del salón.

   Es DETERMINISTA a propósito: PRNG con semilla fija, así el
   catálogo es idéntico en cada carga. Importa porque el historial
   del jugador guarda ids de juego: si mañana "g1042" fuera otro
   título, las jugadas guardadas dejarían de tener sentido.

   Depende de: MCThemes, MCSlotMath.
   ============================================================ */
window.MCGameGen = (function () {
  'use strict';

  var SEED_BASE = 1000;
  var SEED_STEP = 7;

  function maker(rng) {
    return {
      pick: function (arr) { return arr[Math.floor(rng() * arr.length)]; },
      range: function (lo, hi) { return lo + rng() * (hi - lo); },
      chance: function (p) { return rng() < p; }
    };
  }

  /* ---------------- nombre ---------------- */
  function makeName(m, theme, usedNames) {
    var name = '';
    for (var attempt = 0; attempt < 24; attempt++) {
      name = m.pick(theme.a) + ' ' + m.pick(theme.b) + m.pick(MCThemes.SUFFIX);
      if (!usedNames[name]) break;
    }
    if (usedNames[name]) name += ' II';
    usedNames[name] = true;
    return name;
  }

  /* ---------------- un título ---------------- */
  function makeSlot(seed, usedNames) {
    var rng = MC.seeded(seed);
    var m = maker(rng);

    var theme = m.pick(MCThemes.THEMES);
    var name = makeName(m, theme, usedNames);
    var volatility = m.pick(['Baja', 'Media', 'Media', 'Alta', 'Alta', 'Extrema']);
    var model = MCSlotMath.build(theme.symbols, volatility, m.range(0.94, 0.97));

    var badge = m.chance(0.12) ? 'hot' : m.chance(0.14) ? 'new' : m.chance(0.10) ? 'top' : '';
    var maxWin = Math.round(model.maxWin);

    return {
      id: 'g' + seed,
      engine: 'slots',
      name: name,
      kind: 'Tragamonedas',
      studio: m.pick(MCThemes.STUDIOS),
      theme: theme.id,
      emoji: theme.emoji,
      art: theme.art,
      volatility: volatility,
      rtpValue: model.rtp,
      rtp: 'RTP ' + (model.rtp * 100).toFixed(1).replace('.', ',') + '%',
      maxWin: model.maxWin,
      tag: 'Máx. ' + maxWin + 'x · volatilidad ' + volatility.toLowerCase(),
      desc: 'Máx. ' + maxWin + 'x',
      badge: badge,
      config: { symbols: model.symbols }
    };
  }

  function generate(count) {
    var used = {};
    var list = [];
    for (var i = 0; i < count; i++) list.push(makeSlot(SEED_BASE + i * SEED_STEP, used));
    return list;
  }

  return { generate: generate };
})();
