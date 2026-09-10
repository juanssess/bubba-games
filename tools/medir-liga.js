/* ============================================================
   MEDIR EL MARGEN DE LA CASA DE APUESTAS

     node tools/medir-liga.js

   La liga declara un margen del 5%. Cuando los partidos se
   SIMULABAN con las mismas lambdas que generaban la cuota, ese
   numero era cierto por construccion. Con datos reales dejo de
   serlo: la cuota sale del modelo y el resultado sale de la
   cancha, asi que el margen real es "5% si el modelo acierta".

   Esto lo mide. Recorre la temporada partido por partido y apuesta
   una ficha plana a cada mercado, con la cuota que el casino
   hubiera ofrecido.

   ---------------------------------------------------------------
   SIN MIRAR EL FUTURO
   ---------------------------------------------------------------
   Es lo unico que hace valida la medicion y lo mas facil de hacer
   mal. Las fuerzas de cada equipo salen de sus goles a favor y en
   contra POR PARTIDO, asi que si se calculan con la tabla final,
   el modelo ya "sabe" como termino el partido que se le esta
   pidiendo predecir. El resultado da fantastico y no significa
   nada.

   Aca se camina la temporada en orden de fecha y las fuerzas de
   cada partido se calculan SOLO con lo jugado antes. Un partido
   entra a la medicion recien cuando los dos equipos tienen al
   menos MIN_PJ fechas encima.

   ---------------------------------------------------------------
   POR QUE CARGA EL poisson.js DE VERDAD
   ---------------------------------------------------------------
   Reescribir la matematica aca daria una segunda implementacion
   que tarde o temprano se separa de la que juega el casino, y
   entonces la medicion mide otra cosa. Se lee el archivo del sitio
   y se ejecuta. Las constantes de league.js se leen del archivo
   por la misma razon.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache', 'liga-4406-2026.json');
const LIGA_ID = 4406;
const TEMPORADA = 2026;
const RONDAS = 32;

/** Fechas minimas que tiene que tener un equipo para que su fuerza signifique algo. */
const MIN_PJ = 3;

/* ---------------- cargar el codigo del casino ---------------- */

// poisson.js es un IIFE que se cuelga de window. Se le da un window de
// mentira y se ejecuta: asi se mide la matematica que juega de verdad.
const ventana = {};
global.window = ventana;
new Function(fs.readFileSync(path.join(RAIZ, 'src/sports/poisson.js'), 'utf8'))();
const MCPoisson = ventana.MCPoisson;

/** Las constantes salen del archivo, no copiadas: si alla cambian, aca cambian. */
function constante(nombre) {
  const src = fs.readFileSync(path.join(RAIZ, 'src/sports/league.js'), 'utf8');
  const m = src.match(new RegExp('var\\s+' + nombre + '\\s*=\\s*([0-9.]+)'));
  if (!m) throw new Error('no encontre ' + nombre + ' en league.js');
  return Number(m[1]);
}
const LEAGUE_AVG = constante('LEAGUE_AVG');
const HOME_ADV = constante('HOME_ADV');

/* ---------------- datos ---------------- */

async function bajar() {
  const todos = [];
  for (let r = 1; r <= RONDAS; r++) {
    const u = `https://www.thesportsdb.com/api/v1/json/123/eventsround.php?id=${LIGA_ID}&r=${r}&s=${TEMPORADA}`;
    try {
      const j = await (await fetch(u)).json();
      if (j.events) todos.push(...j.events);
    } catch (e) { /* una fecha que falla no invalida el resto */ }
    await new Promise((s) => setTimeout(s, 350));
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(todos));
  return todos;
}

async function eventos() {
  if (fs.existsSync(CACHE) && !process.argv.includes('--bajar')) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  console.log('Bajando la temporada de TheSportsDB…');
  return bajar();
}

/* ---------------- las fuerzas, igual que en league.js ---------------- */

/* Copiado de normalizeTable(). Es la unica parte que no se puede cargar del
   sitio —vive enredada con el formato de la API— asi que va aparte y dicho:
   si league.js cambia la formula, hay que cambiarla aca. */
function fuerza(pj, gf, gc) {
  if (!pj) return { attack: 1, defense: 1 };
  return {
    attack: Math.max(0.65, Math.min(1.55, (gf / pj) / LEAGUE_AVG)),
    defense: Math.max(0.65, Math.min(1.55, LEAGUE_AVG / Math.max(0.35, gc / pj)))
  };
}

function lambdas(h, a, prom, ventajaLocal) {
  return {
    home: prom * h.attack / a.defense * ventajaLocal,
    away: prom * a.attack / h.defense
  };
}

