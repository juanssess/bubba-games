/* ============================================================
   BUBBA GAMES — Crash ("Bubba Jet")
   El multiplicador sube hasta que revienta. Retirás antes o perdés.
   Punto de reventón: 0.97 / (1 - r)  →  3% de ventaja para la casa.
   ============================================================ */
(function () {
  'use strict';

  var GROWTH = 0.00009;      // velocidad de subida del multiplicador
  var MAX_MULT = 1000;
  var QUICK = [50, 100, 250, 500, 1000];

  var phase = 'idle';        // idle | running | crashed
  var bet = 0;
  var cashedAt = 0;
  var crashPoint = 1;
  var startedAt = 0;
  var mult = 1;
  var rafId = null;
  var el = {};
  var ctx2d = null;

  /* ---------------- matemática de la ronda ---------------- */
  function rollCrashPoint() {
    var r = MC.rand();
    if (r > 0.9999) r = 0.9999;
    var point = 0.97 / (1 - r);
    return Math.min(MAX_MULT, Math.max(1, Math.floor(point * 100) / 100));
  }

  function multAt(ms) {
    return Math.exp(GROWTH * ms);
  }

  /* ---------------- dibujo ---------------- */
  function draw(elapsedMs) {
    var c = el.canvas, g = ctx2d;
    var W = c.width, H = c.height;
    var pad = 46;

    g.clearRect(0, 0, W, H);

    // grilla
    g.strokeStyle = 'rgba(255,255,255,.05)';
    g.lineWidth = 1;
    for (var x = pad; x < W; x += 90) {
      g.beginPath(); g.moveTo(x, 10); g.lineTo(x, H - pad); g.stroke();
    }
    for (var y = H - pad; y > 10; y -= 62) {
      g.beginPath(); g.moveTo(pad, y); g.lineTo(W - 10, y); g.stroke();
    }

    // ejes
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.beginPath(); g.moveTo(pad, 10); g.lineTo(pad, H - pad); g.lineTo(W - 10, H - pad); g.stroke();

    if (phase === 'idle') return;

    var spanMs = Math.max(6000, elapsedMs * 1.08);
    var topMult = Math.max(2, mult * 1.12);

    var toX = function (ms) { return pad + (ms / spanMs) * (W - pad - 14); };
    var toY = function (m) { return (H - pad) - ((m - 1) / (topMult - 1)) * (H - pad - 18); };

    // curva
    var steps = 90;
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var ms = (elapsedMs * i) / steps;
      pts.push([toX(ms), toY(multAt(ms))]);
    }

    var accent = phase === 'crashed' ? '#f31260' : (cashedAt ? '#17c964' : '#2f6bff');

    // área bajo la curva
    var grad = g.createLinearGradient(0, 10, 0, H - pad);
    grad.addColorStop(0, accent + '55');
    grad.addColorStop(1, accent + '05');
    g.beginPath();
    g.moveTo(pad, H - pad);
    pts.forEach(function (p) { g.lineTo(p[0], p[1]); });
    g.lineTo(pts[pts.length - 1][0], H - pad);
    g.closePath();
    g.fillStyle = grad;
    g.fill();

    // línea
    g.beginPath();
    pts.forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.shadowColor = accent;
    g.shadowBlur = 16;
    g.stroke();
    g.shadowBlur = 0;

    // nave en la punta
    var tip = pts[pts.length - 1];
    g.font = '30px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(phase === 'crashed' ? '💥' : '🚀', tip[0], tip[1] - 14);

    // etiquetas del eje Y
    g.fillStyle = 'rgba(255,255,255,.45)';
    g.font = '12px system-ui, sans-serif';
    g.textAlign = 'right';
    [1, (topMult + 1) / 2, topMult].forEach(function (m) {
      g.fillText(m.toFixed(2) + 'x', pad - 8, toY(m));
    });
  }

  /* ---------------- bucle ---------------- */
  function tick() {
    var elapsed = Date.now() - startedAt;
    mult = multAt(elapsed);

    if (mult >= crashPoint) {
      mult = crashPoint;
      bust();
      return;
    }

    var auto = parseFloat(el.auto.value);
    if (!cashedAt && auto >= 1.01 && mult >= auto) cashout(true);
    // Ojo: después de retirar el bucle SIGUE corriendo hasta el reventón.
    // Si se cortara acá, la ronda nunca terminaría y el juego quedaría trabado.

    el.mult.textContent = MC.fmtMult(mult);
    if (!cashedAt) el.action.textContent = 'RETIRAR ' + MC.fmtMult(mult);
    el.profit.textContent = cashedAt ? MC.fmt(bet * cashedAt - bet) : MC.fmt(bet * mult - bet);

    draw(elapsed);
    rafId = requestAnimationFrame(tick);
  }

  /* ---------------- acciones ---------------- */
  function placeBet() {
    var amount = Math.floor(parseFloat(el.bet.value) || 0);
    if (amount < 10) { MC.toast('La apuesta mínima es 10 fichas.', 'lose'); return; }
    if (!MC.canBet(amount)) { MC.toast('No te alcanzan las fichas.', 'lose'); return; }

    bet = amount;
    MC.addBalance(-bet);
    cashedAt = 0;
    crashPoint = rollCrashPoint();
    startedAt = Date.now();
    mult = 1;
    phase = 'running';

    el.mult.className = 'crash-mult';
    el.state.textContent = 'En vuelo — retirá cuando quieras';
    el.bet.disabled = true;
    el.action.className = 'btn btn-block btn-gold';
    MC.sound.spin();
    tick();
  }

  function cashout(auto) {
    if (phase !== 'running' || cashedAt) return;
    cashedAt = mult;
    var payout = Math.floor(bet * cashedAt);
    MC.addBalance(payout);
    MC.recordRound(bet, payout, 'retiro en ' + MC.fmtMult(cashedAt));
    MC.sound.win();

    el.mult.className = 'crash-mult cashed';
    el.mult.textContent = MC.fmtMult(cashedAt);
    el.state.textContent = (auto ? 'Retiro automático' : 'Retiraste') + ' en ' + MC.fmtMult(cashedAt) +
                           ' · +' + MC.fmt(payout - bet) + ' fichas';
    el.action.textContent = 'ESPERANDO EL REVENTÓN...';
    el.action.disabled = true;
    MC.toast('Retirado en ' + MC.fmtMult(cashedAt) + ': +' + MC.fmt(payout - bet), 'win');
  }

  function bust() {
    phase = 'crashed';
    cancelAnimationFrame(rafId);

    el.mult.className = 'crash-mult bust';
    el.mult.textContent = MC.fmtMult(crashPoint);
    draw(Date.now() - startedAt);

    if (!cashedAt) {
      MC.recordRound(bet, 0, 'reventó en ' + MC.fmtMult(crashPoint));
      MC.sound.blast();
      el.state.textContent = 'Reventó en ' + MC.fmtMult(crashPoint) + ' — perdiste ' + MC.fmt(bet);
    } else {
      el.state.textContent = 'Reventó en ' + MC.fmtMult(crashPoint) + ' — vos ya estabas afuera';
    }

    pushHistory(crashPoint);
    if (crashPoint > (MC.state.crashBest || 1)) {
      MC.state.crashBest = crashPoint;
      MC.save();
    }
    renderBest();

    setTimeout(resetRound, 2200);
  }

  function resetRound() {
    phase = 'idle';
    bet = 0;
    cashedAt = 0;
    mult = 1;
    el.mult.className = 'crash-mult';
    el.mult.textContent = '1.00x';
    el.state.textContent = 'Apostá para el próximo despegue';
    el.action.textContent = 'APOSTAR';
    el.action.className = 'btn btn-accent btn-block';
    el.action.disabled = false;
    el.bet.disabled = false;
    el.profit.textContent = '0';
    draw(0);
  }

  /* ---------------- historial ---------------- */
  function pushHistory(point) {
    MC.state.crashHistory.unshift(point);
    MC.state.crashHistory = MC.state.crashHistory.slice(0, 14);
    MC.save();
    renderHistory();
  }

  function renderHistory() {
    el.history.innerHTML = (MC.state.crashHistory || []).map(function (p) {
      var cls = p >= 10 ? 'epic' : p >= 3 ? 'high' : p >= 1.7 ? 'mid' : 'low';
      return '<span class="ch-item ' + cls + '">' + MC.fmtMult(p) + '</span>';
    }).join('');
  }

  function renderBest() {
    el.best.textContent = MC.fmtMult(MC.state.crashBest || 1);
  }

  /* ---------------- init ---------------- */
  function init() {
    el.canvas = document.getElementById('crashCanvas');
    ctx2d = el.canvas.getContext('2d');
    el.mult = document.getElementById('crashMult');
    el.state = document.getElementById('crashState');
    el.bet = document.getElementById('crashBet');
    el.auto = document.getElementById('crashAuto');
    el.action = document.getElementById('crashAction');
    el.profit = document.getElementById('crashProfit');
    el.best = document.getElementById('crashBest');
    el.history = document.getElementById('crashHistory');

    el.quick = document.getElementById('crashQuick');
    el.quick.innerHTML = QUICK.map(function (v) {
      return '<button data-v="' + v + '">' + (v >= 1000 ? (v / 1000) + 'K' : v) + '</button>';
    }).join('') + '<button data-v="max">MAX</button>';
    el.quick.onclick = function (e) {
      var v = e.target.dataset.v;
      if (!v) return;
      el.bet.value = v === 'max' ? Math.max(10, MC.getBalance()) : v;
      MC.sound.chip();
    };

    el.action.onclick = function () {
      if (phase === 'idle') placeBet();
      else if (phase === 'running') cashout(false);
    };

    renderHistory();
    renderBest();
    resetRound();

    // Con una ronda en el aire no se puede abandonar la mesa.
    MC.guard('crash', function () { return phase === 'running'; });

    document.addEventListener('keydown', function (e) {
      if (MC.getCurrentView() !== 'crash') return;
      if (e.code === 'Space') { e.preventDefault(); el.action.click(); }
    });
  }

  window.MCCrash = { init: init, redraw: function () { draw(phase === 'idle' ? 0 : Date.now() - startedAt); } };
})();
