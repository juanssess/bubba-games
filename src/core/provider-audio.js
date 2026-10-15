/* Puente de presentación para el proveedor compilado. Carga antes del módulo.
   No toca resultados: sus efectos conservan su volumen y pasan por un master
   que respeta el silencio del casino y la pestaña oculta. */
(function () {
  'use strict';
  var parentMC;
  try { parentMC = window.parent !== window && window.parent.MC; } catch (_) {}
  if (!parentMC || !parentMC.sound) return;
  var outputs = [], lastMuted = null;
  var NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  if (NativeAudioContext) {
    class CasinoAudioContext extends NativeAudioContext {
      constructor(options) {
        super(options);
        this.casinoOutput = this.createGain();
        this.casinoOutput.connect(super.destination);
        outputs.push({context:this, gain:this.casinoOutput});
        sync();
      }
      get destination() { return this.casinoOutput || super.destination; }
    }
    window.AudioContext = CasinoAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = CasinoAudioContext;
  }
  function sync() {
    var on = parentMC.state.soundOn !== false && !document.hidden && !window.parent.document.hidden;
    outputs.forEach(function (entry) {
      if (entry.context.state !== 'closed') {
        entry.gain.gain.setTargetAtTime(on ? 1 : 0, entry.context.currentTime, 0.015);
      }
    });
    var muted = false;
    try { muted = localStorage.getItem('maverick.muted') === '1'; } catch (_) {}
    if (muted !== lastMuted) {
      lastMuted = muted;
      parentMC.sound.providerMuted(muted);
    }
  }
  function unlock() { sync(); parentMC.sound.unlock(); }
  document.addEventListener('pointerdown', unlock, {passive:true});
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', sync);
  var timer = setInterval(sync, 150);
  window.addEventListener('pagehide', function () { clearInterval(timer); });
  sync();
})();
