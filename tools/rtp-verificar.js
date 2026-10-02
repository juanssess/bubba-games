/* ============================================================
   VERIFICAR EL PANEL DE RETORNO

     node tools/rtp-verificar.js [rondas]

   El panel de la casa promete algo concreto: si le pedís que una
   mesa pague el 90%, paga el 90%. Esta herramienta lo comprueba
   contra el código que de verdad se publica, no contra una copia.

   ---------------------------------------------------------------
   QUÉ SE PUEDE VERIFICAR DESDE ACÁ Y QUÉ NO
   ---------------------------------------------------------------
   Se cargan los archivos del casino tal cual, con un `window` de
   mentira:

     core/rtp.js          el redondeo y la aritmética del factor
     games/slots5-math.js la matemática de Bubba Gold
     games/roulette.js    `cubre` y `pagoDe`, que la ruleta exporta
                          justo para poder medirlos

   Mines y Bubba Jet no entran acá, y no es un olvido: en esos dos el
   RTP ES la constante que el panel mueve, para cualquier forma de
   jugarlos, y la demostración son dos líneas que están escritas en
   el encabezado de cada motor. Simular lo que ya está cerrado
   algebraicamente significaría escribir una segunda copia de su
   matemática en este archivo, que es exactamente lo que estas
   herramientas existen para evitar.

   Blackjack tampoco: su retorno depende de cómo juegue el jugador,
   así que no hay un número único contra el que comparar. El panel lo
   marca con ≈ por eso mismo.

   ---------------------------------------------------------------
   CÓMO SE JUZGA UN RESULTADO
   ---------------------------------------------------------------
   Lo exacto se compara con igualdad numérica: tiene que dar, no
   "andar cerca". Lo simulado se compara contra su ERROR ESTÁNDAR,
   nunca contra un umbral inventado: una diferencia de medio punto
   puede ser perfecta con pocas rondas y un escándalo con muchas.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

const RONDAS = parseInt(process.argv[2], 10) || 2000000;

/* ---------------- un casino de mentira, lo mínimo ---------------- */
// rtp.js y roulette.js esperan `window` y `MC`. Se les da lo justo:
// un estado en memoria y un generador. Nada de DOM.
const ventana = {};
global.window = ventana;
ventana.MC = { state: {}, rand: Math.random, getCurrentGame: () => null };
global.MC = ventana.MC;
ventana.MC.save = function () {};
ventana.MC.getGame = function (id) { return CATALOGO[id] || null; };

/* Los RTP de fábrica, copiados del catálogo SÓLO para esta prueba: en
   el navegador los lee de MCCatalog. Si alguno cambia allá y acá no,
   la prueba de "k·nominal" avisa sola. */
const CATALOGO = {
  slots5:   { id: 'slots5',   name: 'Bubba Gold',     rtpValue: 0.9546,  rtp: 'RTP 95,5%' },
  roulette: { id: 'roulette', name: 'Ruleta Europea', rtpValue: 36 / 37, rtp: 'RTP 97,3%' },
  mines:    { id: 'mines',    name: 'Mines',          rtpValue: 0.97,    rtp: 'RTP 97,0%' }
};
// codigo() recorre el catálogo para saber qué mesas tienen número propio.
ventana.MCCatalog = { all: Object.keys(CATALOGO).map((k) => CATALOGO[k]) };

function cargar(rel) {
  new Function(fs.readFileSync(path.join(RAIZ, rel), 'utf8'))();
}

cargar('src/core/rtp.js');
const MC = global.MC;
const M = require('../src/games/slots5-math.js');
cargar('src/games/roulette.js');
const Ruleta = ventana.MCRoulette;

/* ---------------- formato ---------------- */
function pct(x) { return (x * 100).toFixed(3) + '%'; }
function titulo(t) { console.log('\n' + t + '\n' + '='.repeat(t.length)); }

let fallas = 0;
function exige(ok, texto, detalle) {
  console.log('  ' + (ok ? 'OK  ' : 'MAL ') + texto + (detalle ? '   ' + detalle : ''));
  if (!ok) fallas++;
}

/* ============================================================
   1. EL REDONDEO A FICHAS

   Es la pieza nueva más fácil de romper y la que sostiene todo lo
   demás: si el redondeo tuviera sesgo, pedir 90% daría 89 y pico sin
   que nada más estuviera mal. Se comprueba que el promedio de
   MC.rtp.fichas(x) sea x, comparando contra el error estándar.
   ============================================================ */
