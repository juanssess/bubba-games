/* ============================================================
   UI / MISIONES — la pantalla de progresión: rango VIP, objetivos
   del día y la escala de rangos con sus beneficios.

   Depende de: MCLevels, MCMissions.
   ============================================================ */
window.MCMissionsView = (function () {
  'use strict';

  function open() {
    MC.showView('missions');
    render();
  }

  function render() {
    var view = document.getElementById('view-missions');
    if (!view) return;

    renderRank();
    renderMissions();
    renderTiers();
  }

  /* ---------------- tarjeta de rango ---------------- */
  function renderRank() {
    var box = document.getElementById('rankCard');
    if (!box) return;

    var t = MCLevels.current();
    var nxt = MCLevels.next();
    var pct = Math.round(MCLevels.progress() * 100);

    box.innerHTML =
      '<div class="rank-ico">' + t.ico + '</div>' +
      '<div class="rank-body">' +
        '<span class="rank-label">Tu rango</span>' +
        '<h3>' + t.name + '</h3>' +
        '<div class="lvl-bar"><div class="lvl-fill" style="width:' + pct + '%"></div></div>' +
        '<p>' + MC.fmt(MCLevels.getXP()) + ' XP · ' +
          (nxt ? 'faltan ' + MC.fmt(nxt.min - MCLevels.getXP()) + ' para ' + nxt.name
               : 'rango máximo alcanzado') + '</p>' +
      '</div>' +
      '<div class="rank-perk">' +
        '<span>Bono</span><strong>' + Math.round(t.bonus * 100) + '%</strong>' +
      '</div>';
  }

  /* ---------------- misiones del día ---------------- */
  function renderMissions() {
    var wrap = document.getElementById('missionList');
    if (!wrap) return;

    wrap.innerHTML = MCMissions.items().map(function (m, i) {
      var done = m.progress >= m.goal;
      var pct = Math.min(100, Math.round((m.progress / m.goal) * 100));
      // Los objetivos de "mejor marca" se muestran con decimales.
      var shown = (m.key === 'bigmult') ? m.progress.toFixed(2) : MC.fmt(m.progress);
      var goal = (m.key === 'bigmult') ? m.goal.toFixed(2) : MC.fmt(m.goal);

      var action = m.claimed
        ? '<span class="mission-done">Reclamada</span>'
        : done
          ? '<button class="btn btn-gold" data-claim="' + i + '">Reclamar</button>'
          : '<span class="mission-pending">' + pct + '%</span>';

      return '<article class="mission' + (m.claimed ? ' is-claimed' : done ? ' is-ready' : '') + '">' +
               '<div class="mission-top">' +
                 '<strong>' + MCMissions.describe(m) + '</strong>' + action +
               '</div>' +
               '<div class="lvl-bar"><div class="lvl-fill" style="width:' + pct + '%"></div></div>' +
               '<div class="mission-foot">' +
                 '<span>' + shown + ' / ' + goal + '</span>' +
                 '<span>+' + MC.fmt(m.reward.chips) + ' fichas · +' + MC.fmt(m.reward.xp) + ' XP</span>' +
               '</div>' +
             '</article>';
    }).join('');

    wrap.onclick = function (e) {
      var b = e.target.closest('[data-claim]');
      if (b) MCMissions.claim(parseInt(b.dataset.claim, 10));
    };
  }

  /* ---------------- escala de rangos ---------------- */
  function renderTiers() {
    var wrap = document.getElementById('tierList');
    if (!wrap) return;

    var actual = MCLevels.current().name;
    wrap.innerHTML = MCLevels.TIERS.map(function (t) {
      var alcanzado = MCLevels.getXP() >= t.min;
      return '<div class="tier' + (t.name === actual ? ' is-current' : '') +
                              (alcanzado ? ' is-reached' : '') + '">' +
               '<span class="tier-ico">' + t.ico + '</span>' +
               '<span class="tier-name">' + t.name + '</span>' +
               '<span class="tier-xp">' + MC.fmt(t.min) + ' XP</span>' +
               '<span class="tier-bonus">bono ' + Math.round(t.bonus * 100) + '%</span>' +
             '</div>';
    }).join('');
  }

  function init() {
    document.getElementById('missionsBack').onclick = function () {
      MC.sound.click();
      MC.showView('lobby');
    };
  }

  return { init: init, open: open, render: render };
})();
