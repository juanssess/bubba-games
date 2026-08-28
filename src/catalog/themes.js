/* ============================================================
   CATÁLOGO / TEMÁTICAS — la materia prima del generador.

   Cada temática define los símbolos (ordenados del más común al
   más raro), el degradado de la portada y los pools de palabras
   con los que se arman los nombres. Sumar una temática nueva acá
   agrega decenas de títulos posibles sin tocar nada más.
   ============================================================ */
window.MCThemes = (function () {
  'use strict';

  // Estudios ficticios. "Bubba Originals" queda reservado
  // para los juegos hechos a mano, no lo usa el generador.
  var STUDIOS = [
    'Nova Play', 'Cerro Studios', 'Lumen Gaming',
    'Delta Nueve', 'Faro Interactive', 'Ámbar Labs'
  ];

  var SUFFIX = ['', '', '', '', ' 777', ' Extremo', ' Deluxe', ' x50', ' Nocturno', ' Oro'];

  // steep: qué tan rápido cae el peso de un símbolo al siguiente.
  // exp:   qué tan castigado está el pago de los símbolos raros.
  var VOLATILITY = {
    'Baja':    { steep: 0.86, exp: 1.45 },
    'Media':   { steep: 0.78, exp: 1.68 },
    'Alta':    { steep: 0.70, exp: 1.90 },
    'Extrema': { steep: 0.60, exp: 2.15 }
  };

  var THEMES = [
    {
      id: 'azteca', emoji: '🗿',
      art: 'linear-gradient(135deg,#4a1d0e,#c2410c 60%,#fbbf24)',
      symbols: [
        { face: '🌽', name: 'Maíz' }, { face: '🪶', name: 'Pluma' },
        { face: '🏹', name: 'Flecha' }, { face: '🐍', name: 'Serpiente' },
        { face: '🌞', name: 'Sol' }, { face: '🐆', name: 'Jaguar' },
        { face: '🗿', name: 'Tótem' }, { face: '💎', name: 'Jade' }
      ],
      a: ['Tótem', 'Jaguar', 'Sol', 'Templo', 'Cóndor', 'Serpiente'],
      b: ['Azteca', 'de Jade', 'Sagrado', 'de Piedra', 'Ancestral']
    },
    {
      id: 'oceano', emoji: '🐙',
      art: 'linear-gradient(135deg,#082f49,#0369a1 60%,#38bdf8)',
      symbols: [
        { face: '🐚', name: 'Caracol' }, { face: '🐠', name: 'Pez' },
        { face: '🦀', name: 'Cangrejo' }, { face: '⚓', name: 'Ancla' },
        { face: '🐬', name: 'Delfín' }, { face: '🦈', name: 'Tiburón' },
        { face: '🐙', name: 'Pulpo' }, { face: '💎', name: 'Perla' }
      ],
      a: ['Abismo', 'Marea', 'Kraken', 'Arrecife', 'Sirena', 'Corriente'],
      b: ['Profundo', 'Azul', 'Salvaje', 'del Sur', 'Perdida']
    },
    {
      id: 'oeste', emoji: '🤠',
      art: 'linear-gradient(135deg,#451a03,#b45309 60%,#fcd34d)',
      symbols: [
        { face: '🌵', name: 'Cactus' }, { face: '🐎', name: 'Caballo' },
        { face: '🎯', name: 'Diana' }, { face: '🪕', name: 'Banjo' },
        { face: '🤠', name: 'Vaquero' }, { face: '💰', name: 'Bolsa' },
        { face: '⭐', name: 'Estrella' }, { face: '💎', name: 'Gema' }
      ],
      a: ['Duelo', 'Frontera', 'Polvo', 'Rifle', 'Bandido', 'Cañón'],
      b: ['del Oeste', 'al Amanecer', 'Salvaje', 'sin Ley', 'Rojo']
    },
    {
      id: 'frutas', emoji: '🍒',
      art: 'linear-gradient(135deg,#4c0519,#e11d48 60%,#fda4af)',
      symbols: [
        { face: '🍒', name: 'Cereza' }, { face: '🍋', name: 'Limón' },
        { face: '🍇', name: 'Uva' }, { face: '🍉', name: 'Sandía' },
        { face: '🔔', name: 'Campana' }, { face: '⭐', name: 'Estrella' },
        { face: '💎', name: 'Diamante' }, { face: '7', name: 'Siete' }
      ],
      a: ['Frutal', 'Cereza', 'Clásico', 'Doble', 'Neón'],
      b: ['777', 'Retro', 'Caliente', 'Express', 'de Oro']
    },
    {
      id: 'nilo', emoji: '🏺',
      art: 'linear-gradient(135deg,#3b2f0b,#a16207 60%,#fde68a)',
      symbols: [
        { face: '🪲', name: 'Escarabajo' }, { face: '🐫', name: 'Camello' },
        { face: '🏺', name: 'Ánfora' }, { face: '🐍', name: 'Cobra' },
        { face: '👁️', name: 'Ojo' }, { face: '🦅', name: 'Halcón' },
        { face: '👑', name: 'Corona' }, { face: '💎', name: 'Zafiro' }
      ],
      a: ['Arena', 'Nilo', 'Faraón', 'Oasis', 'Duna', 'Escriba'],
      b: ['Dorado', 'Eterno', 'Perdido', 'del Desierto', 'Secreto']
    },
    {
      id: 'dragon', emoji: '🐉',
      art: 'linear-gradient(135deg,#450a0a,#dc2626 60%,#fbbf24)',
      symbols: [
        { face: '🎋', name: 'Bambú' }, { face: '🏮', name: 'Farol' },
        { face: '🪙', name: 'Moneda' }, { face: '🐟', name: 'Carpa' },
        { face: '🐅', name: 'Tigre' }, { face: '🐉', name: 'Dragón' },
        { face: '👑', name: 'Corona' }, { face: '💎', name: 'Jade' }
      ],
      a: ['Dragón', 'Tigre', 'Loto', 'Farol', 'Trueno', 'Bambú'],
      b: ['Rojo', 'de Fuego', 'Imperial', 'Nocturno', 'de Jade']
    },
    {
      id: 'espacio', emoji: '🚀',
      art: 'linear-gradient(135deg,#1e1b4b,#4f46e5 60%,#a5b4fc)',
      symbols: [
        { face: '☄️', name: 'Cometa' }, { face: '🛰️', name: 'Satélite' },
        { face: '🌕', name: 'Luna' }, { face: '👾', name: 'Alien' },
        { face: '🛸', name: 'Nave' }, { face: '🚀', name: 'Cohete' },
        { face: '⭐', name: 'Estrella' }, { face: '💎', name: 'Cristal' }
      ],
      a: ['Órbita', 'Nebulosa', 'Cosmos', 'Eclipse', 'Meteoro', 'Galaxia'],
      b: ['Infinita', 'Extrema', 'Cero', 'Nueve', 'Final']
    },
    {
      id: 'selva', emoji: '🐅',
      art: 'linear-gradient(135deg,#052e16,#15803d 60%,#86efac)',
      symbols: [
        { face: '🍌', name: 'Banana' }, { face: '🌴', name: 'Palmera' },
        { face: '🐒', name: 'Mono' }, { face: '🦜', name: 'Guacamayo' },
        { face: '🐍', name: 'Boa' }, { face: '🐅', name: 'Tigre' },
        { face: '🗿', name: 'Ídolo' }, { face: '💎', name: 'Esmeralda' }
      ],
      a: ['Selva', 'Liana', 'Ruinas', 'Sendero', 'Ídolo', 'Tambor'],
      b: ['Perdida', 'Verde', 'Profunda', 'Salvaje', 'Escondido']
    },
    {
      id: 'hielo', emoji: '❄️',
      art: 'linear-gradient(135deg,#0c2233,#0891b2 60%,#a5f3fc)',
      symbols: [
        { face: '🧊', name: 'Hielo' }, { face: '🐟', name: 'Pez' },
        { face: '🐧', name: 'Pingüino' }, { face: '🦌', name: 'Reno' },
        { face: '🐺', name: 'Lobo' }, { face: '🐻', name: 'Oso' },
        { face: '❄️', name: 'Copo' }, { face: '💎', name: 'Cristal' }
      ],
      a: ['Ventisca', 'Glaciar', 'Aurora', 'Témpano', 'Escarcha', 'Lobo'],
      b: ['Polar', 'Helada', 'del Norte', 'Blanca', 'Boreal']
    },
    {
      id: 'fiesta', emoji: '🎉',
      art: 'linear-gradient(135deg,#4a044e,#c026d3 60%,#f0abfc)',
      symbols: [
        { face: '🍹', name: 'Trago' }, { face: '🎺', name: 'Trompeta' },
        { face: '🥁', name: 'Tambor' }, { face: '💃', name: 'Bailarina' },
        { face: '🎊', name: 'Confeti' }, { face: '🎉', name: 'Fiesta' },
        { face: '🪩', name: 'Bola' }, { face: '💎', name: 'Brillante' }
      ],
      a: ['Carnaval', 'Rumba', 'Tambor', 'Bengala', 'Verbena', 'Murga'],
      b: ['Nocturna', 'sin Fin', 'de Neón', 'Caliente', 'Total']
    }
  ];

  return { STUDIOS: STUDIOS, SUFFIX: SUFFIX, VOLATILITY: VOLATILITY, THEMES: THEMES };
})();
