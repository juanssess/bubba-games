/* ============================================================
   BANCO DE PRUEBAS DE MODELOS DE LA LIGA

     node tools/probar-modelos.js

   `medir-liga.js` contesta "cuanto margen tiene el casino hoy".
   Esto contesta la siguiente: "que modelo lo arregla". Corre varios
   candidatos SOBRE LOS MISMOS PARTIDOS y los compara.

   ---------------------------------------------------------------
   POR QUE LA COMPARACION ES APAREADA
   ---------------------------------------------------------------
   El RTP de un modelo sobre 300 partidos tiene un error de +-3
   puntos. Comparar dos numeros con ese error no distingue nada por
   debajo de seis puntos, y las mejoras de modelo casi nunca son tan
   grandes.

   Pero los dos modelos apuestan a LOS MISMOS partidos, asi que la
   DIFERENCIA por partido es una variable propia y con un desvio
   mucho menor: si los dos aciertan y fallan juntos, la diferencia
   es estable aunque cada uno baile. Por eso el informe muestra el
   error DE LA DIFERENCIA y no el de cada modelo suelto.

   ---------------------------------------------------------------
   SIN MIRAR EL FUTURO
   ---------------------------------------------------------------
   Igual que en medir-liga.js: se camina cada temporada en orden y
   la historia de un partido son SOLO los partidos anteriores. Las
   temporadas se recorren por separado —la fuerza de un equipo no
   cruza de un anio al otro— y despues se juntan las apuestas.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '.cache', 'liga-4406-todas.json');
const MIN_PJ = 3;          // fechas minimas de cada equipo
const MIN_LIGA = 20;       // partidos minimos jugados en la temporada
/* Seis fechas de 15 partidos: lo que el casino baja de verdad en cada
   actualizacion. Ver el bloque HISTORIAL de src/sports/league.js. */
const VENTANA = 90;

const ventana = {};
global.window = ventana;
new Function(fs.readFileSync(path.join(RAIZ, 'src/sports/poisson.js'), 'utf8'))();
const MCPoisson = ventana.MCPoisson;

function constante(nombre) {
  const src = fs.readFileSync(path.join(RAIZ, 'src/sports/league.js'), 'utf8');
  const m = src.match(new RegExp('var\\s+' + nombre + '\\s*=\\s*([0-9.]+)'));
  /* Si no esta, es porque el modelo viejo ya no existe en league.js —se
     midio que estaba mal y se saco—. Se usan los valores historicos para
     que el modelo `hoy` siga siendo comparable. */
  return m ? Number(m[1]) : { LEAGUE_AVG: 1.35, HOME_ADV: 1.15 }[nombre];
}
const LEAGUE_AVG = constante('LEAGUE_AVG');
const HOME_ADV = constante('HOME_ADV');

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

const corte = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ============================================================
   LOS MODELOS

   Cada uno recibe la historia —equipo local, visitante y los
   totales de la liga hasta ese momento— y devuelve las dos lambdas.
   Nada mas. Asi se comparan de a pares sin tocar el arnes.

   Campos de un equipo:
     pj, gf, gc          todo junto
     pjL, gfL, gcL       de local
     pjV, gfV, gcV       de visitante
   ============================================================ */
