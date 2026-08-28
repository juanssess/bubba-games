/* ============================================================
   BUBBA GAMES — Mines
   Tablero de 5x5. Cada gema sube el multiplicador; una mina y perdés.
   Multiplicador = 0.97 · C(25,k) / C(25-minas,k)   (3% para la casa)
   ============================================================ */
(function () {
  'use strict';

  var SIZE = 25;
  var EDGE = 0.97;
  var QUICK = [50, 100, 250, 500, 1000];

  var mines = 3;
  var bet = 0;
  var mineSet = {};
  var revealed = 0;
  var playing = false;
  var el = {};

  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }

  function multiplierAt(k) {
    if (k <= 0) return 1;
    return EDGE * comb(SIZE, k) / comb(SIZE - mines, k);
  }

  /* ---------------- tablero ---------------- */
  function buildBoard() {
    el.board.innerHTML = '';
    for (var i = 0; i < SIZE; i++) {
      var t = document.createElement('div');
      t.className = 'tile idle';
      t.dataset.i = i;
      t.onclick = onTileClick;
      el.board.appendChild(t);
    }
  }

  function tiles() {
    return Array.prototype.slice.call(el.board.children);
  }

  function onTileClick(e) {
    if (!playing) return;
    var t = e.currentTarget;
    if (t.classList.contains('done')) return;

    var i = parseInt(t.dataset.i, 10);
    if (mineSet[i]) {
      t.classList.add('mine', 'done');
      t.textContent = '💣';
      lose();
      return;
    }

    revealed++;
    t.classList.add('gem', 'done');
    t.textContent = '💎';
    MC.sound.gem(revealed);
    updateInfo();

    if (revealed === SIZE - mines) {
      MC.toast('¡Limpiaste el tablero!', 'win');
      cashout(true);
    }
  }

  /* ---------------- ronda ---------------- */
  function start() {
    var amount = Math.floor(parseFloat(el.bet.value) || 0);
    if (amount < 10) { MC.toast('La apuesta mínima es 10 fichas.', 'lose'); return; }
    if (!MC.canBet(amount)) { MC.toast('No te alcanzan las fichas.', 'lose'); return; }

    bet = amount;
    mines = parseInt(el.count.value, 10);
    MC.addBalance(-bet);

    mineSet = {};
    var pool = [];
    for (var i = 0; i < SIZE; i++) pool.push(i);
    MC.shuffle(pool).slice(0, mines).forEach(function (i) { mineSet[i] = true; });

    revealed = 0;
    playing = true;

    buildBoard();
    tiles().forEach(function (t) { t.classList.remove('idle'); });

    el.action.disabled = true;
    el.cashout.disabled = true;
    el.bet.disabled = true;
    el.count.disabled = true;
    el.msg.className = 'mines-msg';
    el.msg.textContent = 'Destapá casillas. Retirá cuando te parezca suficiente.';
    MC.sound.click();
    updateInfo();
  }

  function updateInfo() {
    var m = multiplierAt(revealed);
    el.mult.textContent = MC.fmtMult(m);
    el.payout.textContent = MC.fmt(Math.floor(bet * m));
    el.next.textContent = revealed < SIZE - mines ? MC.fmtMult(multiplierAt(revealed + 1)) : '–';
    el.cashout.disabled = !playing || revealed === 0;
  }

  function cashout(auto) {
    if (!playing || revealed === 0) return;
    var payout = Math.floor(bet * multiplierAt(revealed));
    MC.addBalance(payout);
    MC.recordRound(bet, payout, revealed + ' gemas · ' + MC.fmtMult(multiplierAt(revealed)));
    MC.sound.win();

    el.msg.className = 'mines-msg win';
    el.msg.textContent = 'Retiraste ' + MC.fmt(payout) + ' fichas (+' + MC.fmt(payout - bet) + ')';
    if (!auto) MC.toast('+' + MC.fmt(payout - bet) + ' fichas', 'win');
    endRound();
  }

  function lose() {
    MC.recordRound(bet, 0, revealed + ' gemas antes de la mina');
    MC.sound.blast();
    el.msg.className = 'mines-msg lose';
    el.msg.textContent = 'Mina. Perdiste ' + MC.fmt(bet) + ' fichas.';
    endRound();
  }

  function endRound() {
    playing = false;
    // Se muestra el tablero completo para que se vea dónde estaba todo.
    tiles().forEach(function (t) {
      var i = parseInt(t.dataset.i, 10);
      if (!t.classList.contains('done')) {
        t.classList.add('revealed', 'done');
        t.textContent = mineSet[i] ? '💣' : '💎';
      }
    });
    el.action.disabled = false;
    el.cashout.disabled = true;
    el.bet.disabled = false;
    el.count.disabled = false;
    updateInfo();
  }

  /* ---------------- init ---------------- */
  function init() {
    el.board = document.getElementById('minesBoard');
    el.bet = document.getElementById('minesBet');
    el.count = document.getElementById('minesCount');
    el.action = document.getElementById('minesAction');
    el.cashout = document.getElementById('minesCashout');
    el.mult = document.getElementById('minesMult');
    el.payout = document.getElementById('minesPayout');
    el.next = document.getElementById('minesNext');
    el.msg = document.getElementById('minesMsg');

    var opts = '';
    [1, 3, 5, 8, 10, 15, 20, 24].forEach(function (n) {
      opts += '<option value="' + n + '"' + (n === 3 ? ' selected' : '') + '>' + n + ' mina' + (n > 1 ? 's' : '') + '</option>';
    });
    el.count.innerHTML = opts;

    el.quick = document.getElementById('minesQuick');
    el.quick.innerHTML = QUICK.map(function (v) {
      return '<button data-v="' + v + '">' + (v >= 1000 ? (v / 1000) + 'K' : v) + '</button>';
    }).join('') + '<button data-v="max">MAX</button>';
    el.quick.onclick = function (e) {
      var v = e.target.dataset.v;
      if (!v) return;
      el.bet.value = v === 'max' ? Math.max(10, MC.getBalance()) : v;
      MC.sound.chip();
    };

    el.count.onchange = function () {
      mines = parseInt(el.count.value, 10);
      bet = Math.floor(parseFloat(el.bet.value) || 0);
      el.next.textContent = MC.fmtMult(multiplierAt(1));
    };

    el.action.onclick = start;
    el.cashout.onclick = function () { cashout(false); };

    buildBoard();
    mines = 3;
    el.next.textContent = MC.fmtMult(multiplierAt(1));

    MC.guard('mines', function () { return playing; });
  }

  window.MCMines = { init: init };
})();
