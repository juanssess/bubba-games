/* Presentation only. Never generates results, settles bets, or changes game time. */
(function () {
  'use strict';
  var active = null;
  var themes = {
    gold: ['BUBBA GOLD', 'EL TESORO DEL TIGRE'],
    classic20: ['MAVERICK', 'LA CÁMARA DEL SOL'],
    sebusca: ['SE BUSCA', 'LA RECOMPENSA'],
    vendimia: ['LA VENDIMIA', 'LA GRAN COSECHA']
  };
  var reduced = function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  function show(options) {
    // One overlay owns focus; repeated requests share its completion.
    if (active) return active.promise;
    var theme = themes[options.theme] ? options.theme : 'gold';
    var end = options.kind === 'summary';
    var previous = document.activeElement;
    var dialog = document.createElement('dialog');
    dialog.className = 'cinema cinema--' + theme;
    dialog.setAttribute('aria-labelledby', 'cinema-title');
    dialog.setAttribute('aria-describedby', 'cinema-detail');
    dialog.innerHTML = '<div class="cinema-atmosphere" aria-hidden="true"></div>' +
      '<div class="cinema-sparks" aria-hidden="true">' + Array.from({length:24}, function (_,i) {
        return '<i style="--i:' + i + ';--x:' + ((i * 37 + 11) % 100) + '%"></i>';
      }).join('') + '</div><section class="cinema-panel">' +
      '<div class="cinema-brand"></div><div class="cinema-emblem" aria-hidden="true"></div>' +
      '<p class="cinema-eyebrow"></p><h2 id="cinema-title"></h2>' +
      '<div class="cinema-rule" aria-hidden="true"></div>' +
      '<strong class="cinema-value" aria-hidden="true"></strong><p class="cinema-unit"></p>' +
      '<p id="cinema-detail"></p><button type="button" class="cinema-continue"></button>' +
      '<span class="cinema-hint">Enter o espacio para continuar</span></section>';
    dialog.querySelector('.cinema-brand').textContent = themes[theme][0];
    dialog.querySelector('.cinema-eyebrow').textContent = end ? 'BONUS COMPLETADO' : themes[theme][1];
    dialog.querySelector('h2').textContent = end ? 'TU PREMIO TOTAL' : '¡BONUS ACTIVADO!';
    var value = end ? Math.max(0, Number(options.total) || 0) : options.spins;
    var format = function (n) { return Math.round(n).toLocaleString('es-AR'); };
    var number = dialog.querySelector('.cinema-value');
    number.textContent = format(value);
    dialog.querySelector('.cinema-unit').textContent = end ? 'FICHAS' : 'GIROS GRATIS';
    dialog.querySelector('#cinema-detail').textContent = end
      ? format(value) + ' fichas obtenidas en ' + options.spins + ' giros gratis.'
      : options.spins + ' giros gratis. ' + (options.detail || 'Tu bonus está listo.');
    var button = dialog.querySelector('button');
    button.textContent = end ? 'CONTINUAR' : 'EMPEZAR BONUS';
    var resolve, raf = 0, closed = false;
    var promise = new Promise(function (done) { resolve = done; });
    active = { promise:promise, close:close };
    document.body.appendChild(dialog);
    dialog.showModal();
    button.focus();
    function close() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', keyboard, true);
      dialog.close();
      dialog.remove();
      active = null;
      if (previous && previous.isConnected) previous.focus({preventScroll:true});
      resolve();
    }
    function keyboard(event) {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) close();
      }
    }
    document.addEventListener('keydown', keyboard, true);
    button.addEventListener('click', close);
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
    if (end && !reduced()) {
      var start = performance.now();
      function count(now) {
        var t = Math.min(1, (now - start) / 1450);
        number.textContent = format(value * (1 - Math.pow(1-t, 3)));
        if (t < 1) raf = requestAnimationFrame(count);
      }
      raf = requestAnimationFrame(count);
    }
    return promise;
  }
  // Blur is only present while a strip is moving. The landing finishes before settlement.
  function reel(strip, duration) {
    if (reduced()) return;
    if (strip._motion) strip._motion.forEach(function (animation) { animation.cancel(); });
    strip._motion = [strip.animate([
      {filter:'blur(0px)'}, {filter:'blur(2px)',offset:.16},
      {filter:'blur(1px)',offset:.68}, {filter:'blur(0px)'}
    ], {duration:duration,easing:'linear'})];
    strip._motion.push(strip.parentElement.animate([
      {transform:'translateY(0)'}, {transform:'translateY(3px)',offset:.4},
      {transform:'translateY(-1px)',offset:.75}, {transform:'translateY(0)'}
    ], {duration:180,delay:Math.max(0,duration-180),easing:'ease-out'}));
  }
  window.MCCinema = {show:show, reel:reel, reduced:reduced,
    get active() { return !!active; }};
})();
