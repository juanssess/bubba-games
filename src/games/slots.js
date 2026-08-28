/* ============================================================
   BUBBA GAMES — motor de tragamonedas
   Un solo motor para todo el catálogo: cada título le pasa su set
   de símbolos con pesos y tabla de pagos propia (ver gamegen.js).
   Tres rodillos, una línea: tres iguales pagan, y los símbolos
   altos también pagan par.
   ============================================================ */
(function () {
  'use strict';

  var BETS = [10, 25, 50, 100, 250, 500, 1000];
  var betIndex = 2;
  var spinning = false;

  var game = null;      // metadatos del título abierto
  var symbols = [];
  var reelPool = [];
  var el = {};

  function currentBet() { return BETS[betIndex]; }
  function isSeven(sym) { return sym.face === '7'; }

  /* ---------------- carga de un título ---------------- */
  function load(meta) {
    if (spinning) return;
    game = meta;
    symbols = meta.config.symbols;

    reelPool = [];
    symbols.forEach(function (s) {
      for (var i = 0; i < s.weight; i++) reelPool.push(s);
    });

    buildPaytable();
    seedReels();
    el.win.textContent = '';
    el.win.classList.remove('show');
    el.message.textContent = meta.studio
      ? meta.studio + ' · volatilidad ' + meta.volatility.toLowerCase()
      : 'Elegí tu apuesta y girá';
    updateBetUI();
  }

  /* ---------------- render ---------------- */
  function cellHTML(sym) {
    return '<div class="reel-cell' + (isSeven(sym) ? ' sym-seven' : '') + '">' + sym.face + '</div>';
  }

  function buildPaytable() {
    var grid = document.getElementById('paytableGrid');
    grid.innerHTML = symbols.slice().reverse().map(function (s) {
      var pairTxt = s.pair
        ? '<span style="color:var(--txt-dim);font-size:11px">par ' + s.pair + 'x</span>'
        : '<span style="color:var(--txt-dim);font-size:11px">&nbsp;</span>';
      return '<div class="pt-item" title="' + s.name + '">' +
               '<span class="pt-sym' + (isSeven(s) ? ' sym-seven' : '') + '">' + s.face + '</span>' +
               '<span style="text-align:right"><span class="pt-mult">' + s.triple + 'x</span><br>' + pairTxt + '</span>' +
             '</div>';
    }).join('');

    var head = document.getElementById('paytableHead');
    if (head && game) {
      head.textContent = game.rtp + ' · máx. ' + Math.round(game.maxWin) + 'x la apuesta';
    }
  }

  function updateBetUI() {
    el.bet.textContent = MC.fmt(currentBet());
    el.betDown.disabled = spinning || betIndex === 0;
    el.betUp.disabled = spinning || betIndex === BETS.length - 1;
    el.maxBet.disabled = spinning;
    el.spin.disabled = spinning;
  }

  // Deja el rodillo quieto mostrando un símbolo (estado inicial).
  function seedReels() {
    el.strips.forEach(function (strip) {
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.innerHTML = cellHTML(MC.pick(reelPool));
    });
  }

  function cellHeight() {
    return el.strips[0].parentElement.clientHeight;
  }

  /* ---------------- lógica ---------------- */
  function spinReel(strip, finalSymbol, duration) {
    var STOP_AT = 18; // cuántos símbolos "pasan" antes de frenar
    var cells = [];
    for (var i = 0; i < STOP_AT; i++) cells.push(cellHTML(MC.pick(reelPool)));
    cells.push(cellHTML(finalSymbol));
    cells.push(cellHTML(MC.pick(reelPool)));

    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.innerHTML = cells.join('');
    void strip.offsetWidth; // fuerza reflow para que la transición arranque desde 0

    strip.style.transition = 'transform ' + duration + 'ms cubic-bezier(.12,.66,.16,1)';
    strip.style.transform = 'translateY(' + (-STOP_AT * cellHeight()) + 'px)';
  }

  function evaluate(result, bet) {
    var a = result[0], b = result[1], c = result[2];
    if (a.id === b.id && b.id === c.id) {
      return { payout: Math.round(bet * a.triple), kind: 'triple', symbol: a };
    }
    var pairSym = null;
    if (a.id === b.id) pairSym = a;
    else if (b.id === c.id) pairSym = b;
    else if (a.id === c.id) pairSym = a;
    if (pairSym && pairSym.pair > 0) {
      return { payout: Math.round(bet * pairSym.pair), kind: 'pair', symbol: pairSym };
    }
    return { payout: 0, kind: 'none', symbol: null };
  }

  function spin() {
    if (spinning || !game) return;
    var bet = currentBet();
    if (!MC.canBet(bet)) {
      MC.toast('No te alcanzan las fichas. Pedí el bono.', 'lose');
      return;
    }

    spinning = true;
    MC.addBalance(-bet);
    MC.sound.spin();
    el.win.textContent = '';
    el.win.classList.remove('show');
    el.message.textContent = 'Girando...';
    document.querySelectorAll('.reel').forEach(function (r) { r.classList.remove('win'); });
    updateBetUI();

    var result = [MC.pick(reelPool), MC.pick(reelPool), MC.pick(reelPool)];
    var durations = [1500, 1950, 2400];
    el.strips.forEach(function (strip, i) { spinReel(strip, result[i], durations[i]); });

    setTimeout(function () { finish(result, bet); }, durations[2] + 120);
  }

  function finish(result, bet) {
    spinning = false;
    var outcome = evaluate(result, bet);

    if (outcome.payout > 0) {
      MC.addBalance(outcome.payout);
      document.querySelectorAll('.reel').forEach(function (r) { r.classList.add('win'); });
      el.win.textContent = '+' + MC.fmt(outcome.payout) + ' fichas';
      el.win.classList.add('show');

      var isJackpot = outcome.kind === 'triple' && outcome.symbol.triple >= game.maxWin;
      if (isJackpot) {
        el.message.textContent = '¡PREMIO MAYOR!';
        MC.sound.jackpot();
        MC.modal('¡Premio mayor!',
          '<p>Tres <strong>' + outcome.symbol.name + '</strong> en línea (' + outcome.symbol.triple + 'x).</p>' +
          '<p>Te llevás <strong style="color:var(--gold)">' + MC.fmt(outcome.payout) + ' fichas</strong>.</p>',
          [{ label: 'Seguir jugando', kind: 'primary' }]);
      } else if (outcome.kind === 'triple') {
        el.message.textContent = 'Tres ' + outcome.symbol.name + ' — ' + outcome.symbol.triple + 'x';
        MC.sound.win();
        MC.toast('¡Tres ' + outcome.symbol.name + '! +' + MC.fmt(outcome.payout), 'win');
      } else {
        el.message.textContent = 'Par de ' + outcome.symbol.name + ' — ' + outcome.symbol.pair + 'x';
        MC.sound.win();
      }
    } else {
      el.message.textContent = 'Sin premio. Probá de nuevo.';
      MC.sound.lose();
    }

    var detail = outcome.kind === 'triple' ? 'tres ' + outcome.symbol.name
               : outcome.kind === 'pair' ? 'par de ' + outcome.symbol.name
               : 'sin premio';
    MC.recordRound(bet, outcome.payout, detail);
    updateBetUI();
  }

  /* ---------------- init ---------------- */
  function init() {
    el.strips = Array.prototype.slice.call(document.querySelectorAll('.reel-strip'));
    el.bet = document.getElementById('slotBet');
    el.betUp = document.getElementById('slotBetUp');
    el.betDown = document.getElementById('slotBetDown');
    el.maxBet = document.getElementById('slotMaxBet');
    el.spin = document.getElementById('spinBtn');
    el.win = document.getElementById('slotWin');
    el.message = document.getElementById('slotMessage');

    el.betUp.onclick = function () {
      if (betIndex < BETS.length - 1) { betIndex++; MC.sound.click(); updateBetUI(); }
    };
    el.betDown.onclick = function () {
      if (betIndex > 0) { betIndex--; MC.sound.click(); updateBetUI(); }
    };
    el.maxBet.onclick = function () {
      // La máxima que el saldo banca, sin pasarse de la tabla.
      var i = BETS.length - 1;
      while (i > 0 && BETS[i] > MC.getBalance()) i--;
      betIndex = i;
      MC.sound.chip();
      updateBetUI();
    };
    el.spin.onclick = spin;

    document.addEventListener('keydown', function (e) {
      if (MC.getCurrentView() !== 'slots') return;
      if (e.code === 'Space') { e.preventDefault(); spin(); }
    });

    MC.guard('slots', function () { return spinning; });
    MC.registerEngine('slots', { load: load });
  }

  window.MCSlots = { init: init };
})();