const MODELOS = [
  {
    id: 'viejo',
    nombre: 'El modelo VIEJO (antes de medir)',
    /* Fijado a mano y no leido del sitio: poisson.js ya cambio, y si este
       modelo siguiera el archivo dejaria de ser el punto de comparacion.
       Es el unico que se congela a proposito. */
    nota: 'constantes 1,35 y 1,15, sin Dixon-Coles, margen 5%',
    rho: 0,
    margen: 0.05,
    lambdas: (h, a) => {
      const f = (pj, gf, gc) => pj ? {
        at: corte((gf / pj) / LEAGUE_AVG, 0.65, 1.55),
        df: corte(LEAGUE_AVG / Math.max(0.35, gc / pj), 0.65, 1.55)
      } : { at: 1, df: 1 };
      const H = f(h.pj, h.gf, h.gc), A = f(a.pj, a.gf, a.gc);
      return { home: LEAGUE_AVG * H.at / A.df * HOME_ADV, away: LEAGUE_AVG * A.at / H.df };
    }
  },
  {
    id: 'calibrado',
    rho: 0,
    margen: 0.05,
    nombre: 'Sin constantes, promedios de la liga',
    nota: 'los promedios de local y de visitante salen de lo ya jugado',
    lambdas: (h, a, liga) => {
      const pl = liga.gLocal / liga.pj, pv = liga.gVisita / liga.pj;
      const pe = (liga.gLocal + liga.gVisita) / (liga.pj * 2);
      const at = (t) => corte((t.gf / t.pj) / pe, 0.5, 1.8);
      const fl = (t) => corte((t.gc / t.pj) / pe, 0.5, 1.8);
      return { home: pl * at(h) * fl(a), away: pv * at(a) * fl(h) };
    }
  },
  {
    id: 'split',
    rho: 0,
    margen: 0.05,
    nombre: 'Con historial separado de local y de visitante',
    nota: 'un equipo ataca distinto en su cancha que afuera',
    lambdas: (h, a, liga) => {
      const pl = liga.gLocal / liga.pj, pv = liga.gVisita / liga.pj;
      /* La fuerza de local se mide con los partidos DE LOCAL y contra el
         promedio de local. Mezclar las dos mitades —que es lo que hace el
         modelo anterior— borra justamente la diferencia que mas separa a un
         equipo de otro en el futbol argentino. */
      const razon = (pj, g, base) => pj ? corte((g / pj) / base, 0.5, 1.8) : 1;
      return {
        home: pl * razon(h.pjL, h.gfL, pl) * razon(a.pjV, a.gcV, pl),
        away: pv * razon(a.pjV, a.gfV, pv) * razon(h.pjL, h.gcL, pv)
      };
    }
  },
  {
    id: 'encogido',
    rho: 0,
    margen: 0.05,
    nombre: 'Split + encogido hacia el promedio',
    nota: 'con pocas fechas la fuerza de un equipo es casi ruido',
    lambdas: (h, a, liga) => {
      const pl = liga.gLocal / liga.pj, pv = liga.gVisita / liga.pj;
      /* K partidos de "prior": un equipo con cuatro fechas pesa 4/(4+K) su
         propio numero y el resto el promedio de la liga. Sin esto, tres
         goleadas al hilo convierten a cualquiera en el Bayern y el precio se
         va al diablo — y de ahi sale buena parte de la sangria. */
      const K = 6;
      const enc = (pj, g, base) => corte((g + K * base) / ((pj + K) * base), 0.5, 1.8);
      return {
        home: pl * enc(h.pjL, h.gfL, pl) * enc(a.pjV, a.gcV, pl),
        away: pv * enc(a.pjV, a.gfV, pv) * enc(h.pjL, h.gcL, pv)
      };
    }
  },
  {
    id: 'mixto',
    rho: 0,
    margen: 0.05,
    nombre: 'Encogido, mezclando split y total',
    nota: 'mitad su forma en esa condicion, mitad su forma general',
    lambdas: (h, a, liga) => {
      const pl = liga.gLocal / liga.pj, pv = liga.gVisita / liga.pj;
      const pe = (liga.gLocal + liga.gVisita) / (liga.pj * 2);
      const K = 6, W = 0.5;
      /* El split es mas informativo pero tiene la mitad de partidos detras.
         Mezclar las dos vistas es la forma barata de quedarse con lo que
         aporta cada una: la especificidad del split y la estabilidad del
         total. */
      const razon = (pjX, gX, baseX, pjT, gT, baseT) => {
        const a1 = (gX + K * baseX) / ((pjX + K) * baseX);
        const a2 = (gT + K * baseT) / ((pjT + K) * baseT);
        return corte(W * a1 + (1 - W) * a2, 0.5, 1.8);
      };
      return {
        home: pl * razon(h.pjL, h.gfL, pl, h.pj, h.gf, pe) *
                   razon(a.pjV, a.gcV, pl, a.pj, a.gc, pe),
        away: pv * razon(a.pjV, a.gfV, pv, a.pj, a.gf, pe) *
                   razon(h.pjL, h.gcL, pv, h.pj, h.gc, pe)
      };
    }
  }
];

