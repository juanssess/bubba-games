/* ============================================================
   PROGRESO / MISIONES DIARIAS

   Tres objetivos por día, sorteados con la FECHA como semilla:
   son los mismos toda la jornada aunque recargues, y cambian solos
   a la medianoche.

   Todo el seguimiento entra por un único punto: track(), que la
   billetera llama al cerrar cada ronda. Por eso ningún juego tuvo
   que enterarse de que existen las misiones.

   Depende de: state, rng, format, ui, audio, wallet, levels.
   ============================================================ */
window.MCMissions = (function () {
  'use strict';

  var COUNT = 3;   // misiones por día

  /* ---------------- plantillas ----------------
     mode 'count' suma de a uno · 'sum' acumula un total ·
     'best' guarda el mejor valor logrado en una sola ronda.   */
  var TEMPLATES = [
    { key: 'rounds', mode: 'count', goals: [15, 25, 40],
      text: function (n) { return 'Jugá ' + n + ' rondas'; },
      hits: function () { return 1; } },

    { key: 'wager', mode: 'sum', goals: [2000, 5000, 12000],
      text: function (n) { return 'Apostá ' + MC.fmt(n) + ' fichas en total'; },
      hits: function (r) { return r.staked; } },

    { key: 'wins', mode: 'count', goals: [5, 10, 18],
      text: function (n) { return 'Ganá ' + n + ' rondas'; },
      hits: function (r) { return r.net > 0 ? 1 : 0; } },

    { key: 'bigmult', mode: 'best', goals: [3, 5, 10],
      text: function (n) { return 'Cobrá un x' + n + ' o más en una ronda'; },
      hits: function (r) { return r.mult; } },

    { key: 'profit', mode: 'best', goals: [500, 1500, 4000],
      text: function (n) { return 'Ganá ' + MC.fmt(n) + ' fichas netas en una sola ronda'; },
      hits: function (r) { return r.net; } },

    { key: 'slots', mode: 'count', goals: [10, 20, 35],
      text: function (n) { return 'Jugá ' + n + ' rondas de tragamonedas'; },
      hits: function (r) { return r.engine === 'slots' ? 1 : 0; } },

    { key: 'crash', mode: 'count', goals: [3, 6, 10],
      text: function (n) { return 'Retirá ' + n + ' veces en Crash'; },
      hits: function (r) { return r.engine === 'crash' && r.net > 0 ? 1 : 0; } },

    { key: 'mines', mode: 'count', goals: [3, 6, 10],
      text: function (n) { return 'Retirá ' + n + ' veces en Mines'; },
      hits: function (r) { return r.engine === 'mines' && r.net > 0 ? 1 : 0; } },

    { key: 'table', mode: 'count', goals: [5, 10, 18],
      text: function (n) { return 'Jugá ' + n + ' manos de ruleta o blackjack'; },
      hits: function (r) { return (r.engine === 'roulette' || r.engine === 'blackjack') ? 1 : 0; } },

    { key: 'sports', mode: 'count', goals: [2, 4, 6],
      text: function (n) { return 'Acertá ' + n + ' apuestas deportivas'; },
      hits: function (r) { return r.engine === 'sportsbook' && r.net > 0 ? 1 : 0; } }
  ];

  function templateOf(key) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === key) return TEMPLATES[i];
    return null;
  }

  /* ---------------- generación del día ---------------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // La recompensa sale del escalón elegido: cuanto más difícil, más paga.
  function rewardFor(tier) {
    return { chips: [400, 900, 2000][tier], xp: [500, 1200, 3000][tier] };
  }

  function generate(day) {
    var rng = MC.seeded(MC.hashSeed('misiones-' + day));
    var pool = TEMPLATES.slice();

    // Barajado con la semilla del día: mismo sorteo durante toda la jornada.
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }

    return pool.slice(0, COUNT).map(function (tpl) {
      var tier = Math.floor(rng() * 3);
      return {
        key: tpl.key,
        goal: tpl.goals[tier],
        reward: rewardFor(tier),
        progress: 0,
        claimed: false
      };
    });
  }

  // Devuelve las misiones de hoy, regenerándolas si cambió el día.
  function items() {
    var day = today();
    var m = MC.state.missions;
    if (!m || m.day !== day || !m.items || !m.items.length) {
      MC.state.missions = { day: day, items: generate(day) };
      MC.save();
    }
    return MC.state.missions.items;
  }

  /* ---------------- seguimiento ---------------- */
  // r: { game, engine, staked, returned, net, mult }
  function track(r) {
    var list = items();
    var changed = false;

    list.forEach(function (m) {
      if (m.claimed || m.progress >= m.goal) return;
      var tpl = templateOf(m.key);
      if (!tpl) return;

      var value = tpl.hits(r) || 0;
      if (value <= 0) return;

      if (tpl.mode === 'best') m.progress = Math.max(m.progress, value);
      else m.progress += value;

      changed = true;
      if (m.progress >= m.goal) {
        MC.toast('¡Misión cumplida! Pasá a reclamarla.', 'win');
        MC.sound.win();
      }
    });

    if (changed) {
      MC.save();
      render();
    }
  }

  function claim(index) {
    var m = items()[index];
    if (!m || m.claimed || m.progress < m.goal) return false;

    m.claimed = true;
    MC.save();
    MC.addBalance(m.reward.chips);
    MCLevels.addXP(m.reward.xp);
    MC.sound.jackpot();
    MC.toast('+' + MC.fmt(m.reward.chips) + ' fichas y ' + MC.fmt(m.reward.xp) + ' XP', 'win');
    render();
    return true;
  }

  /* ---------------- estado para la interfaz ---------------- */
  function describe(m) {
    var tpl = templateOf(m.key);
    return tpl ? tpl.text(m.goal) : m.key;
  }

  function claimableCount() {
    return items().filter(function (m) { return !m.claimed && m.progress >= m.goal; }).length;
  }

  function render() {
    var badge = document.getElementById('sbMissionBadge');
    if (badge) badge.classList.toggle('off', claimableCount() === 0);
    if (window.MCMissionsView) MCMissionsView.render();
  }

  return {
    items: items, track: track, claim: claim,
    describe: describe, claimableCount: claimableCount, render: render
  };
})();
