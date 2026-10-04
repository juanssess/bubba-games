/* ============================================================
   UI / ASISTENTE — LO QUE SABE.

   Acá está el contenido; el motor que entiende la pregunta y la
   interfaz viven en asistente.js. Se separan porque esto crece con
   cada juego y cada pantalla nueva, y el motor no tiene por qué
   cambiar cuando eso pasa.

   ---------------------------------------------------------------
   LA REGLA DE ESTE ARCHIVO
   ---------------------------------------------------------------
   Un número que el casino ya sabe NO se escribe acá: se le pregunta
   al módulo que lo tiene. El pozo sale de MCBote, el RTP de MC.rtp,
   las marcas del torneo de MCTorneo. Si mañana cambia el bono o la
   casa baja un juego, el asistente lo dice bien sin que nadie se
   acuerde de tocarlo.

   Lo que sí está escrito a mano son las REGLAS de cada juego: cómo
   se juega no es un dato que algún módulo exponga.

   ---------------------------------------------------------------
   FORMA DE CADA INTENCIÓN
   ---------------------------------------------------------------
     id          nombre interno (lo usa el test)
     pregunta    cómo se lee en un chip "¿Querías decir…?"
     claves      frases que la disparan. Una clave terminada en *
                 matchea por prefijo ('registr*' → registrarme).
     aspecto     si la pregunta nombra un juego, en vez de esta
                 respuesta se da ese aspecto de la ficha del juego
                 ('como' | 'paga' | 'consejo').
     rol         'jugador' o 'agente' si sólo aplica a uno.
     responde    función(ctx) → texto HTML, o { texto, sug }.
     sug         chips que se ofrecen después de contestar.

   Depende de (en vivo, todo opcional): MC, MCCatalog, MCLevels,
   MCMissions, MCBote, MCTorneo, MCBienvenida, MCPeticiones,
   MCCajaAgente, MCRoles, MCTema.
   ============================================================ */
