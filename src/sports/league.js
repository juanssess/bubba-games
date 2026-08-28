/* ============================================================
   DEPORTES / LIGA — fixture, cuotas, simulación y tabla.

   El fixture de cada jornada se sortea con el NÚMERO DE JORNADA
   como semilla: no hace falta guardarlo, y al recargar la página
   los partidos y las cuotas son exactamente los mismos.

   Depende de: rng, state, MCTeams, MCPoisson.
   ============================================================ */
window.MCLeague = (function () {
  'use strict';

  var LEAGUE_AVG = 1.35;    // goles medios por equipo y partido
  var HOME_ADV = 1.15;      // ventaja de local

  /* ---------------- fixture ---------------- */
  function fixture(round) {
    var teams = MCTeams.TEAMS.slice();
    var rng = MC.seeded(MC.hashSeed('jornada-' + round));

    for (var i = teams.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = teams[i]; teams[i] = teams[j]; teams[j] = t;
    }

    var matches = [];
    for (var k = 0; k < teams.length; k += 2) {
      matches.push({
        id: 'r' + round + 'm' + (k / 2),
        round: round,
        home: teams[k].id,
        away: teams[k + 1].id
      });
    }
    return matches;
  }

  /* ---------------- modelo de un partido ---------------- */
  function lambdas(match) {
    var h = MCTeams.get(match.home);
    var a = MCTeams.get(match.away);
    return {
      home: LEAGUE_AVG * (h.attack / a.defense) * HOME_ADV,
      away: LEAGUE_AVG * (a.attack / h.defense)
    };
  }

  // Cuotas de los tres mercados, derivadas del mismo modelo Poisson
  // con el que después se simulan los goles.
  function odds(match) {
    var l = lambdas(match);
    var p = MCPoisson.markets(l.home, l.away);

    var oneXtwo = MCPoisson.oddsFor([p.home, p.draw, p.away]);
    var goals = MCPoisson.oddsFor([p.over, p.under]);
    var both = MCPoisson.oddsFor([p.btts, p.nobtts]);

    return {
      home: oneXtwo[0], draw: oneXtwo[1], away: oneXtwo[2],
      over: goals[0], under: goals[1],
      btts: both[0], nobtts: both[1],
      probs: p
    };
  }

  /* ---------------- simulación ---------------- */
  function simulate(round) {
    return fixture(round).map(function (m) {
      var l = lambdas(m);
      return {
        id: m.id,
        home: m.home,
        away: m.away,
        gh: MCPoisson.sample(l.home, MC.rand),
        ga: MCPoisson.sample(l.away, MC.rand)
      };
    });
  }

  /* ---------------- resolución de una selección ----------------
     pick: 'home' | 'draw' | 'away' | 'over' | 'under' | 'btts' | 'nobtts' */
  function isWinner(pick, result) {
    var gh = result.gh, ga = result.ga;
    switch (pick) {
      case 'home':   return gh > ga;
      case 'draw':   return gh === ga;
      case 'away':   return gh < ga;
      case 'over':   return gh + ga >= 3;
      case 'under':  return gh + ga <= 2;
      case 'btts':   return gh >= 1 && ga >= 1;
      case 'nobtts': return gh === 0 || ga === 0;
      default:       return false;
    }
  }

  /* ---------------- tabla de posiciones ---------------- */
  function blankRow() {
    return { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
  }

  function applyResults(results) {
    var st = MC.state.sports.standings;

    results.forEach(function (r) {
      if (!st[r.home]) st[r.home] = blankRow();
      if (!st[r.away]) st[r.away] = blankRow();

      var H = st[r.home], A = st[r.away];
      H.pj++; A.pj++;
      H.gf += r.gh; H.gc += r.ga;
      A.gf += r.ga; A.gc += r.gh;

      if (r.gh > r.ga)      { H.g++; A.p++; H.pts += 3; }
      else if (r.gh < r.ga) { A.g++; H.p++; A.pts += 3; }
      else                  { H.e++; A.e++; H.pts++; A.pts++; }
    });

    MC.state.sports.results = results.concat(MC.state.sports.results || []).slice(0, 8);
    MC.state.sports.round += 1;
    MC.save();
  }

  function table() {
    var st = MC.state.sports.standings;
    return MCTeams.TEAMS.map(function (t) {
      var row = st[t.id] || blankRow();
      return {
        team: t,
        pj: row.pj, g: row.g, e: row.e, p: row.p,
        gf: row.gf, gc: row.gc, dg: row.gf - row.gc, pts: row.pts
      };
    }).sort(function (a, b) {
      return b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.team.name.localeCompare(b.team.name, 'es');
    });
  }

  function currentRound() { return MC.state.sports.round || 1; }

  return {
    fixture: fixture, lambdas: lambdas, odds: odds,
    simulate: simulate, isWinner: isWinner,
    applyResults: applyResults, table: table, currentRound: currentRound
  };
})();
