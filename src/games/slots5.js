/* ============================================================
   MOTOR / BUBBA GOLD — 5 rodillos, 3 filas, 20 líneas

   Toda la matemática vive en slots5-math.js, que es el archivo que
   mide `node tools/slots5-rtp.js`. Acá sólo hay presentación y
   manejo de la ronda: este archivo NO decide cuánto paga nada.

   ---------------------------------------------------------------
   CÓMO SE CUENTA UNA RONDA
   ---------------------------------------------------------------
   Una ronda es el giro pago MÁS todos los giros gratis que dispare,
   con sus retriggers. Se cobra una sola apuesta al principio y se
   llama a MC.recordRound() una sola vez al final, con lo apostado y
   lo devuelto por el conjunto.

   Si se registrara cada giro gratis como una ronda aparte, el
   historial mostraría veinte "apuestas de 0 fichas" y las
   estadísticas quedarían sin sentido.
   ============================================================ */
window.MCSlots5 = (function () {
  'use strict';

  var M = window.MCSlots5Math;

  var LINE_BETS = [1, 2, 5, 10, 25, 50];
  var betIndex = 2;

  var REEL_MS = [700, 900, 1100, 1300, 1500];   // frenada escalonada
  /* La función va al doble de velocidad. Con retriggers una función puede
     pasar de 90 giros: a ritmo del juego base eso son más de tres minutos
     mirando sin poder tocar nada, que es exactamente al revés de lo que
     tiene que sentirse ganar. */
  var REEL_MS_FREE = [340, 430, 520, 610, 700];
  var REEL_MS_TURBO = [110, 150, 190, 230, 270];
  var STOP_AT = 18;                              // símbolos que "pasan" antes de frenar
  var WIN_STEP_MS = 620;                         // cuánto dura cada línea encendida

  /* Cuánto se estira el rodillo que puede disparar la función. Es el
     número que decide si el juego "se siente" o no: sin esto, que
     caigan dos bolsas y que caigan tres se ven exactamente igual.

     Con dos bolsas, TODOS los rodillos que faltan siguen vivos, así que
     todos anticipan. Pero no pueden durar lo mismo: a 1,7s cada uno el
     giro se iba a más de seis segundos y la tensión se volvía tedio.
     El primero es el dramático; los siguientes sostienen sin estirar. */
  var ANTICIPA_1 = 1500;
  var ANTICIPA_N = 800;
  var ANTICIPA_TOPE = 3200;   // techo del estirón total

  /* Los escalones del premio y el conteo viven en MCPremio: los usan
     los ocho juegos y tienen que verse igual en todos. */

  var turbo = false;
  var autoLeft = 0;

  var spinning = false;
  var freeLeft = 0;
  var freeTotal = 0;
  var freeWin = 0;
  var roundReturn = 0;
  /* Lo que costó ESTA ronda. Casi siempre es la apuesta, pero comprar
     la función cuesta 16x: si el cierre contable siguiera usando
     totalBet(), una compra quedaría registrada como si hubiera salido
     una apuesta normal y las estadísticas mentirían. */
  var roundStake = 0;

  /* DOS relojes distintos, a propósito. Antes compartían variable y el
     ciclo de líneas ganadoras pisaba al que programa el próximo giro
     gratis: el clearTimeout de arriba cancelaba el que estuviera último,
     no el que correspondía. Separados, cada uno se cancela solo. */
  var winTimer = null;    // ciclo que enciende las líneas ganadoras
  var nextTimer = null;   // próximo giro de la función

  var el = {};

  function lineBet() { return LINE_BETS[betIndex]; }
  function totalBet() { return lineBet() * M.LINES; }
  function inFreeMode() { return freeLeft > 0 || freeTotal > 0; }

  /* ---------------- armado de los rodillos ---------------- */
  /* El rango sale de lo que PAGA el símbolo, no de una lista aparte:
     si mañana se retoca la tabla, el color acompaña solo. */
  var RANGOS = { W: 'wild', S: 'scatter' };
  M.SYMBOLS.forEach(function (s) {
    if (RANGOS[s.id]) return;
    var p = M.PAYS[s.id] ? M.PAYS[s.id][5] : 0;
    RANGOS[s.id] = p >= 600 ? 'alta' : p >= 150 ? 'media' : 'baja';
  });

  function cellHTML(id, extra) {
    var cls = 'g5-cell' + (id === M.WILD ? ' es-wild' : '') +
                          (id === M.SCATTER ? ' es-scatter' : '') + (extra || '');
    return '<div class="' + cls + '" data-sym="' + id + '" data-rango="' + RANGOS[id] + '">' +
             '<span class="simbolo">' + MCStudioSymbols.render(M.FACE[id]) + '</span>' +
           '</div>';
  }

  function randomSymbol(reel) {
    var strip = M.STRIPS[reel];
    return strip[MC.randInt(0, strip.length)];
  }

  // Estado quieto: tres símbolos por rodillo, sin animación.
  function seedReels() {
    el.strips.forEach(function (strip, reel) {
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      var cells = '';
      for (var r = 0; r < M.ROWS; r++) cells += cellHTML(randomSymbol(reel));
      strip.innerHTML = cells;
    });
  }

  function cellHeight() {
    return el.strips[0].parentElement.clientHeight / M.ROWS;
  }

  /* El giro visual: la tira termina con los tres símbolos que ya salieron. */
  function animateReel(reel, column, duration) {
    var strip = el.strips[reel];
    var cells = [];
    for (var i = 0; i < STOP_AT; i++) cells.push(cellHTML(randomSymbol(reel)));
    for (var r = 0; r < M.ROWS; r++) cells.push(cellHTML(column[r]));
    cells.push(cellHTML(randomSymbol(reel)));

    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.innerHTML = cells.join('');
    void strip.offsetWidth;   // reflow: que la transición arranque desde 0

    strip.style.transition = 'transform ' + duration + 'ms cubic-bezier(.12,.66,.16,1)';
    strip.style.transform = 'translateY(' + (-STOP_AT * cellHeight()) + 'px)';
  }

  /* Enciende el rodillo mientras dura su anticipación: arranca cuando
     frena el anterior y se apaga cuando frena él. */
  function encenderAnticipacion(reel, desde, hasta) {
    var caja = el.strips[reel].parentElement;
    setTimeout(function () {
      caja.classList.add('anticipa');
      MC.sound.tension((hasta - desde) / 1000);
    }, desde);
    setTimeout(function () { caja.classList.remove('anticipa'); }, hasta);
  }

  function apagarAnticipacion() {
    el.board.querySelectorAll('.anticipa').forEach(function (c) { c.classList.remove('anticipa'); });
  }

  /* ---------------- una ronda ---------------- */
  function spin() {
    if (spinning) return;

    // Un giro gratis no cobra; el pago sale de la ronda que lo disparó.
    if (freeLeft <= 0) {
      var cost = totalBet();
      if (!MC.canBet(cost)) { MC.toast('No te alcanzan las fichas. Pedí el bono.', 'lose'); return; }
      MC.addBalance(-cost);
      roundReturn = 0;
      roundStake = cost;
    }

    spinning = true;
    clearTimeout(winTimer);
    clearTimeout(nextTimer);
    limpiarGanadoras();
    MCPremio.limpiar({ win: el.win, tier: el.tier });
    el.msg.textContent = freeLeft > 0
      ? 'Giro gratis ' + (freeTotal - freeLeft + 1) + ' de ' + freeTotal
      : 'Girando...';
    actualizarControles();
    MC.sound.spin();

    // EL RESULTADO SE DECIDE ACÁ. Lo de abajo es sólo mostrarlo.
    var result = M.spin(MC.rand);
    var mult = freeLeft > 0 ? M.FS_WILD_MULT : 1;
    var evaluated = M.evaluate(result.grid, mult);

    /* ---------------- anticipación ----------------
       Si ya cayeron dos bolsas, el rodillo que falta frena mucho más
       lento y se enciende. El resultado está decidido desde antes: lo
       que se estira es el rato que el jugador pasa sin saberlo. Sin
       esto, que caigan dos bolsas y que caigan tres se ven igual. */
    var base = turbo ? REEL_MS_TURBO : (freeLeft > 0 ? REEL_MS_FREE : REEL_MS);
    var extra = 0;
    var vistos = 0;          // bolsas en los rodillos YA resueltos
    var cuantasAnticiparon = 0;
    var fin = 0;

    for (var reel = 0; reel < M.REELS; reel++) {
      var anticipa = reel >= 2 && vistos >= 2;
      if (anticipa) {
        var suma = cuantasAnticiparon === 0 ? ANTICIPA_1 : ANTICIPA_N;
        if (turbo) suma *= 0.4;
        extra = Math.min(ANTICIPA_TOPE, extra + suma);
        cuantasAnticiparon++;
      }

      var dura = base[reel] + extra;
      var column = [];
      for (var r = 0; r < M.ROWS; r++) {
        column.push(result.grid[r][reel]);
        if (result.grid[r][reel] === M.SCATTER) vistos++;
      }
      animateReel(reel, column, dura);
      if (anticipa) encenderAnticipacion(reel, fin, dura);
      fin = dura;
    }

    setTimeout(function () { resolver(evaluated); }, fin + 120);
  }

  function resolver(ev) {
    spinning = false;
    apagarAnticipacion();   // por si algún rodillo quedó encendido

    var lineaGanada = ev.lineTotal * lineBet();
    var scatterGanado = ev.scatterPay * totalBet();
    /* Con el retorno bajado la tabla deja de ser entera, así que el
       premio se redondea al azar: el jugador cobra fichas enteras y
       el valor esperado queda exacto. Ver MC.rtp.fichas. */
    var ganado = MC.rtp.fichas(lineaGanada + scatterGanado);

    if (ganado > 0) MC.addBalance(ganado);
    roundReturn += ganado;
    if (freeLeft > 0) freeWin += ganado;

    pintarResultado(ev, ganado);

    if (freeLeft > 0) {
      freeLeft--;
      if (ev.freeSpins > 0) {          // retrigger
        freeLeft += ev.freeSpins;
        freeTotal += ev.freeSpins;
        MC.toast('+' + ev.freeSpins + ' giros gratis', 'win');
        MC.sound.win();
      }
      actualizarControles();
      if (freeLeft > 0) {
        nextTimer = setTimeout(spin, ev.wins.length ? 750 : 420);
      } else {
        cerrarFuncion();
      }
      return;
    }

    if (ev.freeSpins > 0) {
      abrirFuncion(ev.freeSpins, ev.scatters);
      return;
    }

    cerrarRonda(ev, ganado);
  }

  /* ---------------- giros gratis ---------------- */
  function abrirFuncion(spins, scatters, comprada) {
    freeLeft = spins;
    freeTotal = spins;
    freeWin = 0;
    // El automático para acá: es el momento que el jugador quiere mirar.
    if (autoLeft > 0) detenerAuto('Automático en pausa: entraste a la función');
    apagarAnticipacion();
    MC.sound.jackpot();
    actualizarControles();

    MC.modal('¡GIROS GRATIS!',
      (comprada
        ? '<p>Compraste la función: <strong style="color:var(--gold)">' + spins +
          ' giros gratis</strong>.</p>'
        : '<p>Cayeron <strong>' + scatters + ' bolsas</strong>: te ganaste ' +
          '<strong style="color:var(--gold)">' + spins + ' giros gratis</strong>.</p>') +
      '<p>Durante la función, cada premio con el tigre paga <strong>x' +
      M.FS_WILD_MULT + '</strong>.</p>',
      [{ label: 'Que giren', kind: 'primary', onClick: function () {
        nextTimer = setTimeout(spin, 350);
      } }]);
  }

  function cerrarFuncion() {
    var ganado = freeWin;
    var giros = freeTotal;
    freeLeft = 0;
    freeTotal = 0;
    freeWin = 0;
    actualizarControles();

    MC.sound.win();
    MC.modal('Función terminada',
      '<p>En ' + giros + ' giros gratis juntaste ' +
      '<strong style="color:var(--gold)">' + MC.fmt(ganado) + ' fichas</strong>.</p>',
      [{ label: 'Seguir', kind: 'primary' }]);

    cerrarRonda(null, roundReturn, giros);
  }

  // Cierre contable de la ronda: una sola vez, con el total.
  function cerrarRonda(ev, ganado, giros) {
    var detalle;
    if (giros) detalle = 'función de ' + giros + ' giros gratis';
    else if (!ev || !ev.wins.length) detalle = 'sin premio';
    else if (ev.wins.length === 1) detalle = ev.wins[0].count + ' ' + M.NAME[ev.wins[0].symbol];
    else detalle = ev.wins.length + ' líneas premiadas';

    MC.recordRound(roundStake, roundReturn, detalle);
    roundReturn = 0;
    roundStake = 0;
    actualizarControles();

    // El automático encadena acá: una ronda es el giro pago más toda su
    // función, así que recién ahora se puede contar como "un giro".
    if (autoLeft > 0) {
      autoLeft--;
      actualizarControles();
      if (autoLeft > 0 && MC.canBet(totalBet())) {
        nextTimer = setTimeout(spin, turbo ? 260 : 700);
      } else {
        detenerAuto(autoLeft > 0 ? 'Sin fichas para seguir' : null);
      }
    }
  }

  /* ---------------- turbo ---------------- */
  function alternarTurbo() {
    turbo = !turbo;
    MC.sound.click();
    actualizarControles();
  }

  /* ---------------- automático ----------------
     Se detiene solo al disparar la función: es el momento en que el
     jugador quiere mirar, y seguir girando encima sería taparlo. */
  function arrancarAuto(n) {
    if (spinning || inFreeMode()) return;
    if (!MC.canBet(totalBet())) { MC.toast('No te alcanzan las fichas.', 'lose'); return; }
    autoLeft = n;
    actualizarControles();
    spin();
  }

  function detenerAuto(motivo) {
    if (autoLeft <= 0 && !motivo) { actualizarControles(); return; }
    autoLeft = 0;
    clearTimeout(nextTimer);
    if (motivo) MC.toast(motivo, 'info');
    actualizarControles();
  }

  function pedirAuto() {
    if (autoLeft > 0) { detenerAuto('Automático detenido'); return; }
    MC.sound.click();
    MC.modal('Giros automáticos',
      '<p>Gira solo la cantidad que elijas. <strong>Se detiene al disparar la función</strong>, ' +
      'para que no te pierdas la entrada, y también si te quedás sin fichas.</p>',
      [10, 25, 50, 100].map(function (n) {
        return { label: String(n), kind: n === 25 ? 'primary' : undefined,
                 onClick: function () { arrancarAuto(n); } };
      }).concat([{ label: 'Cancelar' }]));
  }

  /* ---------------- comprar la función ----------------
     El precio lo calcula la matemática (valor de la función / RTP), no
     está escrito acá ni en el HTML. Ver tools/slots5-rtp.js. */
  function precioCompra() {
    return Math.round(M.buyPrice(M.exactRTP().total));
  }

  function comprar() {
    if (spinning || inFreeMode() || autoLeft > 0) return;
    var veces = precioCompra();
    var costo = veces * totalBet();

    if (!MC.canBet(costo)) {
      MC.toast('Comprar la función cuesta ' + MC.fmt(costo) + ' fichas.', 'lose');
      return;
    }

    var rtpCompra = M.featureValue().value / veces;
    MC.sound.click();
    MC.modal('Comprar la función',
      '<p>Entrás directo a <strong>' + M.FREE_SPINS[3] + ' giros gratis</strong>, con el tigre ' +
      'pagando <strong>x' + M.FS_WILD_MULT + '</strong> y con retriggers.</p>' +
      '<p>Cuesta <strong style="color:var(--gold)">' + MC.fmt(costo) + ' fichas</strong> ' +
      '(' + veces + ' veces tu apuesta).</p>' +
      '<p style="font-size:12.5px">El precio sale de cuánto vale la función, no de un número ' +
      'elegido a ojo: comprando, el retorno es <strong>' + (rtpCompra * 100).toFixed(1).replace('.', ',') +
      '%</strong> contra ' + (M.exactRTP().total * 100).toFixed(1).replace('.', ',') +
      '% del juego base.</p>',
      [
        { label: 'Cancelar' },
        { label: 'Comprar', kind: 'primary', onClick: function () {
          MC.addBalance(-costo);
          roundReturn = 0;
          roundStake = costo;
          abrirFuncion(M.FREE_SPINS[3], 3, true);
        } }
      ]);
  }

  /* ---------------- pintado del resultado ---------------- */
  function pintarResultado(ev, ganado) {
    if (ganado > 0) {
      /* Un giro gratis no costó nada: se le pasa apuesta 0 y el veredicto
         lo trata como ganancia pura, sin necesidad de un caso especial.
         `referencia` es siempre la apuesta total, para que el escalón se
         mida contra lo mismo dentro y fuera de la función. */
      MCPremio.mostrar({
        win: el.win, tier: el.tier,
        apostado: freeLeft > 0 ? 0 : totalBet(),
        devuelto: ganado,
        referencia: totalBet(),
        turbo: turbo
      });
    } else {
      MCPremio.limpiar({ win: el.win, tier: el.tier });
    }

    if (ev.scatters >= 3) {
      el.msg.textContent = ev.scatters + ' bolsas — ¡función!';
    } else if (ev.wins.length) {
      var top = ev.wins.slice().sort(function (a, b) { return b.pay - a.pay; })[0];
      el.msg.textContent = top.count + ' ' + M.NAME[top.symbol] +
        (ev.wins.length > 1 ? ' y ' + (ev.wins.length - 1) + ' línea' + (ev.wins.length > 2 ? 's' : '') + ' más' : '');
    } else {
      el.msg.textContent = freeLeft > 0 ? 'Sin premio en este giro' : 'Sin premio. Probá de nuevo.';
    }

    if (ev.wins.length) encenderGanadoras(ev.wins);
    marcarScatters();
  }

  // Enciende las líneas ganadoras de a una, en bucle.
  function encenderGanadoras(wins) {
    var i = 0;
    function paso() {
      limpiarGanadoras();
      var w = wins[i % wins.length];
      w.rows.forEach(function (row, reel) {
        if (reel >= w.count) return;
        var cell = celdaVisible(reel, row);
        if (cell) cell.classList.add('ganadora');
      });
      el.lineTag.textContent = 'Línea ' + (w.line + 1) + ' · ' +
        w.count + ' ' + M.NAME[w.symbol] + ' · ' + MC.fmt(w.pay * lineBet()) +
        (w.wild && freeLeft > 0 ? ' (x' + M.FS_WILD_MULT + ')' : '');
      el.lineTag.classList.add('visible');
      i++;
      /* Acotado: con varias líneas el ciclo se repetía para siempre, y si la
         función terminaba ahí nadie lo cancelaba nunca. Veinticuatro vueltas
         son unos quince segundos, de sobra para leerlas todas. */
      if ((wins.length > 1 || i < 2) && i < 24) winTimer = setTimeout(paso, WIN_STEP_MS);
    }
    paso();
  }

  function celdaVisible(reel, row) {
    var strip = el.strips[reel];
    // Tras la animación, las tres visibles son las de índice STOP_AT..STOP_AT+2.
    var base = strip.children.length > M.ROWS ? STOP_AT : 0;
    return strip.children[base + row] || null;
  }

  function marcarScatters() {
    for (var reel = 0; reel < M.REELS; reel++) {
      for (var row = 0; row < M.ROWS; row++) {
        var c = celdaVisible(reel, row);
        if (c && c.dataset.sym === M.SCATTER) c.classList.add('ganadora');
      }
    }
  }

  function limpiarGanadoras() {
    el.board.querySelectorAll('.ganadora').forEach(function (c) { c.classList.remove('ganadora'); });
    el.lineTag.classList.remove('visible');
  }

  /* ---------------- controles ---------------- */
  function actualizarControles() {
    var libre = !spinning && freeLeft === 0;
    var quieto = libre && autoLeft === 0;   // sin girar Y sin automático

    el.lineBet.textContent = MC.fmt(lineBet());
    el.totalBet.textContent = MC.fmt(totalBet());
    el.betUp.disabled = !quieto || betIndex === LINE_BETS.length - 1;
    el.betDown.disabled = !quieto || betIndex === 0;
    el.spin.disabled = !libre || autoLeft > 0;
    el.spin.textContent = freeLeft > 0 ? 'GIRANDO GRATIS' : 'GIRAR';

    el.turbo.classList.toggle('activo', turbo);
    el.auto.classList.toggle('activo', autoLeft > 0);
    el.auto.textContent = autoLeft > 0 ? 'Detener' : 'Automático';
    el.autoBar.classList.toggle('visible', autoLeft > 0);
    el.autoLeftLbl.textContent = autoLeft;

    // La compra muestra su precio real, con la apuesta puesta.
    el.buy.disabled = !quieto;
    el.buy.textContent = 'Comprar función · ' + MC.fmt(precioCompra() * totalBet());

    el.freeBox.classList.toggle('visible', freeLeft > 0);
    if (freeLeft > 0) {
      el.freeCount.textContent = freeLeft;
      el.freeSum.textContent = MC.fmt(freeWin);
    }
  }

  /* ---------------- tabla de pagos ---------------- */
  function pintarTabla() {
    var orden = ['W', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
    el.paytable.innerHTML = orden.map(function (id) {
      /* Los pagos salen de M.payLine y no de M.PAYS: así la tabla que
         se ve en pantalla es literalmente la que cobra el jugador,
         con el factor de la casa ya puesto. */
      var p = [0, 0, 0].concat([3, 4, 5].map(function (n) {
        return Math.round(M.payLine(id, n) * 100) / 100;
      }));
      return '<div class="g5-pt">' +
               '<span class="g5-pt-sym">' + MCStudioSymbols.render(M.FACE[id]) + '</span>' +
               '<span class="g5-pt-name">' + M.NAME[id] + '</span>' +
               '<span class="g5-pt-vals"><b>3</b>' + p[3] + ' <b>4</b>' + p[4] + ' <b>5</b>' + p[5] + '</span>' +
             '</div>';
    }).join('') +
    '<div class="g5-pt especial">' +
      '<span class="g5-pt-sym">' + MCStudioSymbols.render(M.FACE[M.SCATTER]) + '</span>' +
      '<span class="g5-pt-name">' + M.NAME[M.SCATTER] + '</span>' +
      '<span class="g5-pt-vals">3+ en cualquier lado → giros gratis</span>' +
    '</div>';
  }

  /* ---------------- ciclo de vida ---------------- */
  function load() {
    // Se entra limpio: sin conteo a medias, sin rótulo colgado, sin
    // automático heredado de la vez anterior y sin rodillo encendido.
    clearTimeout(nextTimer);
    clearTimeout(winTimer);
    /* Se limpia TODO el estado de ronda, no sólo el automático. Faltaba
       esto: si quedaba una función a medias, al volver a entrar el juego
       arrancaba con freeLeft > 0 — botón trabado en "GIRANDO GRATIS",
       barra de giros gratis encendida y ninguna apuesta cobrada. */
    autoLeft = 0;
    freeLeft = 0;
    freeTotal = 0;
    freeWin = 0;
    roundReturn = 0;
    roundStake = 0;
    spinning = false;
    apagarAnticipacion();
    limpiarGanadoras();
    seedReels();
    MCPremio.limpiar({ win: el.win, tier: el.tier });
    el.msg.textContent = 'Apostá y girá. 20 líneas, siempre activas.';
    pintarTabla();
    actualizarControles();
  }

  function init() {
    el.board = document.getElementById('g5Board');
    el.strips = Array.prototype.slice.call(document.querySelectorAll('.g5-strip'));
    el.spin = document.getElementById('g5Spin');
    el.lineBet = document.getElementById('g5LineBet');
    el.totalBet = document.getElementById('g5TotalBet');
    el.betUp = document.getElementById('g5BetUp');
    el.betDown = document.getElementById('g5BetDown');
    el.win = document.getElementById('g5Win');
    el.msg = document.getElementById('g5Msg');
    el.lineTag = document.getElementById('g5LineTag');
    el.paytable = document.getElementById('g5Paytable');
    el.freeBox = document.getElementById('g5Free');
    el.freeCount = document.getElementById('g5FreeCount');
    el.freeSum = document.getElementById('g5FreeSum');
    el.tier = document.getElementById('g5Tier');
    el.turbo = document.getElementById('g5Turbo');
    el.auto = document.getElementById('g5Auto');
    el.buy = document.getElementById('g5Buy');
    el.autoBar = document.getElementById('g5AutoBar');
    el.autoLeftLbl = document.getElementById('g5AutoLeft');
    el.autoStop = document.getElementById('g5AutoStop');

    /* El módulo de matemática lee el factor de la casa por acá. Se
       engancha un lector y no un valor para que cambiarlo en el panel
       se note en el giro siguiente, sin avisarle a nadie. */
    M.setFactor(function () { return MC.rtp.factor('slots5'); });

    el.turbo.onclick = alternarTurbo;
    el.auto.onclick = pedirAuto;
    el.buy.onclick = comprar;
    el.autoStop.onclick = function () { detenerAuto('Automático detenido'); };

    el.spin.onclick = spin;
    el.betUp.onclick = function () {
      if (betIndex < LINE_BETS.length - 1) { betIndex++; MC.sound.click(); actualizarControles(); }
    };
    el.betDown.onclick = function () {
      if (betIndex > 0) { betIndex--; MC.sound.click(); actualizarControles(); }
    };

    document.addEventListener('keydown', function (e) {
      if (MC.getCurrentView() !== 'slots5') return;
      if (e.code === 'Space') { e.preventDefault(); spin(); }
    });

    // No se sale con los rodillos girando ni con la función abierta.
    MC.guard('slots5', function () { return spinning || inFreeMode(); });
    MC.registerEngine('slots5', { load: load });
  }

  return { init: init };
})();