/* ---------------- resolucion de mercados ---------------- */

const MERCADOS = ['home', 'draw', 'away', 'over', 'under', 'btts', 'nobtts'];
const NOMBRE = {
  home: 'Gana local', draw: 'Empate', away: 'Gana visitante',
  over: 'Mas de 2.5', under: 'Menos de 2.5',
  btts: 'Ambos marcan', nobtts: 'No marcan ambos'
};

function gano(pick, gh, ga) {
  if (pick === 'home') return gh > ga;
  if (pick === 'draw') return gh === ga;
  if (pick === 'away') return gh < ga;
  if (pick === 'over') return gh + ga >= 3;
  if (pick === 'under') return gh + ga <= 2;
  if (pick === 'btts') return gh >= 1 && ga >= 1;
  return gh === 0 || ga === 0;
}

/* ---------------- la medicion ---------------- */

function medir(partidos, prom, ventajaLocal, etiqueta) {
  const tabla = {};       // equipo -> { pj, gf, gc }
  const acc = {};
  MERCADOS.forEach((m) => { acc[m] = { n: 0, apostado: 0, devuelto: 0, dev2: 0, prob: 0, pasó: 0 }; });
  let usados = 0, salteados = 0;
  // Lo que el modelo esperaba de goles, contra lo que hubo.
  let lamLocal = 0, lamVisita = 0, golLocal = 0, golVisita = 0;

  for (const p of partidos) {
    const h = tabla[p.local] || { pj: 0, gf: 0, gc: 0 };
    const a = tabla[p.visita] || { pj: 0, gf: 0, gc: 0 };

    if (h.pj >= MIN_PJ && a.pj >= MIN_PJ) {
      const l = lambdas(fuerza(h.pj, h.gf, h.gc), fuerza(a.pj, a.gf, a.gc), prom, ventajaLocal);
      const probs = MCPoisson.markets(l.home, l.away);
      const c1x2 = MCPoisson.oddsFor([probs.home, probs.draw, probs.away]);
      const cGoles = MCPoisson.oddsFor([probs.over, probs.under]);
      const cAmbos = MCPoisson.oddsFor([probs.btts, probs.nobtts]);
      const cuota = {
        home: c1x2[0], draw: c1x2[1], away: c1x2[2],
        over: cGoles[0], under: cGoles[1], btts: cAmbos[0], nobtts: cAmbos[1]
      };
      for (const m of MERCADOS) {
        acc[m].n++;
        acc[m].apostado += 1;
        acc[m].prob += probs[m];
        if (gano(m, p.gh, p.ga)) { acc[m].devuelto += cuota[m]; acc[m].dev2 += cuota[m] * cuota[m]; acc[m].pasó++; }
      }
      lamLocal += l.home;
      lamVisita += l.away;
      golLocal += p.gh;
      golVisita += p.ga;
      usados++;
    } else {
      salteados++;
    }

    // Recien DESPUES de apostar se suma el partido a la tabla.
    tabla[p.local] = { pj: h.pj + 1, gf: h.gf + p.gh, gc: h.gc + p.ga };
    tabla[p.visita] = { pj: a.pj + 1, gf: a.gf + p.ga, gc: a.gc + p.gh };
  }

  return {
    etiqueta, acc, usados, salteados, prom, ventajaLocal,
    goles: {
      esperadoLocal: lamLocal / Math.max(1, usados),
      esperadoVisita: lamVisita / Math.max(1, usados),
      realLocal: golLocal / Math.max(1, usados),
      realVisita: golVisita / Math.max(1, usados)
    }
  };
}

/* ============================================================
   EL MODELO SIN CONSTANTES INVENTADAS

   La medicion de arriba muestra que cambiar LEAGUE_AVG no arregla
   nada, y la razon es estructural: esa constante aparece TRES veces
   con papeles que se pelean. Normaliza el ataque (dividiendo),
   normaliza la defensa (multiplicando) y despues vuelve a escalar
   lambda. En el medio hay recortes a [0.65, 1.55] que rompen la
   cancelacion, asi que bajarla puede subir o bajar lambda segun el
   partido. No se puede razonar: solo medir.

   Esta es la forma estandar y se calibra sola:

     lambda_local   = promLocal  x ataque(local)  x flojera(visita)
     lambda_visita  = promVisita x ataque(visita) x flojera(local)

   donde los promedios son los OBSERVADOS de local y de visitante, y
   ataque/flojera son razones contra el promedio de la liga. Dos
   equipos promedio dan exactamente el promedio de la liga. La
   ventaja de local no es una constante aparte: ya esta adentro de
   que promLocal sea mayor que promVisita.

   OJO CON EL SIGNO: aca `flojera` es goles recibidos / promedio, o
   sea MAS ES PEOR. En league.js `defense` es al reves (mas es
   mejor) y por eso alla se divide. Mezclarlos invierte el modelo.
   ============================================================ */
