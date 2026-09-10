/* ============================================================
   DEPORTES / LIGA PROFESIONAL ARGENTINA
   Datos reales desde TheSportsDB y cuotas virtuales Poisson.
   ============================================================ */
window.MCLeague = (function () {
  'use strict';

  var LEAGUE_ID = 4406;
  var SEASON = 2026;
  /* TOTAL_ROUNDS, LEAGUE_AVG y HOME_ADV vivian aca y ya no existen.
     Los dos primeros eran de la liga simulada de antes —16 fechas
     inventadas— y no los usaba nadie. Los otros dos eran las constantes
     del modelo, y se fueron el dia que se midio que estaban mal: el
     promedio real es 1,04 y no 1,35, y la ventaja de local 1,29 y no 1,15.
     Ahora los dos salen de la tabla de la temporada. Ver `promedios`. */
  var API = 'https://www.thesportsdb.com/api/v1/json/123/';
  var CACHE_KEY = 'bubba_liga_argentina_2026_v1';
  var CACHE_MS = 10 * 60 * 1000;
  var live = { ready: false, loading: false, error: '', round: 1,
    matches: [], results: [], historia: [], table: [], updatedAt: 0 };

  function num(v) { return Number(v) || 0; }

  function eventDate(e) {
    var day = e.dateEventLocal || e.dateEvent;
    var time = e.strTimeLocal || e.strTime || '00:00:00';
    var d = new Date(day + 'T' + time + '-03:00');
    if (isNaN(d.getTime())) d = new Date(e.strTimestamp || day);
    return d;
  }

  function eventTeam(e, home) {
    return MCTeams.register({
      id: home ? e.idHomeTeam : e.idAwayTeam,
      name: home ? e.strHomeTeam : e.strAwayTeam,
      logo: home ? e.strHomeTeamBadge : e.strAwayTeamBadge
    });
  }

  function normalizeEvent(e) {
    var h = eventTeam(e, true), a = eventTeam(e, false);
    var status = String(e.strStatus || (e.intHomeScore !== null ? 'FT' : 'NS')).toUpperCase();
    return { id: String(e.idEvent), round: num(e.intRound), home: h.id, away: a.id,
      date: eventDate(e).toISOString(), status: status, venue: e.strVenue || '',
      gh: e.intHomeScore === null ? null : num(e.intHomeScore),
      ga: e.intAwayScore === null ? null : num(e.intAwayScore) };
  }

  function finished(m) {
    return ['FT', 'AET', 'PEN'].indexOf(m.status) >= 0 && m.gh !== null && m.ga !== null;
  }

  function around(events, pivot) {
    var center = pivot.getTime(), range = 30 * 86400000;
    return (events || []).map(normalizeEvent).filter(function (m) {
      return Math.abs(new Date(m.date).getTime() - center) < range;
    });
  }

  /**
   * Promedios de LA temporada que está corriendo, sacados de los partidos.
   *
   * Antes acá había dos constantes escritas a mano (1,35 goles por equipo
   * y 1,15 de ventaja de local) y las dos estaban mal: el torneo argentino
   * promedia 1,04 y la ventaja real de la temporada dio 1,29. Peor todavía,
   * LEAGUE_AVG aparecía tres veces con papeles que se peleaban —normalizaba
   * el ataque dividiendo, la defensa multiplicando, y después volvía a
   * escalar λ— así que cambiarla podía subir o bajar λ según el partido.
   *
   * Ahora salen de los partidos bajados y no hay nada que elegir.
   */
  var promedios = { equipo: 1.1, local: 1.25, visita: 0.97 };

  /**
   * Fuerzas de cada equipo, armadas con LOS PARTIDOS y no con la tabla.
   *
   * OJO, ESTO NO ES UN DETALLE. `lookuptable.php` con la clave gratuita
   * devuelve CINCO equipos, no los treinta — y son los cinco primeros, o
   * sea los que más goles hacen. Sacar el promedio de la liga de ahí lo
   * daba en 1,375 cuando el real de la temporada es 1,038: un 32% de más.
   * Y los otros veinticinco equipos quedaban sin datos, tratados como
   * exactamente promedio, así que el modelo no distinguía a nadie.
   *
   * Los resultados que ya bajamos sí son partidos de verdad. La tabla se
   * sigue usando para los pocos equipos que trae, porque ahí son 16 fechas
   * contra las 4 o 5 que tiene cada equipo en los resultados recientes.
   */
  var porEquipo = {};

  function recalcularPromedios(filas) {
    porEquipo = {};
    var pj = 0, goles = 0, gl = 0, gv = 0, n = 0;

    (live.historia || live.results).forEach(function (m) {
      var h = porEquipo[m.home] || (porEquipo[m.home] = { pj: 0, gf: 0, gc: 0 });
      var a = porEquipo[m.away] || (porEquipo[m.away] = { pj: 0, gf: 0, gc: 0 });
      h.pj++; h.gf += m.gh; h.gc += m.ga;
      a.pj++; a.gf += m.ga; a.gc += m.gh;
      gl += m.gh; gv += m.ga; n++;
      pj += 2; goles += m.gh + m.ga;
    });

    // Donde la tabla tiene al equipo, manda la tabla: son más fechas.
    filas.forEach(function (f) {
      if (f.pj > (porEquipo[f.team.id] || { pj: 0 }).pj) {
        porEquipo[f.team.id] = { pj: f.pj, gf: f.gf, gc: f.gc };
      }
    });

    /* Con menos de 30 partidos el promedio propio es peor que un valor de
       referencia. 1,10 es el promedio histórico del torneo argentino. */
    promedios.equipo = (n >= 15 && pj) ? goles / pj : 1.10;

    /* Ventaja de local: se encoge fuerte hacia 1,25. Con veinte partidos el
       cociente crudo baila demasiado para fijar un precio con él. */
    var V = 40, REF = 1.25;
    var v = n ? (gl + V * REF * (gv / n)) / Math.max(0.01, gv + V * (gv / n)) : REF;
    if (!isFinite(v)) v = REF;
    v = Math.max(1.0, Math.min(1.6, v));
    promedios.local = promedios.equipo * 2 * v / (1 + v);
    promedios.visita = promedios.equipo * 2 / (1 + v);
  }

  /** Lo que sabemos de un equipo, o nada si nunca lo vimos jugar. */
  function historia(id) {
    return porEquipo[id] || null;
  }

  function normalizeTable(rows) {
    var filas = (rows || []).map(function (r) {
      var pj = num(r.intPlayed), gf = num(r.intGoalsFor), gc = num(r.intGoalsAgainst);
      var team = MCTeams.register({ id: r.idTeam, name: r.strTeam, logo: r.strBadge,
        pj: pj, gf: gf, gc: gc });
      return { team: team, rank: num(r.intRank), group: r.strGroup || '', pj: pj,
        g: num(r.intWin), e: num(r.intDraw), p: num(r.intLoss), gf: gf, gc: gc,
        dg: num(r.intGoalDifference), pts: num(r.intPoints) };
    }).sort(function (a, b) { return a.rank - b.rank || b.pts - a.pts || b.dg - a.dg; });

    recalcularPromedios(filas);
    // Las estrellitas de la ficha del equipo siguen necesitando estos dos.
    filas.forEach(function (f) {
      f.team.attack = fuerza(f.pj, f.gf);
      f.team.defense = 2 - fuerza(f.pj, f.gc);
    });
    return filas;
  }

  /**
   * La fuerza de un equipo, ENCOGIDA hacia el promedio de la liga.
   *
   * Es el cambio que más rindió de todos, y el que menos parece. Sin
   * encoger, un equipo con tres fechas y dos goleadas queda con un ataque
   * de 1,8 y el precio se va al diablo; medido sobre cinco temporadas, un
   * modelo con las fuerzas crudas devuelve 124% —la casa se funde— y el
   * mismo modelo encogido devuelve 100%.
   *
   * K son los "partidos de prior": con K=6, un equipo con cuatro fechas
   * pesa 4/10 su propio número y 6/10 el promedio de la liga. Recién sobre
   * la fecha 15 empieza a mandar lo suyo, que es más o menos cuando su
   * número deja de ser ruido.
   */
  function fuerza(pj, goles) {
    var K = 6, base = promedios.equipo;
    if (!base) return 1;
    var r = (goles + K * base) / ((pj + K) * base);
    return Math.max(0.5, Math.min(1.8, r));
  }

  function packMatch(m) {
    var copy = Object.assign({}, m);
    copy.homeTeam = MCTeams.get(m.home);
    copy.awayTeam = MCTeams.get(m.away);
    return copy;
  }

  function unpack(data) {
    (data.matches || []).concat(data.results || [], data.historia || []).forEach(function (m) {
      if (m.homeTeam) MCTeams.register(m.homeTeam);
      if (m.awayTeam) MCTeams.register(m.awayTeam);
    });
    (data.table || []).forEach(function (r) { if (r.team) MCTeams.register(r.team); });
    live = data;
    live.ready = true;
    live.loading = false;
    live.error = '';
    /* Al volver de la cache hay que rehacer las fuerzas: viven en una
       variable del modulo, no en el JSON guardado. Sin esto, al abrir el
       casino con cache tibia todos los equipos valian exactamente el
       promedio y las cuotas salian iguales para cualquier partido. */
    recalcularPromedios(live.table || []);
  }

  function restoreCache() {
    try {
      var data = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!data || !data.matches) return false;
      unpack(data);
      return true;
    } catch (e) { return false; }
  }

  function saveCache() {
    try {
      var copy = Object.assign({}, live, {
        matches: live.matches.map(packMatch), results: live.results.map(packMatch),
        historia: (live.historia || []).map(packMatch)
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(copy));
    } catch (e) {}
  }

  function getJson(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function refresh(force) {
    if (live.loading) return Promise.resolve(live);
    if (!live.ready) restoreCache();
    if (!force && live.ready && Date.now() - live.updatedAt < CACHE_MS) return Promise.resolve(live);
    live.loading = true;
    live.error = '';

    return Promise.all([
      getJson('eventsnextleague.php?id=' + LEAGUE_ID),
      getJson('eventspastleague.php?id=' + LEAGUE_ID),
      getJson('lookuptable.php?l=' + LEAGUE_ID + '&s=' + SEASON)
    ]).then(function (base) {
      var next = base[0].events && base[0].events[0];
      var past = base[1].events && base[1].events[0];
      if (!next && !past) throw new Error('La fuente no devolvió partidos');
      var round = num(next ? next.intRound : num(past.intRound) + 1);
      var previousRound = num(past ? past.intRound : Math.max(1, round - 1));
      var nextPivot = eventDate(next || past), pastPivot = eventDate(past || next);
      var ticketIds = {}, extraRounds = [];
      var openTickets = (MC.state.sports && MC.state.sports.tickets) || [];
      openTickets.forEach(function (t) {
        (t.selections || []).forEach(function (s) { ticketIds[String(s.matchId)] = true; });
        var r = num(t.round);
        if (r && r !== round && r !== previousRound && extraRounds.indexOf(r) < 0) extraRounds.push(r);
      });
      /* HISTORIAL PARA EL MODELO.
         Antes se bajaban dos fechas: la que viene y la anterior. Alcanzaba
         para mostrar resultados, pero no para estimar a un equipo — con una
         fecha, cada equipo tiene UN partido.
         Ahora se bajan seis fechas hacia atras (unos 90 partidos), que es de
         donde salen las fuerzas y el promedio de la liga. Es la unica fuente
         confiable: `lookuptable.php` con la clave gratuita devuelve cinco
         equipos y son los cinco primeros. */
      var HISTORIAL = 6;
      var historial = [];
      for (var k = 1; k <= HISTORIAL; k++) {
        var rr = round - k;
        if (rr >= 1 && rr !== previousRound) historial.push(rr);
      }
      var roundCalls = [
        getJson('eventsround.php?id=' + LEAGUE_ID + '&r=' + round + '&s=' + SEASON),
        getJson('eventsround.php?id=' + LEAGUE_ID + '&r=' + previousRound + '&s=' + SEASON)
      ].concat(extraRounds.slice(0, 8).concat(historial).map(function (r) {
        return getJson('eventsround.php?id=' + LEAGUE_ID + '&r=' + r + '&s=' + SEASON);
      }));
      return Promise.all(roundCalls).then(function (rounds) {
        var now = Date.now();
        var current = around(rounds[0].events, nextPivot);
        var previous = around(rounds[1].events, pastPivot);
        var older = [];
        /* Dos cosas distintas salen del mismo lote de fechas:
             `older`    los partidos que algun cupon pendiente necesita para
                        liquidarse. Van a `results`, que es lo que se muestra
                        y con lo que se pagan los cupones.
             `historia` TODO lo terminado, para el modelo. No se muestra: si
                        entrara a `results`, la pantalla de resultados
                        pasaria de quince partidos a noventa. */
        var historia = [];
        rounds.slice(2).forEach(function (data) {
          (data.events || []).map(normalizeEvent).forEach(function (m) {
            if (!finished(m)) return;
            historia.push(m);
            if (ticketIds[m.id]) older.push(m);
          });
        });
        live.round = round;
        live.matches = current.filter(function (m) {
          return !finished(m) && new Date(m.date).getTime() > now - 7200000;
        }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        var seen = {};
        live.results = previous.concat(current, older).filter(finished).filter(function (m) {
          if (seen[m.id]) return false;
          seen[m.id] = true;
          return true;
        }).sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });
        /* La historia para el modelo: todo lo terminado que bajamos, sin
           repetir. Incluye lo de `results`, porque esos partidos tambien son
           informacion. */
        var vistos = {};
        live.historia = historia.concat(previous, current).filter(finished)
          .filter(function (m) {
            if (vistos[m.id]) return false;
            vistos[m.id] = true;
            return true;
          });
        live.table = normalizeTable(base[2].table);
        live.updatedAt = Date.now();
        live.ready = true;
        live.loading = false;
        live.error = '';
        saveCache();
        return live;
      });
    }).catch(function (e) {
      live.loading = false;
      live.error = e.message || 'No se pudo actualizar la liga';
      return live;
    });
  }

  function fixture() { return live.ready ? live.matches : []; }
  function results() { return live.ready ? live.results : []; }
  function table() { return live.ready ? live.table : []; }
  function currentRound() { return live.round || 1; }

  /**
   * Los goles esperados de cada lado.
   *
   *   λ local   = promedio de local    × ataque(local)  × flojera(visita)
   *   λ visita  = promedio de visitante × ataque(visita) × flojera(local)
   *
   * Dos equipos promedio dan exactamente el promedio de la liga, y la
   * ventaja de local ya está adentro de que un promedio sea mayor que el
   * otro: no hay una constante suelta multiplicando al final.
   *
   * OJO CON EL SIGNO: `flojera` son goles RECIBIDOS, o sea más es peor. Es
   * al revés de la vieja `defense` (más era mejor, y por eso se dividía).
   * Mezclarlas invierte el modelo y no se nota hasta que el margen se va a
   * negativo.
   */
  function lambdas(match) {
    var h = historia(match.home), a = historia(match.away);
    var ataque = function (t) { return t && t.pj ? fuerza(t.pj, t.gf) : 1; };
    var flojera = function (t) { return t && t.pj ? fuerza(t.pj, t.gc) : 1; };
    return {
      home: promedios.local * ataque(h) * flojera(a),
      away: promedios.visita * ataque(a) * flojera(h)
    };
  }

  function odds(match) {
    var l = lambdas(match), p = MCPoisson.markets(l.home, l.away);
    var a = MCPoisson.oddsFor([p.home, p.draw, p.away]);
    var g = MCPoisson.oddsFor([p.over, p.under]);
    var b = MCPoisson.oddsFor([p.btts, p.nobtts]);
    return { home: a[0], draw: a[1], away: a[2], over: g[0], under: g[1],
      btts: b[0], nobtts: b[1], probs: p };
  }

  function isWinner(pick, r) {
    if (pick === 'home') return r.gh > r.ga;
    if (pick === 'draw') return r.gh === r.ga;
    if (pick === 'away') return r.gh < r.ga;
    if (pick === 'over') return r.gh + r.ga >= 3;
    if (pick === 'under') return r.gh + r.ga <= 2;
    if (pick === 'btts') return r.gh >= 1 && r.ga >= 1;
    if (pick === 'nobtts') return r.gh === 0 || r.ga === 0;
    return false;
  }

  return { fixture: fixture, results: results, table: table, currentRound: currentRound,
    lambdas: lambdas, odds: odds, isWinner: isWinner, refresh: refresh,
    status: function () { return live; }, isReal: function () { return live.ready; },
    promedios: function () { return promedios; } };
})();
