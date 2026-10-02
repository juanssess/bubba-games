/* ============================================================
   EL BOTE COMPARTIDO — las dos cosas que hay que probar

     node tools/bote-compartido.js [rondas]

   1. QUE COMPARTIRLO NO LE CAMBIE EL RETORNO A NADIE.

      Es lo que decide si la función se puede publicar. Si un pozo
      común le diera menos al que apuesta poco, sería un impuesto
      encubierto del chico al grande, y habría que decirlo en
      pantalla en vez de venderlo como una mejora.

      Se mide el valor esperado EXACTO acumulado —no el realizado—
      porque con un pozo grande el que apuesta poco espera un premio
      cada millones de rondas: su resultado real es ruido puro y no
      prueba nada. Esa distinción es el punto de esta prueba.

   2. QUE DOS GANADORES SIMULTÁNEOS NO COBREN DOS VECES.

      El pozo es uno. Dos jugadores pueden sacarlo contra la misma
      foto, y la transacción tiene que dejar cobrar a uno solo. Si
      cobraran los dos, el casino pagaría dos veces un pozo que
      existe una sola vez.

   Importa MCBote.BASE y MCBote.APORTE del módulo que se publica:
   con una copia propia estaría midiendo otro bote.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

/* ---------------- el casino de mentira ---------------- */
const ventana = {};
global.window = ventana;
ventana.MC = { state: {}, rand: Math.random, save() {}, fmt: String,
               toast() {}, modal() {}, addBalance() {},
               sound: { jackpot() {} } };
global.MC = ventana.MC;
new Function(fs.readFileSync(path.join(RAIZ, 'src/progress/bote.js'), 'utf8'))();
const B = ventana.MCBote;

const RONDAS = parseInt(process.argv[2], 10) || 2000000;

let fallas = 0;
function exige(ok, texto, detalle) {
  console.log('  ' + (ok ? 'OK  ' : 'MAL ') + texto + (detalle ? '   ' + detalle : ''));
  if (!ok) fallas++;
}
function titulo(t) { console.log('\n' + t + '\n' + '='.repeat(t.length)); }

/* ============================================================
   1. ¿COMPARTIR CAMBIA EL RETORNO?
   ============================================================ */
function probarRetorno() {
  titulo('1. UN POZO COMÚN Y DOS JUGADORES MUY DESPAREJOS');
  console.log('  ' + RONDAS.toLocaleString('es-AR') + ' rondas cada uno, mismo pozo\n');

  const jug = [{ ap: 5000 }, { ap: 50 }].map((j) => ({
    ap: j.ap, apostado: 0, ev: 0, ganado: 0, premios: 0
  }));
  let pozo = B.BASE;

  for (let i = 0; i < RONDAS; i++) {
    for (const j of jug) {
      const aporte = j.ap * B.APORTE;
      const p = aporte / pozo;

      /* El valor esperado EXACTO de esta ronda: la chance por lo que
         se llevaría. El premio incluye el aporte propio, igual que en
         el motor (primero se sortea contra el pozo que había, después
         entra el aporte y eso es lo que se cobra). */
      j.ev += p * (pozo + aporte);

      const gano = Math.random() < p;
      pozo += aporte;
      j.apostado += j.ap;
      if (gano) { j.ganado += Math.floor(pozo); j.premios++; pozo = B.BASE; }
    }
  }

  jug.forEach((j) => {
    const ev = j.ev / j.apostado;
    const real = j.ganado / j.apostado;
    console.log('    apuesta ' + String(j.ap).padStart(5) +
                '   EV ' + (ev * 100).toFixed(4) + '%' +
                '   realizado ' + (real * 100).toFixed(3) + '%' +
                '   premios ' + j.premios);
  });

  console.log('');
  jug.forEach((j) => {
    const ev = j.ev / j.apostado;
    exige(Math.abs(ev - B.APORTE) < 0.0002,
      'el que apuesta ' + j.ap + ' espera el ' + (B.APORTE * 100).toFixed(0) + '% de lo suyo',
      '→ ' + (ev * 100).toFixed(4) + '%');
  });

  const difEV = Math.abs(jug[0].ev / jug[0].apostado - jug[1].ev / jug[1].apostado);
  exige(difEV < 0.0002,
    'y los dos esperan lo MISMO, aunque uno apueste 100 veces más',
    '→ diferencia ' + (difEV * 100).toFixed(5) + ' puntos');

  console.log('\n  (lo realizado difiere muchísimo entre los dos, y está bien:');
  console.log('   con el pozo de todos, el que apuesta poco espera un premio');
  console.log('   cada millones de rondas. Eso es varianza, no injusticia.)');
}

