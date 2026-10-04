/* ============================================================
   CATÁLOGO — junta los juegos de la casa con los generados y
   arma los rieles del lobby y los banners de promoción.

   Depende de: MCSlotMath, MCGameGen, MCThemes, MC (router).
   ============================================================ */
window.MCCatalog = (function () {
  'use strict';

  /* ============================================================
     QUÉ SE MUESTRA EN EL SALÓN
     Este es el único lugar que hay que tocar para prender o apagar
     juegos. El código de los motores queda intacto: sirve de
     referencia para escribir los juegos propios de Bubba.

     Para volver a mostrar uno, sacalo de OCULTOS.
     Para traer de nuevo las 120 tragamonedas, poné true abajo.
     ============================================================ */
  // Vacio: estan todos los juegos de la casa a la vista. Para apagar uno,
  // metelo aca por su id y desaparece del lobby, del buscador y del
  // catalogo sin tocar una linea de su codigo.
  var OCULTOS = [];
  var MOSTRAR_TRAGAMONEDAS_GENERADAS = false;

  // Si están ocultas ni siquiera se generan: no tiene sentido
  // calcular 120 modelos matemáticos que nadie va a ver.
  var CATALOG_SIZE = MOSTRAR_TRAGAMONEDAS_GENERADAS ? 120 : 0;

  /* ---------------- tragamonedas de la casa (hecha a mano) ---------------- */
  var BUBBA_777 = [
    { id: 'cherry',  face: '🍒', name: 'Cereza',   weight: 18, triple: 8,   pair: 0 },
    { id: 'lemon',   face: '🍋', name: 'Limón',    weight: 16, triple: 12,  pair: 0 },
    { id: 'bell',    face: '🔔', name: 'Campana',  weight: 14, triple: 18,  pair: 1 },
    { id: 'clover',  face: '🍀', name: 'Trébol',   weight: 12, triple: 28,  pair: 1.5 },
    { id: 'star',    face: '⭐', name: 'Estrella', weight: 10, triple: 45,  pair: 2 },
    { id: 'diamond', face: '💎', name: 'Diamante', weight: 8,  triple: 80,  pair: 4 },
    { id: 'crown',   face: '👑', name: 'Corona',   weight: 6,  triple: 150, pair: 7 },
    { id: 'seven',   face: '7',  name: 'Siete',    weight: 4,  triple: 250, pair: 18 }
  ];

  var RTP_777 = MCSlotMath.exactRTP(BUBBA_777);
  function pct(x) { return 'RTP ' + (x * 100).toFixed(1).replace('.', ',') + '%'; }

  var ORIGINALS = [
    {
      id: 'crash', engine: 'crash', name: 'Bubba Jet', kind: 'Crash',
      studio: 'Bubba Originals', volatility: 'Extrema',
      tag: 'Ventaja de la casa 3%', rtpValue: 0.97, rtp: 'RTP 97,0%',
      maxWin: 1000, emoji: '🚀', badge: 'hot',
      art: 'linear-gradient(135deg,#1b2a6b,#2f6bff 55%,#7aa2ff)',
      desc: 'Retirá antes del reventón'
    },
    {
      id: 'mines', engine: 'mines', name: 'Mines', kind: 'Instantáneo',
      studio: 'Bubba Originals', volatility: 'Alta',
      tag: 'Ventaja de la casa 3%', rtpValue: 0.97, rtp: 'RTP 97,0%',
      maxWin: 2425, emoji: '💣', badge: 'hot',
      art: 'linear-gradient(135deg,#3a1150,#8b5cf6 60%,#c4a6ff)',
      desc: 'Gemas sí, minas no'
    },
    {
      id: 'slots777', engine: 'slots', name: 'Bubba 777', kind: 'Tragamonedas',
      studio: 'Bubba Originals', volatility: 'Media',
      rtpValue: RTP_777, rtp: pct(RTP_777),
      maxWin: 250, tag: 'Máx. 250x · volatilidad media',
      emoji: '🎰', badge: 'top',
      art: 'linear-gradient(135deg,#5c1a3e,#f31260 60%,#ff7aa8)',
      desc: 'Máx. 250x',
      config: { symbols: BUBBA_777 }
    },
    /* ---------- Tragamonedas propias, servidas en iframe ----------
       Se construyen aparte (proyecto "Juegos Casinos") y se sirven desde
       games/slots/. Comparten la billetera de Bubba: ver proveedor.js.
       El RTP que se muestra es el verificado por simulación de 100-200
       millones de rondas, igual que el resto del catálogo. */
    {
      id: 'maverick', engine: 'proveedor', name: 'Maverick', kind: 'Tragamonedas',
      studio: 'Bubba Studios', volatility: 'Alta',
      tag: '20 líneas · La Escalinata', rtpValue: 0.9666, rtp: 'RTP 96,7%',
      maxWin: 3362, emoji: '🐆', badge: 'top',
      art: 'linear-gradient(135deg,#2a1a0e,#c8901f 55%,#4fbf8b)',
      desc: 'Escalá la pirámide',
      frameUrl: 'games/slots/index.html?game=classic20'
    },
    {
      id: 'sebusca', engine: 'proveedor', name: 'Se Busca', kind: 'Tragamonedas',
      studio: 'Bubba Studios', volatility: 'Extrema',
      tag: 'Wilds pegajosos · tope 10.000x', rtpValue: 0.9644, rtp: 'RTP 96,4%',
      maxWin: 10000, emoji: '🤠', badge: 'hot',
      art: 'linear-gradient(135deg,#2e1a0c,#c8452f 55%,#e8d3a0)',
      desc: 'Multiplicadores que se pegan',
      frameUrl: 'games/slots/index.html?game=sebusca'
    },
    {
      id: 'vendimia', engine: 'proveedor', name: 'La Vendimia', kind: 'Tragamonedas',
      studio: 'Bubba Studios', volatility: 'Media-alta',
      tag: 'Racimos · cascadas · el multiplicador sube', rtpValue: 0.9658, rtp: 'RTP 96,6%',
      maxWin: 5000, emoji: '🍇', badge: 'new',
      art: 'linear-gradient(135deg,#2b1226,#8e1330 55%,#cfa93c)',
      desc: 'Cinco pegados y explota',
      frameUrl: 'games/slots/index.html?game=vendimia'
    },
    {
      // PLANTILLA: copiá esta entrada para dar de alta tu juego.
      // El campo que manda es `engine`: tiene que coincidir con el
      // nombre que usás en MC.registerEngine() y con el id de la
      // <section class="view" id="view-plantilla"> del HTML.
      /* El RTP y el máximo NO están elegidos a mano: salen de
         `node tools/slots5-rtp.js`, que mide la misma matemática que
         juega el motor. 95,46% es el cálculo exacto, confirmado por
         Monte Carlo de 5M de rondas (95,78%, dentro del ruido). El
         máximo es el golpe más grande que apareció en esas 5M: con
         retriggers no hay tope teórico, así que se publica lo medido. */
      id: 'slots5', engine: 'slots5', name: 'Bubba Gold', kind: 'Tragamonedas',
      studio: 'Bubba Originals', volatility: 'Alta',
      rtpValue: 0.9546, rtp: 'RTP 95,5%',
      maxWin: 596, tag: '20 líneas · comodín y giros gratis',
      emoji: '🐯', badge: 'new',
      art: 'linear-gradient(135deg,#2a0d12,#a8141f 55%,#f5c451)',
      desc: '5 rodillos · 20 líneas'
    },
    {
      id: 'plantilla', engine: 'plantilla', name: 'Doble o Nada', kind: 'Instantáneo',
      studio: 'Bubba Originals', volatility: 'Media',
      tag: 'Plantilla de referencia · paga 1.95x', rtpValue: 0.975, rtp: 'RTP 97,5%',
      maxWin: 1.95, emoji: '🎴', badge: 'new',
      art: 'linear-gradient(135deg,#2a0d12,#d81e34 60%,#ff7a86)',
      desc: 'Rojo o negro'
    },
    {
      /* ESTE RETORNO ESTA MEDIDO, no despejado.
         Antes decia 95,2% porque es 1/(1+margen) con el 5% que se cobra, y
         eso solo vale si el modelo acierta. Con partidos reales no acierta:
         medido sobre 1.628 partidos de cinco temporadas
         (`node tools/probar-modelos.js`), con aquel modelo el retorno real
         era 102,65% —la casa PERDIA— y perdia en las cinco.
         Hoy el modelo es otro y el margen nominal es 8%. El retorno medido
         es 96,97%, que es el numero que va aca. Si se vuelve a tocar el
         modelo o el margen, hay que volver a medir y actualizar esto. */
      id: 'sports', engine: 'sportsbook', name: 'Fútbol', kind: 'Deportes',
      studio: 'Bubba Originals', volatility: 'Alta',
      tag: 'Argentina y el mundo · Cuotas virtuales', rtpValue: 0.9697, rtp: 'Argentina base: 97,0%',
      maxWin: 500, emoji: '⚽', badge: 'new',
      art: 'linear-gradient(135deg,#052e16,#15803d 60%,#86efac)',
      desc: 'Fixture y resultados reales'
    },
    {
      id: 'roulette', engine: 'roulette', name: 'Ruleta Europea', kind: 'Mesa',
      studio: 'Bubba Originals', volatility: 'Media',
      tag: 'Pleno paga 35:1', rtpValue: 0.973, rtp: 'RTP 97,3%',
      maxWin: 36, emoji: '🎡', badge: '',
      art: 'linear-gradient(135deg,#06301f,#0f7a45 60%,#3fd08a)',
      desc: 'Un solo cero'
    },
    {
      id: 'blackjack', engine: 'blackjack', name: 'Blackjack Clásico', kind: 'Mesa',
      studio: 'Bubba Originals', volatility: 'Baja',
      tag: 'Blackjack paga 3:2', rtpValue: 0.99, rtp: 'RTP ~99%',
      maxWin: 3, emoji: '🃏', badge: 'new',
      art: 'linear-gradient(135deg,#0b2340,#1b4f8f 60%,#5fa8f5)',
      desc: 'Zapato de 6 mazos'
    }
  ];

  /* ---------------- catálogo completo ---------------- */
  var GENERATED = MCGameGen.generate(CATALOG_SIZE);
  var TODOS = ORIGINALS.concat(GENERATED);

  TODOS.forEach(function (g) {
    if (OCULTOS.indexOf(g.id) >= 0) g.hidden = true;
  });

  // El mapa por id incluye TODO, también lo oculto: el historial guarda
  // ids de juego y tiene que seguir sabiendo cómo se llamaba cada uno.
  var GAMES = {};
  TODOS.forEach(function (g) { GAMES[g.id] = g; });

  // La lista visible es la que ven el lobby, el buscador y el catálogo.
  var ALL = TODOS.filter(function (g) { return !g.hidden; });

  /* ---------------- rieles del lobby ---------------- */
  function ids(list) { return list.map(function (g) { return g.id; }); }
  function visibles(idList) {
    return idList.filter(function (id) { return GAMES[id] && !GAMES[id].hidden; });
  }
  function take(list, n) { return list.slice(0, n); }
  function byBadge(b) { return GENERATED.filter(function (g) { return g.badge === b; }); }
  function byStudio(s) { return GENERATED.filter(function (g) { return g.studio === s; }); }
  function byVolatility(v) { return GENERATED.filter(function (g) { return g.volatility === v; }); }

  var topWin = GENERATED.slice().sort(function (a, b) { return b.maxWin - a.maxWin; });
  var topRTP = GENERATED.slice().sort(function (a, b) { return b.rtpValue - a.rtpValue; });

  var RAILS = [
    { id: 'populares', title: 'Populares', sub: 'lo que más se juega acá',
      games: ids(ORIGINALS).concat(ids(take(byBadge('hot'), 10))) },
    { id: 'nuevos', title: 'Recién llegados', sub: 'lo último del catálogo',
      games: ids(take(byBadge('new'), 14)) },
    { id: 'jackpots', title: 'Los que más pagan', sub: 'ordenados por premio máximo',
      games: ids(take(topWin, 14)) },
    { id: 'rtp', title: 'Mejor RTP', sub: 'los de menor ventaja para la casa',
      games: ids(take(topRTP, 14)) },
    { id: 'extrema', title: 'Volatilidad extrema', sub: 'poco y grande, o nada',
      games: ids(take(byVolatility('Extrema'), 14)) },
    { id: 'suave', title: 'Para jugar tranquilo', sub: 'volatilidad baja',
      games: ids(take(byVolatility('Baja'), 14)) },
    { id: 'nova', title: 'Nova Play', sub: 'estudio destacado',
      games: ids(take(byStudio('Nova Play'), 14)) },
    { id: 'slots', title: 'Todas las tragamonedas', sub: CATALOG_SIZE + ' títulos en el salón',
      games: ids(take(GENERATED, 14)), more: true }
  ]
    // Se saca de cada riel lo que esté oculto, y después se descartan
    // los rieles que quedaron vacíos: sin esto el lobby mostraría
    // títulos de sección sin una sola tarjeta abajo.
    .map(function (r) { r.games = visibles(r.games); return r; })
    .filter(function (r) { return r.games.length > 0; });

  /* Crash, mesa y deportes eran rieles de uno o dos juegos que dejaban
     media fila vacía. Ahora son pestañas de un solo bloque. El id es el
     mismo que tenía el riel, así el sidebar sigue llevando a cada una. */
  var CATEGORIES = [
    { id: 'tragamonedas', tab: 'Tragamonedas', kinds: ['Tragamonedas'] },
    { id: 'crash',        tab: 'Crash e instantáneos', kinds: ['Crash', 'Instantáneo'] },
    { id: 'mesa',         tab: 'Mesa', kinds: ['Mesa'] },
    { id: 'deportes',     tab: 'Deportes', kinds: ['Deportes'] }
  ].map(function (c) {
    c.games = ALL.filter(function (g) { return c.kinds.indexOf(g.kind) !== -1; })
                 .map(function (g) { return g.id; });
    return c;
  }).filter(function (c) { return c.games.length > 0; });

  /* ---------------- banners ----------------
     Los banners sólo pueden apuntar a juegos visibles: si mandan a
     uno oculto, el botón no hace nada y parece que la página falla. */
  /* Banners de juego: van primero en el carrusel y usan el arte real
     (la escena de environments.png y el sprite de la portada). Los
     numeros —RTP, premio maximo— salen de la ficha del juego, no de aca. */
  var GAME_BANNERS = [
    { game: 'vendimia', scene: 'wine',    kicker: 'Ya llegó',   side: ['Exclusivo', 'del salón'], chip: 'Cascadas' },
    { game: 'sebusca',  scene: 'western', kicker: 'El más buscado', side: ['Volatilidad', 'extrema'], chip: 'Wilds pegajosos' },
    { game: 'maverick', scene: 'temple',  kicker: 'Subí la pirámide', side: ['Top', 'del salón'], chip: '20 líneas' }
  ];

  /* La fila de banners chicos debajo del carrusel. */
  var MINI_BANNERS = [
    { game: 'maverick', scene: 'temple',  color: '#c8901f', tint: '#1a120899,#140d06f2' },
    { game: 'sebusca',  scene: 'western', color: '#c8452f', tint: '#2a120a88,#1a0c06f2' },
    { game: 'crash',    scene: 'temple',  color: '#2f6bff', tint: '#0b1a4cd9,#08112ef5' },
    { game: 'sports',   scene: 'western', color: '#15803d', tint: '#06301fd9,#04170ef5' }
  ];

  var PROMOS = [
    {
      id: 'welcome',
      kicker: 'Bienvenida',
      title: '5.000 fichas para arrancar',
      text: 'Tu cuenta se crea sola al abrir la página. Sin registro, sin datos, sin dinero real.',
      cta: 'Ver mis fichas', action: 'wallet', emoji: '🪙',
      bg: 'linear-gradient(120deg,#2a0d12,#d81e34 60%,#ff7a86)'
    },
    {
      id: 'catalog',
      kicker: 'Explorá el salón',
      title: 'Encontrá tu juego favorito',
      text: 'Tragamonedas, mesas y deportes. Descubrí el catálogo y elegí cómo jugar hoy.',
      cta: 'Ver el catálogo', action: 'catalog', emoji: '🎲',
      bg: 'linear-gradient(120deg,#1a1413,#3a2b27 55%,#c9922b)'
    },
    {
      id: 'bonus',
      kicker: 'Bono recargable',
      title: '+2.500 fichas cada 8 horas',
      text: 'Y si te quedás en cero, la casa te rescata al instante. Acá nadie se queda afuera.',
      cta: 'Reclamar bono', action: 'bonus', emoji: '🎁',
      bg: 'linear-gradient(120deg,#3a1150,#8b5cf6 60%,#c4a6ff)'
    },
    {
      id: 'liga',
      kicker: 'Mesa abierta',
      title: 'Liga Argentina',
      text: 'Partidos y resultados reales de la temporada 2026, con apuestas exclusivamente en fichas virtuales.',
      cta: 'Ver partidos', action: 'game:sports', emoji: '⚽',
      bg: 'linear-gradient(120deg,#0b3b2b,#17c964 60%,#7ef0b0)'
    }
  ];

  MC.registerGames(GAMES);

  return {
    games: GAMES,
    all: ALL,
    originals: ORIGINALS,
    generated: GENERATED,
    rails: RAILS,
    promos: PROMOS,
    gameBanners: GAME_BANNERS,
    categories: CATEGORIES,
    miniBanners: MINI_BANNERS,
    studios: ['Bubba Originals'].concat(MCThemes.STUDIOS),
    size: ALL.length
  };
})();
