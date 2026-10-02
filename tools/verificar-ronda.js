/* ============================================================
   VERIFICAR UNA RONDA DE BUBBA GOLD

     node tools/verificar-ronda.js <semillaCasa> <tuSemilla> <ronda>

   Recalcula la tirada desde cero y dibuja la grilla. Si no coincide
   con lo que viste en pantalla, algo se tocó.

   Las tres cosas salen del casino: Ajustes → Juego justo. La semilla
   de la casa sólo aparece cuando cerrás la tanda ("Revelar y empezar
   otra"): mientras está abierta se muestra su hash, que es el
   compromiso.

   ---------------------------------------------------------------
   POR QUÉ ESTO VALE ALGO
   ---------------------------------------------------------------
   Importa el MISMO módulo de matemática que juega el casino
   (src/games/slots5-math.js) y la MISMA función de azar
   (src/core/rng.js). Si tuviera su propia copia estaría verificando
   otro juego, que es el error que vuelve decorativas a la mitad de
   las herramientas de este tipo.

   También comprueba el compromiso: hace SHA-256 de la semilla que le
   pasás y lo muestra, para que lo compares con el hash que el casino
   te había mostrado ANTES de jugar. Si no coincide, la semilla
   revelada no es la que se había comprometido.

   Hasta dónde llega la garantía está explicado en core/justo.js, y
   conviene leerlo: en un casino sin servidor esto prueba
   repetibilidad, no honestidad de la casa.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');

/* ---------------- el casino de mentira, lo justo ---------------- */
const ventana = {};
global.window = ventana;
ventana.MC = {};
global.MC = ventana.MC;

new Function(fs.readFileSync(path.join(RAIZ, 'src/core/rng.js'), 'utf8'))();
const MC = global.MC;
const M = require('../src/games/slots5-math.js');

/* ---------------- argumentos ---------------- */
const [servidor, cliente, nonceTxt] = process.argv.slice(2);

if (!servidor || !cliente || nonceTxt === undefined) {
  console.log('\nUso:  node tools/verificar-ronda.js <semillaCasa> <tuSemilla> <ronda>\n');
  console.log('Las tres salen de Ajustes → Juego justo, en el casino.');
  console.log('La semilla de la casa aparece al cerrar la tanda.\n');
  process.exit(1);
}

const nonce = Number(nonceTxt);
if (!Number.isInteger(nonce) || nonce < 0) {
  console.log('\nLa ronda tiene que ser un entero desde 0.\n');
  process.exit(1);
}

/* ---------------- la misma cuenta que hace el casino ---------------- */
// Ver semillaDeRonda() en core/justo.js: es esta línea.
const semilla = MC.hashSeed(servidor + ':' + cliente + ':' + nonce);
const rnd = MC.seeded(semilla);

const compromiso = crypto.createHash('sha256').update(servidor).digest('hex');

/* ---------------- la tirada ---------------- */
const result = M.spin(rnd);
const ev = M.evaluate(result.grid, 1);

/* ---------------- salida ---------------- */
function linea(n) { return '  ' + '─'.repeat(n); }

console.log('\n' + '='.repeat(58));
console.log('  RONDA ' + nonce + ' — BUBBA GOLD');
console.log('='.repeat(58));

console.log('\n  Semilla de la casa');
console.log('    ' + servidor);
console.log('  SHA-256 (comparalo con el compromiso que viste ANTES de jugar)');
console.log('    ' + compromiso);
console.log('  Tu semilla');
console.log('    ' + cliente);
console.log('  Semilla de esta ronda (hash de las tres)');
console.log('    ' + semilla);

console.log('\n  LA GRILLA');
console.log(linea(34));
for (let f = 0; f < M.ROWS; f++) {
  let fila = '   ';
  for (let r = 0; r < M.REELS; r++) {
    const id = result.grid[f][r];
    fila += ' ' + (M.NAME[id] || id).slice(0, 5).padEnd(6);
  }
  console.log(fila);
}
console.log(linea(34));
console.log('  Paradas de cada rodillo: ' + result.stops.join(' · '));

console.log('\n  QUÉ PAGA  (en apuestas por línea)');
if (!ev.wins.length) {
  console.log('    ninguna línea');
} else {
  ev.wins.forEach((w) => {
    console.log('    línea ' + String(w.line + 1).padStart(2) + ': ' +
                w.count + ' × ' + (M.NAME[w.symbol] || w.symbol) +
                (w.wild ? ' (con comodín)' : '') + '  →  ' + w.pay);
  });
}
console.log('    total líneas: ' + ev.lineTotal);
console.log('    bolsas a la vista: ' + ev.scatters +
            (ev.scatterPay ? '  (paga ' + ev.scatterPay + ' apuestas totales)' : ''));
if (ev.freeSpins) console.log('    dispara ' + ev.freeSpins + ' giros gratis');

console.log('\n  El factor de la casa de este resultado es ' + M.factor().toFixed(4) +
            '.\n  Si el casino estaba con otro, los pagos de arriba no van a coincidir:');
console.log('  la grilla sí, que es lo que prueba que la tirada no se tocó.\n');
