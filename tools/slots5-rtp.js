/* ============================================================
   MEDIR "BUBBA GOLD"

     node tools/slots5-rtp.js [giros]

   Importa la MISMA matemática que juega el casino
   (src/games/slots5-math.js). Si tuviera su propia copia de la tabla
   de pagos estaría midiendo otro juego.

   ---------------------------------------------------------------
   DOS MÉTODOS, A PROPÓSITO
   ---------------------------------------------------------------
   1. EXACTO: el valor esperado calculado analíticamente. No tiene
      error de muestreo: es el número, no una estimación.

   2. MONTE CARLO: juega rondas completas de verdad, con sus giros
      gratis y sus retriggers, y divide lo devuelto por lo apostado.

   El exacto podría estar mal si me equivoqué en la derivación. El
   Monte Carlo podría estar mal si me equivoqué en el motor. Que dos
   caminos distintos den el mismo número es lo que hace que el RTP
   publicado signifique algo.

   Además mide lo que el cálculo exacto no dice: cada cuánto se gana
   (frecuencia de acierto), cuánto varía (volatilidad) y cuál fue el
   golpe más grande que apareció.
   ============================================================ */
'use strict';

const M = require('../src/games/slots5-math.js');

const GIROS = parseInt(process.argv[2], 10) || 5000000;
const APUESTA = M.LINES;   // la apuesta total son 20 unidades de línea

function pct(x) { return (x * 100).toFixed(2) + '%'; }

/* ---------------- método 1: exacto ---------------- */
function exacto() {
  const r = M.exactRTP();
  console.log('\n=== MÉTODO 1: CÁLCULO EXACTO ===\n');
  console.log('  Líneas (juego base)  ' + pct(r.base));
  console.log('  Scatter              ' + pct(r.scatter));
  console.log('  Giros gratis         ' + pct(r.free));
  console.log('  ' + '-'.repeat(32));
  console.log('  RTP TOTAL            ' + pct(r.total));
  console.log('  Ventaja de la casa   ' + pct(1 - r.total));

  console.log('\n  Disparo de la función:');
  console.log('    probabilidad        ' + pct(r.triggerProb) +
              '  (1 cada ' + Math.round(1 / r.triggerProb) + ' giros)');
  console.log('    giros que se suman por cada giro gratis: ' + r.growth.toFixed(4));
  console.log('    valor de un giro gratis: ' + pct(r.perFreeSpin) + ' de la apuesta');

  console.log('\n  Scatter visibles:');
  r.scatterDist.forEach((p, k) => {
    if (p > 1e-9) console.log('    ' + k + ' → ' + pct(p));
  });

  if (r.growth >= 1) {
    console.log('\n  *** PELIGRO: los giros gratis no terminan nunca (growth >= 1) ***');
  }
  return r;
}

/* ---------------- método 2: Monte Carlo ---------------- */
function ronda(rnd) {
  let won = 0;

  const base = M.evaluate(M.spin(rnd).grid, 1);
  won += base.lineTotal + base.scatterPay * APUESTA;

  let restantes = base.freeSpins;
  let jugados = 0;
  while (restantes > 0 && jugados < 5000) {   // tope de seguridad
    restantes--; jugados++;
    const fs = M.evaluate(M.spin(rnd).grid, M.FS_WILD_MULT);
    won += fs.lineTotal + fs.scatterPay * APUESTA;
    restantes += fs.freeSpins;                // retrigger
  }

  return { won, gano: base.lineTotal + base.scatterPay * APUESTA > 0, disparo: base.freeSpins > 0 };
}

