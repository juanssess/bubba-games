/* ============================================================
   CORE / ESTADO — la única copia de la verdad, y su persistencia.
   Todo lo que sobrevive a un F5 vive acá.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  // El estado se guarda POR PERFIL: la clave la arma MC.auth con el uid
  // del que está jugando. Antes era una sola clave global; la migración
  // de esa cuenta vieja al primer perfil la hace auth.js al arrancar.
  function storageKey() {
    return MC.auth.claveEstado(MC.auth.current().uid);
  }
  var STARTING_CHIPS = 5000;

  var defaults = {
    balance: STARTING_CHIPS,
    lastBonusAt: 0,
    soundOn: true,
    stats: { plays: 0, best: 0, net: 0, wagered: 0 },
    history: [],            // últimas jugadas reales del usuario
    rouletteHistory: [],
    crashHistory: [],
    crashBest: 1,

    xp: 0,                                        // rango VIP
    missions: { day: '', items: [] },             // objetivos del día
    // liga simulada: jornada actual, tabla, últimos resultados y cupones pendientes
    sports: { round: 1, standings: {}, results: [], tickets: [] }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Se mezcla con los valores por defecto para que agregar campos nuevos
  // no rompa las cuentas ya guardadas en el navegador.
  function load() {
    try {
      // Sólo el perfil activo. La migración de las cuentas viejas (cuando
      // no había perfiles) la hace auth.js una única vez al arrancar: si
      // también se intentara acá, CADA perfil nuevo heredaría ese saldo en
      // vez de empezar con las fichas de bienvenida.
      var raw = localStorage.getItem(storageKey());
      if (!raw) return clone(defaults);
      var saved = JSON.parse(raw);
      var merged = clone(defaults);
      Object.keys(merged).forEach(function (k) {
        if (saved[k] !== undefined && saved[k] !== null) merged[k] = saved[k];
      });
      merged.stats = Object.assign(clone(defaults.stats), saved.stats || {});

      // Cuentas creadas antes de que existieran los rangos: se les
      // acredita como XP todo lo que ya habían apostado.
      if (!merged.xp && merged.stats.wagered) merged.xp = merged.stats.wagered;

      return merged;
    } catch (e) {
      return clone(defaults);
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(MC.state));
    } catch (e) {
      /* navegación privada o almacenamiento lleno: se juega igual, sin guardar */
    }
  }

  function resetProgress() {
    var keepSound = MC.state.soundOn;
    var fresh = clone(defaults);
    fresh.soundOn = keepSound;

    // Se vacía y rellena el mismo objeto para no romper las referencias
    // que otros módulos ya tomaron de MC.state.
    Object.keys(MC.state).forEach(function (k) { delete MC.state[k]; });
    Object.assign(MC.state, fresh);

    save();
    MC.renderBalance(true);
    MC.renderStats();
    if (window.MCPortal && MCPortal.renderHistory) MCPortal.renderHistory();
    MC.toast('Cuenta reiniciada con ' + MC.fmt(STARTING_CHIPS) + ' fichas', 'info');
  }

  MC.STARTING_CHIPS = STARTING_CHIPS;
  MC.state = load();
  MC.save = save;
  MC.resetProgress = resetProgress;
})(window.MC);