function medirCalibrado(partidos, etiqueta) {
  const tabla = {};
  const acc = {};
  MERCADOS.forEach((m) => { acc[m] = { n: 0, apostado: 0, devuelto: 0, dev2: 0, prob: 0, pasó: 0 }; });
  let usados = 0;
  let lamLocal = 0, lamVisita = 0, golLocal = 0, golVisita = 0;
  // Promedios de la liga, tambien corridos: solo con lo ya jugado.
  let ligaPj = 0, ligaLocal = 0, ligaVisita = 0;

  for (const p of partidos) {
    const h = tabla[p.local] || { pj: 0, gf: 0, gc: 0 };
    const a = tabla[p.visita] || { pj: 0, gf: 0, gc: 0 };

    if (h.pj >= MIN_PJ && a.pj >= MIN_PJ && ligaPj >= 20) {
      const promLocal = ligaLocal / ligaPj;
      const promVisita = ligaVisita / ligaPj;
      const promEquipo = (ligaLocal + ligaVisita) / (ligaPj * 2);

      const ataque = (t) => Math.max(0.5, Math.min(1.8, (t.gf / t.pj) / promEquipo));
      const flojera = (t) => Math.max(0.5, Math.min(1.8, (t.gc / t.pj) / promEquipo));

      const l = {
        home: promLocal * ataque(h) * flojera(a),
        away: promVisita * ataque(a) * flojera(h)
      };
      const probs = MCPoisson.markets(l.home, l.away);
      const c1x2 = MCPoisson.oddsFor([probs.home, probs.draw, probs.away]);
      const cGoles = MCPoisson.oddsFor([probs.over, probs.under]);
      const cAmbos = MCPoisson.oddsFor([probs.btts, probs.nobtts]);
      const cuota = {
        home: c1x2[0], draw: c1x2[1], away: c1x2[2],
        over: cGoles[0], under: cGoles[1], btts: cAmbos[0], nobtts: cAmbos[1]
      };
      for (const m of MERCADOS) {
        acc[m].n++;
        acc[m].apostado += 1;
        acc[m].prob += probs[m];
        if (gano(m, p.gh, p.ga)) { acc[m].devuelto += cuota[m]; acc[m].dev2 += cuota[m] * cuota[m]; acc[m].pasó++; }
      }
      lamLocal += l.home; lamVisita += l.away;
      golLocal += p.gh; golVisita += p.ga;
      usados++;
    }

    tabla[p.local] = { pj: h.pj + 1, gf: h.gf + p.gh, gc: h.gc + p.ga };
    tabla[p.visita] = { pj: a.pj + 1, gf: a.gf + p.ga, gc: a.gc + p.gh };
    ligaPj++; ligaLocal += p.gh; ligaVisita += p.ga;
  }

  return {
    etiqueta, acc, usados, prom: (ligaLocal + ligaVisita) / (ligaPj * 2),
    ventajaLocal: ligaLocal / Math.max(1, ligaVisita),
    goles: {
      esperadoLocal: lamLocal / Math.max(1, usados),
      esperadoVisita: lamVisita / Math.max(1, usados),
      realLocal: golLocal / Math.max(1, usados),
      realVisita: golVisita / Math.max(1, usados)
    }
  };
}

/* ============================================================
   CONTROL: UN MUNDO DONDE EL MODELO TIENE RAZON

   Antes de creerle a la medicion hay que probar el medidor. Si el
   modelo fuera perfecto, apostar a los tres resultados de un mismo
   partido tiene que devolver exactamente 1/(1+margen) = 95,24%,
   porque las inversas de las cuotas suman 1+margen por
   construccion. Cualquier otra cosa es un error MIO, no del modelo.

   Asi que se rehace la temporada entera sorteando los resultados de
   las MISMAS lambdas que generan la cuota — que es exactamente lo
   que hacia la liga simulada de antes. Si esto da 95,24%, el
   medidor esta bien y el desvio de las corridas de arriba es error
   del modelo de verdad.
   ============================================================ */
