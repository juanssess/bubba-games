/* ============================================================
   BUBBA GAMES — Ruleta europea (un solo cero)
   Pleno 35:1 · Docena y columna 2:1 · Chances simples 1:1
   ============================================================ */
(function () {
  'use strict';

  // Orden real de la rueda europea, arrancando en el 0 y en sentido horario.
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
               10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var SECTOR = 360 / WHEEL.length;

  var CHIPS = [5, 25, 100, 500, 1000];
  var chipValue = 25;

  /* Tipos de apuesta interna. El pago NO se escribe acá: se deriva de
     cuántos números cubre cada una. La etiqueta se calcula al pintar. */
  var MODES = [
    { id: 'straight', nombre: 'Pleno',  ayuda: 'un número' },
    { id: 'split',    nombre: 'Split',  ayuda: 'con el de al lado' },
    { id: 'street',   nombre: 'Calle',  ayuda: 'la fila de 3' },
    { id: 'corner',   nombre: 'Cuadro', ayuda: 'las 4 de la esquina' },
    { id: 'line',     nombre: 'Línea',  ayuda: 'dos calles, 6 números' }
  ];
  var modo = 'straight';

  var bets = [];        // [{ cellId, chipCell, type, value, amount }]
  var lastBets = [];    // la ronda anterior, para el botón Repetir
  var spinning = false;
  var wheelAngle = 0;   // acumulado, para que siempre gire hacia adelante

  var el = {};

  function colorOf(n) {
    if (n === 0) return 'green';
    return REDS.indexOf(n) >= 0 ? 'red' : 'black';
  }

  /* ---------------- construcción de la mesa ---------------- */
  function cell(id, label, className, style) {
    var d = document.createElement('div');
    d.className = 'bet-cell ' + (className || '');
    d.dataset.cell = id;
    d.textContent = label;
    if (style) Object.assign(d.style, style);
    d.addEventListener('click', function () { placeBet(id); });
    // Al pasar por encima se encienden los números que agarraría la
    // apuesta: "Cuadro" deja de ser una palabra y se ve cuál es.
    d.addEventListener('mouseenter', function () {
      if (!spinning) marcarCubiertos(cubre(apuestaDe(id)), false);
    });
    d.addEventListener('mouseleave', limpiarPreview);
    return d;
  }

  function buildTable() {
    var t = el.table;
    t.innerHTML = '';

    t.appendChild(cell('n-0', '0', 'green', { gridColumn: '1', gridRow: '1 / 4' }));

    for (var n = 1; n <= 36; n++) {
      var col = Math.ceil(n / 3) + 1;
      var row = 3 - ((n - 1) % 3);
      t.appendChild(cell('n-' + n, String(n), colorOf(n), { gridColumn: String(col), gridRow: String(row) }));
    }

    // Columnas 2:1 (a la derecha). La fila 1 corresponde a la columna 3, y así.
    [3, 2, 1].forEach(function (c, i) {
      t.appendChild(cell('col-' + c, '2:1', 'outside', { gridColumn: '14', gridRow: String(i + 1) }));
    });

    // Docenas
    [['1ª DOCENA', 1, '2 / 6'], ['2ª DOCENA', 2, '6 / 10'], ['3ª DOCENA', 3, '10 / 14']]
      .forEach(function (d) {
        t.appendChild(cell('dozen-' + d[1], d[0], 'outside', { gridColumn: d[2], gridRow: '4' }));
      });

    // Chances simples
    [['1-18', 'low', '2 / 4'], ['PAR', 'even', '4 / 6'], ['ROJO', 'red', '6 / 8'],
     ['NEGRO', 'black', '8 / 10'], ['IMPAR', 'odd', '10 / 12'], ['19-36', 'high', '12 / 14']]
      .forEach(function (o) {
        var extra = o[1] === 'red' ? 'red' : (o[1] === 'black' ? 'black' : 'outside');
        t.appendChild(cell(o[1], o[0], extra, { gridColumn: o[2], gridRow: '5' }));
      });
  }

  function buildChipRack() {
    el.rack.innerHTML = '';
    CHIPS.forEach(function (v) {
      var c = document.createElement('div');
      c.className = 'chip chip-' + v + (v === chipValue ? ' active' : '');
      c.textContent = v >= 1000 ? (v / 1000) + 'K' : v;
      c.onclick = function () {
        chipValue = v;
        MC.sound.chip();
        buildChipRack();
      };
      el.rack.appendChild(c);
    });
  }

  function buildWheel() {
    var stops = [];
    WHEEL.forEach(function (n, i) {
      var c = colorOf(n);
      var fill = c === 'red' ? '#d93b45' : (c === 'green' ? '#1f7a4d' : '#15151f');
      stops.push(fill + ' ' + (i * SECTOR).toFixed(3) + 'deg ' + ((i + 1) * SECTOR).toFixed(3) + 'deg');
    });
    el.wheel.style.background = 'conic-gradient(' + stops.join(',') + ')';

    WHEEL.forEach(function (n, i) {
      var lab = document.createElement('div');
      lab.className = 'wheel-num';
      lab.textContent = n;
      lab.style.transform = 'rotate(' + (i * SECTOR + SECTOR / 2) + 'deg)';
      el.wheel.appendChild(lab);
    });
  }

  /* ---------------- apuestas ---------------- */
  function parseCell(id) {
    if (id.indexOf('n-') === 0) return { type: 'straight', value: parseInt(id.slice(2), 10) };
    if (id.indexOf('dozen-') === 0) return { type: 'dozen', value: parseInt(id.slice(6), 10) };
    if (id.indexOf('col-') === 0) return { type: 'column', value: parseInt(id.slice(4), 10) };
    return { type: id, value: null };
  }

  /* Traduce un click en una apuesta concreta. En una celda de número, el
     tipo lo pone el modo elegido; el cero sólo admite pleno, porque no
     pertenece a ninguna calle. */
  function apuestaDe(cellId) {
    var info = parseCell(cellId);
    if (info.type !== 'straight') return info;          // docena, columna, chances
    if (info.value === 0) return info;                  // el cero, siempre pleno
    return { type: modo, value: info.value };
  }

  function placeBet(cellId) {
    if (spinning) return;
    if (!MC.canBet(chipValue)) {
      MC.toast('Saldo insuficiente para esa ficha.', 'lose');
      return;
    }
    var info = apuestaDe(cellId);
    var nums = cubre(info);

    MC.addBalance(-chipValue);
    bets.push({
      // La clave incluye el tipo: un pleno y un cuadro anclados en el
      // mismo número son apuestas distintas y no se deben sumar.
      cellId: info.type + ':' + info.value,
      chipCell: cellId,
      type: info.type, value: info.value, amount: chipValue
    });
    MC.sound.chip();
    renderBets();
    marcarCubiertos(nums, true);
  }

  function undoBet() {
    if (spinning || !bets.length) return;
    var last = bets.pop();
    MC.addBalance(last.amount);
    MC.sound.click();
    renderBets();
  }

  function clearBets() {
    if (spinning || !bets.length) return;
    MC.addBalance(totalStaked());
    bets = [];
    MC.sound.click();
    renderBets();
  }

  function totalStaked() {
    return bets.reduce(function (s, b) { return s + b.amount; }, 0);
  }

  /* ---------------- selector de tipo de apuesta ---------------- */
  function buildModes() {
    el.modes.innerHTML = MODES.map(function (m) {
      // El pago sale del modelo, no de una tabla escrita a mano.
      var paga = pagoVisible({ type: m.id, value: 7 });
      return '<button class="bet-mode' + (m.id === modo ? ' active' : '') + '" data-modo="' + m.id + '">' +
               '<b>' + m.nombre + '</b>' +
               '<span>' + paga + ':1 · ' + m.ayuda + '</span>' +
             '</button>';
    }).join('');

    el.modes.onclick = function (e) {
      var b = e.target.closest('.bet-mode');
      if (!b || spinning) return;
      modo = b.dataset.modo;
      MC.sound.click();
      buildModes();
    };
  }

  /* ---------------- vista previa de lo que se cubre ----------------
     Sin esto, "Cuadro" es una palabra: no se sabe qué cuatro números
     agarra hasta después de apostar. Al pasar el mouse se encienden. */
  function marcarCubiertos(nums, flash) {
    limpiarPreview();
    nums.forEach(function (n) {
      var c = el.table.querySelector('[data-cell="n-' + n + '"]');
      if (c) c.classList.add(flash ? 'recien-apostado' : 'cubierto');
    });
    if (flash) {
      setTimeout(function () {
        el.table.querySelectorAll('.recien-apostado').forEach(function (c) {
          c.classList.remove('recien-apostado');
        });
      }, 420);
    }
  }

  function limpiarPreview() {
    el.table.querySelectorAll('.cubierto').forEach(function (c) { c.classList.remove('cubierto'); });
  }

  /* ---------------- repetir la ronda anterior ----------------
     Volver a armar seis apuestas ficha por ficha después de cada giro
     es el mayor fastidio de una ruleta. */
  function repetirApuestas() {
    if (spinning || !lastBets.length) return;
    var costo = lastBets.reduce(function (s, b) { return s + b.amount; }, 0);
    if (!MC.canBet(costo)) { MC.toast('No te alcanza para repetir esa ronda.', 'lose'); return; }

    MC.addBalance(-costo);
    bets = lastBets.map(function (b) {
      return { cellId: b.cellId, chipCell: b.chipCell, type: b.type, value: b.value, amount: b.amount };
    });
    MC.sound.chip();
    renderBets();
  }

  function renderBets() {
    el.table.querySelectorAll('.cell-chip').forEach(function (c) { c.remove(); });
    // Se agrupa por apuesta (tipo + ancla) pero la ficha se dibuja en la
    // celda que se tocó: un cuadro se ve sobre su número de referencia.
    var byCell = {};
    var donde = {};
    bets.forEach(function (b) {
      byCell[b.cellId] = (byCell[b.cellId] || 0) + b.amount;
      donde[b.cellId] = b.chipCell || b.cellId;
    });
    Object.keys(byCell).forEach(function (id) {
      var target = el.table.querySelector('[data-cell="' + donde[id] + '"]');
      if (!target) return;
      var chip = document.createElement('span');
      chip.className = 'cell-chip';
      var v = byCell[id];
      chip.textContent = v >= 1000 ? (Math.round(v / 100) / 10) + 'K' : v;
      target.appendChild(chip);
    });
    el.staked.textContent = MC.fmt(totalStaked());
    el.spin.disabled = spinning || bets.length === 0;
  }

  /* ---------------- resolución ---------------- */
  // Devuelve el multiplicador de PAGO (sin contar la ficha apostada).
  /* ============================================================
     TODA APUESTA ES UN CONJUNTO DE NÚMEROS

     Antes había un `switch` con un pago escrito a mano por tipo, y
     por eso sumar split, calle, cuadro y línea significaba sumar
     cuatro casos más con cuatro números más para equivocarse.

     No hace falta. En la ruleta europea toda apuesta cubre `n` de los
     37 números y paga exactamente:

         pago = 36/n − 1

     Pleno: 36/1−1 = 35. Split: 36/2−1 = 17. Calle: 11. Cuadro: 8.
     Línea: 5. Docena y columna: 36/12−1 = 2. Chances simples: 1.

     De ahí sale que el margen sea el MISMO para todas:
         RTP = (n/37) · (36/n) = 36/37 = 97,297%
     El tamaño del conjunto se cancela. Por eso no hay ninguna apuesta
     "mejor" que otra en esta mesa, y por eso el pago no se escribe:
     se deriva. Un pago mal tipeado es un error imposible acá.
     ============================================================ */

  // Índice de calle (0..11) y posición dentro de ella (0 abajo, 2 arriba).
  function calleDe(n) { return Math.floor((n - 1) / 3); }
  function filaDe(n) { return (n - 1) % 3; }
  function rango(desde, cuantos) {
    var out = [];
    for (var i = 0; i < cuantos; i++) out.push(desde + i);
    return out;
  }

  /* Los números que cubre una apuesta. Para las apuestas internas, el
     ancla se corre hacia adentro del paño si el grupo no entra: tocar
     el 36 pidiendo un cuadro te da el cuadro que contiene al 36. */
  function cubre(bet) {
    var v = bet.value;
    var c, f;

    switch (bet.type) {
      case 'straight': return [v];

      case 'split':                       // 2 números, horizontal
        c = Math.min(calleDe(v), 10); f = filaDe(v);
        return [c * 3 + f + 1, c * 3 + f + 4];

      case 'street':                      // 3 números: la calle entera
        return rango(calleDe(v) * 3 + 1, 3);

      case 'corner':                      // 4 números
        c = Math.min(calleDe(v), 10); f = Math.min(filaDe(v), 1);
        var a = c * 3 + f + 1;
        return [a, a + 1, a + 3, a + 4];

      case 'line':                        // 6 números: dos calles
        return rango(Math.min(calleDe(v), 10) * 3 + 1, 6);

      case 'dozen':  return rango((v - 1) * 12 + 1, 12);
      case 'column': return [1,2,3,4,5,6,7,8,9,10,11,12].map(function (k) { return (k - 1) * 3 + v; });

      case 'red':   return REDS.slice();
      case 'black': return rango(1, 36).filter(function (k) { return REDS.indexOf(k) < 0; });
      case 'even':  return rango(1, 36).filter(function (k) { return k % 2 === 0; });
      case 'odd':   return rango(1, 36).filter(function (k) { return k % 2 === 1; });
      case 'low':   return rango(1, 18);
      case 'high':  return rango(19, 18);
      default:      return [];
    }
  }

  /* El pago se DERIVA del tamaño del conjunto. No se escribe en ningún
     lado — y por eso el panel de la casa tiene UN solo lugar donde
     entrar. El factor multiplica el 36 (lo que se devuelve en total),
     no el 35 (la ganancia): con k, una apuesta de monto m sobre n
     números devuelve m·k·36/n, así que

         RTP = (n/37) · k·36/n = k · 36/37

     se mantiene igual para las trece apuestas de la mesa. Ninguna
     queda mejor que otra después de bajar el retorno, que es la
     propiedad que hace honesta a esta ruleta. */
  function pagoDe(bet) {
    var n = cubre(bet).length;
    return n ? MC.rtp.factor('roulette') * 36 / n - 1 : 0;
  }

  // Para los carteles: el pago redondeado a dos decimales.
  function pagoVisible(bet) {
    return Math.round(pagoDe(bet) * 100) / 100;
  }

  function payoutFor(bet, n) {
    return cubre(bet).indexOf(n) >= 0 ? pagoDe(bet) : 0;
  }

  function spin() {
    if (spinning || !bets.length) return;
    spinning = true;
    el.spin.disabled = true;
    el.undo.disabled = true;
    el.clear.disabled = true;
    el.table.querySelectorAll('.win-flash').forEach(function (c) { c.classList.remove('win-flash'); });
    MC.sound.spin();

    var index = MC.randInt(0, WHEEL.length);
    var number = WHEEL[index];

    // El puntero está arriba: llevamos el centro del sector hasta los 0°.
    var target = -(index * SECTOR + SECTOR / 2);
    var turns = 6 + MC.randInt(0, 3);
    wheelAngle = wheelAngle + turns * 360 + (((target - wheelAngle) % 360) + 360) % 360;
    el.wheel.style.transform = 'rotate(' + wheelAngle + 'deg)';
    el.result.textContent = '';

    setTimeout(function () { settle(number); }, 5400);
  }

  function settle(n) {
    var staked = totalStaked();
    var returned = 0;
    var winningCells = {};

    bets.forEach(function (b) {
      var mult = payoutFor(b, n);
      if (mult > 0) {
        returned += b.amount * (mult + 1); // premio + devolución de la ficha
        winningCells[b.cellId] = true;
      }
    });

    /* Con el retorno bajado los pagos dejan de ser enteros, así que se
       redondea UNA vez sobre el total y no por apuesta: menos ruido, y
       el redondeo al azar mantiene el valor esperado exacto. */
    returned = MC.rtp.fichas(returned);

    el.result.textContent = n;
    el.result.style.color = colorOf(n) === 'black' ? '#f2f1ef' : (colorOf(n) === 'red' ? '#ff6b74' : '#4bbf7a');
    pushHistory(n);

    Object.keys(winningCells).forEach(function (id) {
      var c = el.table.querySelector('[data-cell="' + id + '"]');
      if (c) c.classList.add('win-flash');
    });

    var v = MC.veredicto(staked, returned);

    if (returned > 0) {
      MC.addBalance(returned);
      /* Cubrir rojo y un pleno y que salga rojo devuelve fichas pero deja
         al jugador abajo. El texto ya lo decía; el color no: salía verde
         de victoria igual. Ahora el tono lo pone el veredicto. */
      if (v.gano) MC.sound.win(); else MC.sound.click();
      MC.toast('Salió el ' + n + '. ' + v.texto, v.tono);
    } else {
      MC.sound.lose();
      MC.toast('Salió el ' + n + '. Se la lleva la casa.', 'lose');
    }

    MC.recordRound(staked, returned, 'salió el ' + n + ' (' +
      (colorOf(n) === 'red' ? 'rojo' : colorOf(n) === 'black' ? 'negro' : 'cero') + ')');

    // Se guarda la ronda ANTES de vaciarla, para el botón Repetir.
    lastBets = bets.slice();
    bets = [];
    spinning = false;
    el.undo.disabled = false;
    el.clear.disabled = false;
    renderBets();
  }

  function pushHistory(n) {
    MC.state.rouletteHistory.unshift(n);
    MC.state.rouletteHistory = MC.state.rouletteHistory.slice(0, 12);
    MC.save();
    renderHistory();
  }

  function renderHistory() {
    el.history.innerHTML = MC.state.rouletteHistory.map(function (n) {
      return '<span class="hs-num ' + colorOf(n) + '">' + n + '</span>';
    }).join('');
  }

  /* ---------------- init ---------------- */
  function init() {
    el.table = document.getElementById('rouletteTable');
    el.rack = document.getElementById('chipRack');
    el.wheel = document.getElementById('wheel');
    el.result = document.getElementById('wheelResult');
    el.history = document.getElementById('rouletteHistory');
    el.staked = document.getElementById('rouletteStaked');
    el.spin = document.getElementById('rouletteSpin');
    el.undo = document.getElementById('rouletteUndo');
    el.clear = document.getElementById('rouletteClear');
    el.repeat = document.getElementById('rouletteRepeat');
    el.modes = document.getElementById('rouletteModes');

    buildModes();
    /* Y de nuevo cada vez que se entra a la mesa: los pagos de estos
       botones salen de pagoDe(), así que si alguien bajó el retorno
       desde el panel mientras tanto, construidos una sola vez al
       arrancar se quedarían anunciando el 35:1 de fábrica. */
    MC.onEnter('roulette', buildModes);

    buildTable();
    buildChipRack();
    buildWheel();
    renderHistory();
    renderBets();

    el.spin.onclick = spin;
    el.undo.onclick = undoBet;
    el.clear.onclick = clearBets;
    el.repeat.onclick = repetirApuestas;
  }

  /* cubre y pagoDe salen expuestos para poder verificar la matemática
     contra ESTA implementación y no contra una copia. Ver
     tools/ruleta-margen.js: si el pago y los números cubiertos se
     midieran sobre otro archivo, se estaría validando otra ruleta. */
  window.MCRoulette = { init: init, cubre: cubre, pagoDe: pagoDe, colorOf: colorOf };
})();
