/* ============================================================
   NÚCLEO / RETORNO — el margen de la casa, en un solo lugar.

   Este módulo es el que permite bajarle el RTP a los juegos sin
   tocar la matemática de ninguno. Lo configura el panel de la casa
   (ui/casa.js) y lo consultan los motores.

   ---------------------------------------------------------------
   CÓMO SE BAJA UN RTP, Y CÓMO **NO**
   ---------------------------------------------------------------
   La forma fácil sería recortar el pago al final: calcular el premio
   como siempre y entregar el 90%. Está mal, y vale decir por qué:
   la pantalla seguiría anunciando "paga 35:1" mientras la caja paga
   31,5:1. El jugador no puede ver el recorte en ningún lado.

   Acá se hace al revés. Cada juego expresa su ventaja en ALGÚN
   número propio —una constante, una tabla, una cuota—, y el factor
   se aplica AHÍ, antes de que ese número llegue a la pantalla. El
   resultado es que la interfaz se corrige sola: Mines muestra
   multiplicadores más chicos, la ruleta dice "paga 31:1", la liga
   cotiza más bajo. Nada queda mintiendo, porque nada se recorta
   después de haberlo mostrado.

   Dónde entra el factor en cada juego:

     Bubba Jet (crash)   punto de reventón  0.97/(1−r) → k·0.97/(1−r)
     Mines               EDGE = 0.97        → 0.97·k
     Ruleta Europea      pago = 36/n − 1    → k·36/n − 1
     Bubba 777           multiplicadores de la tabla × k
     Bubba Gold          tabla de pagos × k (en slots5-math)
     Doble o Nada        PAGO = 1.95        → 1.95·k
     Liga Argentina      cuota = 1/(p(1+m)) → × k
     Blackjack           la GANANCIA × k; el empate no se toca

   Las tres tragamonedas servidas en iframe (Maverick, Se Busca, La
   Vendimia) quedan afuera: su matemática corre en otro proyecto y
   este módulo no la alcanza. El panel lo dice en pantalla en vez de
   mostrar un control que no haría nada.

   ---------------------------------------------------------------
   POR QUÉ EL RTP RESULTANTE ES EXACTAMENTE k · NOMINAL
   ---------------------------------------------------------------
   En los siete juegos de arriba —todos menos blackjack— el retorno
   esperado es una suma de (probabilidad × pago), y el factor
   multiplica cada pago sin tocar ninguna probabilidad. Sacar k de
   factor común da:

       RTP(k) = Σ pᵢ · (k·cᵢ) = k · Σ pᵢ · cᵢ = k · RTP(1)

   Por eso el panel puede prometer un número y cumplirlo, en vez de
   estimarlo. En crash y en Mines sale todavía más directo: el RTP
   de esos dos ES la constante, para cualquier forma de jugarlos.

   Blackjack es el único distinto y está explicado en su propio
   motor: el empate devuelve la apuesta y no es un premio, así que
   no se escala. Eso deja el retorno real un poco por ENCIMA de
   k·nominal, y el panel lo avisa en vez de publicar un número que
   no puede sostener.

   Depende de: state (para guardar), rng (para el redondeo).
   Lo consultan los nueve motores y las tarjetas del catálogo.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  /* Hasta dónde se puede bajar. El tope de arriba es 1: este panel
     BAJA el retorno, no lo sube. Dejar pasar k>1 sería publicar un
     juego que paga más de lo que su matemática dice aguantar, y el
     bote y el ranking dejarían de significar lo mismo. */
  var MIN = 0.50;
  var MAX = 1.00;

  /* Los juegos que este módulo no puede alcanzar: corren en un iframe
     con su propia matemática. Se listan para que el panel los muestre
     como lo que son en vez de ofrecer una perilla muerta. */
  var FUERA_DE_ALCANCE = ['maverick', 'sebusca', 'vendimia'];

  /* ============================================================
     LO QUE SE PUBLICA — el retorno que viaja en el código

     Acá abajo está el retorno que la casa publica, y es lo ÚNICO de
     este módulo que vale para todo el mundo. Se sirve junto con el
     sitio, así que cualquiera que lo abra lo recibe.

     Hace falta porque el panel no puede hacer eso. El panel escribe
     en el almacenamiento del navegador, y el almacenamiento de un
     navegador no es de nadie más: bajar una mesa desde ahí la baja
     para vos y para nadie más. No es una limitación que se pueda
     programar alrededor — no hay servidor donde guardar una decisión
     de la casa. Si el número tiene que valer para todos, tiene que
     estar en un archivo que se publique.

     Entonces queda así:

       PUBLICADO   está acá, viaja en el push, lo ve todo el mundo
       el panel    está en tu navegador, lo ves vos

     El panel sigue sirviendo para probar: movés, mirás cómo queda y,
     cuando estás conforme, el botón "Publicar esto para todos" te da
     las líneas exactas para pegar justo acá abajo. Después un commit
     y un push, y recién ahí el cambio es de la casa.

     Formato: igual que el del panel. `global` es el factor que
     siguen todas las mesas; `juegos` lleva las que tienen número
     propio. Dejarlo en 1 y vacío es lo de fábrica.
     ============================================================ */
  var PUBLICADO = {
    global: 0.92,
    juegos: {}
  };

  /* ============================================================
     LO QUE PUBLICA LA CASA EN VIVO

     PUBLICADO, arriba, es el piso: viaja en el código y no se puede
     cambiar sin un push. Esto otro es lo mismo pero en Firestore, y
     es lo que de verdad usa la casa para mover el retorno:

       la casa lo escribe desde el panel  →  Firestore
       cada visitante lo escucha          →  se aplica solo

     Sin pegar código, sin commit y sin push. El documento es
     `casa/retorno`: lo lee cualquiera y lo escribe sólo quien esté
     en la lista de firestore.rules.

     Se guarda una copia en este navegador por dos motivos:

       1. El casino arranca sincrónico y Firestore contesta después.
          Sin copia habría unos cuantos giros pagando el valor del
          código antes de que llegue el de la casa.
       2. Sin internet se sigue jugando con el último retorno
          conocido, que es más fiel que volver al de fábrica.

     La copia NO va en MC.state: el estado es por perfil y esto es de
     la casa, igual para todos los que abran esta compu.
     ============================================================ */
  var CLAVE_NUBE = 'bubba.casa.retorno';
  var nube = leerCache();
  var alCambiar = [];

  function leerCache() {
    try {
      var raw = localStorage.getItem(CLAVE_NUBE);
      if (!raw) return null;
      var c = JSON.parse(raw);
      return (c && typeof c === 'object') ? c : null;
    } catch (e) { return null; }
  }

  /**
   * Entra el retorno que publicó la casa. La llama la capa de
   * Firestore cada vez que el documento cambia, así que un cambio
   * hecho en el panel llega a las demás pantallas sin que nadie
   * tenga que recargar nada.
   */
  function setNube(c) {
    nube = (c && typeof c === 'object') ? c : null;
    if (nube && !nube.juegos) nube.juegos = {};
    try {
      if (nube) localStorage.setItem(CLAVE_NUBE, JSON.stringify(nube));
      else localStorage.removeItem(CLAVE_NUBE);
    } catch (e) { /* sin espacio o en modo privado: se juega igual */ }
    alCambiar.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  /** Para que la vitrina y el panel se repinten cuando llega un cambio. */
  function onCambio(fn) { alCambiar.push(fn); }

  function enNube() { return nube; }

  /* Lo que decidiste vos en ESTE navegador. Arranca vacío a propósito:
     una clave ausente quiere decir "seguí lo publicado", y por eso el
     objeto no se rellena con valores por defecto.

     La migración de abajo existe por una versión anterior de este
     módulo que guardaba {global: 1, juegos: {}} en toda cuenta, aunque
     nadie hubiera tocado nada. Eso, leído con las reglas de hoy, sería
     un jugador diciendo "quiero el 100%, ignorá lo publicado", y le
     taparía a la casa cualquier retorno que publicara después. Si no
     hay ningún juego con número propio, un global en 1 es el rastro de
     aquello y no una decisión: se borra. */
  function config() {
    if (!MC.state.rtp) MC.state.rtp = {};
    var c = MC.state.rtp;
    if (!c.juegos) c.juegos = {};

    /* La limpieza corre UNA sola vez y queda marcada. Si corriera
       siempre, borraría también un 100% puesto a propósito —alguien
       que quiere ver el retorno de fábrica en su compu mientras la
       casa publica un recorte—, y esa es una elección legítima que el
       panel tiene que poder guardar. */
    if (c.v !== 2) {
      if (c.global === 1 && !Object.keys(c.juegos).length) delete c.global;
      c.v = 2;
    }
    return c;
  }

  function limitar(f) {
    f = Number(f);
    if (!isFinite(f)) return 1;
    return Math.min(MAX, Math.max(MIN, f));
  }

  /* ---------------- consulta ---------------- */

  /**
   * El factor que corre para un juego.
   *
   * El ajuste propio GANA sobre el global, no se multiplican. Dos
   * perillas que se multiplican entre sí son imposibles de leer:
   * poner 90% en un juego y ver 85% porque además había un global
   * del 95% es la clase de sorpresa que hace que nadie confíe en el
   * panel. Acá, el número que pusiste en un juego es el que corre.
   */
  function factor(gameId) {
    var c = config();
    var id = gameId || MC.getCurrentGame();
    if (id && fueraDeAlcance(id)) return 1;

    /* El orden es de lo más específico a lo más general, y lo de este
       navegador va antes que lo publicado: el panel existe para poder
       probar algo distinto sin publicarlo. */
    if (id && c.juegos[id] !== undefined) return limitar(c.juegos[id]);
    if (c.global !== undefined) return limitar(c.global);
    return factorPublicado(id);
  }

  /** El factor global que corre: el tuyo si lo pusiste, si no el publicado. */
  function global_() {
    var c = config();
    return limitar(c.global !== undefined ? c.global : PUBLICADO.global);
  }

  /**
   * El factor que la casa publica para un juego, sin mirar lo que
   * haya decidido este navegador.
   *
   * Lo de la nube le gana al código: el código es el piso con el que
   * arranca un casino recién clonado, y la nube es la decisión viva.
   */
  function factorPublicado(gameId) {
    if (gameId && fueraDeAlcance(gameId)) return 1;
    if (nube) {
      if (gameId && nube.juegos && nube.juegos[gameId] !== undefined) {
        return limitar(nube.juegos[gameId]);
      }
      if (nube.global !== undefined) return limitar(nube.global);
    }
    if (gameId && PUBLICADO.juegos[gameId] !== undefined) {
      return limitar(PUBLICADO.juegos[gameId]);
    }
    return limitar(PUBLICADO.global);
  }

  /** ¿Este navegador le está pisando el valor publicado a este juego? */
  function pisado(gameId) {
    return Math.abs(factor(gameId) - factorPublicado(gameId)) > 0.0005;
  }

  /** ¿Hay algo decidido en este navegador, sea lo que sea? */
  function hayLocal() {
    var c = config();
    return c.global !== undefined || Object.keys(c.juegos).length > 0;
  }

  /** ¿La casa publicó algún recorte? */
  function hayPublicado() {
    var g = (nube && nube.global !== undefined) ? nube.global : PUBLICADO.global;
    if (Math.abs(limitar(g) - 1) > 0.0005) return true;
    var j = (nube && nube.juegos) ? nube.juegos : PUBLICADO.juegos;
    return Object.keys(j).length > 0;
  }

  function fueraDeAlcance(gameId) {
    return FUERA_DE_ALCANCE.indexOf(gameId) >= 0;
  }

  /** El RTP con el que el juego fue diseñado (el del catálogo). */
  function nominal(gameId) {
    var g = MC.getGame ? MC.getGame(gameId) : null;
    return g && g.rtpValue ? g.rtpValue : 0;
  }

  /** El RTP que de verdad está pagando hoy. */
  function efectivo(gameId) {
    return nominal(gameId) * factor(gameId);
  }

  /** ¿Este juego está tocado? Sirve para marcarlo en pantalla. */
  function ajustado(gameId) {
    return Math.abs(factor(gameId) - 1) > 0.0005;
  }

  /** ¿Hay algo tocado en todo el casino? */
  function hayAjustes() {
    /* Se accede por window y no por el global suelto: este módulo
       también se carga fuera del navegador, en tools/rtp-verificar.js,
       donde el catálogo se inyecta en un window de mentira y el
       nombre pelado no existe. */
    if (!window.MCCatalog) return hayLocal() || hayPublicado();
    return window.MCCatalog.all.some(function (g) { return ajustado(g.id); });
  }

  /* ---------------- escritura ---------------- */
  function setGlobal(f) {
    config().global = limitar(f);
    MC.save();
  }

  function set(gameId, f) {
    config().juegos[gameId] = limitar(f);
    MC.save();
  }

  /** Saca el ajuste propio: el juego vuelve a seguir al global. */
  function quitar(gameId) {
    delete config().juegos[gameId];
    MC.save();
  }

  /** Borra lo de ESTE navegador. Lo publicado no se toca desde acá:
      para cambiarlo hay que editar PUBLICADO y publicar el sitio. */
  function reset() {
    MC.state.rtp = {};
    MC.save();
  }

  /** Saca el global propio: todo vuelve a seguir lo publicado. */
  function quitarGlobal() {
    delete config().global;
    MC.save();
  }

  /* ============================================================
     LAS LÍNEAS PARA PUBLICAR

     El puente entre las dos capas. El panel no puede escribir en un
     archivo —corre en el navegador, no tiene manos sobre el disco—,
     así que hace lo único honesto que puede hacer: te devuelve
     exactamente el texto que va en PUBLICADO, arriba de este archivo.

     Se arma con lo que está corriendo AHORA (lo tuyo pisando lo
     publicado), que es lo que acabás de probar y querés dejar fijo.
     ============================================================ */
  function codigo() {
    var juegos = [];
    if (window.MCCatalog) {
      window.MCCatalog.all.forEach(function (g) {
        if (fueraDeAlcance(g.id)) return;
        var f = factor(g.id);
        if (Math.abs(f - global_()) > 0.0005) {
          juegos.push("      " + g.id + ": " + redondear(f) +
                      ",   // " + g.name + " → " + pct(g.rtpValue * f));
        }
      });
    }
    var lineas = [
      '  var PUBLICADO = {',
      '    global: ' + redondear(global_()) + ',',
      juegos.length ? '    juegos: {' : '    juegos: {}'
    ];
    if (juegos.length) {
      // La última sin coma, para que no quede basura en el archivo.
      juegos[juegos.length - 1] = juegos[juegos.length - 1].replace(',   //', '    //');
      lineas = lineas.concat(juegos, ['    }']);
    }
    lineas.push('  };');
    return lineas.join('\n');
  }

  // Cuatro decimales alcanzan: es la milésima de punto de RTP.
  function redondear(f) { return Math.round(f * 10000) / 10000; }

  /* ============================================================
     REDONDEO A FICHAS — por qué no se usa Math.floor

     Con los multiplicadores enteros de antes, redondear era casi
     gratis. Con un factor dejan de ser enteros: Doble o Nada pasa de
     pagar 1.95 a pagar 1.755, y `Math.floor(10 × 1.755)` da 17
     cuando el pago justo es 17,55. Sobre apuestas de 10 fichas eso
     es un 3% que se pierde por el piso, no por el factor: el panel
     prometería 90% y la caja pagaría 87%.

     La salida es redondear al azar con la probabilidad del resto:
     17,55 paga 18 el 55% de las veces y 17 el 45%. Así

         E[fichas(x)] = x

     exactamente, para cualquier x y cualquier apuesta. El jugador ve
     un entero —las fichas no se parten— y la caja respeta la
     matemática al decimal.

     De paso arregla un sesgo que ya existía: el `Math.floor` de
     Mines, Crash y la liga venía comiéndose una fracción de ficha en
     cada pago, así que esos juegos pagaban un pelo menos que el RTP
     que publicaban.
     ============================================================ */
  function fichas(x) {
    if (!(x > 0)) return 0;
    var piso = Math.floor(x);
    var resto = x - piso;
    return resto > 0 && MC.rand() < resto ? piso + 1 : piso;
  }

  /* ---------------- texto para la pantalla ---------------- */
  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }

  /**
   * La etiqueta de RTP de una tarjeta del catálogo.
   *
   * Existe para que las tarjetas no puedan quedar desactualizadas:
   * si el número saliera de `g.rtp` —el texto fijo del catálogo—,
   * bajar el retorno dejaría la vitrina anunciando el de fábrica.
   */
  function etiqueta(g) {
    if (!g) return '';
    if (!g.rtpValue || !ajustado(g.id)) return g.rtp;
    var base = g.rtp.indexOf('Retorno') === 0 ? 'Retorno ' : 'RTP ';
    return base + pct(g.rtpValue * factor(g.id));
  }

  /**
   * El renglón chico de la tarjeta.
   *
   * Tres juegos lo tienen escrito con un número que depende del RTP
   * ("Ventaja de la casa 3%", "Pleno paga 35:1"). Con el retorno
   * bajado esos textos pasan a ser falsos, así que se derivan.
   */
  function tagDe(g) {
    if (!g || !ajustado(g.id)) return g ? g.tag : '';
    var k = factor(g.id);
    if (g.id === 'crash' || g.id === 'mines') {
      return 'Ventaja de la casa ' + pct(1 - 0.97 * k);
    }
    if (g.id === 'roulette') {
      return 'Pleno paga ' + (Math.round((k * 36 - 1) * 100) / 100) + ':1';
    }
    return g.tag;
  }

  MC.rtp = {
    MIN: MIN, MAX: MAX,
    factor: factor,
    global: global_,
    nominal: nominal,
    efectivo: efectivo,
    ajustado: ajustado,
    hayAjustes: hayAjustes,
    fueraDeAlcance: fueraDeAlcance,
    // Las dos capas, por separado: lo que publica la casa y lo tuyo.
    factorPublicado: factorPublicado,
    setNube: setNube,
    enNube: enNube,
    onCambio: onCambio,
    pisado: pisado,
    hayLocal: hayLocal,
    hayPublicado: hayPublicado,
    codigo: codigo,
    setGlobal: setGlobal,
    set: set,
    quitar: quitar,
    quitarGlobal: quitarGlobal,
    reset: reset,
    fichas: fichas,
    etiqueta: etiqueta,
    tagDe: tagDe,
    pct: pct
  };
})(window.MC);