function control(partidos) {
  const tabla = {};
  const acc = {};
  MERCADOS.forEach((m) => { acc[m] = { n: 0, apostado: 0, devuelto: 0, dev2: 0, prob: 0, pasó: 0 }; });
  let usados = 0, lamLocal = 0, lamVisita = 0, golLocal = 0, golVisita = 0;
  let semilla = 12345;
  const rnd = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
  };

  for (const p of partidos) {
    const h = tabla[p.local] || { pj: 0, gf: 0, gc: 0 };
    const a = tabla[p.visita] || { pj: 0, gf: 0, gc: 0 };
    let gh = p.gh, ga = p.ga;

    if (h.pj >= MIN_PJ && a.pj >= MIN_PJ) {
      const l = lambdas(fuerza(h.pj, h.gf, h.gc), fuerza(a.pj, a.gf, a.gc), LEAGUE_AVG, HOME_ADV);
      // EL RESULTADO SALE DEL MODELO, no de la cancha.
      gh = MCPoisson.sample(l.home, rnd);
      ga = MCPoisson.sample(l.away, rnd);

      const probs = MCPoisson.markets(l.home, l.away);
      const c1x2 = MCPoisson.oddsFor([probs.home, probs.draw, probs.away]);
      const cGoles = MCPoisson.oddsFor([probs.over, probs.under]);
      const cAmbos = MCPoisson.oddsFor([probs.btts, probs.nobtts]);
      const cuota = {
        home: c1x2[0], draw: c1x2[1], away: c1x2[2],
        over: cGoles[0], under: cGoles[1], btts: cAmbos[0], nobtts: cAmbos[1]
      };
      for (const m of MERCADOS) {
        acc[m].n++;
        acc[m].apostado += 1;
        acc[m].prob += probs[m];
        if (gano(m, gh, ga)) { acc[m].devuelto += cuota[m]; acc[m].dev2 += cuota[m] * cuota[m]; acc[m].pasó++; }
      }
      lamLocal += l.home; lamVisita += l.away;
      golLocal += gh; golVisita += ga;
      usados++;
    }

    // La tabla se alimenta con el resultado SORTEADO, para que el mundo sea
    // coherente consigo mismo.
    tabla[p.local] = { pj: h.pj + 1, gf: h.gf + gh, gc: h.gc + ga };
    tabla[p.visita] = { pj: a.pj + 1, gf: a.gf + ga, gc: a.gc + gh };
  }

  return {
    etiqueta: 'CONTROL — resultados sorteados del propio modelo',
    acc, usados, prom: LEAGUE_AVG, ventajaLocal: HOME_ADV,
    goles: {
      esperadoLocal: lamLocal / Math.max(1, usados),
      esperadoVisita: lamVisita / Math.max(1, usados),
      realLocal: golLocal / Math.max(1, usados),
      realVisita: golVisita / Math.max(1, usados)
    }
  };
}

function pct(v) { return (v * 100).toFixed(2) + '%'; }
function pct1(v) { return (v * 100).toFixed(1) + '%'; }

function informe(r) {
  const out = [];
  const g = r.goles;
  out.push('');
  out.push('  ' + r.etiqueta);
  out.push('  promedio de gol ' + r.prom.toFixed(3) + '   ventaja de local ' + r.ventajaLocal.toFixed(3) +
    '   partidos medidos ' + r.usados);
  out.push('');
  /* LA LINEA QUE EXPLICA TODO LO DEMAS. El margen por mercado dice CUANTO se
     pierde; esto dice POR QUE. Si el modelo espera menos goles de los que
     hay, "mas de 2.5" y "ambos marcan" se pagan de mas, y no hay margen del
     5% que aguante eso. */
  out.push('  goles esperados por el modelo .. ' +
    (g.esperadoLocal + g.esperadoVisita).toFixed(3) +
    '  (local ' + g.esperadoLocal.toFixed(2) + ' / visita ' + g.esperadoVisita.toFixed(2) + ')');
  out.push('  goles que hubo de verdad ....... ' +
    (g.realLocal + g.realVisita).toFixed(3) +
    '  (local ' + g.realLocal.toFixed(2) + ' / visita ' + g.realVisita.toFixed(2) + ')');
  out.push('');
  out.push('  mercado              el modelo   pasó       RTP     (error)  margen real');
  let totalAp = 0, totalDev = 0;
  for (const m of MERCADOS) {
    const a = r.acc[m];
    const rtp = a.apostado ? a.devuelto / a.apostado : 0;
    totalAp += a.apostado;
    totalDev += a.devuelto;
    /* SIN MARGEN DE ERROR UN RTP MEDIDO ES UNA OPINION.
       Con 323 partidos, una cuota de 2,5 y un acierto de 40%, el desvio de
       una sola apuesta ronda 1,2: el error de la media queda cerca de SIETE
       puntos. Un mercado que da 108% puede ser un 100% con suerte. El total
       es mucho mas firme porque apostar a los dos (o tres) lados de un
       mercado se cubre solo. */
    const media = a.n ? a.devuelto / a.n : 0;
    const varia = a.n ? Math.max(0, a.dev2 / a.n - media * media) : 0;
    const ee = a.n ? Math.sqrt(varia / a.n) : 0;
    out.push('  ' + NOMBRE[m].padEnd(20) +
      pct1(a.prob / Math.max(1, a.n)).padStart(9) +
      pct1(a.pasó / Math.max(1, a.n)).padStart(11) +
      pct(rtp).padStart(11) +
      ('+-' + (ee * 100).toFixed(1)).padStart(9) +
      pct(1 - rtp).padStart(12));
  }
  const rtpTotal = totalAp ? totalDev / totalAp : 0;
  let tv = 0, tn = 0;
  for (const m of MERCADOS) { tv += r.acc[m].dev2; tn += r.acc[m].n; }
  const mediaT = tn ? totalDev / tn : 0;
  const eeT = tn ? Math.sqrt(Math.max(0, tv / tn - mediaT * mediaT) / tn) : 0;
  out.push('  ' + '─'.repeat(70));
  out.push('  ' + 'TODOS JUNTOS'.padEnd(20) + ''.padStart(9) + ''.padStart(11) +
    pct(rtpTotal).padStart(11) + ('+-' + (eeT * 100).toFixed(1)).padStart(9) +
    pct(1 - rtpTotal).padStart(12));
  return out.join('\n');
}

