/* ============================================================
   CORE / SONIDO — efectos sintetizados con WebAudio.
   Cero archivos de audio: el casino abre desde el disco sin
   descargar nada y suena igual.
   Depende de: state.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var audioCtx = null;

  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    // Los navegadores arrancan el audio suspendido hasta el primer gesto.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Un tono con envolvente de ataque y caída.
  function beep(freq, duration, type, volume, delay) {
    if (!MC.state.soundOn) return;
    var c = ctx();
    if (!c) return;

    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Ruido blanco decreciente: sirve para cartas y explosiones.
  function noise(duration, volume) {
    if (!MC.state.soundOn) return;
    var c = ctx();
    if (!c) return;

    var frames = Math.floor(c.sampleRate * duration);
    var buffer = c.createBuffer(1, frames, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

    var src = c.createBufferSource();
    var gain = c.createGain();
    gain.gain.value = volume || 0.08;
    src.buffer = buffer;
    src.connect(gain).connect(c.destination);
    src.start();
  }

  var sound = {
    click:   function () { beep(520, 0.06, 'triangle', 0.07); },
    chip:    function () { beep(880, 0.05, 'square', 0.05); beep(1320, 0.04, 'square', 0.03, 0.03); },
    card:    function () { noise(0.13, 0.05); },
    tick:    function () { beep(1150, 0.025, 'square', 0.03); },
    // Sube de tono con cada gema destapada en Mines.
    gem:     function (step) { beep(600 + Math.min(step || 0, 14) * 60, 0.09, 'triangle', 0.08); },
    spin:    function () { for (var i = 0; i < 10; i++) beep(300 + i * 40, 0.05, 'sawtooth', 0.04, i * 0.06); },
    win:     function () { [523, 659, 784, 1047].forEach(function (f, i) { beep(f, 0.22, 'triangle', 0.11, i * 0.09); }); },
    lose:    function () { beep(240, 0.3, 'sawtooth', 0.08); beep(160, 0.35, 'sawtooth', 0.07, 0.12); },
    blast:   function () { noise(0.4, 0.16); beep(90, 0.45, 'sawtooth', 0.1); },
    jackpot: function () {
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) {
        beep(f, 0.3, 'square', 0.1, i * 0.1);
        beep(f * 2, 0.3, 'triangle', 0.05, i * 0.1);
      });
    }
  };

  function toggleSound() {
    MC.state.soundOn = !MC.state.soundOn;
    MC.save();
    var b = document.getElementById('soundBtn');
    if (b) b.textContent = MC.state.soundOn ? '🔊' : '🔇';
    if (MC.state.soundOn) sound.click();
    return MC.state.soundOn;
  }

  MC.sound = sound;
  MC.toggleSound = toggleSound;
})(window.MC);
