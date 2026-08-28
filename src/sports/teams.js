/* ============================================================
   DEPORTES / EQUIPOS — la Liga Bubba.

   Dieciséis clubes inventados. Cada uno tiene fuerza de ataque y
   de defensa, sorteadas con semilla fija: son siempre las mismas,
   y de ahí salen tanto las cuotas como los goles simulados.

   Depende de: rng.
   ============================================================ */
window.MCTeams = (function () {
  'use strict';

  var NAMES = [
    'Cóndor FC',           'Atlético Farallón',
    'Unión del Cerro',     'Deportivo Salitre',
    'Club Vendaval',       'Real Mirasol',
    'Atlético Peñasco',    'Náutico Bahía',
    'Sporting Quebrada',   'Ferro Austral',
    'Defensores del Faro', 'Club Alborada',
    'Meseta Central',      'Olímpico Guanaco',
    'Atlético Retama',     'Juventud Volcán'
  ];

  var BADGES = ['🦅', '🪨', '⛰️', '🧂', '🌪️', '🌻', '🗿', '⚓',
                '🏔️', '🚂', '🗼', '🌅', '🌾', '🦙', '🌿', '🌋'];

  // Fuerzas alrededor de 1.0: más ataque = marca más,
  // más defensa = le convierten menos.
  var TEAMS = (function build() {
    var rng = MC.seeded(MC.hashSeed('liga-bubba-v1'));
    return NAMES.map(function (name, i) {
      return {
        id: 't' + i,
        name: name,
        badge: BADGES[i],
        attack: 0.72 + rng() * 0.66,
        defense: 0.72 + rng() * 0.66
      };
    });
  })();

  var BY_ID = {};
  TEAMS.forEach(function (t) { BY_ID[t.id] = t; });

  function get(id) { return BY_ID[id] || null; }

  // Sólo para mostrar: convierte las fuerzas en una nota de 1 a 5.
  function rating(team) {
    var score = team.attack + team.defense;
    return Math.max(1, Math.min(5, Math.round((score - 1.44) / 0.264)));
  }

  return { TEAMS: TEAMS, get: get, rating: rating };
})();
