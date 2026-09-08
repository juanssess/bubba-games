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
  /**
   * La ficha del rango, como HTML.
   *
   * Se calcula una sola vez al arrancar y se guarda en `ico`, que es el
   * campo que ya leen las doce pantallas que muestran el rango. Asi el
   * cambio de emoji a ficha no obliga a tocar ninguna de las doce.
   */
  function fichaDe(color) {
    return '<span class="vip-chip" style="--vc:' + color + '" aria-hidden="true"></span>';
  }

  var TIERS = [
    /* El rango se muestra como una FICHA, no como un emoji.
       Un bronce, un blanco y una corona sacados del teclado no forman una
       escala: no se entiende cual va antes sin leer el nombre. Una ficha
       que cambia de color si, y ademas es el objeto de la marca. El color
       sube de bronce a carmesi, que es el de la casa. */
    { name: 'Aprendiz',        min: 0,       bonus: 1.00, color: '#8A5A3B' },
    { name: 'Apostador',       min: 10000,   bonus: 1.10, color: '#6E7F96' },
    { name: 'Tahúr',           min: 40000,   bonus: 1.25, color: '#3E9A8C' },
    { name: 'Veterano',        min: 120000,  bonus: 1.40, color: '#B9C2CE' },
    { name: 'As de la casa',   min: 300000,  bonus: 1.60, color: '#F5C451' },
    { name: 'Leyenda Bubba',   min: 750000,  bonus: 2.00, color: '#D81E34' }
  ];

  // `ico` queda como HTML listo para insertar, igual que antes era el emoji.
  TIERS.forEach(function (t) { t.ico = fichaDe(t.color); });

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