function probarRedondeo() {
  titulo('1. REDONDEO A FICHAS — ¿el promedio da el valor exacto?');
  console.log('  (' + RONDAS.toLocaleString('es-AR') + ' muestras por valor)\n');

  [17.55, 1.5, 0.1, 249.999, 3.0].forEach((x) => {
    let suma = 0;
    for (let i = 0; i < RONDAS; i++) suma += MC.rtp.fichas(x);
    const media = suma / RONDAS;

    /* El resultado es piso o piso+1, así que es una Bernoulli escalada:
       varianza p(1−p) con p = la parte decimal. */
    const p = x - Math.floor(x);
    const se = Math.sqrt(p * (1 - p) / RONDAS);
    const sigmas = se > 0 ? Math.abs(media - x) / se : 0;

    exige(sigmas < 4,
      'E[fichas(' + x + ')] = ' + media.toFixed(5),
      '→ ' + (se > 0 ? sigmas.toFixed(2) + ' σ' : 'exacto, sin resto'));
  });

  // Y que nunca devuelva algo que no sea una ficha entera.
  let enteros = true;
  for (let i = 0; i < 10000; i++) {
    const v = MC.rtp.fichas(Math.random() * 500);
    if (v !== Math.floor(v)) enteros = false;
  }
  exige(enteros, 'siempre devuelve fichas enteras');
}

/* ============================================================
   2. LA ARITMÉTICA DEL FACTOR
   ============================================================ */
function probarFactor() {
  titulo('2. ARITMÉTICA DEL FACTOR');

  /* Estas pruebas NO dan por sentado que la casa no publica nada. La
     primera versión comparaba contra 1, y el día que se publicó un
     recorte se cayeron tres comprobaciones sin que hubiera ningún
     error: el invariante no es "sin ajustes da 1", es "sin ajustes da
     lo que publica la casa". Una prueba que hay que arreglar cada vez
     que se cambia una constante no sirve para avisar de nada. */
  const pub = MC.rtp.factorPublicado('slots5');
  console.log('  (la casa publica ' + pub.toFixed(4) + ' para esta mesa)\n');

  MC.rtp.reset();
  exige(MC.rtp.factor('slots5') === pub,
    'sin nada propio, corre lo publicado (' + pub.toFixed(4) + ')');

  MC.rtp.setGlobal(0.9);
  exige(Math.abs(MC.rtp.factor('slots5') - 0.9) < 1e-12,
    'un juego sin ajuste propio sigue al global');

  MC.rtp.set('slots5', 0.8);
  exige(Math.abs(MC.rtp.factor('slots5') - 0.8) < 1e-12,
    'el ajuste propio GANA sobre el global (no se multiplican)');
  exige(Math.abs(MC.rtp.factor('roulette') - 0.9) < 1e-12,
    'y no contagia a las otras mesas');

  MC.rtp.quitar('slots5');
  exige(Math.abs(MC.rtp.factor('slots5') - 0.9) < 1e-12,
    'al quitarlo, vuelve a seguir al global');

  MC.rtp.setGlobal(1.8);
  exige(MC.rtp.factor('slots5') === 1, 'no se puede subir por encima de 1');
  MC.rtp.setGlobal(0.01);
  exige(Math.abs(MC.rtp.factor('slots5') - MC.rtp.MIN) < 1e-12,
    'no se puede bajar por debajo de ' + MC.rtp.MIN);

  MC.rtp.setGlobal(0.7);
  exige(MC.rtp.factor('maverick') === 1,
    'los juegos en iframe quedan en 1: el panel no los alcanza');

  MC.rtp.reset();
  exige(!MC.rtp.hayLocal(), 'reset deja el navegador sin nada propio');
  exige(MC.rtp.factor('slots5') === pub, 'y de vuelta en lo publicado');
}

/* ============================================================
   3. BUBBA GOLD — exacto a varios factores

   Es la prueba central: el RTP exacto de la tabla escalada tiene que
   dar k × el RTP de fábrica, para todo k. Si diera cualquier otra
   cosa, el deslizador del panel estaría mintiendo.
   ============================================================ */
function probarGoldExacto() {
  titulo('3. BUBBA GOLD — RTP exacto a distintos factores');

  M.setFactor(1);
  const base = M.exactRTP().total;
  console.log('  RTP de fábrica: ' + pct(base) + '\n');

  [1, 0.97, 0.95, 0.9, 0.85, 0.8, 0.5].forEach((k) => {
    M.setFactor(k);
    const r = M.exactRTP().total;
    const esperado = base * k;
    /* Igualdad numérica: el factor sale de factor común, así que esto
       no es una aproximación. Se tolera sólo el ruido de coma flotante. */
    exige(Math.abs(r - esperado) < 1e-12,
      'k=' + k.toFixed(2) + ' → ' + pct(r),
      'esperado ' + pct(esperado));
  });

  M.setFactor(1);
}

