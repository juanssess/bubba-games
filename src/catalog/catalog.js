/* ============================================================
   CATÁLOGO — junta los juegos de la casa con los generados y
   arma los rieles del lobby y los banners de promoción.

   Depende de: MCSlotMath, MCGameGen, MCThemes, MC (router).
   ============================================================ */
window.MCCatalog = (function () {
  'use strict';

  var CATALOG_SIZE = 120;

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
    {
      // Retorno = 1 / (1 + margen). Con 5% de margen, 95,2% en apuesta simple.
      id: 'sports', engine: 'sportsbook', name: 'Liga Bubba', kind: 'Deportes',
      studio: 'Bubba Originals', volatility: 'Alta',
      tag: 'Margen de la casa 5%', rtpValue: 0.952, rtp: 'Retorno 95,2%',
      maxWin: 500, emoji: '⚽', badge: 'new',
      art: 'linear-gradient(135deg,#052e16,#15803d 60%,#86efac)',
      desc: '16 equipos simulados'
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
  var ALL = ORIGINALS.concat(GENERATED);

  var GAMES = {};
  ALL.forEach(function (g) { GAMES[g.id] = g; });

  /* ---------------- rieles del lobby ---------------- */
  function ids(list) { return list.map(function (g) { return g.id; }); }
  function take(list, n) { return list.slice(0, n); }
  function byBadge(b) { return GENERATED.filter(function (g) { return g.badge === b; }); }
  function byStudio(s) { return GENERATED.filter(function (g) { return g.studio === s; }); }
  function byVolatility(v) { return GENERATED.filter(function (g) { return g.volatility === v; }); }

  var topWin = GENERATED.slice().sort(function (a, b) { return b.maxWin - a.maxWin; });
  var topRTP = GENERATED.slice().sort(function (a, b) { return b.rtpValue - a.rtpValue; });

  var RAILS = [
    { id: 'populares', title: 'Populares', sub: 'lo que más se juega acá',
      games: ids(ORIGINALS).concat(ids(take(byBadge('hot'), 10))) },
    { id: 'crash', title: 'Crash e instantáneos', sub: 'una decisión por ronda',
      games: ['crash', 'mines'] },
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
    { id: 'mesa', title: 'Juegos de mesa', sub: 'ruleta y cartas',
      games: ['roulette', 'blackjack'] },
    { id: 'deportes', title: 'Deportes', sub: 'liga ficticia con cuotas calculadas',
      games: ['sports'] },
    { id: 'nova', title: 'Nova Play', sub: 'estudio destacado',
      games: ids(take(byStudio('Nova Play'), 14)) },
    { id: 'slots', title: 'Todas las tragamonedas', sub: CATALOG_SIZE + ' títulos en el salón',
      games: ids(take(GENERATED, 14)), more: true }
  ].filter(function (r) { return r.games.length > 0; });

  /* ---------------- banners ---------------- */
  var PROMOS = [
    {
      kicker: 'Bienvenida',
      title: '5.000 fichas para arrancar',
      text: 'Tu cuenta se crea sola al abrir la página. Sin registro, sin datos, sin dinero real.',
      cta: 'Ver mis fichas', action: 'wallet', emoji: '🪙',
      bg: 'linear-gradient(120deg,#1b2a6b,#2f6bff 60%,#6f9bff)'
    },
    {
      kicker: 'Salón completo',
      title: ALL.length + ' juegos abiertos',
      text: 'Cada tragamonedas tiene sus propios símbolos, tabla de pagos y RTP calculado. Ninguna es decorativa.',
      cta: 'Ver el catálogo', action: 'catalog', emoji: '🎰',
      bg: 'linear-gradient(120deg,#3a1150,#8b5cf6 60%,#c4a6ff)'
    },
    {
      kicker: 'Bono recargable',
      title: '+2.500 fichas cada 8 horas',
      text: 'Y si te quedás en cero, la casa te rescata al instante. Acá nadie se queda afuera.',
      cta: 'Reclamar bono', action: 'bonus', emoji: '🎁',
      bg: 'linear-gradient(120deg,#5c1a3e,#f31260 60%,#ff7aa8)'
    },
    {
      kicker: 'Juego destacado',
      title: 'Bubba Jet',
      text: 'El multiplicador sube sin freno. La única pregunta es cuándo apretás retirar.',
      cta: 'Despegar', action: 'game:crash', emoji: '🚀',
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
    studios: ['Bubba Originals'].concat(MCThemes.STUDIOS),
    size: ALL.length
  };
})();