/* Las variantes Dixon-Coles usan las MISMAS lambdas que `mixto` —el mejor
   hasta aca— y cambian solo como se reparte el marcador. Asi la comparacion
   aisla el efecto del retoque y no lo mezcla con un cambio de lambdas. */
const lambdasMixto = MODELOS.filter((m) => m.id === 'mixto')[0].lambdas;
[-0.05, -0.10, -0.15].forEach((rho) => {
  MODELOS.push({
    id: 'dc' + String(Math.round(Math.abs(rho) * 100)),
    nombre: 'Mixto + Dixon-Coles (rho ' + rho.toFixed(2) + ')',
    nota: 'mismas lambdas que mixto; retoca 0-0, 1-1, 1-0 y 0-1',
    rho: rho,
    lambdas: lambdasMixto
  });
});

/* ============================================================
   EL MARGEN QUE HAY QUE COBRAR PARA GANAR EL QUE SE DECLARA

   Despues de arreglar todo lo arreglable, al mejor modelo le sigue
   faltando. No es raro: un Poisson con dos numeros por equipo no le
   va a ganar al futbol, y cada punto de error del modelo se lo come
   el margen.

   Asi que el ultimo ajuste no es de modelo, es del precio. Si
   cobrando 5% nominal el retorno real queda en 97,5%, entonces para
   que quede en 95,24% hay que cobrar mas. El numero no se despeja a
   ojo —el margen entra dividiendo cada probabilidad y despues se
   redondea la cuota— se prueba y se mide, que es lo mismo que se
   hace con el precio de la compra de bonus en los slots.

   Lo importante: esto NO es "cobrar mas caro y taparlo". Es que el
   numero declarado sea cierto. Un 5% que en la practica es -2% es
   peor cartel que un 8% que en la practica es 5%.
   ============================================================ */
/* ============================================================
   LO QUE EL CASINO PUEDE CALCULAR DE VERDAD

   Los modelos de arriba usan el historial de local y de visitante
   por equipo. El casino NO lo tiene: saca las fuerzas de
   `lookuptable.php`, que trae la tabla de posiciones —partidos
   jugados, goles a favor y en contra, TODO junto— sin separar
   cancha propia de ajena.

   Asi que hay que medir la version que si es implementable hoy:
   totales encogidos, sin split, con Dixon-Coles y con el margen
   calibrado. Si esta queda cerca de la de arriba, se implementa y
   listo. Si queda lejos, el paso siguiente es que league.js arme
   las fuerzas desde los partidos en vez de la tabla, y eso ya es
   otro trabajo.

   La ventaja de local tampoco esta en la tabla: se puede sacar de
   los resultados que el casino ya baja, encogida contra un valor de
   referencia para que no baile con veinte partidos.
   ============================================================ */
MODELOS.push({
  id: 'tabla80',
  nombre: 'Solo con la tabla: totales encogidos + DC, 8,0% nominal',
  nota: 'lo unico implementable sin cambiar de donde salen los datos',
  rho: -0.10,
  margen: 0.08,
  lambdas: (h, a, liga) => {
    const pe = (liga.gLocal + liga.gVisita) / (liga.pj * 2);
    // Ventaja de local encogida hacia 1,25 con 40 partidos de prior.
    const V = 40, REF = 1.25;
    const v = (liga.gLocal + V * REF * (liga.gVisita / Math.max(1, liga.pj)) * liga.pj / Math.max(1, liga.pj)) /
              Math.max(0.01, liga.gVisita + V * (liga.gVisita / Math.max(1, liga.pj)));
    const vv = corte(isFinite(v) ? v : REF, 1.0, 1.6);
    const pl = pe * 2 * vv / (1 + vv), pv = pe * 2 / (1 + vv);
    const K = 6;
    const enc = (t, g) => corte((g + K * pe) / ((t.pj + K) * pe), 0.5, 1.8);
    return {
      home: pl * enc(h, h.gf) * enc(a, a.gc),
      away: pv * enc(a, a.gf) * enc(h, h.gc)
    };
  }
});

/* ============================================================
   LO QUE EL CASINO JUEGA AHORA MISMO

   No trae `rho` ni `margen`: usa el poisson.js del sitio tal cual
   esta. Sus lambdas son una copia de las de league.js. Es el unico
   modelo cuyo numero se puede poner en la ficha del juego, porque es
   el unico que mide lo que un jugador va a recibir hoy.
   ============================================================ */
