/* Goal-based 90-minute markets share the existing Poisson/Dixon-Coles engine. */
window.MCMarkets = (function () {
  'use strict';
  var PICKS = {}, GROUPS = [];
  function name(m, side) { return MCTeams.get(m[side]).name; }
  function group(id, title, category) {
    var g = { id: id, title: title, category: category, picks: [] }; GROUPS.push(g); return g;
  }
  function add(g, id, short, label, result) {
    g.picks.push(id); PICKS[id] = { short: short, long: label, group: g.title, result: result };
  }
  function yes(test) { return function (h, a) { return test(h, a) ? 'win' : 'lose'; }; }
  var winner = group('winner', 'Resultado del partido', 'main');
  add(winner, 'home', '1', function (m) { return name(m, 'home') + ' gana'; }, yes(function (h, a) { return h > a; }));
  add(winner, 'draw', 'X', function () { return 'Empate'; }, yes(function (h, a) { return h === a; }));
  add(winner, 'away', '2', function (m) { return name(m, 'away') + ' gana'; }, yes(function (h, a) { return h < a; }));
  var double = group('double', 'Doble oportunidad', 'main');
  [['dc_1x', '1X', 'Local o empate', function (h, a) { return h >= a; }],
    ['dc_x2', 'X2', 'Empate o visitante', function (h, a) { return h <= a; }],
    ['dc_12', '12', 'Local o visitante', function (h, a) { return h !== a; }]].forEach(function (p) {
    add(double, p[0], p[1], function () { return p[2]; }, yes(p[3]));
  });
  var dnb = group('dnb', 'Empate no v\u00e1lido', 'main');
  ['home', 'away'].forEach(function (side) {
    add(dnb, 'dnb_' + side, side === 'home' ? '1' : '2', function (m) { return name(m, side) + ' \u00b7 Empate no v\u00e1lido'; },
      function (h, a) { return h === a ? 'push' : (side === 'home' ? h > a : a > h) ? 'win' : 'lose'; });
  });
  var both = group('btts', 'Ambos equipos marcan', 'main');
  add(both, 'btts', 'S\u00ed', function () { return 'Ambos marcan: s\u00ed'; }, yes(function (h, a) { return h > 0 && a > 0; }));
  add(both, 'nobtts', 'No', function () { return 'Ambos marcan: no'; }, yes(function (h, a) { return h === 0 || a === 0; }));
  [0.5, 1.5, 2.5, 3.5, 4.5].forEach(function (line) {
    var g = group('total_' + line, 'Goles totales \u00b7 ' + line, 'goals');
    ['over', 'under'].forEach(function (direction) {
      var id = line === 2.5 ? direction : direction + '_' + String(line).replace('.', '');
      add(g, id, (direction === 'over' ? '+' : '-') + line,
        function () { return (direction === 'over' ? 'M\u00e1s' : 'Menos') + ' de ' + line + ' goles'; },
        yes(function (h, a) { return direction === 'over' ? h + a > line : h + a < line; }));
    });
  });
  ['home', 'away'].forEach(function (side) {
    [0.5, 1.5, 2.5].forEach(function (line) {
      var g = group(side + '_total_' + line, 'Goles del ' + (side === 'home' ? 'local' : 'visitante') + ' \u00b7 ' + line, 'goals');
      ['over', 'under'].forEach(function (direction) {
        add(g, side + '_' + direction + '_' + String(line).replace('.', ''), (direction === 'over' ? '+' : '-') + line,
          function (m) { return name(m, side) + ': ' + (direction === 'over' ? 'm\u00e1s' : 'menos') + ' de ' + line + ' goles'; },
          yes(function (h, a) { var goals = side === 'home' ? h : a; return direction === 'over' ? goals > line : goals < line; }));
      });
    });
  });
  var parity = group('parity', 'Goles totales: par o impar', 'goals');
  add(parity, 'even', 'Par', function () { return 'Total de goles par (incluye 0)'; }, yes(function (h, a) { return (h + a) % 2 === 0; }));
  add(parity, 'odd', 'Impar', function () { return 'Total de goles impar'; }, yes(function (h, a) { return (h + a) % 2 === 1; }));
  [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].forEach(function (line) {
    var g = group('handicap_' + line, 'H\u00e1ndicap de goles \u00b7 Local ' + (line > 0 ? '+' : '') + line, 'handicap');
    ['home', 'away'].forEach(function (side) {
      var handicap = side === 'home' ? line : -line;
      add(g, 'hcp_' + side + '_' + String(handicap).replace('-', 'm').replace('.', ''),
        (side === 'home' ? '1 ' : '2 ') + (handicap > 0 ? '+' : '') + handicap,
        function (m) { return name(m, side) + ' ' + (handicap > 0 ? '+' : '') + handicap + ' goles'; },
        yes(function (h, a) { return side === 'home' ? h + handicap > a : a + handicap > h; }));
    });
  });
  var exact = group('score', 'Resultado exacto', 'score');
  for (var h = 0; h <= 3; h++) for (var a = 0; a <= 3; a++) (function (home, away) {
    add(exact, 'score_' + home + '_' + away, home + ' - ' + away,
      function () { return 'Resultado exacto ' + home + ' - ' + away; }, yes(function (x, y) { return x === home && y === away; }));
  })(h, a);
  ['home', 'draw', 'away'].forEach(function (side) {
    add(exact, 'score_other_' + side, 'Otro ' + ({ home: '1', draw: 'X', away: '2' })[side],
      function () { return 'Otro resultado: ' + ({ home: 'gana local', draw: 'empate', away: 'gana visitante' })[side]; },
      yes(function (h, a) { return (h > 3 || a > 3) && (side === 'home' ? h > a : side === 'away' ? a > h : h === a); }));
  });
  var combo = group('combo', 'Resultado y ambos marcan', 'combo');
  ['home', 'draw', 'away'].forEach(function (side) {
    [true, false].forEach(function (btts) {
      add(combo, side + '_btts_' + (btts ? 'yes' : 'no'), ({ home: '1', draw: 'X', away: '2' })[side] + ' + ' + (btts ? 'S\u00ed' : 'No'),
        function (m) { return (side === 'draw' ? 'Empate' : name(m, side) + ' gana') + ' y ambos marcan: ' + (btts ? 's\u00ed' : 'no'); },
        yes(function (h, a) { return (side === 'home' ? h > a : side === 'away' ? h < a : h === a) && ((h > 0 && a > 0) === btts); }));
    });
  });
  function odds(m) {
    var argentina = m.leagueId === '4406' || m.source !== 'daily';
    var l = argentina && MCLeague.status().ready ? MCLeague.lambdas(m) : { home: 1.35, away: 1.10 };
    var grid = MCPoisson.grid(l.home, l.away), total = 0, result = {};
    grid.forEach(function (row) { row.forEach(function (p) { total += p; }); });
    Object.keys(PICKS).forEach(function (id) {
      var win = 0, push = 0;
      grid.forEach(function (row, h) { row.forEach(function (p, a) {
        var value = PICKS[id].result(h, a); if (value === 'win') win += p; if (value === 'push') push += p;
      }); });
      var probability = win / (total - push);
      var quote = probability > 0 ? MCPoisson.oddsFor([probability])[0] : null;
      result[id] = Number.isFinite(quote) ? Math.min(1000, quote) : null;
    });
    // Preserve the exact quotes already offered by the homepage and existing coupons.
    var legacy = m.source === 'daily' ? MCFootball.odds(m) : MCLeague.odds(m);
    ['home', 'draw', 'away', 'over', 'under', 'btts', 'nobtts'].forEach(function (id) { result[id] = legacy[id]; });
    return result;
  }
  function outcome(pick, result) {
    if (!PICKS[pick] || !result || !Number.isInteger(result.gh) || !Number.isInteger(result.ga) || result.gh < 0 || result.ga < 0) return null;
    return PICKS[pick].result(result.gh, result.ga);
  }
  function settle(ticket, byId) {
    if (!ticket.selections || !ticket.selections.length) return null;
    var values = ticket.selections.map(function (s) { return outcome(s.pick, byId[s.matchId]); });
    if (values.some(function (v) { return v === null; })) return null;
    var pushes = values.filter(function (v) { return v === 'push'; }).length;
    if (values.indexOf('lose') >= 0) return { status: 'lost', odds: ticket.odds, payout: 0, pushes: pushes };
    if (pushes === values.length) return { status: 'refunded', odds: 1, payout: ticket.stake, pushes: pushes };
    var quote = pushes ? ticket.selections.reduce(function (q, s, i) { return q * (values[i] === 'push' ? 1 : s.odds); }, 1) : ticket.odds;
    if (!Number.isFinite(quote) || quote < 1) return null;
    if (pushes) quote = Math.round(quote * 100) / 100;
    return { status: 'won', odds: quote, payout: MC.rtp.fichas(ticket.stake * quote), pushes: pushes };
  }
  return { PICKS: PICKS, GROUPS: GROUPS, odds: odds, outcome: outcome, settle: settle };
})();
