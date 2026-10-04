/* ============================================================
   PROBAR EL ASISTENTE

     node tools/probar-asistente.js

   Le hace al asistente preguntas como las escribe la gente —con
   errores de tipeo, sin tildes, en voseo, de seguimiento— y
   comprueba que cada una caiga donde tiene que caer. Después le
   pide la respuesta completa a todas, para que una que tire error
   se vea acá y no en el chat de alguien.

   Carga el MISMO catálogo y el MISMO asistente que el casino. Lo
   único inventado es el estado del jugador (saldo, misiones, bote),
   que en el navegador viene de los otros módulos.

   Sale con código 1 si algo falla.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);

function cargar(rel) {
  vm.runInContext(fs.readFileSync(path.join(raiz, rel), 'utf8'), sandbox, { filename: rel });
}

/* ---------------- el casino, lo justo ---------------- */
let rol = 'jugador';
vm.runInContext(`
  var MC = window.MC = {
    fmt: function (n) { return Math.round(n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.'); },
    humanTime: function (ms) { return Math.round(ms / 60000) + ' min'; },
    seeded: function (s) { var a = s >>> 0; return function () { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; },
    registerEngine: function () {}, registerGames: function () {},
    getBalance: function () { return 12345; },
    bonusReadyIn: function () { return 0; },
    BONUS_AMOUNT: 2500,
    state: {
      stats: { plays: 120, best: 4800, net: -1500, wagered: 30000 },
      history: [{ game: 'maverick', staked: 100, returned: 250, net: 150 }]
    },
    auth: { current: function () { return { guest: false, name: 'Nacho', provider: 'google', uid: 'x' }; },
            estadoNube: function () { return 'ok'; } },
    rtp: { etiqueta: function (g) { return g.rtp; }, efectivo: function (id) { return (MCCatalog.games[id] || {}).rtpValue || 0; } }
  };
  window.MCLevels = {
    TIERS: [{ name: 'Aprendiz', min: 0, bonus: 1 }, { name: 'Apostador', min: 10000, bonus: 1.1 }],
    current: function () { return this.TIERS[0]; }, next: function () { return this.TIERS[1]; },
    getXP: function () { return 4000; }, bonusMultiplier: function () { return 1; }
  };
  window.MCMissions = {
    items: function () { return [{ key: 'spins', progress: 3, goal: 10, claimed: false }]; },
    describe: function () { return 'Jugá 10 rondas'; }
  };
  window.MCBote = { pozo: function () { return 260000; }, unoEnCuantas: function () { return 260000; },
    esCompartido: function () { return true; }, MINIMO_APUESTA: 10 };
  window.MCTorneo = { MARCAS: [{ x: 25, premio: 2000, nombre: 'Golpe' }],
    mio: function () { return { golpe: 31.5, juego: 'sebusca' }; },
    porCobrar: function () { return []; }, faltan: function () { return '2d 4h'; } };
  window.MCBienvenida = { BONO: 10000, disponible: function () { return false; },
    extraListo: function () { return false; }, hayAlgo: function () { return false; } };
  window.MCPeticiones = { MIN: 100, MAXIMO: 500000, usaNube: function () { return false; },
    miPendiente: function () { return null; }, pendientes: function () { return []; } };
  window.MCCajaAgente = { saldo: function () { return 480000; }, FLOTANTE: 500000, COMISION: 0.03,
    comisionDisponible: function () { return 1200; } };
  window.MCTema = { leer: function () { return 'oscuro'; } };
`, sandbox);
sandbox.MCRoles = { activoEsAgente: () => rol === 'agente' };

['src/catalog/slot-math.js', 'src/catalog/themes.js', 'src/catalog/generator.js', 'src/catalog/catalog.js',
 'src/ui/asistente-saber.js', 'src/ui/asistente.js'].forEach(cargar);

const A = sandbox.MCAsistente;
A.debug = true;

function aId(e) {
  if (e.tipo === 'juego') return 'juego:' + e.juego.id + ':' + e.aspecto;
  if (e.tipo === 'ir') return 'ir:' + (e.juego ? e.juego.id : e.lugar.ir);
  if (e.tipo === 'intencion') return e.def.id;
  return 'nada';
}

