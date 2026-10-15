/* Tres pinos equiprobables. Pago nominal 2.91x: RTP = 2.91 / 3 = 97%.
   El factor de la casa modifica el pago visible antes de apostar. */
window.MCBowling = (function () {
  'use strict';
  var BETS = [10, 25, 50, 100, 250, 500, 1000];
  var betIndex = 3, selected = 1, rolling = false, revealed = false;
  var el = {}, pins = [], choices = [], raf = 0;
  var TARGETS = [288, 400, 512];

  function bet() { return BETS[betIndex]; }
  function multiplier() { return 2.91 * MC.rtp.factor('bowling'); }
  function decimal(n) { return Number(n.toFixed(4)).toLocaleString('es-AR', { maximumFractionDigits: 4 }); }
  function controls() {
    el.bet.textContent = MC.fmt(bet());
    el.down.disabled = rolling || betIndex === 0;
    el.up.disabled = rolling || betIndex === BETS.length - 1;
    el.throw.disabled = rolling;
    el.throw.textContent = rolling ? 'BOLA EN JUEGO…' : revealed ? 'VOLVER A TIRAR' : 'TIRAR LA BOLA';
    pins.concat(choices).forEach(function (button, i) {
      button.disabled = rolling;
      button.setAttribute('aria-pressed', String(i % 3 === selected));
      button.classList.toggle('selected', i % 3 === selected);
    });
    el.target.textContent = 'Pino ' + (selected + 1);
    var m = multiplier();
    el.payout.textContent = decimal(m) + 'x';
    el.return.textContent = decimal(bet() * m) + ' fichas';
    el.rtp.textContent = MC.rtp.pct(m / 3);
    el.aim.setAttribute('d', 'M400 490 Q400 350 ' + TARGETS[selected] + ' 240');
  }

  function resetScene() {
    revealed = false;
    el.scene.classList.remove('is-rolling', 'is-revealed', 'is-win');
    pins.forEach(function (pin) {
      pin.classList.remove('hit', 'prize', 'empty');
      pin.querySelector('.bw-pin-result').textContent = '?';
    });
    el.ball.setAttribute('transform', 'translate(400 490) scale(1)');
    el.spin.setAttribute('transform', 'rotate(0)');
    el.msg.className = 'bw-message';
    el.msg.textContent = 'Elegí tu pino y tirá. ¿Dónde está el premio?';
  }

  function choose(index) {
    if (rolling) return;
    if (revealed) resetScene();
    selected = index;
    MC.sound.click();
    controls();
  }

  function finish(round) {
    if (!rolling) return;
    cancelAnimationFrame(raf);
    el.ball.setAttribute('transform', 'translate(' + TARGETS[round.selected] + ' 233) scale(.43)');
    pins[round.selected].classList.add('hit');
    el.scene.classList.remove('is-rolling');
    el.scene.classList.add('is-revealed');
    el.scene.classList.toggle('is-win', round.paid > 0);
    pins.forEach(function (pin, i) {
      pin.classList.add(i === round.winner ? 'prize' : 'empty');
      pin.querySelector('.bw-pin-result').textContent = i === round.winner ? 'PREMIO' : 'VACÍO';
    });
    MC.state.bowlingPending = null;
    if (round.paid > 0) {
      MC.addBalance(round.paid);
      MC.sound.win();
      el.msg.className = 'bw-message won';
      el.msg.textContent = '¡Pino ganador! Cobraste ' + MC.fmt(round.paid) + ' fichas · Ganancia: +' + MC.fmt(round.paid - round.bet);
    } else {
      MC.sound.lose();
      el.msg.className = 'bw-message lost';
      el.msg.textContent = 'El premio estaba en el pino ' + (round.winner + 1) + '. Perdiste ' + MC.fmt(round.bet) + ' fichas.';
    }
    MC.recordRound(round.bet, round.paid, 'Pino elegido: ' + (round.selected + 1) + ' · Premio en el pino ' + (round.winner + 1));
    rolling = false;
    revealed = true;
    controls();
    history();
  }

  function play() {
    if (rolling) return;
    var amount = bet();
    if (!MC.canBet(amount)) {
      MC.toast('No se pudo realizar la apuesta. Revisá tus fichas y límites.', 'lose');
      return;
    }
    // Capturar elección, apuesta y pago: ningún cambio posterior afecta esta ronda.
    var winner = MC.randInt(0, 3);
    var round = { selected: selected, winner: winner, bet: amount,
      paid: winner === selected ? MC.rtp.fichas(amount * multiplier()) : 0 };
    resetScene();
    rolling = true;
    // Se guarda junto con el débito: volver a abrir el juego tras un F5
    // termina este mismo tiro sin volver a cobrar ni volver a sortear.
    MC.state.bowlingPending = round;
    MC.addBalance(-amount);
    controls();
    el.scene.classList.add('is-rolling');
    el.msg.textContent = 'Apuntaste al pino ' + (selected + 1) + '… ¡allá va la bola!';
    MC.sound.spin();
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var duration = reduced ? 100 : 1650;
    var start = performance.now();
    function animate(now) {
      var p = Math.min(1, (now - start) / duration);
      var x = 400 + (TARGETS[round.selected] - 400) * p * p;
      var y = 490 - 257 * p;
      el.ball.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + (1 - .57 * p) + ')');
      el.spin.setAttribute('transform', 'rotate(' + (p * 1080) + ')');
      if (p < 1) raf = requestAnimationFrame(animate);
    }
    if (!reduced) raf = requestAnimationFrame(animate);
    setTimeout(function () {
      pins[round.selected].classList.add('hit');
      MC.sound.click();
    }, duration);
    // El cierre usa un reloj independiente del dibujo: también cierra en una pestaña oculta.
    setTimeout(function () { finish(round); }, duration + (reduced ? 100 : 650));
  }

  function history() {
    var rounds = MC.state.history.filter(function (r) { return r.game === 'bowling'; }).slice(0, 8);
    el.history.innerHTML = rounds.length ? rounds.map(function (r) {
      return '<span class="bw-history-chip ' + (r.returned > 0 ? 'won' : 'lost') + '">' +
        (r.net > 0 ? '+' : '') + MC.fmt(r.net) + '</span>';
    }).join('') : '<span class="bw-history-empty">Tu primer tiro empieza acá</span>';
  }

  function load() {
    // El router puede volver a cargar la misma vista durante un tiro.
    if (rolling) return;
    resetScene();
    if (MC.state.bowlingPending) {
      var pending = MC.state.bowlingPending;
      selected = pending.selected;
      rolling = true;
      controls();
      el.msg.textContent = 'Terminando tu tiro pendiente…';
      setTimeout(function () { finish(pending); }, 200);
      return;
    }
    controls();
    history();
  }

  function init() {
    ['bet', 'down', 'up', 'throw', 'target', 'payout', 'return', 'rtp', 'aim', 'scene', 'ball', 'spin', 'msg', 'history'].forEach(function (key) {
      el[key] = document.getElementById('bw-' + key);
    });
    pins = Array.from(document.querySelectorAll('.bw-pin'));
    choices = Array.from(document.querySelectorAll('.bw-choice'));
    pins.concat(choices).forEach(function (button, i) { button.onclick = function () { choose(i % 3); }; });
    el.down.onclick = function () { if (!rolling && betIndex > 0) { betIndex--; controls(); } };
    el.up.onclick = function () { if (!rolling && betIndex < BETS.length - 1) { betIndex++; controls(); } };
    el.throw.onclick = play;
    MC.guard('bowling', function () { return rolling; });
    MC.registerEngine('bowling', { load: load });
    MC.rtp.onCambio(function () { if (!rolling) controls(); });
  }
  return { init: init };
})();
