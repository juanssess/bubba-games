/* ============================================================
   PROGRESO / NIVELES — rango VIP por experiencia acumulada.

   La XP sube con lo APOSTADO, no con lo ganado: así el rango
   refleja cuánto jugaste y no si tuviste suerte.
   El perk es concreto: cada rango agranda el bono recargable.

   Depende de: state, format, ui.
   ============================================================ */
window.MCLevels = (function () {
  'use strict';

  // min: XP necesaria para entrar al rango
  // bonus: multiplicador que se le aplica al bono recargable
  var TIERS = [
    { name: 'Aprendiz',        min: 0,       bonus: 1.00, ico: '🥉' },
    { name: 'Apostador',       min: 10000,   bonus: 1.10, ico: '🎯' },
    { name: 'Tahúr',           min: 40000,   bonus: 1.25, ico: '🎩' },
    { name: 'Veterano',        min: 120000,  bonus: 1.40, ico: '🥈' },
    { name: 'As de la casa',   min: 300000,  bonus: 1.60, ico: '🥇' },
    { name: 'Leyenda Bubba',   min: 750000,  bonus: 2.00, ico: '👑' }
  ];

  function getXP() { return MC.state.xp || 0; }

  function tierIndex(xp) {
    var i = 0;
    for (var k = 0; k < TIERS.length; k++) if (xp >= TIERS[k].min) i = k;
    return i;
  }

  function current() { return TIERS[tierIndex(getXP())]; }
  function next() {
    var i = tierIndex(getXP());
    return i < TIERS.length - 1 ? TIERS[i + 1] : null;
  }

  // Avance dentro del rango actual, de 0 a 1.
  function progress() {
    var xp = getXP();
    var i = tierIndex(xp);
    var nxt = TIERS[i + 1];
    if (!nxt) return 1;
    var span = nxt.min - TIERS[i].min;
    return Math.min(1, (xp - TIERS[i].min) / span);
  }

  function bonusMultiplier() { return current().bonus; }

  // Suma XP y avisa si el jugador subió de rango.
  function addXP(amount) {
    if (!amount || amount <= 0) return;
    var before = tierIndex(getXP());
    MC.state.xp = getXP() + Math.round(amount);
    var after = tierIndex(MC.state.xp);

    if (after > before) {
      var t = TIERS[after];
      MC.sound.jackpot();
      MC.modal('Subiste de rango',
        '<p>Ahora sos <strong style="color:var(--gold)">' + t.ico + ' ' + t.name + '</strong>.</p>' +
        '<p>Tu bono recargable pasa a valer <strong>' + Math.round(t.bonus * 100) + '%</strong>.</p>',
        [{ label: 'Seguir jugando', kind: 'primary' }]);
    }
    MC.save();
    render();
  }

  /* ---------------- pintado ---------------- */
  function render() {
    var box = document.getElementById('sbLevel');
    if (!box) return;

    var t = current();
    var nxt = next();
    var pct = Math.round(progress() * 100);

    box.innerHTML =
      '<div class="lvl-top"><span>' + t.ico + ' ' + t.name + '</span>' +
        '<strong>' + pct + '%</strong></div>' +
      '<div class="lvl-bar"><div class="lvl-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="lvl-next">' +
        (nxt ? 'Faltan ' + MC.fmt(nxt.min - getXP()) + ' XP para ' + nxt.name : 'Rango máximo alcanzado') +
      '</div>';

    if (window.MCMissionsView) MCMissionsView.render();
  }

  return {
    TIERS: TIERS,
    getXP: getXP, current: current, next: next, progress: progress,
    bonusMultiplier: bonusMultiplier, addXP: addXP, render: render
  };
})();
