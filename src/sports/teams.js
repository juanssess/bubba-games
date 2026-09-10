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

  var CODES = ['CFC', 'AFA', 'UDC', 'DSA', 'VEN', 'RMI', 'APE', 'NBA',
               'SQU', 'FEA', 'DFA', 'ALB', 'MEC', 'OLG', 'ARE', 'JVO'];

  var COLORS = [
    ['#b71c1c','#f5c451'], ['#37474f','#eceff1'], ['#2e7d32','#f5c451'], ['#1565c0','#e3f2fd'],
    ['#6a1b9a','#f3e5f5'], ['#ef6c00','#fff3e0'], ['#5d4037','#f5c451'], ['#00838f','#e0f7fa'],
    ['#283593','#e8eaf6'], ['#263238','#ef5350'], ['#8e0000','#eeeeee'], ['#f9a825','#0d47a1'],
    ['#558b2f','#f1f8e9'], ['#6d4c41','#efebe9'], ['#1b5e20','#c5e1a5'], ['#d84315','#212121']
  ];

  // Fuerzas alrededor de 1.0: más ataque = marca más,
  // más defensa = le convierten menos.
  var TEAMS = (function build() {
    var rng = MC.seeded(MC.hashSeed('liga-bubba-v1'));
    return NAMES.map(function (name, i) {
      return {
        id: 't' + i,
        name: name,
        badge: BADGES[i],
        code: CODES[i],
        color: COLORS[i][0],
        color2: COLORS[i][1],
        attack: 0.72 + rng() * 0.66,
        defense: 0.72 + rng() * 0.66
      };
    });
  })();

  var BY_ID = {};
  TEAMS.forEach(function (t) { BY_ID[t.id] = t; });

  function get(id) { return BY_ID[id] || null; }

  /* La fuente real trae los clubes junto con cada partido. Se incorporan
     en caliente para que el sportsbook pueda seguir usando MCTeams.get()
     sin conocer el formato del proveedor. */
  function register(data) {
    if (!data || data.id === undefined || !data.name) return null;
    var id = String(data.id);
    var team = BY_ID[id];
    if (!team) {
      var rng = MC.seeded(MC.hashSeed('liga-real-' + id));
      team = {
        id: id,
        name: data.name,
        badge: '⚽',
        code: data.code || data.name.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase(),
        color: '#173b78',
        color2: '#e6eefc',
        attack: 0.82 + rng() * 0.36,
        defense: 0.82 + rng() * 0.36
      };
      BY_ID[id] = team;
      TEAMS.push(team);
    }
    team.name = data.name;
    if (data.logo) team.logo = data.logo;
    if (data.attack) team.attack = data.attack;
    if (data.defense) team.defense = data.defense;
    return team;
  }

  // Sólo para mostrar: convierte las fuerzas en una nota de 1 a 5.
  function rating(team) {
    var score = team.attack + team.defense;
    return Math.max(1, Math.min(5, Math.round((score - 1.44) / 0.264)));
  }

  return { TEAMS: TEAMS, get: get, register: register, rating: rating };
})();