MODELOS.push({
  id: 'enVivo',
  nombre: 'EL QUE JUEGA AHORA (league.js + poisson.js del sitio)',
  nota: 'totales encogidos con K=6, promedios de la tabla, DC y margen del sitio',
  lambdas: (h, a, liga) => {
    const pe = (liga.gLocal + liga.gVisita) / (liga.pj * 2);
    const V = 40, REF = 1.25;
    const gv = liga.gVisita, n = liga.pj;
    let v = n ? (liga.gLocal + V * REF * (gv / n)) / Math.max(0.01, gv + V * (gv / n)) : REF;
    if (!isFinite(v)) v = REF;
    v = corte(v, 1.0, 1.6);
    const pl = pe * 2 * v / (1 + v), pv = pe * 2 / (1 + v);
    const K = 6;
    const f = (t, g) => corte((g + K * pe) / ((t.pj + K) * pe), 0.5, 1.8);
    return { home: pl * f(h, h.gf) * f(a, a.gc), away: pv * f(a, a.gf) * f(h, h.gc) };
  }
});

/* ============================================================
   EL MISMO MODELO, PERO CON LA MEMORIA QUE EL CASINO TIENE

   `enVivo` usa toda la temporada. El sitio no puede: baja seis
   fechas hacia atras, unos noventa partidos, asi que cada equipo
   tiene cinco o seis y no veinte. Menos historia es menos
   discriminacion, y por eso este numero —y no el de `enVivo`— es el
   que se puede poner en la ficha del juego.
   ============================================================ */
MODELOS.push({
  id: 'enVivoReal',
  nombre: 'EL QUE JUEGA AHORA, con su memoria real (6 fechas)',
  nota: 'identico a enVivo pero viendo solo los ultimos 90 partidos',
  ventana: true,
  lambdas: (h, a, liga) => {
    if (!liga.pj) return { home: 1.25, away: 0.97 };
    const pe = (liga.gLocal + liga.gVisita) / (liga.pj * 2) || 1.10;
    const V = 40, REF = 1.25;
    const gv = liga.gVisita, n = liga.pj;
    let v = n ? (liga.gLocal + V * REF * (gv / n)) / Math.max(0.01, gv + V * (gv / n)) : REF;
    if (!isFinite(v)) v = REF;
    v = corte(v, 1.0, 1.6);
    const pl = pe * 2 * v / (1 + v), pv = pe * 2 / (1 + v);
    const K = 6;
    const f = (t, g) => t.pj ? corte((g + K * pe) / ((t.pj + K) * pe), 0.5, 1.8) : 1;
    return { home: pl * f(h, h.gf) * f(a, a.gc), away: pv * f(a, a.gf) * f(h, h.gc) };
  }
});

[0.07, 0.075, 0.08].forEach((m) => {
  MODELOS.push({
    id: 'dc10m' + String(Math.round(m * 1000)),
    nombre: 'Mixto + DC (rho -0,10) cobrando ' + (m * 100).toFixed(1) + '% nominal',
    nota: 'mismo modelo; lo unico que cambia es cuanto margen se carga',
    rho: -0.10,
    margen: m,
    lambdas: lambdasMixto
  });
});

/* ============================================================
   CORRECCION DIXON-COLES

   El modelo `mixto` ya clava los goles totales y sin embargo sigue
   perdiendo en DOS mercados concretos, los dos por lo mismo:

     empate         predice 29,0%  y pasa 31,2%
     ambos marcan   predice 39,7%  y pasa 43,7%

   Las dos Poisson independientes reparten mal los partidos de pocos
   goles: en el futbol de verdad el 0-0 y el 1-1 aparecen mas de lo
   que dice la independencia, y el 1-0 y el 0-1 menos. Dixon y Coles
   (1997) lo arreglan retocando esas cuatro casillas con un solo
   parametro, sin tocar las lambdas ni el total de goles.

   Con rho negativo suben 0-0 y 1-1 y bajan 1-0 y 0-1. Eso levanta
   los empates (las dos casillas son empate) y de paso levanta
   "ambos marcan" por el 1-1. Es exactamente donde faltaba.

   No es un parche inventado para estos datos: es el ajuste estandar
   del area, y aca se prueba con tres valores para ver cuanto pesa.
   ============================================================ */