/* ---------------- corrida ---------------- */

(async () => {
  const ev = await eventos();

  const partidos = ev
    .filter((e) => e.intHomeScore !== null && e.intHomeScore !== undefined && e.strHomeTeam)
    .map((e) => ({
      id: e.idEvent,
      fecha: new Date((e.dateEvent || '') + 'T' + (e.strTime || '00:00:00') + '-03:00'),
      ronda: Number(e.intRound) || 0,
      estado: String(e.strStatus || 'FT').toUpperCase(),
      local: e.strHomeTeam, visita: e.strAwayTeam,
      gh: Number(e.intHomeScore), ga: Number(e.intAwayScore)
    }))
    .filter((p) => !isNaN(p.fecha.getTime()))
    .sort((a, b) => a.fecha - b.fecha);

  console.log('LIGA PROFESIONAL ' + TEMPORADA + ' — margen real de la casa');
  console.log('='.repeat(64));
  console.log('Partidos terminados: ' + partidos.length +
    '   ·   margen declarado: ' + pct(MCPoisson.MARGIN));

  const noFT = partidos.filter((p) => p.estado !== 'FT');
  if (noFT.length) {
    console.log('\n  OJO: ' + noFT.length + ' partido(s) no terminaron en los 90:');
    noFT.forEach((p) => console.log('    ' + p.estado + '  ' + p.local + ' ' + p.gh +
      '-' + p.ga + ' ' + p.visita + '  (fecha ' + p.ronda + ')'));
    console.log('    El casino los liquida con ese marcador. Ver la nota del informe.');
  }

  // Los promedios que la temporada tiene de verdad.
  let gTot = 0, gLocal = 0, gVisita = 0;
  partidos.forEach((p) => { gTot += p.gh + p.ga; gLocal += p.gh; gVisita += p.ga; });
  const promReal = gTot / (partidos.length * 2);
  const ventajaReal = gLocal / Math.max(1, gVisita);

  console.log('\nLO QUE DICE LA TEMPORADA');
  console.log('  goles por equipo por partido .. ' + promReal.toFixed(3) +
    '   (league.js usa ' + LEAGUE_AVG.toFixed(2) + ')');
  console.log('  goles de local / de visitante .. ' + ventajaReal.toFixed(3) +
    '   (league.js usa ' + HOME_ADV.toFixed(2) + ')');

  console.log('\n' + '='.repeat(64));
  console.log(informe(medir(partidos, LEAGUE_AVG, HOME_ADV, 'CON LAS CONSTANTES DE HOY')));
  console.log('');
  console.log('='.repeat(64));
  console.log(informe(medir(partidos, promReal, ventajaReal, 'CON LAS CONSTANTES MEDIDAS')));
  console.log('');
  console.log('='.repeat(64));
  console.log(informe(medirCalibrado(partidos, 'SIN CONSTANTES: EL MODELO SE CALIBRA SOLO')));
  console.log('');
  console.log('='.repeat(64));
  console.log(informe(control(partidos)));
  console.log('');
  console.log('  Si este ultimo no da ~' + pct(1 / (1 + MCPoisson.MARGIN)) +
    ', el medidor esta mal y no hay que creerle a nada de arriba.');
  console.log('');
})();