/* ============================================================
   4. BUBBA GOLD — Monte Carlo con el factor puesto

   El exacto podría estar bien y el motor pagar otra cosa. Esto juega
   rondas completas, con giros gratis y retriggers, al factor elegido.
   ============================================================ */
function probarGoldSimulado(k, rondas) {
  titulo('4. BUBBA GOLD — ' + rondas.toLocaleString('es-AR') +
         ' rondas jugadas con k=' + k);

  M.setFactor(k);
  const objetivo = M.exactRTP().total;

  const APUESTA = M.LINES;
  let apostado = 0;
  let devuelto = 0;
  let sumaCuadrados = 0;

  for (let i = 0; i < rondas; i++) {
    apostado += APUESTA;
    let gano = 0;

    // Giro pago
    let r = M.spin(Math.random);
    let ev = M.evaluate(r.grid, 1);
    gano += ev.lineTotal + ev.scatterPay * APUESTA;

    // Giros gratis, con sus retriggers (igual que el motor)
    let libres = ev.freeSpins;
    while (libres > 0) {
      libres--;
      r = M.spin(Math.random);
      ev = M.evaluate(r.grid, M.FS_WILD_MULT);
      gano += ev.lineTotal + ev.scatterPay * APUESTA;
      libres += ev.freeSpins;
    }

    devuelto += gano;
    const x = gano / APUESTA;
    sumaCuadrados += x * x;
  }

  const rtp = devuelto / apostado;
  const media = devuelto / rondas / APUESTA;
  const varianza = sumaCuadrados / rondas - media * media;
  const se = Math.sqrt(varianza / rondas);
  const sigmas = Math.abs(rtp - objetivo) / se;

  console.log('  Medido    ' + pct(rtp));
  console.log('  Exacto    ' + pct(objetivo));
  console.log('  Error est. ±' + pct(se) + '  (1 σ)');
  exige(sigmas < 4, 'coincide dentro del ruido', '→ ' + sigmas.toFixed(2) + ' σ');

  M.setFactor(1);
}

/* ============================================================
   5. LA RULETA — las trece apuestas, con y sin factor

   Se usa el `pagoDe` que exporta el motor, no una copia. La
   propiedad que se verifica es la que hace honesta a esta mesa: TODAS
   las apuestas tienen el mismo margen, también después de bajarlo.
   ============================================================ */
function probarRuleta() {
  titulo('5. RULETA EUROPEA — las trece apuestas');

  const TIPOS = [
    ['straight', 7], ['split', 7], ['street', 7], ['corner', 7], ['line', 7],
    ['dozen', 1], ['column', 1],
    ['red', 0], ['black', 0], ['even', 0], ['odd', 0], ['low', 0], ['high', 0]
  ];

  [1, 0.9].forEach((k) => {
    /* El factor se fija SIEMPRE a mano, también el 1: si se dejara en
       reset, la prueba mediría lo que la casa esté publicando en vez
       del caso que quiere probar. */
    MC.rtp.reset();
    MC.rtp.set('roulette', k);

    const esperado = k * 36 / 37;
    console.log('\n  k=' + k.toFixed(2) + ' → RTP esperado ' + pct(esperado) +
                ' en las trece');

    let todasIguales = true;
    TIPOS.forEach(([type, value]) => {
      const bet = { type: type, value: value };
      const n = Ruleta.cubre(bet).length;
      const pago = Ruleta.pagoDe(bet);

      /* Esperanza sobre los 37 números: n de ellos devuelven (pago+1)
         veces la ficha y los otros 37−n no devuelven nada. */
      const rtp = (n / 37) * (pago + 1);
      const ok = Math.abs(rtp - esperado) < 1e-12;
      if (!ok) todasIguales = false;

      console.log('    ' + type.padEnd(9) + ' cubre ' + String(n).padStart(2) +
                  '  paga ' + pago.toFixed(4).padStart(9) + ':1  → ' + pct(rtp) +
                  (ok ? '' : '   <-- MAL'));
    });
    exige(todasIguales, 'las trece dan el mismo RTP = k·36/37');
  });

  MC.rtp.reset();
}