function mercadosDC(lh, la, rho) {
  const MAX = 9;
  const pmf = (k, l) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p = p * l / i; return p; };
  const ph = [], pa = [];
  for (let k = 0; k <= MAX; k++) { ph.push(pmf(k, lh)); pa.push(pmf(k, la)); }

  const tau = (i, j) => {
    if (i === 0 && j === 0) return 1 - lh * la * rho;
    if (i === 0 && j === 1) return 1 + lh * rho;
    if (i === 1 && j === 0) return 1 + la * rho;
    if (i === 1 && j === 1) return 1 - rho;
    return 1;
  };

  let home = 0, draw = 0, away = 0, over = 0, btts = 0, total = 0;
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      // El retoque puede dar negativo con rho grande; se corta en cero.
      const p = Math.max(0, ph[i] * pa[j] * tau(i, j));
      total += p;
      if (i > j) home += p; else if (i === j) draw += p; else away += p;
      if (i + j >= 3) over += p;
      if (i >= 1 && j >= 1) btts += p;
    }
  }
  // Renormalizar: el retoque no conserva la masa exactamente.
  return {
    home: home / total, draw: draw / total, away: away / total,
    over: over / total, under: 1 - over / total,
    btts: btts / total, nobtts: 1 - btts / total
  };
}

/* ============================================================
   EL ARNES
   ============================================================ */

function vacio() {
  const acc = {};
  MERCADOS.forEach((m) => { acc[m] = { n: 0, dev: 0, prob: 0, paso: 0 }; });
  return { acc, n: 0, lam: 0, gol: 0, porPartido: [] };
}

