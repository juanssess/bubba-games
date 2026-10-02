/* ============================================================
   UI / CARRUSEL — los banners de promoción del lobby.
   Avanza solo y se reinicia el temporizador si el usuario toca
   un punto, para no cambiarle la diapositiva en la cara.
   ============================================================ */
window.MCCarousel = (function () {
  'use strict';

  var AUTOPLAY_MS = 6500;

  var index = 0;
  var timer = null;
  var paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    var track = document.getElementById('carouselTrack');
    var dots = document.getElementById('carouselDots');

    track.innerHTML = MCCatalog.promos.map(function (p, i) {
      return '<div class="promo" role="group" aria-label="' + (i + 1) + ' de ' + MCCatalog.promos.length + '" style="background:' + p.bg + '">' +
               '<span class="promo-kicker">' + p.kicker + '</span>' +
               '<h3>' + p.title + '</h3>' +
               '<p>' + p.text + '</p>' +
               '<button class="btn btn-gold" data-action="' + p.action + '">' + p.cta + '</button>' +
               '<span class="promo-emoji" aria-hidden="true">' + p.emoji + '</span>' +
             '</div>';
    }).join('');

    dots.innerHTML = MCCatalog.promos.map(function (_, i) {
      return '<button class="dot' + (i ? '' : ' active') + '" data-i="' + i + '" aria-label="Ver destacado ' + (i + 1) + '" aria-pressed="' + (i === 0) + '"></button>';
    }).join('');

    dots.onclick = function (e) {
      if (!e.target.dataset.i) return;
      goTo(parseInt(e.target.dataset.i, 10));
      restart();
    };

    track.onclick = function (e) {
      var button = e.target.closest('[data-action]');
      if (button) MCActions.run(button.dataset.action);
    };

    var pause = document.getElementById('carouselPause');
    function renderPause() {
      pause.textContent = paused ? 'Reanudar' : 'Pausar';
      pause.setAttribute('aria-label', paused ? 'Reanudar destacados' : 'Pausar destacados');
      pause.setAttribute('aria-pressed', String(paused));
    }
    pause.onclick = function () { paused = !paused; renderPause(); restart(); };
    renderPause();
    var carousel = document.getElementById('carousel');
    carousel.onmouseenter = function () { clearInterval(timer); };
    carousel.onmouseleave = restart;
    carousel.onfocusin = function () { clearInterval(timer); };
    carousel.onfocusout = function (e) { if (!carousel.contains(e.relatedTarget)) restart(); };
    goTo(0);
    restart();
  }

  function goTo(i) {
    var promos = MCCatalog.promos;
    index = (i + promos.length) % promos.length;
    document.getElementById('carouselTrack').style.transform = 'translateX(' + (-index * 100) + '%)';
    document.querySelectorAll('.dot').forEach(function (d, k) {
      d.classList.toggle('active', k === index);
      d.setAttribute('aria-pressed', String(k === index));
    });
    document.querySelectorAll('#carouselTrack .promo').forEach(function (p, k) {
      p.inert = k !== index;
      p.setAttribute('aria-hidden', String(k !== index));
    });
  }

  function restart() {
    clearInterval(timer);
    if (paused || document.getElementById('carousel').contains(document.activeElement)) return;
    timer = setInterval(function () { goTo(index + 1); }, AUTOPLAY_MS);
  }

  return { build: build };
})();
