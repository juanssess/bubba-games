/* ============================================================
   PLANTILLA DE MOTOR — "Doble o Nada"

   Este archivo existe para copiarse. Es un juego completo y
   funcionando (tirás la ficha, elegís color, cobrás o perdés) escrito
   con lo mínimo indispensable, para que se vea el contrato entero
   sin ruido alrededor.

   ---------------------------------------------------------------
   EL CONTRATO: cuatro cosas y listo
   ---------------------------------------------------------------
   1. HTML     una <section class="view" id="view-TUJUEGO"> dentro
               del escenario, en index.html.
   2. Registro MC.registerEngine('TUJUEGO', { load: load })
   3. Plata    MC.canBet() antes, MC.addBalance() para mover fichas,
               MC.recordRound() SIEMPRE al cerrar la ronda.
   4. Catálogo una entrada en src/catalog/catalog.js con el
               engine: 'TUJUEGO'.

   Con ese único MC.recordRound() te enganchás gratis al historial
   del lobby, las estadísticas, la XP, el rango VIP y las misiones
   diarias. No hay que avisarle a nadie más.

   ---------------------------------------------------------------
   PARA CONVERTIRLO EN TU JUEGO
   ---------------------------------------------------------------
   - Cambiá 'plantilla' por el id de tu juego (acá, en el HTML y en
     el catálogo).
   - Reemplazá resolver() por tu lógica.
   - Todo lo demás (apuesta, saldo, sonido, guardado) ya funciona.

   Matemática de este ejemplo: 50% de acertar, paga 1.95x.
   RTP = 0.5 × 1.95 = 97,5%.
   ============================================================ */
window.MCPlantilla = (function () {
  'use strict';

  var BETS = [10, 25, 50, 100, 250, 500, 1000];
  var PAGO = 1.95;              // cuánto multiplica la apuesta al acertar
  var DURACION_TIRADA = 1200;   // ms que dura la animación

  var betIndex = 3;
  var tirando = false;          // bloquea todo mientras la ficha gira
  var el = {};

  function apuesta() { return BETS[betIndex]; }

  /* ============================================================
     ACÁ VA TU LÓGICA
     Devuelve el resultado de una ronda. Es lo único que cambia
     de un juego a otro.
     ============================================================ */
  function resolver(eleccion) {
    // MC.rand() es la fuente de azar de la casa (usa crypto cuando puede).
    var salio = MC.rand() < 0.5 ? 'red' : 'black';
    var acerto = salio === eleccion;
    return {
      salio: salio,
      acerto: acerto,
      pago: acerto ? Math.floor(apuesta() * PAGO) : 0
    };
  }

  /* ---------------- una ronda de punta a punta ---------------- */
  function jugar(eleccion) {
    if (tirando) return;

    var monto = apuesta();

    // 1. ¿Le alcanza? Siempre preguntarle a la billetera, nunca a MC.state.
    if (!MC.canBet(monto)) {
      MC.toast('No te alcanzan las fichas. Pedí el bono.', 'lose');
      return;
    }

    // 2. Se cobra la apuesta al empezar.
    MC.addBalance(-monto);
    tirando = true;
    actualizarControles();

    var r = resolver(eleccion);

    // 3. Animación. El resultado ya está decidido: lo que gira es la
    //    presentación, nunca el azar.
    el.chip.className = 'pl-chip girando';
    el.face.textContent = '';
    el.msg.textContent = 'Girando...';
    MC.sound.spin();

    setTimeout(function () { cerrar(eleccion, r, monto); }, DURACION_TIRADA);
  }

  function cerrar(eleccion, r, monto) {
    tirando = false;

    el.chip.className = 'pl-chip ' + r.salio;
    el.face.textContent = r.salio === 'red' ? '◆' : '♠';

    // 4. Se paga el premio (si hubo).
    if (r.pago > 0) {
      MC.addBalance(r.pago);
      MC.sound.win();
      el.msg.className = 'pl-msg gano';
      el.msg.textContent = 'Salió ' + nombre(r.salio) + ' · +' + MC.fmt(r.pago - monto) + ' fichas';
    } else {
      MC.sound.lose();
      el.msg.className = 'pl-msg perdio';
      el.msg.textContent = 'Salió ' + nombre(r.salio) + ' · perdiste ' + MC.fmt(monto);
    }

    // 5. Cierre de ronda. ESTO ES LO QUE NO PUEDE FALTAR:
    //    (lo apostado, lo devuelto, un texto corto de qué pasó)
    MC.recordRound(monto, r.pago, 'elegiste ' + nombre(eleccion) + ', salió ' + nombre(r.salio));

    guardarEnHistorial(r.salio);
    actualizarControles();
  }

  function nombre(color) { return color === 'red' ? 'rojo' : 'negro'; }

  /* ---------------- historial de la mesa ---------------- */
  // Se guarda en MC.state para que sobreviva a un F5, y se recorta:
  // el estado no es un basurero, sólo lo que se muestra.
  function guardarEnHistorial(color) {
    if (!MC.state.plantillaHistory) MC.state.plantillaHistory = [];
    MC.state.plantillaHistory.unshift(color);
    MC.state.plantillaHistory = MC.state.plantillaHistory.slice(0, 12);
    MC.save();
    pintarHistorial();
  }

  function pintarHistorial() {
    var h = MC.state.plantillaHistory || [];
    el.history.innerHTML = h.map(function (c) {
      return '<span class="pl-dot ' + c + '"></span>';
    }).join('');
  }

  /* ---------------- controles ---------------- */
  function actualizarControles() {
    el.bet.textContent = MC.fmt(apuesta());
    el.betUp.disabled = tirando || betIndex === BETS.length - 1;
    el.betDown.disabled = tirando || betIndex === 0;
    el.red.disabled = tirando;
    el.black.disabled = tirando;
  }

  /* ---------------- ciclo de vida ---------------- */
  // load() lo llama el router cada vez que se abre el juego.
  // Recibe la entrada del catálogo por si querés leer su config.
  function load(meta) {
    el.chip.className = 'pl-chip';
    el.face.textContent = '?';
    el.msg.className = 'pl-msg';
    el.msg.textContent = 'Elegí un color y tirá la ficha';
    pintarHistorial();
    actualizarControles();
  }

  // init() se llama una sola vez al arrancar la página.
  function init() {
    el.chip = document.getElementById('plChip');
    el.face = document.getElementById('plFace');
    el.msg = document.getElementById('plMsg');
    el.history = document.getElementById('plHistory');
    el.bet = document.getElementById('plBet');
    el.betUp = document.getElementById('plBetUp');
    el.betDown = document.getElementById('plBetDown');
    el.red = document.getElementById('plRed');
    el.black = document.getElementById('plBlack');

    el.betUp.onclick = function () {
      if (betIndex < BETS.length - 1) { betIndex++; MC.sound.click(); actualizarControles(); }
    };
    el.betDown.onclick = function () {
      if (betIndex > 0) { betIndex--; MC.sound.click(); actualizarControles(); }
    };
    el.red.onclick = function () { jugar('red'); };
    el.black.onclick = function () { jugar('black'); };

    // Impide salirse del juego con la ficha en el aire.
    MC.guard('plantilla', function () { return tirando; });

    // El registro: a partir de acá el router sabe abrir este juego.
    MC.registerEngine('plantilla', { load: load });
  }

  return { init: init };
})();