function correr(temporadas) {
  const res = {};
  MODELOS.forEach((m) => { res[m.id] = vacio(); });
  const nuevo = () => ({ pj: 0, gf: 0, gc: 0, pjL: 0, gfL: 0, gcL: 0, pjV: 0, gfV: 0, gcV: 0 });

  for (const partidos of temporadas) {
    const eq = {};
    const jugados = [];
    const liga = { pj: 0, gLocal: 0, gVisita: 0 };

    for (const p of partidos) {
      const h = eq[p.local] || nuevo();
      const a = eq[p.visita] || nuevo();

      /* Un partido entra a la medicion solo si TODOS los modelos tienen con
         que estimarlo. Si no, el que necesita menos historia mediria mas
         partidos y la comparacion dejaria de ser apareada. */
      /* La ventana movil: los ultimos VENTANA partidos de la temporada. Es
         lo unico que el casino tiene de verdad —baja seis fechas hacia
         atras— asi que un modelo que use toda la historia mediria algo que
         el sitio no puede hacer. */
      const recientes = jugados.slice(-VENTANA);
      const eqV = {};
      const ligaV = { pj: 0, gLocal: 0, gVisita: 0 };
      recientes.forEach((m) => {
        const x = eqV[m.local] || (eqV[m.local] = { pj: 0, gf: 0, gc: 0 });
        const y = eqV[m.visita] || (eqV[m.visita] = { pj: 0, gf: 0, gc: 0 });
        x.pj++; x.gf += m.gh; x.gc += m.ga;
        y.pj++; y.gf += m.ga; y.gc += m.gh;
        ligaV.pj++; ligaV.gLocal += m.gh; ligaV.gVisita += m.ga;
      });

      if (h.pj >= MIN_PJ && a.pj >= MIN_PJ && liga.pj >= MIN_LIGA &&
          h.pjL >= 1 && a.pjV >= 1) {
        for (const mod of MODELOS) {
          const l = mod.ventana
            ? mod.lambdas(eqV[p.local] || { pj: 0, gf: 0, gc: 0 },
                          eqV[p.visita] || { pj: 0, gf: 0, gc: 0 }, ligaV)
            : mod.lambdas(h, a, liga);
          // Con `rho` el modelo usa Dixon-Coles; sin el, el poisson.js del sitio.
          /* `rho` definido (aunque sea 0) = el modelo trae su propia
             matematica y no depende del poisson.js del sitio. Sin `rho` se
             usa el del sitio, que es lo que mide el modelo `enVivo`. */
          const pr = mod.rho !== undefined
            ? mercadosDC(l.home, l.away, mod.rho)
            : MCPoisson.markets(l.home, l.away);
          /* Sin `margen` propio se usa el oddsFor del sitio, que es el que
             juega. Con margen propio se replica su cuenta exacta —incluido
             el redondeo a dos decimales, que no es despreciable en cuotas
             bajas— para que la unica diferencia sea el margen. */
          const cuotas = mod.margen
            ? (ps) => ps.map((p) => Math.max(1.01, Math.round((1 / (p * (1 + mod.margen))) * 100) / 100))
            : MCPoisson.oddsFor;
          const c1 = cuotas([pr.home, pr.draw, pr.away]);
          const c2 = cuotas([pr.over, pr.under]);
          const c3 = cuotas([pr.btts, pr.nobtts]);
          const cu = { home: c1[0], draw: c1[1], away: c1[2],
            over: c2[0], under: c2[1], btts: c3[0], nobtts: c3[1] };

          const r = res[mod.id];
          let devPartido = 0;
          for (const mk of MERCADOS) {
            const A = r.acc[mk];
            A.n++;
            A.prob += pr[mk];
            if (gano(mk, p.gh, p.ga)) {
              A.dev += cu[mk];
              A.paso++;
              devPartido += cu[mk];
            }
          }
          r.n++;
          r.lam += l.home + l.away;
          r.gol += p.gh + p.ga;
          // Lo devuelto por las siete apuestas de ESTE partido: es la unidad
          // de la comparacion apareada.
          r.porPartido.push(devPartido);
        }
      }

      jugados.push(p);
      eq[p.local] = { pj: h.pj + 1, gf: h.gf + p.gh, gc: h.gc + p.ga,
        pjL: h.pjL + 1, gfL: h.gfL + p.gh, gcL: h.gcL + p.ga,
        pjV: h.pjV, gfV: h.gfV, gcV: h.gcV };
      eq[p.visita] = { pj: a.pj + 1, gf: a.gf + p.ga, gc: a.gc + p.gh,
        pjL: a.pjL, gfL: a.gfL, gcL: a.gcL,
        pjV: a.pjV + 1, gfV: a.gfV + p.ga, gcV: a.gcV + p.gh };
      liga.pj++; liga.gLocal += p.gh; liga.gVisita += p.ga;
    }
  }
  return res;
}

/* ============================================================
   INFORME
   ============================================================ */

const pct = (v) => (v * 100).toFixed(2) + '%';
const pct1 = (v) => (v * 100).toFixed(1) + '%';

function rtpDe(r) {
  let dev = 0, n = 0;
  for (const m of MERCADOS) { dev += r.acc[m].dev; n += r.acc[m].n; }
  return n ? dev / n : 0;
}

function detalle(mod, r) {
  const out = [];
  out.push('');
  out.push('  ' + mod.nombre);
  out.push('  ' + mod.nota);
  out.push('  goles esperados ' + (r.lam / r.n).toFixed(3) +
    '   goles reales ' + (r.gol / r.n).toFixed(3) +
    '   partidos ' + r.n);
  out.push('  mercado              el modelo   paso        RTP');
  for (const m of MERCADOS) {
    const A = r.acc[m];
    out.push('  ' + NOMBRE[m].padEnd(20) +
      pct1(A.prob / A.n).padStart(9) + pct1(A.paso / A.n).padStart(11) +
      pct(A.dev / A.n).padStart(12));
  }
  out.push('  ' + '-'.repeat(52));
  out.push('  ' + 'TOTAL'.padEnd(20) + ''.padStart(20) + pct(rtpDe(r)).padStart(12));
  return out.join('\n');
}

