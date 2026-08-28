/* ============================================================
   BUBBA GAMES — Blackjack
   Zapato de 6 mazos · el crupier se planta en 17 (también blando)
   Blackjack natural paga 3:2 · doblar y dividir habilitados
   ============================================================ */
(function () {
  'use strict';

  var SUITS = [
    { s: '♠', red: false }, { s: '♥', red: true },
    { s: '♦', red: true },  { s: '♣', red: false }
  ];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var DECKS = 6;
  var MAX_HANDS = 4;

  var BETS = [25, 50, 100, 250, 500, 1000];
  var betIndex = 2;

  var shoe = [];
  var dealer = [];
  var hands = [];       // [{ cards, bet, done, doubled, fromSplitAces }]
  var activeHand = 0;
  var phase = 'idle';   // idle | dealing | player | dealer | done
  var el = {};

  function currentBet() { return BETS[betIndex]; }

  /* ---------------- zapato ---------------- */
  function buildShoe() {
    shoe = [];
    for (var d = 0; d < DECKS; d++) {
      SUITS.forEach(function (su) {
        RANKS.forEach(function (r) {
          shoe.push({ rank: r, suit: su.s, red: su.red });
        });
      });
    }
    MC.shuffle(shoe);
  }

  function draw() {
    // Se rebaraja al llegar al 25% del zapato, como en mesa real.
    if (shoe.length < DECKS * 52 * 0.25) buildShoe();
    return shoe.pop();
  }

  /* ---------------- puntaje ---------------- */
  function scoreOf(cards) {
    var total = 0, aces = 0;
    cards.forEach(function (c) {
      if (c.rank === 'A') { aces++; total += 11; }
      else if (['J', 'Q', 'K', '10'].indexOf(c.rank) >= 0) total += 10;
      else total += parseInt(c.rank, 10);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function isBlackjack(cards) { return cards.length === 2 && scoreOf(cards) === 21; }

  /* ---------------- render ---------------- */
  function cardEl(card, hidden) {
    var d = document.createElement('div');
    if (hidden) { d.className = 'card back'; return d; }
    d.className = 'card' + (card.red ? ' red' : '');
    d.innerHTML =
      '<div class="c-corner-t"><div class="c-rank">' + card.rank + '</div>' +
      '<div class="c-suit-sm">' + card.suit + '</div></div>' +
      '<div class="c-suit-big">' + card.suit + '</div>' +
      '<div class="c-corner-b"><div class="c-rank">' + card.rank + '</div>' +
      '<div class="c-suit-sm">' + card.suit + '</div></div>';
    return d;
  }

  function render() {
    // Crupier
    el.dealerHand.innerHTML = '';
    dealer.forEach(function (c, i) {
      var hidden = (i === 1 && (phase === 'player' || phase === 'dealing'));
      el.dealerHand.appendChild(cardEl(c, hidden));
    });
    var dealerVisible = (phase === 'player' || phase === 'dealing') ? dealer.slice(0, 1) : dealer;
    el.dealerScore.textContent = dealer.length ? scoreOf(dealerVisible) + (dealerVisible.length < dealer.length ? ' + ?' : '') : '';

    // Jugador
    el.playerHands.innerHTML = '';
    hands.forEach(function (h, i) {
      var box = document.createElement('div');
      box.className = 'hand-box' + (i === activeHand && phase === 'player' ? ' active' : '');
      var row = document.createElement('div');
      row.className = 'hand';
      h.cards.forEach(function (c) { row.appendChild(cardEl(c, false)); });
      box.appendChild(row);
      var betLine = document.createElement('div');
      betLine.className = 'hand-bet';
      betLine.textContent = MC.fmt(h.bet) + ' fichas' + (h.result ? ' · ' + h.result : '');
      box.appendChild(betLine);
      el.playerHands.appendChild(box);
    });

    var main = hands[activeHand];
    el.playerScore.textContent = main ? scoreOf(main.cards) : '';

    updateControls();
  }

  function updateControls() {
    var idle = phase === 'idle' || phase === 'done';
    el.deal.style.display = idle ? '' : 'none';
    el.betControl.style.display = idle ? '' : 'none';
    el.actions.classList.toggle('show', phase === 'player');

    el.betUp.disabled = betIndex === BETS.length - 1;
    el.betDown.disabled = betIndex === 0;
    el.bet.textContent = MC.fmt(currentBet());
    el.deal.disabled = !MC.canBet(currentBet());

    if (phase !== 'player') return;
    var h = hands[activeHand];
    var canAct = h && !h.done;
    el.hit.disabled = !canAct || h.fromSplitAces;
    el.stand.disabled = !canAct;
    el.double.disabled = !canAct || h.cards.length !== 2 || h.fromSplitAces || !MC.canBet(h.bet);
    el.split.disabled = !canAct || hands.length >= MAX_HANDS || h.cards.length !== 2 ||
                        rankValue(h.cards[0]) !== rankValue(h.cards[1]) || !MC.canBet(h.bet);
  }

  function rankValue(c) {
    return ['J', 'Q', 'K', '10'].indexOf(c.rank) >= 0 ? '10' : c.rank;
  }

  function banner(text, flash) {
    el.banner.textContent = text;
    if (flash) {
      el.banner.classList.remove('flash');
      void el.banner.offsetWidth;
      el.banner.classList.add('flash');
    }
  }

  /* ---------------- ronda ---------------- */
  function deal() {
    var bet = currentBet();
    if (!MC.canBet(bet)) { MC.toast('No te alcanzan las fichas.', 'lose'); return; }
    if (phase !== 'idle' && phase !== 'done') return;

    if (!shoe.length) buildShoe();
    MC.addBalance(-bet);

    dealer = [];
    hands = [{ cards: [], bet: bet, done: false, doubled: false, fromSplitAces: false, result: '' }];
    activeHand = 0;
    phase = 'dealing';
    banner('Repartiendo...');
    render();

    var steps = [
      function () { hands[0].cards.push(draw()); },
      function () { dealer.push(draw()); },
      function () { hands[0].cards.push(draw()); },
      function () { dealer.push(draw()); }
    ];
    steps.forEach(function (fn, i) {
      setTimeout(function () {
        fn();
        MC.sound.card();
        render();
        if (i === steps.length - 1) setTimeout(afterDeal, 320);
      }, i * 260);
    });
  }

  function afterDeal() {
    var playerBJ = isBlackjack(hands[0].cards);
    var dealerBJ = isBlackjack(dealer);

    if (playerBJ || dealerBJ) {
      phase = 'done';
      if (playerBJ && dealerBJ) {
        settleHand(hands[0], 1, 'Empate');
        banner('Blackjack de los dos — empate', true);
      } else if (playerBJ) {
        settleHand(hands[0], 2.5, 'Blackjack 3:2');
        banner('¡BLACKJACK!', true);
        MC.sound.jackpot();
      } else {
        settleHand(hands[0], 0, 'Pierde');
        banner('Blackjack del crupier', true);
        MC.sound.lose();
      }
      finishRound();
      return;
    }

    phase = 'player';
    banner('Tu turno');
    render();
  }

  function hit() {
    var h = hands[activeHand];
    if (!h || h.done) return;
    h.cards.push(draw());
    MC.sound.card();
    var sc = scoreOf(h.cards);
    if (sc > 21) {
      h.done = true;
      h.result = 'Se pasó';
      banner('Te pasaste con ' + sc, true);
      MC.sound.lose();
      nextHand();
    } else if (sc === 21) {
      h.done = true;
      nextHand();
    }
    render();
  }

  function stand() {
    var h = hands[activeHand];
    if (!h || h.done) return;
    h.done = true;
    nextHand();
    render();
  }

  function doubleDown() {
    var h = hands[activeHand];
    if (!h || h.done || h.cards.length !== 2 || !MC.canBet(h.bet)) return;
    MC.addBalance(-h.bet);
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(draw());
    MC.sound.card();
    h.done = true;
    if (scoreOf(h.cards) > 21) h.result = 'Se pasó';
    nextHand();
    render();
  }

  function split() {
    var h = hands[activeHand];
    if (!h || h.cards.length !== 2 || hands.length >= MAX_HANDS || !MC.canBet(h.bet)) return;
    if (rankValue(h.cards[0]) !== rankValue(h.cards[1])) return;

    MC.addBalance(-h.bet);
    var moved = h.cards.pop();
    var splittingAces = h.cards[0].rank === 'A';

    var newHand = {
      cards: [moved], bet: h.bet, done: false, doubled: false,
      fromSplitAces: splittingAces, result: ''
    };
    h.fromSplitAces = splittingAces;
    hands.splice(activeHand + 1, 0, newHand);

    h.cards.push(draw());
    newHand.cards.push(draw());
    MC.sound.card();

    // Con ases divididos se recibe una sola carta por mano y se cierra.
    if (splittingAces) {
      h.done = true;
      newHand.done = true;
      nextHand();
    }
    render();
  }

  function nextHand() {
    while (activeHand < hands.length && hands[activeHand].done) activeHand++;
    if (activeHand >= hands.length) {
      dealerTurn();
    } else {
      banner('Mano ' + (activeHand + 1) + ' de ' + hands.length);
    }
  }

  function dealerTurn() {
    phase = 'dealer';
    render();

    var alive = hands.some(function (h) { return scoreOf(h.cards) <= 21; });
    if (!alive) {
      phase = 'done';
      banner('La casa se lleva la mano', true);
      hands.forEach(function (h) { if (!h.result) h.result = 'Pierde'; });
      finishRound();
      return;
    }

    banner('Juega el crupier');
    var step = function () {
      if (scoreOf(dealer) < 17) {
        dealer.push(draw());
        MC.sound.card();
        render();
        setTimeout(step, 620);
      } else {
        setTimeout(showdown, 420);
      }
    };
    setTimeout(step, 520);
  }

  function showdown() {
    phase = 'done';
    var dScore = scoreOf(dealer);
    var dBust = dScore > 21;
    var netMsg = [];

    hands.forEach(function (h) {
      var p = scoreOf(h.cards);
      if (p > 21) { settleHand(h, 0, 'Pierde'); netMsg.push('pasada'); return; }
      if (dBust || p > dScore) { settleHand(h, 2, 'Gana'); netMsg.push('gana'); }
      else if (p === dScore) { settleHand(h, 1, 'Empate'); netMsg.push('empate'); }
      else { settleHand(h, 0, 'Pierde'); netMsg.push('pierde'); }
    });

    var won = netMsg.filter(function (m) { return m === 'gana'; }).length;
    if (dBust) banner('El crupier se pasó con ' + dScore, true);
    else banner('Crupier ' + dScore + ' — ' + (won ? '¡ganaste!' : 'se planta'), true);

    if (won) MC.sound.win(); else MC.sound.lose();
    finishRound();
  }

  // multiplier: 0 pierde · 1 empate · 2 gana · 2.5 blackjack
  function settleHand(hand, multiplier, label) {
    hand.result = label;
    hand.returned = Math.round(hand.bet * multiplier);
    if (hand.returned > 0) MC.addBalance(hand.returned);
  }

  function finishRound() {
    var staked = hands.reduce(function (s, h) { return s + h.bet; }, 0);
    var returned = hands.reduce(function (s, h) { return s + (h.returned || 0); }, 0);
    var detail = hands.map(function (h) { return (h.result || '').toLowerCase(); }).join(' · ');
    MC.recordRound(staked, returned, detail);
    render();

    if (returned > staked) MC.toast('+' + MC.fmt(returned - staked) + ' fichas', 'win');
    else if (returned === 0) MC.toast('-' + MC.fmt(staked) + ' fichas', 'lose');
  }

  /* ---------------- init ---------------- */
  function init() {
    el.dealerHand = document.getElementById('dealerHand');
    el.dealerScore = document.getElementById('dealerScore');
    el.playerHands = document.getElementById('playerHands');
    el.playerScore = document.getElementById('playerScore');
    el.banner = document.getElementById('bjBanner');
    el.deal = document.getElementById('bjDeal');
    el.actions = document.getElementById('bjActions');
    el.betControl = document.getElementById('bjBetControl');
    el.bet = document.getElementById('bjBet');
    el.betUp = document.getElementById('bjBetUp');
    el.betDown = document.getElementById('bjBetDown');
    el.hit = document.getElementById('bjHit');
    el.stand = document.getElementById('bjStand');
    el.double = document.getElementById('bjDouble');
    el.split = document.getElementById('bjSplit');

    buildShoe();

    el.deal.onclick = deal;
    el.hit.onclick = function () { if (phase === 'player') hit(); };
    el.stand.onclick = function () { if (phase === 'player') stand(); };
    el.double.onclick = function () { if (phase === 'player') doubleDown(); };
    el.split.onclick = function () { if (phase === 'player') split(); };
    el.betUp.onclick = function () { if (betIndex < BETS.length - 1) { betIndex++; MC.sound.click(); render(); } };
    el.betDown.onclick = function () { if (betIndex > 0) { betIndex--; MC.sound.click(); render(); } };

    render();
  }

  window.MCBlackjack = { init: init, refresh: function () { render(); } };
})();