window.MCAsistenteSaber = (function () {
  'use strict';

  /* ---------------- ayudas ---------------- */
  function fmt(n) { return MC.fmt(n); }
  function x(n) { return '×' + MC.fmt(n); }
  function pct(f, dec) {
    return (f * 100).toFixed(dec == null ? 1 : dec).replace('.', ',') + '%';
  }
  function juego(id) {
    return (window.MCCatalog && MCCatalog.games && MCCatalog.games[id]) ||
      ((window.MCCatalog && MCCatalog.all) || []).filter(function (g) { return g.id === id; })[0] ||
      null;
  }
  function rtpDe(g) {
    try { return MC.rtp.etiqueta(g); } catch (e) { return g.rtp || ''; }
  }
  function efectivo(id, porDefecto) {
    try { return MC.rtp.efectivo(id); } catch (e) { return porDefecto; }
  }
  function esAgente() {
    return !!(window.MCRoles && MCRoles.activoEsAgente && MCRoles.activoEsAgente());
  }
  function link(destino, texto) {
    return '<a data-ir="' + destino + '">' + texto + '</a>';
  }
  function jugar(g) { return link(g.id, 'Jugar ' + g.name + ' →'); }

  /* ============================================================
     GUÍAS DE JUEGO
     Cada una: como (reglas), paga(g) (premios), consejo.
     La cabecera —tipo, RTP, volatilidad, máximo— la arma el motor
     con lo que dice el catálogo.
     ============================================================ */
  var GUIAS = {
    crash: {
      alias: ['bubba jet', 'jet', 'crash', 'cohete', 'avioncito', 'aviator'],
      como: 'Apostás y el cohete despega: el multiplicador sube desde ×1,00. ' +
        '<strong>Retirás cuando quieras</strong> y cobrás tu apuesta por el multiplicador ' +
        'de ese momento. Si revienta antes de que retires, perdés la apuesta.',
      paga: function (g) {
        var r = efectivo('crash', 0.97);
        return 'El punto de reventón es aleatorio y el tope es ' + x(g.maxWin) + '. ' +
          'La chance de que llegue a un multiplicador <em>m</em> es ' + pct(r, 0) + ' dividido <em>m</em>, ' +
          'así que el retorno es ' + pct(r) + ' <strong>con cualquier estrategia</strong>.';
      },
      consejo: function () {
        var r = efectivo('crash', 0.97);
        return 'Ninguna forma de retirar cambia el retorno: sólo cambia cuán seguido ganás. ' +
          'Retirando en ×2 ganás alrededor del <strong>' + pct(r / 2, 0) + '</strong> de las veces; ' +
          'en ×10, un <strong>' + pct(r / 10) + '</strong>. Elegí según cuánta adrenalina querés.';
      }
    },
    mines: {
      alias: ['mines', 'minas', 'buscaminas', 'gemas'],
      como: 'Tablero de 5×5. Elegís cuántas minas esconder (de 1 a 24), apostás y vas ' +
        'destapando casillas. Cada gema <strong>sube el multiplicador</strong>; cuando ' +
        'quieras, retirás y cobrás. Si destapás una mina, perdés lo apostado.',
      paga: function (g) {
        return 'El multiplicador es exactamente la inversa de la probabilidad de haber llegado ' +
          'hasta ahí, menos la ventaja de la casa. Con más minas sube más rápido por gema. ' +
          'El máximo publicado es ' + x(g.maxWin) + '.';
      },
      consejo: function () {
        return 'El retorno es el mismo elijas las minas que elijas y destapes las que destapes: ' +
          'lo que cambia es el riesgo. Con 3 minas, la primera casilla sale bien el 88% de ' +
          'las veces (22 de 25). Con 20, apenas el 20%.';
      }
    },
    slots777: {
      alias: ['bubba 777', '777', 'tragamonedas clasica', 'frutas', 'cereza'],
      como: 'Tragamonedas clásica de 3 rodillos. Tirás y, si salen <strong>tres símbolos ' +
        'iguales</strong> en la línea, cobrás. Algunos símbolos también pagan con dos.',
      paga: function (g) {
        var s = (g.config && g.config.symbols) || [];
        if (!s.length) return 'Paga hasta ' + x(g.maxWin) + '.';
        var tres = s.map(function (y) { return y.face + ' ' + x(y.triple); }).join(' · ');
        var dos = s.filter(function (y) { return y.pair; })
          .map(function (y) { return y.face + y.face + ' ' + x(y.pair); }).join(' · ');
        return '<strong>Tres iguales:</strong> ' + tres + '<br>' +
          (dos ? '<strong>Dos iguales:</strong> ' + dos : '');
      },
      consejo: function (g) {
        return 'Es la de volatilidad media: premios chicos bastante seguido y un techo de ' +
          x(g.maxWin) + '. Buena para que el saldo dure.';
      }
    },
    maverick: {
      alias: ['maverick', 'maverik', 'escalinata', 'piramide', 'templo', 'jaguar'],
      como: 'Tragamonedas de 5×3 con 20 líneas. Su función es <em>La Escalinata</em>: ' +
        'con 3 templos escalás una pirámide, y el nivel al que llegás define el paquete ' +
        'de giros gratis.',
      paga: function (g) {
        return 'Los giros gratis van de <strong>8 giros ×4</strong> hasta <strong>20 giros ×10</strong>, ' +
          'según cuánto subas. También podés comprar la entrada directa por 80× tu apuesta. ' +
          'Máximo publicado: ' + x(g.maxWin) + '.';
      },
      consejo: 'La compra de función no cambia el RTP: te ahorra el camino, no te da ventaja. ' +
        'Volatilidad alta, así que apostá chico si querés llegar a ver la pirámide.'
    },
    sebusca: {
      alias: ['se busca', 'sebusca', 'wanted', 'vaquero', 'wild pegajoso', 'pegajoso'],
      como: 'Tragamonedas de 5×5 con 15 líneas. En los giros gratis cada wild que cae ' +
        '<em>queda fijo</em> con un multiplicador de ×2 a ×50, y los de una misma línea ' +
        '<strong>se multiplican entre sí</strong>: un ×10 y un ×25 juntos son ×250.',
      paga: function (g) {
        return 'El tope es ' + x(g.maxWin) + ' la apuesta, el más alto del salón.';
      },
      consejo: 'Es la más volátil del casino: vas a pasar rachas secas largas, está hecha así ' +
        'a propósito. Apostá un porcentaje chico de tu saldo para aguantar hasta la función.'
    },
    vendimia: {
      alias: ['vendimia', 'la vendimia', 'uvas', 'racimo', 'cascada'],
      como: 'Grilla de 6×5 que no paga por líneas sino por <em>racimos</em>: cinco o más ' +
        'símbolos iguales PEGADOS entre sí —arriba, abajo o al costado— y cobrás. Lo que ' +
        'gana se va, cae lo de arriba y se vuelve a mirar.',
      paga: function (g) {
        return 'Cada cascada de la misma jugada <strong>sube el multiplicador</strong> ' +
          '(×1, ×2, ×3, ×5, ×8…). En los giros gratis la escalera <em>no vuelve a empezar</em>: ' +
          'sigue donde quedó hasta el final. Máximo ' + x(g.maxWin) + '.';
      },
      consejo: 'Volatilidad media-alta: entre Bubba 777 y Se Busca. Lo bueno está en las ' +
        'cascadas largas de los giros gratis.'
    },
    slots5: {
      alias: ['bubba gold', 'gold', 'tigre', 'slots5'],
      como: 'Tragamonedas de 5 rodillos, 3 filas y 20 líneas. Elegís la apuesta por línea ' +
        '(la total es 20 veces eso). El <strong>comodín</strong> aparece sólo en los rodillos ' +
        '2, 3 y 4, reemplaza a cualquier símbolo y además es el que más paga.',
      paga: function (g) {
        return 'El <strong>scatter</strong> paga en cualquier lado: 3 → ×2, 4 → ×10, 5 → ×50 la ' +
          'apuesta total, y da 10, 15 o 20 giros gratis donde <strong>el comodín multiplica ×3</strong>. ' +
          'Los giros gratis se pueden redisparar. El golpe más grande medido es ' + x(g.maxWin) + '.';
      },
      consejo: 'Es el juego con <em>juego justo</em>: cada giro se puede recalcular con las ' +
        'semillas que ves en Ajustes. Si algo te parece raro, tenés con qué comprobarlo.'
    },
    plantilla: {
      alias: ['doble o nada', 'rojo o negro', 'plantilla'],
      como: 'Elegís <strong>rojo o negro</strong> y se da vuelta una carta. Acertás la mitad ' +
        'de las veces.',
      paga: function (g) {
        return 'Si acertás cobrás <strong>×1,95</strong> tu apuesta: 50% × 1,95 = 97,5% de retorno de fábrica. ' +
          'Hoy rinde ' + rtpDe(g) + '.';
      },
      consejo: 'Es el juego más simple del salón y existe además como plantilla: es el ejemplo ' +
        'que se copia para programar un juego nuevo.'
    },
    sports: {
      alias: ['liga argentina', 'liga', 'futbol', 'deporte', 'apuesta deportiva', 'partido', 'cuota', 'sportsbook', 'champions', 'mundial'],
      como: 'Partidos de fútbol <strong>reales</strong>, con su fixture y sus resultados. ' +
        'Elegís partidos, armás tu ticket con fichas y se liquida solo cuando se publica el resultado.',
      paga: function (g) {
        return 'Las cuotas son virtuales: las calcula un modelo propio con margen de la casa, ' +
          'no son de ninguna casa real. El retorno publicado (' + rtpDe(g) + ') está <strong>medido</strong> ' +
          'sobre cinco temporadas de partidos reales de la liga argentina, no despejado de la fórmula.';
      },
      consejo: 'La cuota ya incluye el margen: apostarle siempre al favorito no le gana. ' +
        'Si combinás varios partidos, la cuota se multiplica, y el margen también.'
    },
    roulette: {
      alias: ['ruleta', 'ruleta europea', 'roulette', 'pleno'],
      como: 'Ruleta europea: 37 números, del 0 al 36, con <strong>un solo cero</strong>. ' +
        'Ponés fichas en el paño y girás. Podés apostar a varios lugares a la vez y repetir ' +
        'la última jugada.',
      paga: function () {
        return '<strong>Pleno</strong> 35:1 · <strong>Split</strong> 17:1 · <strong>Calle</strong> 11:1 · ' +
          '<strong>Cuadro</strong> 8:1 · <strong>Línea</strong> 5:1 · <strong>Docena y columna</strong> 2:1 · ' +
          '<strong>Rojo/negro, par/impar, 1-18/19-36</strong> 1:1.';
      },
      consejo: 'Todas las apuestas tienen la misma ventaja de la casa (el cero). Ninguna ' +
        'combinación paga más a la larga: sólo cambia cuán seguido ganás y cuánto.'
    },
    blackjack: {
      alias: ['blackjack', 'black jack', 'bj', 'al 21', 'veintiuno', 'doblar', 'dividir', 'plantarme', 'pedir carta', 'crupier'],
      como: 'Sumás lo más cerca de 21 sin pasarte y le tenés que ganar al crupier. Las ' +
        'figuras valen 10 y el as 1 u 11. Zapato de 6 mazos; el crupier se planta en 17 ' +
        '(también blando). Podés <strong>doblar</strong> con las dos primeras cartas y ' +
        '<strong>dividir</strong> pares hasta 4 manos.',
      paga: function () {
        return 'Mano ganada 1:1, <strong>blackjack natural 3:2</strong>, empate devuelve la apuesta.';
      },
      consejo: '<strong>Estrategia básica, resumida:</strong><br>' +
        '· 17 o más: plantate.<br>' +
        '· 13 a 16: plantate si el crupier muestra 2 a 6; pedí si muestra 7 o más.<br>' +
        '· 12: plantate contra 4, 5 y 6; si no, pedí.<br>' +
        '· 11: doblá. 10: doblá salvo contra 10 o as.<br>' +
        '· Dividí siempre ases y ochos; nunca dieces ni cincos.<br>' +
        'Jugándola bien llegás al retorno publicado de la mesa; jugando a ojo, bastante menos.'
    }
  };

  /* ============================================================
     LUGARES — para "¿dónde está…?" y "llevame a…".
     `nombre` ya trae la preposición: se lee "Ir " + nombre.
     ============================================================ */
  var LUGARES = [
    { ir: 'lobby',    nombre: 'al Lobby',          claves: ['lobby', 'inicio', 'salon', 'principal', 'home'] },
    { ir: 'cajero',   nombre: 'al Cajero',         claves: ['cajero', 'caja', 'bono', 'recarga', 'pedir ficha*'] },
    { ir: 'misiones', nombre: 'a Misiones',          claves: ['mision*', 'objetivo*', 'diaria*'] },
    { ir: 'vip',      nombre: 'al Club VIP',       claves: ['vip', 'club', 'rango*', 'nivel*'] },
    { ir: 'torneo',   nombre: 'al Torneo',         claves: ['torneo', 'golpe de la semana', 'competencia'] },
    { ir: 'ranking',  nombre: 'al Ranking',        claves: ['ranking', 'tabla', 'posiciones', 'podio'] },
    { ir: 'stats',    nombre: 'a tus Estadísticas',  claves: ['estadistica*', 'historial', 'mis numeros', 'stats'] },
    { ir: 'ajustes',  nombre: 'a Ajustes',           claves: ['ajuste*', 'configuracion', 'opciones', 'sonido', 'tema', 'limite*'] },
    { ir: 'catalog',  nombre: 'al Catálogo',       claves: ['catalogo', 'todos los juegos', 'buscador', 'buscar juego'] },
    { ir: 'agente',   nombre: 'al Panel de agente', claves: ['panel de agente', 'panel', 'agente'], rol: 'agente' },
    { ir: 'casa',     nombre: 'al Panel de la casa', claves: ['panel de la casa', 'casa', 'retorno de la casa'], rol: 'agente' }
  ];

  /* ============================================================
     INTENCIONES
     ============================================================ */
  var INTENCIONES = [

    /* ---------- charla ---------- */
    {
      id: 'saludo', pregunta: 'Hola',
      claves: ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'que tal', 'como andas', 'hey', 'holis'],
      responde: function () {
        return '¡Hola! ¿En qué te doy una mano? Puedo decirte cuánto tenés, explicarte ' +
          'cualquier juego, contarte del bote o del torneo, o llevarte a donde quieras.';
      },
      sug: ['¿Qué sabés hacer?', '¿Qué juegos hay?', '¿A qué juego me conviene?']
    },
    {
      id: 'gracias', pregunta: 'Gracias',
      claves: ['gracias', 'genial', 'buenisimo', 'joya', 'perfecto', 'excelente', 'de diez', 'mil gracias', 'grax'],
      responde: function () {
        return '¡De nada! Si necesitás algo más, acá estoy.';
      }
    },
    {
      id: 'chau', pregunta: 'Chau',
      claves: ['chau', 'adios', 'nos vemos', 'hasta luego', 'me voy'],
      responde: function () {
        return '¡Chau! Que la suerte te acompañe. Y acordate: si deja de ser divertido, es momento de cortar.';
      }
    },
    {
      id: 'ayuda', pregunta: '¿Qué sabés hacer?',
      claves: ['ayuda', 'que sabes', 'que podes', 'que haces', 'quien sos', 'que sos', 'menu', 'opciones de ayuda', 'temas'],
      responde: function () {
        if (esAgente()) {
          return 'Sé de este casino y de tu panel. Preguntame por:<br>' +
            '· <strong>Tu caja</strong> y la <strong>comisión</strong> disponible<br>' +
            '· <strong>Pedidos de fichas</strong> pendientes<br>' +
            '· Cómo funciona <strong>cada juego</strong> y su RTP<br>' +
            '· El <strong>panel de la casa</strong> y dónde queda cada pantalla';
        }
        return 'Sé de este casino y de tu cuenta. Preguntame por:<br>' +
          '· <strong>Tu cuenta</strong>: saldo, rango VIP, estadísticas, tu última jugada<br>' +
          '· <strong>Fichas gratis</strong>: bono, bienvenida, misiones, pedirle al agente<br>' +
          '· <strong>Juegos</strong>: reglas, cuánto pagan, consejos, cuál te conviene<br>' +
          '· <strong>Premios</strong>: el Bote Bubba y el Torneo de la semana<br>' +
          '· <strong>El casino</strong>: RTP, juego justo, ajustes, dónde queda cada cosa';
      },
      sug: ['¿Cuánto tengo?', '¿Cómo consigo fichas?', '¿Qué juegos hay?', '¿Cómo va el bote?']
    },

    /* ---------- cuenta ---------- */
    {
      id: 'saldo', pregunta: '¿Cuánto tengo?',
      claves: ['saldo', 'cuanto tengo', 'fichas tengo', 'mis fichas', 'cuantas fichas', 'plata tengo', 'mi plata', 'balance', 'billetera'],
      responde: function () {
        if (esAgente()) {
          var c = window.MCCajaAgente ? MCCajaAgente.saldo() : 0;
          return 'Como agente no tenés saldo para apostar: tenés una <strong>caja</strong>, ' +
            'y ahora tiene <strong>' + fmt(c) + ' fichas</strong>. De ahí salen las cargas a tus ' +
            'jugadores. ' + link('agente', 'Abrir el panel');
        }
        var s = MC.getBalance();
        var t = MCLevels.current();
        var txt = 'Tenés <strong>' + fmt(s) + ' fichas</strong> y sos <strong>' + t.name + '</strong>.';
        if (s < 500) {
          txt += '<br>Vas justo: pasá por el ' + link('cajero', 'Cajero') +
            ', el bono es gratis y se recarga cada 8 horas.';
        }
        return txt;
      },
      sug: ['¿Cómo consigo fichas?', '¿Cuánto me falta para subir?', 'Mis estadísticas']
    },
    {
      id: 'bono', pregunta: '¿Cómo consigo fichas?', rol: 'jugador',
      claves: ['bono', 'recarga', 'recargar', 'gratis', 'mas fichas', 'conseguir fichas', 'consigo fichas',
               'ganar fichas', 'sin fichas', 'me quede sin', 'perdi todo', 'pierdo todo', 'no tengo fichas', 'fichas gratis', 'cargar fichas'],
      responde: function () {
        var listo = MC.bonusReadyIn() === 0;
        var monto = Math.round(MC.BONUS_AMOUNT * MCLevels.bonusMultiplier());
        var txt = listo
          ? '· <strong>Bono recargable:</strong> tenés <strong>' + fmt(monto) + ' fichas</strong> esperándote en el ' +
            link('cajero', 'Cajero') + '.<br>'
          : '· <strong>Bono recargable:</strong> el próximo, de ' + fmt(monto) + ' fichas, llega en <strong>' +
            MC.humanTime(MC.bonusReadyIn()) + '</strong>.<br>';
        if (window.MCBienvenida && MCBienvenida.hayAlgo()) {
          txt += '· <strong>Bienvenida:</strong> ' +
            (MCBienvenida.disponible() ? 'todavía no cobraste tus ' + fmt(MCBienvenida.BONO) + ' fichas.'
                                       : 'ya tenés el premio extra listo para cobrar.') + '<br>';
        }
        var faltan = misionesSinCobrar();
        if (faltan) txt += '· <strong>Misiones:</strong> te quedan ' + faltan + ' del día. ' + link('misiones', 'Ver') + '<br>';
        txt += '· <strong>Pedirle al agente:</strong> desde el Cajero le mandás un pedido.<br>' +
          '· <strong>Subir de rango</strong> agranda el bono.';
        return txt;
      },
      sug: ['¿Qué misiones me faltan?', '¿Cómo le pido fichas al agente?', '¿Qué es el bono de bienvenida?']
    },
    {
      id: 'bienvenida', pregunta: '¿Qué es el bono de bienvenida?', rol: 'jugador',
      claves: ['bienvenida', 'bono de bienvenida', 'bono inicial', 'requisito', 'rollover', 'premio extra'],
      responde: function () {
        if (!window.MCBienvenida) return 'El bono de bienvenida está en el ' + link('cajero', 'Cajero') + '.';
        var B = MCBienvenida.BONO;
        var txt = 'Es una sola vez por cuenta y tiene dos partes:<br>' +
          '1. <strong>' + fmt(B) + ' fichas</strong> al instante, sin condiciones.<br>' +
          '2. Si además apostás <strong>20 veces</strong> el bono (' + fmt(B * 20) + '), se libera un premio extra.<br>' +
          'Las fichas del bono son tuyas desde el primer segundo: el requisito no te bloquea nada.';
        if (MCBienvenida.disponible()) txt += '<br>👉 <strong>Todavía no lo cobraste.</strong> ' + link('cajero', 'Ir al Cajero');
        else if (MCBienvenida.extraListo()) txt += '<br>👉 <strong>Ya cumpliste el requisito</strong>: el extra te espera en el ' + link('cajero', 'Cajero') + '.';
        return txt;
      }
    },
    {
      id: 'misiones', pregunta: '¿Qué misiones me faltan?', rol: 'jugador',
      claves: ['mision*', 'objetivo*', 'diaria*', 'tarea*', 'desafio*'],
      responde: function () {
        var items = (window.MCMissions && MCMissions.items()) || [];
        var faltan = items.filter(function (m) { return !m.claimed; });
        if (!items.length) return 'Todavía no se cargaron las misiones del día. Entrá a ' + link('misiones', 'Misiones') + '.';
        if (!faltan.length) return '¡Las hiciste todas! A medianoche salen nuevas.';
        return 'Te quedan <strong>' + faltan.length + ' de ' + items.length + '</strong>:<br>' +
          faltan.map(function (m) {
            // El texto de cada misión lo arma el propio módulo (describe),
            // así no hay dos redacciones distintas de lo mismo.
            var mostrado = m.key === 'bigmult' ? m.progress.toFixed(2) : fmt(m.progress);
            var meta = m.key === 'bigmult' ? m.goal.toFixed(2) : fmt(m.goal);
            var lista = m.progress >= m.goal ? ' ✅ <strong>¡lista para cobrar!</strong>' : '';
            return '· ' + MCMissions.describe(m) + ' <em>(' + mostrado + '/' + meta + ')</em>' + lista;
          }).join('<br>') +
          '<br>' + link('misiones', 'Ver misiones');
      },
      sug: ['¿Cómo consigo fichas?', '¿A qué juego me conviene?']
    },
    {
      id: 'rango', pregunta: '¿Cuánto me falta para subir?', rol: 'jugador',
      claves: ['rango', 'vip', 'club vip', 'nivel', 'xp', 'experiencia', 'subir de', 'falta para subir', 'categoria'],
      responde: function () {
        var t = MCLevels.current();
        var sig = MCLevels.next();
        var lista = MCLevels.TIERS.map(function (r) {
          var yo = r.name === t.name;
          return (yo ? '<strong>▸ ' : '· ') + r.name + ' — ' + fmt(r.min) + ' XP, bono ×' +
            String(r.bonus).replace('.', ',') + (yo ? '</strong>' : '');
        }).join('<br>');
        var cab = !sig
          ? 'Sos <strong>' + t.name + '</strong>, el rango más alto. No hay nada por encima.'
          : 'Sos <strong>' + t.name + '</strong> y te faltan <strong>' +
            fmt(sig.min - MCLevels.getXP()) + ' XP</strong> para ' + sig.name + '.';
        return cab + '<br>La XP sube con lo que <em>apostás</em>, no con lo que ganás: no depende ' +
          'de la suerte. Cada rango agranda el bono del cajero.<br>' + lista + '<br>' + link('vip', 'Ver el Club VIP');
      }
    },
    {
      id: 'stats', pregunta: 'Mis estadísticas', rol: 'jugador',
      claves: ['estadistica*', 'stats', 'mis numeros', 'cuanto gane', 'cuanto perdi', 'cuanto aposte',
               'gane o perdi', 'voy ganando', 'voy perdiendo', 'neto', 'mejor jugada', 'mejor golpe'],
      responde: function () {
        var s = MC.state.stats || {};
        if (!s.plays) return 'Todavía no jugaste ninguna ronda con este perfil. ¡Cuando quieras arrancamos!';
        var neto = s.net || 0;
        return 'En toda tu vida en Bubba:<br>' +
          '· <strong>' + fmt(s.plays) + '</strong> rondas jugadas<br>' +
          '· <strong>' + fmt(s.wagered || 0) + '</strong> fichas apostadas<br>' +
          '· Neto: <strong class="' + (neto >= 0 ? 'as-pos' : 'as-neg') + '">' + (neto >= 0 ? '+' : '−') +
          fmt(Math.abs(neto)) + '</strong><br>' +
          '· Mejor premio en una ronda: <strong>' + fmt(s.best || 0) + '</strong><br>' +
          link('stats', 'Ver estadísticas por día');
      },
      sug: ['¿Cómo me fue en la última?', '¿Cómo voy en el torneo?', 'Ranking']
    },
    {
      id: 'historial', pregunta: '¿Cómo me fue en la última?', rol: 'jugador',
      claves: ['ultima jugada', 'ultima ronda', 'ultima partida', 'en la ultima', 'historial', 'que jugue', 'ultimas jugadas'],
      responde: function () {
        var h = (MC.state.history || []).slice(0, 5);
        if (!h.length) return 'No hay rondas registradas todavía.';
        return 'Tus últimas rondas:<br>' + h.map(function (r) {
          var g = juego(r.game);
          var neto = r.net != null ? r.net : r.returned - r.staked;
          return '· ' + (g ? g.name : r.game) + ': apostaste ' + fmt(r.staked) + ', volvieron ' +
            fmt(r.returned) + ' <strong class="' + (neto >= 0 ? 'as-pos' : 'as-neg') + '">(' +
            (neto >= 0 ? '+' : '−') + fmt(Math.abs(neto)) + ')</strong>';
        }).join('<br>');
      }
    },
    {
      id: 'cuenta', pregunta: '¿Cómo guardo mi progreso?',
      claves: ['cuenta', 'perfil', 'login', 'google', 'iniciar sesion', 'entrar con', 'registr*', 'crear cuenta',
               'guardar progreso', 'guardo mi progreso', 'otro dispositivo', 'otra compu', 'invitado', 'cambiar nombre', 'cambio mi nombre', 'mi nombre', 'cerrar sesion', 'borrar mi cuenta', 'borro mi cuenta'],
      responde: function () {
        var u = MC.auth.current();
        if (u.guest) {
          return 'Estás jugando como <strong>invitado</strong>. Si creás tu perfil ' +
            '<strong>conservás las fichas</strong> que ya ganaste. Entrando con Google además ' +
            'tu saldo te sigue entre la compu y el celular, y jugás por el bote compartido.';
        }
        return 'Estás como <strong>' + u.name + '</strong>' +
          (u.provider === 'google' ? ' con tu cuenta de Google' : ' con un perfil local') +
          '. ' + (MC.auth.estadoNube && MC.auth.estadoNube() === 'ok'
            ? 'Tu progreso se guarda en la nube y te sigue entre dispositivos.'
            : 'Tu progreso está sólo en este navegador: podés descargarlo como respaldo desde ' +
              link('ajustes', 'Ajustes') + '.');
      }
    },

    /* ---------- premios compartidos ---------- */
    {
      id: 'bote', pregunta: '¿Cómo va el bote?', rol: 'jugador',
      claves: ['bote', 'pozo', 'jackpot', 'progresivo', 'bote bubba', 'acumulado'],
      responde: function () {
        if (!window.MCBote) return 'El Bote Bubba no está disponible ahora.';
        var B = MCBote;
        var apuesta = Math.max(B.MINIMO_APUESTA, 100);
        var en = B.unoEnCuantas(apuesta);
        return 'El <strong>Bote Bubba</strong> está en <strong>' + fmt(B.pozo()) + ' fichas</strong>' +
          (B.esCompartido() ? ', y es <strong>uno solo para todos</strong> los que entraron con Google.' : '.') +
          '<br>Cada ronda aporta el 1% de lo apostado y te da una chance de ganarlo: apostando ' +
          fmt(apuesta) + ', es 1 en ' + (isFinite(en) ? fmt(en) : '—') + '.<br>' +
          'La cuenta cierra justa: el bote te devuelve exactamente el 1% que aportás, ' +
          'apuestes como apuestes. Apostar fuerte no mejora el retorno, sólo adelanta el momento. ' +
          'Las apuestas de menos de ' + fmt(B.MINIMO_APUESTA) + ' no participan.' +
          (B.esCompartido() ? '' : '<br>Sin cuenta de Google jugás contra un pozo propio.');
      },
      sug: ['¿Cómo va el torneo?', '¿Cómo guardo mi progreso?']
    },
    {
      id: 'torneo', pregunta: '¿Cómo voy en el torneo?', rol: 'jugador',
      claves: ['torneo', 'golpe de la semana', 'competencia', 'semanal', 'marca*', 'golpazo', 'golpe maestro'],
      responde: function () {
        if (!window.MCTorneo) return 'El torneo está en ' + link('torneo', 'Torneo') + '.';
        var T = MCTorneo;
        var t = T.mio();
        var marcas = T.MARCAS.map(function (m) {
          var hecha = t.golpe >= m.x;
          return (hecha ? '✅ ' : '· ') + '<strong>' + m.nombre + '</strong> ' + x(m.x) + ' → ' + fmt(m.premio) + ' fichas';
        }).join('<br>');
        var cobrar = T.porCobrar();
        var txt = '<strong>El Golpe de la Semana</strong> premia tu <em>mejor multiplicador</em> de una ' +
          'sola ronda (lo que volvió dividido lo que apostaste). Así el que apuesta 20 y saca ×80 le ' +
          'gana al que apuesta 2.000 y saca ×3.<br>' +
          'Tu mejor golpe esta semana: <strong>' + (t.golpe ? x(Math.round(t.golpe * 100) / 100) : 'todavía ninguno') + '</strong>' +
          (t.juego && juego(t.juego) ? ' en ' + juego(t.juego).name : '') + '.<br>' + marcas + '<br>' +
          'Cierra en <strong>' + T.faltan() + '</strong> (los lunes a las 00:00).';
        if (cobrar.length) txt += '<br>👉 <strong>Tenés ' + cobrar.length + ' premio(s) para cobrar.</strong>';
        return txt + '<br>' + link('torneo', 'Ver el torneo');
      },
      sug: ['¿Qué juego tiene premios más grandes?', 'Ranking', '¿Cómo va el bote?']
    },
    {
      id: 'ranking', pregunta: 'Ranking',
      claves: ['ranking', 'tabla de posiciones', 'posiciones', 'podio', 'primero', 'quien va ganando', 'leaderboard', 'top jugadores'],
      responde: function () {
        return 'El ' + link('ranking', 'Ranking') + ' ordena a los jugadores por <strong>total apostado</strong>, ' +
          'con oro, plata y bronce. Para aparecer tenés que entrar con Google: los perfiles locales ' +
          'no salen de tu navegador.<br>Si buscás una competencia donde entrar con poco no te deje ' +
          'afuera, mirá el ' + link('torneo', 'Torneo') + ': mide multiplicadores, no fichas.';
      }
    },
    {
      id: 'compartir', pregunta: '¿Cómo comparto un premio?',
      claves: ['compartir', 'comparti*', 'whatsapp', 'mandar a un amigo', 'invitar', 'captura', 'mostrar mi premio', 'amigo*', 'multijugador', 'con otros', 'otros jugadores'],
      responde: function () {
        return 'Cuando sacás un golpe grande aparece el botón <strong>Compartir</strong>: arma una ' +
          'tarjeta con tu multiplicador y el link del casino. En el celular sale directo al menú ' +
          'para mandarlo por WhatsApp; en la compu se copia el mensaje y se descarga la imagen.<br>' +
          'Si tus amigos entran con Google, además compiten en el ' + link('ranking', 'Ranking') + ' y el ' +
          link('torneo', 'Torneo') + ', y juegan todos por el mismo Bote Bubba.';
      }
    },

    /* ---------- agente ---------- */
    {
      id: 'pedidos', pregunta: '¿Cómo le pido fichas al agente?',
      claves: ['pedir fichas', 'pido fichas', 'pedido*', 'pedirle al agente', 'solicitar', 'solicitud', 'peticion*', 'me cargue', 'que me carguen'],
      responde: function () {
        var P = window.MCPeticiones;
        if (!P) return 'Los pedidos de fichas se hacen desde el ' + link('cajero', 'Cajero') + '.';
        if (esAgente()) {
          var pend = P.usaNube() ? null : P.pendientes();
          return (pend ? 'Tenés <strong>' + pend.length + ' pedido(s) pendiente(s)</strong>. ' : '') +
            'Los pedidos de tus jugadores te llegan al ' + link('agente', 'Panel de agente') +
            ': al aceptarlos, las fichas salen de tu caja y queda asentado en el libro.';
        }
        var mio = P.usaNube() ? null : P.miPendiente();
        if (mio) {
          return 'Ya tenés un pedido de <strong>' + fmt(mio.monto) + ' fichas</strong> esperando que el ' +
            'agente lo resuelva. Lo podés cancelar desde el ' + link('cajero', 'Cajero') + '.';
        }
        return 'En el ' + link('cajero', 'Cajero') + ' tocás <strong>Pedir fichas</strong>, ponés el monto ' +
          '(de ' + fmt(P.MIN) + ' a ' + fmt(P.MAXIMO) + ') y una nota si querés. Al agente le llega ' +
          'y lo acepta o rechaza; si lo acepta, las fichas te aparecen solas.';
      }
    },
    {
      id: 'agente', pregunta: '¿Qué es el panel de agente?',
      claves: ['agente', 'panel de agente', 'cargar a un jugador', 'descontar', 'mis jugadores', 'rol', 'cambiar de rol'],
      responde: function () {
        if (esAgente()) {
          return 'Desde el ' + link('agente', 'Panel de agente') + ' ves a tus jugadores (saldo, lo apostado, ' +
            'rango, movimiento del día), les cargás o descontás fichas y resolvés sus pedidos.<br>' +
            'Cargar <strong>sale de tu caja</strong> y descontar vuelve a ella; todo queda en el libro de movimientos.';
        }
        return 'En Bubba hay dos roles: <strong>jugador</strong> (apuesta, cobra bonos, hace misiones, ' +
          'juega por el bote) y <strong>agente</strong> (carga fichas a sus jugadores y cobra comisión, ' +
          'pero no apuesta). Si necesitás fichas de tu agente, pedíselas desde el ' + link('cajero', 'Cajero') + '.';
      }
    },
    {
      id: 'caja-agente', pregunta: '¿Cuánto tengo en la caja?', rol: 'agente',
      claves: ['mi caja', 'caja del agente', 'flotante', 'comision', 'cobrar comision', 'netwin', 'ganancia del agente'],
      responde: function () {
        var C = window.MCCajaAgente;
        if (!C) return 'La caja está en el ' + link('agente', 'Panel de agente') + '.';
        return 'Tu caja tiene <strong>' + fmt(C.saldo()) + ' fichas</strong> (arrancó con ' + fmt(C.FLOTANTE) + ').<br>' +
          'Cobrás el <strong>' + pct(C.COMISION, 0) + '</strong> del netwin de tus jugadores; disponible ahora: <strong>' +
          fmt(C.comisionDisponible()) + '</strong>. Si tienen una buena racha el netwin baja y el disponible ' +
          'puede quedar en cero hasta que se recupere: nunca se cobra dos veces lo mismo.<br>' +
          link('agente', 'Abrir el panel');
      }
    },
    {
      id: 'casa', pregunta: '¿Qué es el panel de la casa?', rol: 'agente',
      claves: ['panel de la casa', 'margen', 'bajar el rtp', 'subir el rtp', 'configurar rtp', 'retorno de la casa'],
      responde: function () {
        return 'El ' + link('casa', 'Panel de la casa') + ' decide cuánto paga cada juego: movés el RTP de ' +
          'cada mesa o uno global. El cambio entra en la matemática del juego, no sólo en el cartel, ' +
          'y la pantalla de cada juego muestra el retorno que de verdad tiene.';
      }
    },

    /* ---------- cómo funciona el casino ---------- */
    {
      id: 'rtp', pregunta: '¿Qué es el RTP?', aspecto: 'paga',
      claves: ['rtp', 'retorno', 'devuelve', 'ventaja de la casa', 'probabilidad', 'chances', 'cual paga mas', 'que juego paga mas', 'mejor rtp', 'porcentaje'],
      responde: function () {
        var lista = MCCatalog.all.slice().sort(function (a, b) {
          return efectivo(b.id, 0) - efectivo(a.id, 0);
        });
        var mejor = lista[0];
        return 'El RTP es cuánto devuelve un juego <em>a la larga</em>: 96% quiere decir que de cada ' +
          '100 fichas apostadas vuelven 96 en promedio, y las otras 4 son la ventaja de la casa.<br>' +
          'Acá <strong>ningún RTP es de adorno</strong>: están calculados o medidos sobre la matemática real.<br>' +
          'El que más devuelve ahora es <strong>' + mejor.name + '</strong> (' + rtpDe(mejor) + ').<br>' +
          lista.slice(0, 5).map(function (g) { return '· ' + g.name + ' — ' + rtpDe(g); }).join('<br>');
      },
      sug: ['¿Qué es la volatilidad?', '¿Hay algún truco?', '¿Cómo sé que es justo?']
    },
    {
      id: 'volatilidad', pregunta: '¿Qué es la volatilidad?', aspecto: 'paga',
      claves: ['volatil*', 'varianza', 'racha*', 'riesgo', 'seguido'],
      responde: function () {
        return 'La volatilidad es cuánto se mueve el resultado, no cuánto paga.<br>' +
          '<strong>Baja</strong>: ganás seguido y poco. <strong>Alta</strong>: rachas secas largas y ' +
          'premios grandes cuando entran.<br>Dos juegos con el mismo RTP pueden sentirse completamente ' +
          'distintos: Se Busca y Maverick devuelven casi lo mismo y no se parecen en nada.<br>' +
          porVolatilidad();
      }
    },
    {
      id: 'premios', pregunta: '¿Qué juego tiene premios más grandes?',
      claves: ['premio mas grande', 'premios mas grandes', 'mas grande', 'maximo premio', 'premio maximo', 'pagar mas grande', 'mas alto', 'multiplicador mas alto'],
      responde: function () {
        var lista = MCCatalog.all.slice().sort(function (a, b) { return b.maxWin - a.maxWin; }).slice(0, 5);
        return 'Ordenados por premio máximo:<br>' + lista.map(function (g) {
          return '· <strong>' + g.name + '</strong> — hasta ' + x(g.maxWin) + ' (volatilidad ' + (g.volatility || '').toLowerCase() + ')';
        }).join('<br>') + '<br>Más techo casi siempre quiere decir rachas secas más largas.';
      }
    },
    {
      id: 'justo', pregunta: '¿Cómo sé que es justo?',
      claves: ['justo', 'juego justo', 'trampa', 'arreglado', 'amañado', 'manipulado', 'semilla*', 'provably fair', 'verificar', 'confiable', 'es real', 'roba*', 'robo', 'estafa'],
      responde: function () {
        return 'Dos cosas, y te digo hasta dónde llega cada una:<br>' +
          '· <strong>Los RTP están medidos</strong> sobre la misma matemática que se juega, con ' +
          'cientos de millones de rondas simuladas.<br>' +
          '· <strong>Bubba Gold tiene juego justo</strong>: cada giro sale de una semilla de la casa ' +
          '(ves su hash antes de apostar), tu semilla y un número de ronda. Al cerrar la tanda se ' +
          'revela y cualquiera puede recalcular la grilla. Está en ' + link('ajustes', 'Ajustes') + '.<br>' +
          'Lo honesto: el casino corre entero en tu navegador, así que eso prueba que una ronda no se ' +
          'tocó, no que la casa no pueda cambiar el código. Para eso, el código es público.';
      }
    },
    {
      id: 'truco', pregunta: '¿Hay algún truco?', aspecto: 'consejo',
      claves: ['truco', 'ganar siempre', 'como gano', 'como ganar', 'sistema', 'martingala', 'estrategia', 'consejo*', 'tip*', 'esta por pagar', 'conviene doblar'],
      responde: function () {
        return 'No hay truco, y desconfiá de quien te diga que sí.<br>' +
          'Cada ronda es independiente: los rodillos no se acuerdan de la anterior ni "están por pagar". ' +
          'La martingala (doblar cuando perdés) tampoco funciona: cambia muchas pérdidas chicas por una enorme.<br>' +
          'Lo que sí podés elegir: el juego (RTP y volatilidad) y el tamaño de la apuesta. Apostar ' +
          'el 1-2% de tu saldo por ronda hace que dure.';
      },
      sug: ['Estrategia de blackjack', '¿Qué es el RTP?', '¿A qué juego me conviene?']
    },
    {
      id: 'como', pregunta: '¿Cómo se juega?', aspecto: 'como',
      claves: ['como se juega', 'como juego', 'como apuesto', 'como se apuesta', 'como hago para jugar', 'reglas', 'como funciona', 'explicame', 'de que se trata', 'que es', 'instrucciones', 'como es'],
      responde: function () {
        return '¿De qué juego? Decime el nombre —por ejemplo <em>"cómo se juega Mines"</em>— o ' +
          'preguntame <em>"qué juegos hay"</em> y te paso la lista.';
      },
      sug: ['¿Qué juegos hay?', '¿Cómo se juega Mines?', '¿Cómo se juega al blackjack?']
    },
    {
      id: 'paga', pregunta: '¿Cuánto paga?', aspecto: 'paga',
      claves: ['cuanto paga', 'que paga', 'pagos', 'tabla de pagos', 'premios', 'cuanto se gana', 'cuanto puedo ganar', 'maximo', 'como se calcula'],
      responde: function () {
        return '¿Qué juego? Decime el nombre, o te paso los que tienen ' +
          '<em>premios más grandes</em> o el <em>mejor RTP</em>.';
      },
      sug: ['¿Qué juego tiene premios más grandes?', '¿Qué juego paga más?']
    },
    {
      id: 'juegos', pregunta: '¿Qué juegos hay?',
      claves: ['que juegos hay', 'juegos hay', 'lista de juegos', 'cuantos juegos', 'catalogo', 'todos los juegos', 'que hay para jugar', 'tragamonedas', 'slots', 'juegos de mesa'],
      responde: function () {
        var grupos = {};
        MCCatalog.all.forEach(function (g) {
          (grupos[g.kind] = grupos[g.kind] || []).push(g);
        });
        return 'Hay <strong>' + MCCatalog.all.length + ' juegos</strong>:<br>' +
          Object.keys(grupos).map(function (k) {
            return '<strong>' + k + ':</strong> ' + grupos[k].map(function (g) {
              return link(g.id, g.emoji + ' ' + g.name);
            }).join(', ');
          }).join('<br>') + '<br>Tocá uno para jugarlo, o preguntame cómo se juega.';
      },
      sug: ['¿A qué juego me conviene?', '¿Qué juego paga más?', '¿Qué juego tiene premios más grandes?']
    },
    {
      id: 'recomendacion', pregunta: '¿A qué juego me conviene?',
      claves: ['recomend*', 'que juego', 'a que juego', 'cual juego', 'cual me conviene', 'me conviene', 'sugerencia', 'sugeri*', 'con que arranco', 'para empezar', 'no se que jugar'],
      responde: function () {
        var s = MC.getBalance();
        if (!esAgente() && s < 300) {
          return 'Con ' + fmt(s) + ' fichas yo primero pasaría por el ' + link('cajero', 'Cajero') +
            ' a buscar el bono. Después, con saldo, jugá tranquilo.';
        }
        var todos = MCCatalog.all;
        var masRtp = todos.slice().sort(function (a, b) { return efectivo(b.id, 0) - efectivo(a.id, 0); })[0];
        var suave = todos.filter(function (g) { return g.volatility === 'Media' && g.kind === 'Tragamonedas'; })[0];
        var bravo = todos.slice().sort(function (a, b) { return b.maxWin - a.maxWin; })[0];
        var txt = 'Depende de qué tengas ganas:<br>';
        if (masRtp) txt += '· <strong>Que rinda:</strong> ' + link(masRtp.id, masRtp.name) + ' (' + rtpDe(masRtp) + ')<br>';
        if (suave) txt += '· <strong>Girar tranquilo:</strong> ' + link(suave.id, suave.name) + ', volatilidad media<br>';
        if (bravo) txt += '· <strong>Buscar el golpe:</strong> ' + link(bravo.id, bravo.name) + ', hasta ' + x(bravo.maxWin) + '<br>';
        txt += '· <strong>Algo rápido:</strong> ' + link('crash', 'Bubba Jet') + ' o ' + link('mines', 'Mines') + ', vos decidís cuándo retirar';
        if (!esAgente()) {
          var una = Math.max(1, Math.round(s * 0.01));
          txt += '<br>Con ' + fmt(s) + ' fichas, apostando ' + fmt(una) + ' (el 1%) te alcanza para ' +
            'muchas rondas.';
        }
        return txt;
      }
    },
    {
      id: 'ajustes', pregunta: '¿Qué hay en Ajustes?',
      claves: ['ajuste*', 'configur*', 'sonido', 'silenciar', 'mute', 'animacion*', 'descargar progreso', 'exportar', 'importar', 'respaldo', 'backup', 'borrar datos'],
      responde: function () {
        return 'En ' + link('ajustes', 'Ajustes') + ' tenés:<br>' +
          '· <strong>Sonido</strong>, <strong>animaciones</strong> y <strong>tema</strong> claro/oscuro<br>' +
          '· <strong>Juego responsable</strong>: límite de apuesta por ronda y recordatorio del tiempo jugado<br>' +
          '· <strong>Juego justo</strong>: tu semilla y la de la casa<br>' +
          '· <strong>Tus datos</strong>: descargar el progreso como archivo, importarlo en otro navegador o borrarlo';
      }
    },
    {
      id: 'tema', pregunta: '¿Cómo cambio a modo claro?',
      claves: ['tema', 'modo oscuro', 'modo claro', 'oscuro', 'claro', 'colores', 'fondo blanco', 'dark mode'],
      responde: function () {
        var actual = window.MCTema ? MCTema.leer() : 'sistema';
        return 'En ' + link('ajustes', 'Ajustes') + ' → <strong>Tema</strong> elegís claro, oscuro o ' +
          '"como el sistema", que sigue lo que tengas puesto en tu compu o celular. Ahora está en ' +
          '<strong>' + actual + '</strong>. Las mesas de juego no cambian: un paño es verde con la luz que sea.';
      }
    },
    {
      id: 'responsable', pregunta: 'Juego responsable',
      claves: ['responsable', 'limite*', 'adiccion', 'adicto', 'vicio', 'no puedo parar', 'juego mucho', 'controlar', 'pausa', 'autoexclusion', 'recordatorio', 'menor de edad', 'edad'],
      responde: function () {
        return 'Acá las fichas no valen nada, pero los hábitos se practican igual. En ' + link('ajustes', 'Ajustes') +
          ' podés poner un <strong>límite de apuesta por ronda</strong> y un <strong>recordatorio</strong> ' +
          'cada tantos minutos.<br>Señales para cortar: jugar para recuperar lo perdido, seguir ' +
          'aunque no te divierta, o que te cueste parar.<br>Si eso te pasa con dinero real, en Argentina ' +
          'podés buscar ayuda gratuita en <strong>Jugadores Anónimos</strong> o en el programa de juego ' +
          'responsable de tu provincia.';
      }
    },
    {
      id: 'dinero', pregunta: '¿Hay dinero real?',
      claves: ['dinero real', 'plata real', 'retirar', 'retiro', 'depositar', 'deposito', 'cobrar plata', 'pasar a pesos',
               'ganar plata', 'ganar dinero', 'plata', 'tarjeta', 'mercado pago', 'transferencia', 'cbu', 'cuanto valen', 'valen algo', 'pesos', 'dolares'],
      responde: function () {
        return 'No, y no es un detalle: <strong>acá no hay dinero real en ningún lado</strong>.<br>' +
          'Las fichas son virtuales, se consiguen gratis y no valen nada. No se puede ' +
          'depositar ni retirar, y nunca te vamos a pedir datos de una tarjeta ni de ' +
          'una cuenta bancaria. Si alguien te pide plata en nombre de Bubba, es una estafa.';
      }
    },
    {
      id: 'celular', pregunta: '¿Se puede jugar en el celular?',
      claves: ['celular', 'telefono', 'movil', 'android', 'iphone', 'app', 'aplicacion', 'instalar', 'descargar la app'],
      responde: function () {
        return 'Sí: se juega desde el navegador del celular, no hay que instalar nada. Si querés ' +
          'tenerlo a mano, en el menú del navegador elegí <strong>"Agregar a pantalla de inicio"</strong> ' +
          'y te queda como una app. Entrando con Google tu saldo es el mismo en la compu y el celular.';
      }
    },
    {
      id: 'problema', pregunta: 'Algo no anda',
      claves: ['no anda', 'no funciona', 'no carga', 'no me carga', 'no me anda', 'no me funciona', 'no abre', 'carga el juego', 'error', 'bug', 'se colgo', 'se trabo', 'pantalla negra', 'no me deja', 'se borro', 'perdi mis fichas', 'no aparece'],
      responde: function () {
        return 'Probemos en orden:<br>' +
          '1. <strong>Recargá la página</strong> (si estabas en medio de una ronda, el saldo ya quedó guardado).<br>' +
          '2. Si no te deja salir de un juego, es porque hay una ronda abierta: terminala primero.<br>' +
          '3. Si se te "borraron" las fichas, fijate de estar en el mismo perfil y el mismo navegador; ' +
          'con Google, que hayas entrado con la misma cuenta.<br>' +
          '4. Si lo abrís desde la compu con doble clic en el archivo, usá <em>ABRIR CASINO.bat</em>: ' +
          'las tragamonedas grandes necesitan el servidor.';
      }
    },
    {
      id: 'sobre', pregunta: '¿Qué es Bubba Games?',
      claves: ['bubba games', 'que es bubba', 'quien hizo', 'quien creo', 'creador', 'de quien es', 'sobre el casino', 'que es esto', 'este casino'],
      responde: function () {
        return '<strong>Bubba Games</strong> es un casino de práctica con fichas virtuales: sin dinero ' +
          'real, sin registro obligatorio, y con la matemática de cada juego a la vista. Los RTP ' +
          'están medidos, el bote cierra justo y las reglas se explican en vez de esconderse.';
      }
    }
  ];

  /* ---------------- datos de apoyo ---------------- */
  function misionesSinCobrar() {
    var items = (window.MCMissions && MCMissions.items()) || [];
    return items.filter(function (m) { return !m.claimed; }).length;
  }

  function porVolatilidad() {
    var orden = ['Baja', 'Media', 'Media-alta', 'Alta', 'Extrema'];
    var lista = MCCatalog.all.slice().sort(function (a, b) {
      return orden.indexOf(a.volatility) - orden.indexOf(b.volatility);
    });
    return lista.map(function (g) {
      return '· ' + g.name + ' — ' + (g.volatility || '').toLowerCase();
    }).join('<br>');
  }

  return {
    INTENCIONES: INTENCIONES,
    GUIAS: GUIAS,
    LUGARES: LUGARES,
    // El motor arma la cabecera de cada juego con esto.
    rtpDe: rtpDe,
    esAgente: esAgente,
    link: link,
    jugar: jugar
  };
})();