/* ============================================================
   2. DOS GANADORES A LA VEZ

   Se replica la transacción de auth-firebase.js: leer el pozo, y
   cobrar sólo si todavía hay algo arriba de la base.
   ============================================================ */
function probarCarrera() {
  titulo('2. DOS JUGADORES SACAN EL BOTE CONTRA LA MISMA FOTO');

  let pozo = B.BASE + 400000;        // un pozo gordo esperando
  let ganados = 7;
  const foto = pozo;                 // los dos lo vieron así
  const testigo = ganados;           // ...y con este contador

  /* La misma transaccion que corre en auth-firebase.js: el testigo es
     el CONTADOR de premios, no el monto. Con el monto, el aporte
     pendiente de la propia ronda levantaba el total por encima de la
     base y el segundo ganador cobraba el pozo recien reiniciado. */
  function cobrar(ganadosAlSortear, aportePendiente) {
    if (ganados !== ganadosAlSortear) return 0;
    const total = Math.floor(pozo + aportePendiente);
    pozo = B.BASE;
    ganados += 1;
    return total;
  }

  const primero = cobrar(testigo, 50);
  const segundo = cobrar(testigo, 50);

  console.log('    pozo que vieron los dos: ' + foto.toLocaleString('es-AR'));
  console.log('    cobra el primero:        ' + primero.toLocaleString('es-AR'));
  console.log('    cobra el segundo:        ' + segundo.toLocaleString('es-AR'));
  console.log('    pozo despues:            ' + pozo.toLocaleString('es-AR') + '\n');

  exige(primero > B.BASE, 'el primero se lleva el pozo');
  exige(segundo === 0, 'el segundo NO cobra nada');
  exige(pozo === B.BASE, 'y el pozo queda en la base, una sola vez');
  exige(primero + segundo < foto + 100 + B.BASE,
    'entre los dos no se pagó el pozo dos veces');
}

/* ============================================================
   3. EL MOTOR, SIN NUBE, SIGUE ANDANDO COMO ANTES
   ============================================================ */
function probarSinNube() {
  titulo('3. SIN POZO COMÚN SE JUEGA CON EL PROPIO');

  exige(!B.esCompartido(), 'sin conectar nada, no está compartido');
  const antes = B.pozo();
  B.ronda(1000);
  exige(B.pozo() >= antes, 'una ronda alimenta el pozo propio',
    '→ ' + antes + ' a ' + B.pozo());

  B.recibir({ pozo: 999999, ganados: 3, ultimo: 1 });
  exige(!B.esCompartido(),
    'con pozo de la nube pero sin canal de escritura, NO se comparte');
  exige(B.pozo() !== 999999,
    'y se sigue jugando contra el propio, no contra uno que no se puede tocar');
}

console.log('\n' + '#'.repeat(60));
console.log('#  EL BOTE COMPARTIDO');
console.log('#'.repeat(60));

probarRetorno();
probarCarrera();
probarSinNube();

titulo('RESULTADO');
if (fallas === 0) {
  console.log('  Todo bien: compartir el pozo no le cambia el retorno a nadie,');
  console.log('  y no se paga dos veces.\n');
} else {
  console.log('  ' + fallas + ' comprobación(es) fallaron.\n');
  process.exitCode = 1;
}