(function () {
  if (!fs.existsSync(CACHE)) {
    console.log('Falta el volcado de la liga. Corre primero tools/.cache/bajar.js');
    process.exit(1);
  }
  const crudo = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

  const temporadas = [];
  let totalPartidos = 0;
  Object.keys(crudo).sort().forEach((s) => {
    const ps = (crudo[s] || [])
      .filter((e) => e.intHomeScore !== null && e.intHomeScore !== undefined && e.strHomeTeam)
      .map((e) => ({
        fecha: new Date((e.dateEvent || '') + 'T' + (e.strTime || '00:00:00') + '-03:00'),
        local: e.strHomeTeam, visita: e.strAwayTeam,
        gh: Number(e.intHomeScore), ga: Number(e.intAwayScore)
      }))
      .filter((p) => !isNaN(p.fecha.getTime()))
      .sort((x, y) => x.fecha - y.fecha);
    if (ps.length) { temporadas.push(ps); totalPartidos += ps.length; }
  });

  const objetivo = 1 / (1 + MCPoisson.MARGIN);

  console.log('BANCO DE PRUEBAS - modelos de la Liga Profesional');
  console.log('='.repeat(64));
  console.log('Temporadas: ' + temporadas.length + '   partidos terminados: ' + totalPartidos);
  console.log('Objetivo: RTP ' + pct(objetivo) + '  (margen declarado ' + pct(MCPoisson.MARGIN) + ')');

  const res = correr(temporadas);
  for (const mod of MODELOS) console.log(detalle(mod, res[mod.id]));

  console.log('');
  console.log('='.repeat(64));
  console.log('');
  console.log('  CONTRA EL MODELO VIEJO (apareado, mismo partido)');
  console.log('');
  console.log('  modelo             RTP      dif     error   veredicto');
  const base = res['viejo'].porPartido;
  const rtpViejo = rtpDe(res['viejo']);
  for (const mod of MODELOS) {
    const r = res[mod.id];
    const rtp = rtpDe(r);
    if (mod.id === 'viejo') {
      console.log('  ' + mod.id.padEnd(18) + pct(rtp).padStart(8) + '        -');
      continue;
    }
    const d = r.porPartido.map((v, i) => (v - base[i]) / MERCADOS.length);
    const media = d.reduce((x, y) => x + y, 0) / d.length;
    const varia = d.reduce((x, y) => x + (y - media) * (y - media), 0) / d.length;
    const ee = Math.sqrt(varia / d.length);
    /* Se juzga por CUANTO SE ACERCA AL OBJETIVO, no por RTP mas bajo: un
       modelo que devuelve 80% tampoco sirve, es una casa que roba. */
    const acerca = Math.abs(rtpViejo - objetivo) - Math.abs(rtp - objetivo);
    const claro = Math.abs(media) > 2 * ee;
    console.log('  ' + mod.id.padEnd(18) + pct(rtp).padStart(8) +
      ((media >= 0 ? '+' : '') + (media * 100).toFixed(2)).padStart(8) +
      ('+-' + (ee * 100).toFixed(2)).padStart(9) +
      '   ' + (acerca > 0 ? 'ACERCA' : 'aleja ') + ' ' + (claro ? '(claro)' : '(ruido)'));
  }
  console.log('');
  console.log('  "dif" es cuanto cambia el RTP por apuesta contra el modelo viejo.');
  console.log('  "claro" = la diferencia supera dos veces su propio error.');

  /* ---------------- estabilidad temporada por temporada ----------------

     UN PROMEDIO DE CINCO ANIOS PUEDE ESCONDER CUALQUIER COSA. Si el
     modelo devuelve 97% de promedio pero va de 88% a 106% segun el anio,
     entonces el margen real no es 3%: es una loteria con esperanza 3%, y
     afinar el margen decimal por decimal sobre el promedio seria ajustar
     al ruido. Esta tabla es la que dice si el numero de arriba se puede
     declarar o no. */
  console.log('');
  console.log('='.repeat(64));
  console.log('');
  console.log('  EL MISMO MODELO, TEMPORADA POR TEMPORADA');
  console.log('');
  const anios = Object.keys(crudo).sort().filter((s) => (crudo[s] || []).length);
  const cabecera = ['viejo', 'enVivo', 'enVivoReal'];
  console.log('  temporada  ' + cabecera.map((c) => c.padStart(12)).join(''));
  anios.forEach((s, i) => {
    const r = correr([temporadas[i]]);
    console.log('  ' + s.padEnd(11) +
      cabecera.map((c) => pct(rtpDe(r[c])).padStart(12)).join(''));
  });
  console.log('');
})();