/* ============================================================
   6. EL CIRCUITO DE PUBLICAR, DE PUNTA A PUNTA

   El panel no puede escribir en el disco: devuelve el texto que va
   en PUBLICADO y vos lo pegás. Eso deja un hueco donde nada avisa si
   el texto sale mal — y saldría mal en silencio, porque un PUBLICADO
   con un error de sintaxis rompe rtp.js entero y el casino no abre.

   Esta prueba cierra el hueco: configura un retorno a mano, pide las
   líneas, las PEGA de verdad en una copia del módulo, la carga en un
   navegador nuevo y sin nada guardado, y comprueba que las mesas
   paguen lo mismo. Si el generador se equivoca de coma, acá se cae.
   ============================================================ */
function probarPublicar() {
  titulo('6. PUBLICAR — ¿las líneas que entrega el panel reproducen lo configurado?');

  // 1. Alguien configura esto en su navegador y queda conforme.
  MC.rtp.reset();
  MC.rtp.setGlobal(0.93);
  MC.rtp.set('slots5', 0.85);

  const esperado = {};
  Object.keys(CATALOGO).forEach((id) => { esperado[id] = MC.rtp.factor(id); });
  const codigo = MC.rtp.codigo();

  console.log('\n  Lo que entrega el panel:\n');
  codigo.split('\n').forEach((l) => console.log('    ' + l));
  console.log('');

  // 2. Se pega en el módulo, como haría el usuario.
  const fuente = fs.readFileSync(path.join(RAIZ, 'src/core/rtp.js'), 'utf8');
  const bloque = /  var PUBLICADO = \{[\s\S]*?\n  \};/;
  exige(bloque.test(fuente), 'el bloque PUBLICADO se encuentra en el archivo');
  const pegado = fuente.replace(bloque, codigo);

  // 3. Un navegador nuevo: nadie tocó nada en ESA compu.
  const otra = { MCCatalog: ventana.MCCatalog };
  otra.MC = { state: {}, rand: Math.random, getCurrentGame: () => null,
              save: () => {}, getGame: (id) => CATALOGO[id] || null };
  const cargarEn = new Function('window', 'MC', pegado);
  try {
    cargarEn(otra, otra.MC);
  } catch (e) {
    exige(false, 'el código pegado se carga sin romper', e.message);
    return;
  }
  exige(true, 'el código pegado se carga sin romper');

  // 4. ¿Paga lo mismo que pagaba el que lo configuró?
  let todas = true;
  Object.keys(esperado).forEach((id) => {
    const ahora = otra.MC.rtp.factor(id);
    const ok = Math.abs(ahora - esperado[id]) < 0.0001;
    if (!ok) todas = false;
    console.log('    ' + id.padEnd(10) + ' configurado ' + esperado[id].toFixed(4) +
                '  publicado ' + ahora.toFixed(4) + (ok ? '' : '   <-- MAL'));
  });
  exige(todas, 'cada mesa paga lo mismo publicada que configurada a mano');
  exige(!otra.MC.rtp.hayLocal(),
    'y en esa compu no hay nada local: lo que se ve viene del código');

  MC.rtp.reset();
}

/* ============================================================
   7. LA MIGRACIÓN DE LAS CUENTAS VIEJAS

   La primera versión de este panel guardaba {global:1, juegos:{}} en
   toda cuenta, tocara o no la perilla. Con las reglas de hoy eso es
   "quiero el 100%, ignorá lo publicado", y le taparía a la casa
   cualquier recorte que publicara después. Tiene que limpiarse.
   ============================================================ */
function probarMigracion() {
  titulo('7. MIGRACIÓN — una cuenta vieja no debe tapar lo publicado');

  MC.state.rtp = { global: 1, juegos: {} };     // como la guardaba la versión anterior
  exige(!MC.rtp.hayLocal(),
    'el {global:1} de fábrica se limpia: la cuenta queda sin nada propio');

  // Pero un 100% puesto A PROPÓSITO, después, se respeta.
  MC.rtp.setGlobal(1);
  MC.rtp.set('mines', 0.9);
  MC.rtp.quitar('mines');
  exige(MC.rtp.hayLocal(),
    'y un 100% elegido a mano después NO se borra');

  MC.rtp.reset();
}

/* ---------------- corrida ---------------- */
console.log('\n' + '#'.repeat(62));
console.log('#  VERIFICACIÓN DEL PANEL DE RETORNO');
console.log('#'.repeat(62));

probarRedondeo();
probarFactor();
probarGoldExacto();
probarGoldSimulado(0.9, RONDAS);
probarRuleta();
probarPublicar();
probarMigracion();

titulo('RESULTADO');
if (fallas === 0) {
  console.log('  Todo bien: el panel paga lo que promete.\n');
} else {
  console.log('  ' + fallas + ' comprobación(es) fallaron. Revisar arriba.\n');
  process.exitCode = 1;
}
