/* ============================================================
   UI / CARRUSEL — los banners de promoción del lobby.
   Avanza solo y se reinicia el temporizador si el usuario toca
   un punto, para no cambiarle la diapositiva en la cara.
   ============================================================ */
window.MCCarousel = (function () {
  'use strict';

  var AUTOPLAY_MS = 6500;

  var index = 0;
  var count = 0;
  var timer = null;
  var paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ENV = 'assets/illustrated/environments.png';
  var SCENE_POS = { temple: '0%', western: '50%', wine: '100%' };

  function escena(scene) {
    return 'url(' + ENV + ') ' + SCENE_POS[scene] + ' center/300% 100%';
  }

  // Papel picado: pocas tiras, cada una con su retardo, para que caigan
  // escalonadas y no como una cortina.
  function confeti() {
    var colores = ['#f5c451', '#fff8ee', '#e9a3b8'];
    var out = '';
    for (var i = 0; i < 9; i++) {
      out += '<span class="gb-cf" style="left:' + (6 + i * 10.5) + '%;animation-delay:' +
             ((i * 0.73) % 6).toFixed(2) + 's;background:' + colores[i % 3] + '"></span>';
    }
    return out;
  }

  function bannerJuego(b) {
    var g = MCCatalog.games[b.game];
    var maxWin = 'Hasta x' + g.maxWin.toLocaleString('es-AR');
    return '<div class="promo promo-game" data-scene="' + b.scene + '" data-action="game:' + g.id + '">' +
             '<span class="gb-bg" style="background:' + escena(b.scene) + '"></span>' +
             '<span class="gb-veil"></span>' +
             confeti() +
             '<div class="gb-sym">' + MCIllustrated.icon(g) + '</div>' +
             '<div class="gb-mid">' +
               (g.badge === 'new' ? '<span class="gb-pill">Nuevo</span>' : '') +
               '<span class="gb-kicker">' + b.kicker + '</span>' +
               '<h3 class="gb-title">' + g.name + '</h3>' +
               '<div class="gb-chips"><span>' + MC.rtp.etiqueta(g) + '</span><span>' + b.chip + '</span><span>' + maxWin + '</span></div>' +
             '</div>' +
             '<div class="gb-side">' +
               '<b>' + b.side[0] + '</b><i>' + b.side[1] + '</i>' +
               '<button class="gb-cta" data-action="game:' + g.id + '">Jugar ahora <span aria-hidden="true">›</span></button>' +
             '</div>' +
           '</div>';
  }

  function bannerPromo(p) {
    return '<div class="promo promo-' + p.id + '" style="background:' + p.bg + '">' +
             '<span class="promo-kicker">' + p.kicker + '</span>' +
             '<h3>' + p.title + '</h3>' +
             '<p>' + p.text + '</p>' +
             '<button class="btn btn-gold" data-action="' + p.action + '">' + p.cta + '</button>' +
             '<span class="promo-emoji" aria-hidden="true">' + p.emoji + '</span>' +
           '</div>';
  }

  // Solo los juegos que existen en el catálogo: si uno se oculta, su
  // banner desaparece en vez de romper el carrusel.
  function slides() {
    return MCCatalog.gameBanners
      .filter(function (b) { return MCCatalog.games[b.game]; })
      .map(bannerJuego)
      .concat(MCCatalog.promos.map(bannerPromo));
  }

  function buildMinis() {
    var row = document.getElementById('miniBanners');
    if (!row) return;
    row.innerHTML = MCCatalog.miniBanners
      .filter(function (m) { return MCCatalog.games[m.game]; })
      .map(function (m) {
        var g = MCCatalog.games[m.game];
        // El fondo va en línea y no en una variable CSS: una url() dentro
        // de var() se resuelve contra la hoja de estilos, no contra la página.
        return '<button class="mini-banner" data-action="game:' + g.id + '" style="--mb-c:' + m.color + '">' +
                 '<span class="mb-bg" style="background:linear-gradient(90deg,' + m.tint + '),' + escena(m.scene) + '"></span>' +
                 MCIllustrated.icon(g) +
                 '<strong>' + g.name + '</strong>' +
                 '<small>' + MC.rtp.etiqueta(g) + '</small>' +
               '</button>';
      }).join('');
    row.onclick = function (e) {
      var b = e.target.closest('[data-action]');
      if (b) MCActions.run(b.dataset.action);
    };
  }

  function build() {
    var track = document.getElementById('carouselTrack');
    var dots = document.getElementById('carouselDots');
    var all = slides();
    count = all.length;

    track.innerHTML = all.map(function (html, i) {
      return html.replace('<div class="promo', '<div role="group" aria-label="' + (i + 1) + ' de ' + count + '" class="promo');
    }).join('');
    buildMinis();

    dots.innerHTML = all.map(function (_, i) {
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
    carousel.onmouseenter = function () { clearInterval(timer); carousel.classList.add('is-held'); };
    carousel.onmouseleave = function () { carousel.classList.remove('is-held'); restart(); };
    carousel.onfocusin = function () { clearInterval(timer); };
    carousel.onfocusout = function (e) { if (!carousel.contains(e.relatedTarget)) restart(); };
    goTo(0);
    restart();
  }

  function goTo(i) {
    index = (i + count) % count;
    document.getElementById('carouselTrack').style.transform = 'translateX(' + (-index * 100) + '%)';
    document.querySelectorAll('.dot').forEach(function (d, k) {
      d.classList.toggle('active', k === index);
      d.setAttribute('aria-pressed', String(k === index));
    });
    document.querySelectorAll('#carouselTrack .promo').forEach(function (p, k) {
      p.inert = k !== index;
      p.setAttribute('aria-hidden', String(k !== index));
      p.classList.toggle('is-active', k === index);
      // La luz ambiente detrás del carrusel toma el color de la escena.
      if (k === index) document.getElementById('view-lobby').dataset.scene = p.dataset.scene || 'promo';
    });
  }

  function restart() {
    clearInterval(timer);
    // La barra del punto activo cuenta el tiempo hasta el próximo banner:
    // se reinicia con el temporizador y queda quieta si está en pausa.
    var carousel = document.getElementById('carousel');
    carousel.classList.toggle('is-paused', paused);
    carousel.style.setProperty('--autoplay', AUTOPLAY_MS + 'ms');
    carousel.classList.remove('is-running');
    void carousel.offsetWidth;
    carousel.classList.add('is-running');
    if (paused || document.getElementById('carousel').contains(document.activeElement)) return;
    timer = setInterval(function () { goTo(index + 1); }, AUTOPLAY_MS);
  }

  return { build: build };
})();