/* ---------------- preguntas sueltas ---------------- */
const CASOS = [
  // cuenta
  ['¿Cuánto tengo?', 'saldo'],
  ['cuanto saldo me queda', 'saldo'],
  ['cuantas fichas tengo', 'saldo'],
  ['me quede sin fichas', 'bono'],
  ['como consigo mas fichas', 'bono'],
  ['dame fichas gratis', 'bono'],
  ['cuando se recarga el bono', 'bono'],
  ['que es el bono de bienvenida', 'bienvenida'],
  ['que misiones me faltan', 'misiones'],
  ['misones', 'misiones'],
  ['cuanto me falta para subir de rango', 'rango'],
  ['que nivel vip soy', 'rango'],
  ['mis estadisticas', 'stats'],
  ['voy ganando o perdiendo?', 'stats'],
  ['como me fue en la ultima jugada', 'historial'],
  ['como guardo mi progreso', 'cuenta'],
  ['quiero registrarme', 'cuenta'],
  ['entrar con google', 'cuenta'],
  // premios
  ['cuanto esta el bote', 'bote'],
  ['como va el pozo', 'bote'],
  ['jackpot', 'bote'],
  ['como voy en el torneo', 'torneo'],
  ['cuanto falta pal torneo', 'torneo'],
  ['tabla de posiciones', 'ranking'],
  ['como comparto por whatsapp', 'compartir'],
  ['como le pido fichas al agente', 'pedidos'],
  ['qiero pedir fichas', 'pedidos'],
  // casino
  ['que es el rtp', 'rtp'],
  ['que juego paga mas', 'rtp'],
  ['que es la volatilidad', 'volatilidad'],
  ['que juego tiene el premio mas grande', 'premios'],
  ['esto esta arreglado?', 'justo'],
  ['como se que es justo', 'justo'],
  ['hay algun truco para ganar', 'truco'],
  ['funciona la martingala?', 'truco'],
  ['que juegos hay', 'juegos'],
  ['a que juego me conviene jugar', 'recomendacion'],
  ['recomendame algo', 'recomendacion'],
  ['como saco el sonido', 'ajustes'],
  ['modo oscuro', 'tema'],
  ['quiero poner un limite', 'responsable'],
  ['creo que juego mucho, no puedo parar', 'responsable'],
  ['se puede retirar plata real?', 'dinero'],
  ['puedo pagar con mercado pago', 'dinero'],
  ['se puede jugar en el celular', 'celular'],
  ['no me carga el juego', 'problema'],
  ['hola', 'saludo'],
  ['buenas noches!', 'saludo'],
  ['gracias genio', 'gracias'],
  ['que sabes hacer', 'ayuda'],
  ['chau', 'chau'],
  // juegos
  ['como se juega maverick', 'juego:maverick:como'],
  ['maverik', 'juego:maverick:ficha'],
  ['cuanto paga se busca', 'juego:sebusca:paga'],
  ['reglas del blackjack', 'juego:blackjack:como'],
  ['estrategia de blackjack', 'juego:blackjack:consejo'],
  ['cuanto paga un pleno en la ruleta', 'juego:roulette:paga'],
  ['como funciona el crash', 'juego:crash:como'],
  ['bubba jet', 'juego:crash:ficha'],
  ['mines', 'juego:mines:ficha'],
  ['buscaminas consejo', 'juego:mines:consejo'],
  ['rtp de la vendimia', 'juego:vendimia:paga'],
  ['bubba gold', 'juego:slots5:ficha'],
  ['bubba 777 cuanto paga', 'juego:slots777:paga'],
  ['doble o nada', 'juego:plantilla:ficha'],
  ['apuestas de futbol', 'juego:sports:ficha'],
  ['como apuesto a la liga', 'juego:sports:como'],
  ['jugar al 21', 'juego:blackjack:ficha'],
  ['me conviene doblar en 11', 'juego:blackjack:consejo'],
  ['cuanto es el maximo de se busca', 'juego:sebusca:paga'],
  ['el juego me robo', 'justo'],
  ['como cambio mi nombre', 'cuenta'],
  ['puedo jugar con amigos', 'compartir'],
  // navegación
  ['donde esta el torneo', 'ir:torneo'],
  ['llevame al cajero', 'ir:cajero'],
  ['donde veo mis estadisticas', 'ir:stats'],
  ['abrime la ruleta', 'ir:roulette'],
  ['donde estan los ajustes', 'ir:ajustes'],
  // fuera de tema
  ['cual es la capital de francia', 'nada'],
  ['asdkjasd', 'nada']
];

/* ---------------- charlas de varias preguntas ---------------- */
const CHARLAS = [
  [['contame de maverick', 'juego:maverick:ficha'], ['y cuanto paga?', 'juego:maverick:paga'], ['algún consejo?', 'juego:maverick:consejo']],
  [['blackjack', 'juego:blackjack:ficha'], ['¿Cómo se juega?', 'juego:blackjack:como'], ['y ese rtp?', 'juego:blackjack:paga']],
  [['mines', 'juego:mines:ficha'], ['que es el rtp', 'rtp']],
  [['como voy en el torneo', 'torneo'], ['y cuanto falta?', 'torneo']]
];

let fallas = 0;
function revisar(pregunta, esperado, obtenido) {
  if (obtenido !== esperado) {
    fallas++;
    console.log('  ✗ "' + pregunta + '" → ' + obtenido + '   (esperaba ' + esperado + ')');
  }
}

console.log('Preguntas sueltas (' + CASOS.length + ')');
CASOS.forEach(([q, esperado]) => {
  A.reiniciar();
  revisar(q, esperado, aId(A.entender(q)));
});

console.log('Charlas (' + CHARLAS.length + ')');
CHARLAS.forEach(charla => {
  A.reiniciar();
  charla.forEach(([q, esperado]) => {
    revisar(q, esperado, aId(A.entender(q)));
    A.responder(q);
  });
});

/* Todas las respuestas, como jugador y como agente: ninguna puede tirar
   error ni devolver vacío. */
console.log('Respuestas completas');
['jugador', 'agente'].forEach(r => {
  rol = r;
  CASOS.forEach(([q]) => {
    A.reiniciar();
    let res;
    try { res = A.responder(q); } catch (e) {
      fallas++;
      console.log('  ✗ [' + r + '] "' + q + '" tiró: ' + e.message);
      return;
    }
    if (!res || !res.texto || /undefined|NaN/.test(res.texto)) {
      fallas++;
      console.log('  ✗ [' + r + '] "' + q + '" respondió mal: ' + (res && res.texto));
    }
  });
});
rol = 'jugador';

if (fallas) {
  console.log('\n' + fallas + ' falla(s).');
  process.exit(1);
}
console.log('\nTodo bien.');
