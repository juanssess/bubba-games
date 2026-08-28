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

  function build() {
    var track = document.getElementById('carouselTrack');
    var dots = document.getElementById('carouselDots');

    track.innerHTML = MCCatalog.promos.map(function (p) {
      return '<div class="promo" style="background:' + p.bg + '">' +
               '<span class="promo-kicker">' + p.kicker + '</span>' +
               '<h3>' + p.title + '</h3>' +
               '<p>' + p.text + '</p>' +
               '<button class="btn btn-gold" data-action="' + p.action + '">' + p.cta + '</button>' +
               '<span class="promo-emoji">' + p.emoji + '</span>' +
             '</div>';
    }).join('');

    dots.innerHTML = MCCatalog.promos.map(function (_, i) {
      return '<button class="dot' + (i ? '' : ' active') + '" data-i="' + i + '"></button>';
    }).join('');

    dots.onclick = function (e) {
      if (!e.target.dataset.i) return;
      goTo(parseInt(e.target.dataset.i, 10));
      restart();
    };

    track.onclick = function (e) {
      MCActions.run(e.target.dataset && e.target.dataset.action);
    };

    restart();
  }

  function goTo(i) {
    var promos = MCCatalog.promos;
    index = (i + promos.length) % promos.length;
    document.getElementById('carouselTrack').style.transform = 'translateX(' + (-index * 100) + '%)';
    document.querySelectorAll('.dot').forEach(function (d, k) {
      d.classList.toggle('active', k === index);
    });
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(function () { goTo(index + 1); }, AUTOPLAY_MS);
  }

  return { build: build };
})();
