/* Presentation helpers: bounded effects, no game state or random-number draws. */
window.MCMotion = (function () {
  'use strict';
  function reduced() {
    return document.body.classList.contains('sin-animaciones') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function animate(node, frames, options) {
    if (!node || reduced() || !node.animate || !node.getClientRects().length) return null;
    var animation = node.animate(frames, options);
    animation.finished.then(function () { animation.cancel(); }, function () {});
    return animation;
  }
  function deal(node, turn) {
    // Wait until the hand has been reconciled before measuring the shoe.
    queueMicrotask(function () {
      if (!node.isConnected) return;
      if (turn) {
        if (reduced()) return;
        var back = document.createElement('span');
        back.className = 'motion-card-back';
        back.setAttribute('aria-hidden', 'true');
        node.appendChild(back);
        var flip = animate(node, [
          { transform: 'perspective(800px) rotateY(180deg)', filter: 'brightness(.8)' },
          { transform: 'perspective(800px) rotateY(90deg)', filter: 'brightness(.6)', offset: .5 },
          { transform: 'perspective(800px) rotateY(0deg)', filter: 'brightness(1)' }
        ], { duration: 460, easing: 'ease-in-out' });
        animate(back, [{ opacity: 1 }, { opacity: 1, offset: .49 }, { opacity: 0, offset: .5 }, { opacity: 0 }], { duration: 460, fill: 'forwards' });
        if (flip) flip.finished.then(function () { back.remove(); }, function () { back.remove(); });
        else back.remove();
        return;
      }
      var shoe = document.querySelector('.bj-shoe');
      var rect = node.getBoundingClientRect();
      var origin = shoe && shoe.getBoundingClientRect();
      var x = origin && origin.width ? origin.left - rect.left : 80;
      var y = origin && origin.width ? origin.top - rect.top : -65;
      animate(node, [
        { transform: 'translate(' + x + 'px,' + y + 'px) rotate(-16deg) scale(.78)', opacity: 0 },
        { transform: 'translate(0,3px) rotate(1deg) scale(1.015)', opacity: 1, offset: .8 },
        { transform: 'none', opacity: 1 }
      ], { duration: 430, easing: 'cubic-bezier(.2,.75,.25,1)' });
    });
  }
  function chip(target, source, label) {
    if (!target || !source || reduced()) return;
    var from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
    var ghost = document.createElement('span');
    ghost.className = 'motion-flying-chip';
    ghost.textContent = label;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.left = from.left + from.width / 2 - 14 + 'px';
    ghost.style.top = from.top + from.height / 2 - 14 + 'px';
    document.body.appendChild(ghost);
    var x = to.left + to.width / 2 - from.left - from.width / 2;
    var y = to.top + to.height / 2 - from.top - from.height / 2;
    var flight = animate(ghost, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + x * .55 + 'px,' + (y * .55 - 45) + 'px) rotate(90deg) scale(1.15)', offset: .5, opacity: 1 },
      { transform: 'translate(' + x + 'px,' + y + 'px) rotate(180deg) scale(.7)', opacity: 0 }
    ], { duration: 430, easing: 'cubic-bezier(.22,.61,.36,1)' });
    if (flight) flight.finished.then(function () { ghost.remove(); }, function () { ghost.remove(); });
    else ghost.remove();
  }
  function burst(host, count) {
    if (!host || reduced()) return;
    var layer = document.createElement('span');
    layer.className = 'motion-sparks';
    layer.setAttribute('aria-hidden', 'true');
    // Even spacing keeps the effect deterministic and independent of game RNG.
    for (var i = 0; i < count; i++) {
      var spark = document.createElement('i');
      var angle = i * Math.PI * 2 / count;
      var distance = 85 + i % 4 * 22;
      spark.style.setProperty('--spark-x', Math.cos(angle) * distance + 'px');
      spark.style.setProperty('--spark-y', Math.sin(angle) * distance + 35 + 'px');
      spark.style.setProperty('--spark-delay', i % 5 * 25 + 'ms');
      layer.appendChild(spark);
    }
    host.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 1250);
  }
  return { reduced: reduced, animate: animate, deal: deal, chip: chip, burst: burst };
})();
