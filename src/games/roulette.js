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

  var bets = [];        // [{ cellId, type, value, amount }]
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

  function placeBet(cellId) {
    if (spinning) return;
    if (!MC.canBet(chipValue)) {
      MC.toast('Saldo insuficiente para esa ficha.', 'lose');
      return;
    }
    var info = parseCell(cellId);
    MC.addBalance(-chipValue);
    bets.push({ cellId: cellId, type: info.type, value: info.value, amount: chipValue });
    MC.sound.chip();
    renderBets();
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

  function renderBets() {
    el.table.querySelectorAll('.cell-chip').forEach(function (c) { c.remove(); });
    var byCell = {};
    bets.forEach(function (b) { byCell[b.cellId] = (byCell[b.cellId] || 0) + b.amount; });
    Object.keys(byCell).forEach(function (id) {
      var target = el.table.querySelector('[data-cell="' + id + '"]');
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
  function payoutFor(bet, n) {
    switch (bet.type) {
      case 'straight': return bet.value === n ? 35 : 0;
      case 'dozen':
        if (n === 0) return 0;
        return Math.ceil(n / 12) === bet.value ? 2 : 0;
      case 'column':
        if (n === 0) return 0;
        return ((n - 1) % 3) + 1 === bet.value ? 2 : 0;
      case 'red':   return colorOf(n) === 'red' ? 1 : 0;
      case 'black': return colorOf(n) === 'black' ? 1 : 0;
      case 'even':  return n !== 0 && n % 2 === 0 ? 1 : 0;
      case 'odd':   return n !== 0 && n % 2 === 1 ? 1 : 0;
      case 'low':   return n >= 1 && n <= 18 ? 1 : 0;
      case 'high':  return n >= 19 && n <= 36 ? 1 : 0;
      default: return 0;
    }
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

    el.result.textContent = n;
    el.result.style.color = colorOf(n) === 'black' ? '#f2f1ef' : (colorOf(n) === 'red' ? '#ff6b74' : '#4bbf7a');
    pushHistory(n);

    Object.keys(winningCells).forEach(function (id) {
      var c = el.table.querySelector('[data-cell="' + id + '"]');
      if (c) c.classList.add('win-flash');
    });

    if (returned > 0) {
      MC.addBalance(returned);
      MC.sound.win();
      var net = returned - staked;
      MC.toast('Salió el ' + n + '. ' + (net >= 0 ? 'Ganás ' : 'Recuperás ') + MC.fmt(returned) + ' fichas', 'win');
    } else {
      MC.sound.lose();
      MC.toast('Salió el ' + n + '. Se la lleva la casa.', 'lose');
    }

    MC.recordRound(staked, returned, 'salió el ' + n + ' (' +
      (colorOf(n) === 'red' ? 'rojo' : colorOf(n) === 'black' ? 'negro' : 'cero') + ')');

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

    buildTable();
    buildChipRack();
    buildWheel();
    renderHistory();
    renderBets();

    el.spin.onclick = spin;
    el.undo.onclick = undoBet;
    el.clear.onclick = clearBets;
  }

  window.MCRoulette = { init: init };
})();