function montecarlo() {
  const rnd = Math.random;
  let apostado = 0, devuelto = 0, aciertos = 0, disparos = 0, maxGolpe = 0;
  let suma = 0, suma2 = 0;

  for (let i = 0; i < GIROS; i++) {
    const r = ronda(rnd);
    apostado += APUESTA;
    devuelto += r.won;
    if (r.gano) aciertos++;
    if (r.disparo) disparos++;
    if (r.won > maxGolpe) maxGolpe = r.won;

    const x = r.won / APUESTA;
    suma += x; suma2 += x * x;
  }

  const media = suma / GIROS;
  const varianza = suma2 / GIROS - media * media;
  const sigma = Math.sqrt(varianza);
  // Error estándar de la media. Sin esto no se puede decir si una
  // diferencia contra el exacto es un error o es ruido de muestreo.
  const ee = sigma / Math.sqrt(GIROS);

  console.log('\n=== MÉTODO 2: MONTE CARLO (' + GIROS.toLocaleString('es') + ' rondas) ===\n');
  console.log('  RTP medido           ' + pct(devuelto / apostado) + ' ± ' + (ee * 100).toFixed(3));
  console.log('  Frecuencia de premio ' + pct(aciertos / GIROS) +
              '  (1 cada ' + (GIROS / aciertos).toFixed(1) + ' giros)');
  console.log('  Disparo de función   ' + pct(disparos / GIROS) +
              '  (1 cada ' + Math.round(GIROS / disparos) + ' giros)');
  console.log('  Volatilidad (σ)      ' + sigma.toFixed(2) + 'x la apuesta');
  console.log('  Golpe más grande     ' + (maxGolpe / APUESTA).toFixed(0) + 'x la apuesta');

  return { rtp: devuelto / apostado, ee: ee };
}

/* ---------------- tabla de pagos, para revisarla a ojo ---------------- */
function tabla() {
  console.log('\n=== TABLA DE PAGOS (x apuesta por línea) ===\n');
  console.log('  símbolo        3        4        5');
  Object.keys(M.PAYS).reverse().forEach(id => {
    const p = M.PAYS[id];
    console.log('  ' + (M.FACE[id] + ' ' + M.NAME[id]).padEnd(16) +
                String(p[3]).padStart(6) + String(p[4]).padStart(9) + String(p[5]).padStart(9));
  });
  console.log('\n  💰 Bolsa (scatter, x apuesta total): ' +
              M.SCATTER_PAYS.slice(3).map((v, i) => (i + 3) + '→' + v + 'x').join('  '));
  console.log('  Giros gratis: ' +
              M.FREE_SPINS.slice(3).map((v, i) => (i + 3) + '→' + v).join('  ') +
              '   ·   comodín x' + M.FS_WILD_MULT + ' durante la función');

  console.log('\n=== COMPOSICIÓN DE LOS RODILLOS (40 posiciones cada uno) ===\n');
  console.log('  ' + 'símbolo'.padEnd(16) + [1, 2, 3, 4, 5].map(n => ('R' + n).padStart(5)).join(''));
  M.SYMBOLS.forEach(s => {
    console.log('  ' + (s.face + ' ' + s.name).padEnd(16) +
                M.COUNTS.map(c => String(c[s.id]).padStart(5)).join(''));
  });
}

/* ---------------- veredicto ---------------- */
function main() {
  console.log('\n' + '='.repeat(52));
  console.log('  BUBBA GOLD — 5 rodillos · 3 filas · ' + M.LINES + ' líneas');
  console.log('='.repeat(52));

  tabla();
  const e = exacto();

  // Con 0 giros sólo corre el cálculo exacto: es instantáneo y sirve
  // para iterar la tabla de pagos sin esperar el Monte Carlo.
  if (GIROS === 0) { console.log(''); return; }

  const mc = montecarlo();

  /* El veredicto se juega contra el ERROR ESTÁNDAR, no contra un umbral
     inventado. Una diferencia de medio punto puede ser un bug grave o
     ruido puro: depende de cuántas rondas se jugaron y de la volatilidad.
     Fuera de 3 errores estándar hay algo roto; adentro, es muestreo. */
  const dif = Math.abs(e.total - mc.rtp);
  const sigmas = dif / mc.ee;

  console.log('\n=== VEREDICTO ===\n');
  console.log('  Exacto       ' + pct(e.total));
  console.log('  Monte Carlo  ' + pct(mc.rtp));
  console.log('  Diferencia   ' + (dif * 100).toFixed(3) + ' puntos = ' +
              sigmas.toFixed(2) + ' errores estándar');
  console.log('\n  ' + (sigmas < 3
    ? 'Coinciden dentro del ruido. El RTP publicado es el que la máquina paga.'
    : 'NO COINCIDEN: la diferencia no se explica por muestreo. Hay un error.') + '\n');
}

main();
