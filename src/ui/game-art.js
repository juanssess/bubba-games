/* ============================================================
   UI / ARTE VIVO DE LAS TARJETAS

   Cada juego del salón muestra una animación chica que reproduce
   SU mecánica: el crash sube y revienta, Mines destapa gemas hasta
   que sale una bomba, Maverick escala la pirámide, Se Busca pega
   multiplicadores. No es decoración: es el juego en miniatura.

   ---------------------------------------------------------------
   POR QUÉ DIBUJADO POR CÓDIGO Y NO GIFS
   ---------------------------------------------------------------
   Un riel de GIFs son megas de descarga por pantalla, y el arte de
   los casinos que se ven por ahí es de ellos. Acá cada preview son
   unas líneas de canvas: pesa nada, se ve nítido en cualquier
   pantalla, y muestra la mecánica de verdad en vez de un logo.

   ---------------------------------------------------------------
   LO QUE CUESTA, Y CÓMO SE PAGA
   ---------------------------------------------------------------
   Nueve animaciones a la vez arruinarían el scroll si se dejaran
   sueltas. Tres reglas lo evitan:

     1. Un solo requestAnimationFrame para TODAS las tarjetas.
        Un rAF por tarjeta es la forma clásica de fundir una página.
     2. Sólo se dibuja lo que está en pantalla (IntersectionObserver).
        Un riel tiene 10 tarjetas y entran 5: las otras no gastan.
     3. 24 cuadros por segundo y quietas con la pestaña oculta.
        Esto es un adorno; no merece los 60 del monitor.

   Depende de: MCCatalog. No toca el estado ni la billetera.
   ============================================================ */
window.MCArte = (function () {
  'use strict';

  var FPS = 24;
  var PASO = 1000 / FPS;
  var MAX_DPR = 2;          // más resolución no se nota y cuesta el doble

  var vivos = [];           // todas las tarjetas montadas
  var visibles = [];        // las que están en pantalla ahora
  var raf = 0, ultimo = 0;
  var io = null;

  /* ============================================================
     HERRAMIENTAS DE DIBUJO
     ============================================================ */
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function fondo(c, w, h, a, b) {
    var g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, a); g.addColorStop(1, b);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }

  function texto(c, s, x, y, px, color, peso) {
    c.font = (peso || 800) + ' ' + px + 'px system-ui,sans-serif';
    c.fillStyle = color;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }

  // Ruido estable: la misma entrada da siempre lo mismo, así una
  // tarjeta se ve igual en cada vuelta del ciclo sin guardar nada.
  function az(n) {
    var x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function suave(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }

  /* ============================================================
     LAS ESCENAS
     Cada una recibe el tamaño y devuelve su función de dibujo.
     El tiempo `t` viene en segundos y nunca se reinicia: los ciclos
     salen de un módulo, así no hay estado que se desincronice.
     ============================================================ */
  var ESCENAS = {};

  /* ---------- Bubba Jet: la curva que sube y revienta ---------- */
  ESCENAS.crash = function (w, h) {
    var CICLO = 5.2, VUELO = 4.0;
    return function (c, t) {
      var f = t % CICLO;
      fondo(c, w, h, '#0a1233', '#1b3a8f');

      // estrellas quietas de fondo
      for (var i = 0; i < 14; i++) {
        c.globalAlpha = 0.25 + 0.45 * az(i);
        c.fillStyle = '#cfe0ff';
        c.fillRect(az(i * 3) * w, az(i * 7) * h * 0.75, 1.5, 1.5);
      }
      c.globalAlpha = 1;

      var revento = f > VUELO;
      var p = Math.min(1, f / VUELO);
      var mult = 1 + Math.pow(p, 2.1) * 11;

      // la curva
      c.beginPath();
      c.moveTo(0, h);
      var px = 0, py = h;
      for (var s = 0; s <= 1.001; s += 0.05) {
        var q = Math.min(s, p);
        px = q * w * 0.92;
        py = h - Math.pow(q, 1.55) * h * 0.78;
        c.lineTo(px, py);
        if (q >= p) break;
      }
      c.lineTo(px, h); c.closePath();
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(122,162,255,.55)');
      g.addColorStop(1, 'rgba(122,162,255,0)');
      c.fillStyle = g; c.fill();

      c.beginPath();
      c.moveTo(0, h);
      for (var s2 = 0; s2 <= p + 0.001; s2 += 0.05) {
        c.lineTo(s2 * w * 0.92, h - Math.pow(s2, 1.55) * h * 0.78);
      }
      c.strokeStyle = revento ? '#ff5470' : '#7aa2ff';
      c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke();

      if (!revento) {
        c.save(); c.translate(px, py); c.rotate(-0.5);
        texto(c, '🚀', 0, 0, 20, '#fff');
        c.restore();
        texto(c, mult.toFixed(2) + 'x', w / 2, h * 0.3, 26, '#fff');
      } else {
        var e = (f - VUELO) / (CICLO - VUELO);
        c.globalAlpha = 1 - e;
        for (var k = 0; k < 9; k++) {
          var an = k / 9 * 6.283, d = e * 34;
          c.fillStyle = k % 2 ? '#ffb03a' : '#ff5470';
          c.beginPath();
          c.arc(px + Math.cos(an) * d, py + Math.sin(an) * d, 3.5 * (1 - e), 0, 6.283);
          c.fill();
        }
        c.globalAlpha = 1;
        texto(c, 'REVENTÓ', w / 2, h * 0.3, 19, '#ff5470');
      }
    };
  };

  /* ---------- Mines: destapa gemas hasta que sale la bomba ---------- */
  ESCENAS.mines = function (w, h) {
    var N = 5, CICLO = 6.0;
    return function (c, t) {
      var vuelta = Math.floor(t / CICLO);
      var f = t % CICLO;
      fondo(c, w, h, '#2a0d40', '#7c4ddb');

      var lado = Math.min(w, h) * 0.66;
      var celda = lado / N, x0 = (w - lado) / 2, y0 = (h - lado) / 2;
      var abiertas = Math.min(9, Math.floor(f / 0.55));
      var bomba = abiertas >= 8;

      for (var i = 0; i < N * N; i++) {
        var cx = x0 + (i % N) * celda, cy = y0 + Math.floor(i / N) * celda;
        // orden de destape distinto en cada vuelta
        var turno = Math.floor(az(i + vuelta * 31) * 25);
        var viva = turno < abiertas;
        var ultima = turno === abiertas - 1;
        var pop = ultima ? suave((f - turno * 0.55) / 0.22) : 1;

        c.save();
        c.translate(cx + celda / 2, cy + celda / 2);
        c.scale(0.86 * (viva ? 0.9 + 0.1 * pop : 1), 0.86 * (viva ? 0.9 + 0.1 * pop : 1));
        rr(c, -celda / 2, -celda / 2, celda, celda, celda * 0.22);
        if (!viva) {
          c.fillStyle = 'rgba(255,255,255,.10)';
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1; c.stroke();
        } else if (bomba && ultima) {
          // Late mientras dura la explosion: sin esto el ciclo se
          // quedaba dos segundos clavado en la misma imagen.
          var lat = 0.5 + 0.5 * Math.sin((f - 4.4) * 11);
          c.fillStyle = 'rgba(224,52,76,' + (0.55 + 0.45 * lat) + ')'; c.fill();
          texto(c, '💣', 0, 1, celda * (0.46 + 0.08 * lat), '#fff');
        } else {
          c.fillStyle = 'rgba(80,235,190,.22)'; c.fill();
          c.strokeStyle = '#4fe3b0'; c.lineWidth = 1.2; c.stroke();
          texto(c, '💎', 0, 1, celda * 0.46, '#fff');
        }
        c.restore();
      }

      if (bomba) texto(c, '¡BOOM!', w / 2, h - 13, 14 + 2 * Math.sin(f * 11), '#ff8fa0');
      else texto(c, (abiertas || 0) + ' gemas', w / 2, h - 13, 13, 'rgba(255,255,255,.8)');
    };
  };

  /* ---------- Bubba 777: tres rodillos que giran y frenan ---------- */
  ESCENAS.slots = function (w, h) {
    var CARAS = ['🍒', '🍋', '🔔', '🍀', '⭐', '💎', '👑', '7'];
    var CICLO = 4.6;
    return function (c, t) {
      var vuelta = Math.floor(t / CICLO), f = t % CICLO;
      fondo(c, w, h, '#4a1030', '#e01055');

      var cw = w * 0.24, ch = h * 0.62, gap = w * 0.045;
      var x0 = (w - (cw * 3 + gap * 2)) / 2, y0 = (h - ch) / 2;

      for (var r = 0; r < 3; r++) {
        var x = x0 + r * (cw + gap);
        rr(c, x, y0, cw, ch, 7);
        c.fillStyle = 'rgba(0,0,0,.42)'; c.fill();
        c.save(); c.clip();

        var frena = 1.1 + r * 0.42;
        var girando = f < frena;
        var final = Math.floor(az(r + vuelta * 17) * CARAS.length);

        if (girando) {
          var vel = 900 * Math.min(1, (frena - f) / 0.5 + 0.35);
          var off = (f * vel) % (ch / 2);
          for (var k = -1; k < 4; k++) {
            var idx = (final + k + 40) % CARAS.length;
            texto(c, CARAS[idx], x + cw / 2, y0 + off + k * (ch / 2), cw * 0.5, '#fff');
          }
        } else {
          var reb = Math.max(0, 1 - (f - frena) / 0.22);
          texto(c, CARAS[final], x + cw / 2, y0 + ch / 2 + reb * 6, cw * 0.56, '#fff');
        }
        c.restore();
        c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
        rr(c, x, y0, cw, ch, 7); c.stroke();
      }

      // línea de pago encendida al final del ciclo
      if (f > 2.6) {
        c.globalAlpha = 0.35 + 0.35 * Math.sin(f * 9);
        c.strokeStyle = '#ffd257'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x0 - 4, h / 2); c.lineTo(x0 + cw * 3 + gap * 2 + 4, h / 2); c.stroke();
        c.globalAlpha = 1;
      }
    };
  };

  /* ---------- Maverick: La Escalinata, tramo por tramo ---------- */
  ESCENAS.maverick = function (w, h) {
    var TRAMOS = 5, CICLO = 6.4;
    return function (c, t) {
      var f = t % CICLO;
      fondo(c, w, h, '#20140a', '#8a6414');

      var alto = h * 0.15, base = h * 0.93;
      var subido = Math.min(TRAMOS, Math.floor(f / 0.85));
      var cima = subido >= TRAMOS;

      for (var i = 0; i < TRAMOS; i++) {
        var an = w * (0.82 - i * 0.115);
        var y = base - (i + 1) * alto;
        var on = i < subido;
        rr(c, (w - an) / 2, y, an, alto - 2, 3);
        c.fillStyle = on ? 'rgba(255,205,80,.85)' : 'rgba(255,255,255,.10)';
        c.fill();
        c.strokeStyle = on ? '#ffe9a8' : 'rgba(255,255,255,.18)';
        c.lineWidth = 1; c.stroke();
        if (on) {
          c.globalAlpha = 0.5;
          texto(c, '×' + (i + 2), w / 2, y + alto / 2 - 1, alto * 0.52, '#3a2600');
          c.globalAlpha = 1;
        }
      }

      // el jaguar que escala
      var yj = base - subido * alto - alto * 0.62;
      var salto = subido < TRAMOS ? Math.abs(Math.sin(f * 7)) * 2.5 : 0;
      texto(c, '🐆', w / 2, yj - salto, alto * 1.15, '#fff');

      if (cima) {
        var e = (f - TRAMOS * 0.85) / (CICLO - TRAMOS * 0.85);
        c.globalAlpha = Math.max(0, 1 - e) * 0.8;
        for (var k = 0; k < 10; k++) {
          var a = k / 10 * 6.283 + f;
          c.strokeStyle = '#ffe9a8'; c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(w / 2 + Math.cos(a) * 14, yj + Math.sin(a) * 14);
          c.lineTo(w / 2 + Math.cos(a) * (20 + e * 16), yj + Math.sin(a) * (20 + e * 16));
          c.stroke();
        }
        c.globalAlpha = 1;
        texto(c, 'LA CIMA', w / 2, h * 0.14, 14, '#ffe9a8');
      }
    };
  };

  /* ---------- Se Busca: wilds que caen y se quedan pegados ---------- */
  ESCENAS.sebusca = function (w, h) {
    var CICLO = 6.2, MAX = 5;
    return function (c, t) {
      var vuelta = Math.floor(t / CICLO), f = t % CICLO;
      fondo(c, w, h, '#2a1608', '#b8442c');

      var col = 5, fil = 4;
      var cw = w * 0.15, chh = h * 0.19;
      var x0 = (w - cw * col) / 2, y0 = h * 0.16;

      c.fillStyle = 'rgba(0,0,0,.30)';
      c.fillRect(x0, y0, cw * col, chh * fil);

      var pegados = Math.min(MAX, Math.floor(f / 0.95));
      var total = 0;

      for (var i = 0; i < pegados; i++) {
        var s = az(i + vuelta * 53);
        var cx = x0 + Math.floor(s * col) * cw;
        var cy = y0 + Math.floor(az(i * 3 + vuelta * 11) * fil) * chh;
        var mult = [2, 3, 5, 10, 25][Math.floor(az(i * 7 + vuelta) * 5)];
        total += mult;

        var nuevo = i === pegados - 1;
        var pop = nuevo ? suave((f - i * 0.95) / 0.3) : 1;
        var caida = nuevo ? (1 - pop) * -18 : 0;

        c.save();
        c.translate(cx + cw / 2, cy + chh / 2 + caida);
        c.scale(0.82 + 0.18 * pop, 0.82 + 0.18 * pop);
        rr(c, -cw / 2 + 2, -chh / 2 + 2, cw - 4, chh - 4, 4);
        var brillo = pegados >= MAX ? 0.5 + 0.5 * Math.sin(f * 6 - i) : 1;
        c.fillStyle = pegados >= MAX
          ? 'rgb(' + Math.round(240 + 15 * brillo) + ',' +
                     Math.round(180 + 40 * brillo) + ',' +
                     Math.round(41 + 90 * brillo) + ')'
          : '#f0b429';
        c.fill();
        c.strokeStyle = '#fff3d0'; c.lineWidth = 1.2; c.stroke();
        texto(c, '×' + mult, 0, 1, chh * 0.42, '#3a2000');
        c.restore();
      }

      // Los wilds ya pegados laten juntos: el tramo final del ciclo
      // dejaba de moverse una vez colocado el ultimo.
      texto(c, total ? '×' + total + ' pegado' : 'Se Busca',
            w / 2, h * 0.075, 13 + (pegados >= MAX ? Math.sin(f * 6) : 0), '#ffe0b8');
    };
  };

  /* ---------- Doble o Nada: la carta que gira ---------- */
  ESCENAS.plantilla = function (w, h) {
    var CICLO = 3.2;
    return function (c, t) {
      var f = t % CICLO;
      fondo(c, w, h, '#280a10', '#c01830');

      var giro = f * 3.4;
      var esc = Math.cos(giro);
      var rojo = esc >= 0;
      var cw = w * 0.3, chh = h * 0.56;

      c.save();
      c.translate(w / 2, h / 2);
      c.scale(Math.max(0.06, Math.abs(esc)), 1);
      rr(c, -cw / 2, -chh / 2, cw, chh, 6);
      c.fillStyle = rojo ? '#f5f7fb' : '#12151d'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2; c.stroke();
      texto(c, rojo ? '♥' : '♠', 0, 0, chh * 0.5, rojo ? '#d81e34' : '#f5f7fb');
      c.restore();

      texto(c, rojo ? 'ROJO' : 'NEGRO', w / 2, h - 14, 13, 'rgba(255,255,255,.85)');
    };
  };

  /* ---------- Liga Bubba: la pelota al arco ---------- */
  ESCENAS.sportsbook = function (w, h) {
    var CICLO = 4.4;
    return function (c, t) {
      var f = t % CICLO, vuelta = Math.floor(t / CICLO);
      fondo(c, w, h, '#062e18', '#189048');

      // rayas del césped
      c.fillStyle = 'rgba(255,255,255,.045)';
      for (var i = 0; i < 5; i += 1) c.fillRect(0, i * h / 5, w, h / 10);

      // el arco
      var aw = w * 0.34, ah = h * 0.28, ax = (w - aw) / 2, ay = h * 0.1;
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2;
      c.strokeRect(ax, ay, aw, ah);
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 0.8;
      for (var k = 1; k < 5; k++) {
        c.beginPath(); c.moveTo(ax + k * aw / 5, ay); c.lineTo(ax + k * aw / 5, ay + ah); c.stroke();
      }

      // el tiro
      var p = Math.min(1, f / 1.5);
      var destino = ax + aw * (0.2 + 0.6 * az(vuelta));
      var bx = w / 2 + (destino - w / 2) * p;
      var by = h * 0.88 - (h * 0.88 - (ay + ah * 0.6)) * p;
      var arco = Math.sin(p * Math.PI) * h * 0.13;
      texto(c, '⚽', bx, by - arco, 17, '#fff');

      if (f > 1.5) {
        c.globalAlpha = Math.max(0, 1 - (f - 1.5) / 1.4);
        texto(c, '¡GOL!', w / 2, h * 0.62, 22, '#ffe066');
        c.globalAlpha = 1;
      }
      texto(c, '2,45  ·  3,10  ·  2,90', w / 2, h - 12, 11, 'rgba(255,255,255,.75)');
    };
  };

  /* ---------- Ruleta: la rueda y la bolilla ---------- */
  ESCENAS.roulette = function (w, h) {
    var CICLO = 6.0, SEG = 18;
    return function (c, t) {
      var f = t % CICLO, vuelta = Math.floor(t / CICLO);
      fondo(c, w, h, '#04281a', '#0d6b3d');

      var cx = w / 2, cy = h * 0.52, R = Math.min(w, h) * 0.34;
      // la rueda frena de a poco
      var freno = Math.min(1, f / 4.2);
      var ang = (1 - Math.pow(1 - freno, 3)) * 9 + az(vuelta) * 6.283;

      c.save(); c.translate(cx, cy); c.rotate(ang);
      for (var i = 0; i < SEG; i++) {
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, R, i / SEG * 6.283, (i + 1) / SEG * 6.283);
        c.closePath();
        c.fillStyle = i === 0 ? '#0fa958' : (i % 2 ? '#c01830' : '#15181f');
        c.fill();
      }
      c.restore();

      c.beginPath(); c.arc(cx, cy, R * 0.42, 0, 6.283);
      c.fillStyle = '#f0c243'; c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();

      // la bolilla cae hacia adentro y se frena
      var rb = R * (0.92 - 0.28 * freno);
      var ab = -ang * 2.6;
      c.beginPath();
      c.arc(cx + Math.cos(ab) * rb, cy + Math.sin(ab) * rb, 3.2, 0, 6.283);
      c.fillStyle = '#fff'; c.fill();

      if (f > 4.4) {
        var n = Math.floor(az(vuelta * 3) * 37);
        texto(c, String(n), cx, cy, R * 0.42, n === 0 ? '#0a3d22' : '#3a2600');
      }
    };
  };

  /* ---------- Blackjack: las cartas que se reparten ---------- */
  ESCENAS.blackjack = function (w, h) {
    var CICLO = 4.2;
    return function (c, t) {
      var f = t % CICLO;
      fondo(c, w, h, '#06331f', '#0d5c37');

      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(w / 2, h * 1.15, w * 0.62, Math.PI * 1.18, Math.PI * 1.82); c.stroke();

      var cartas = [
        { v: 'A', p: '♠', col: '#12151d' },
        { v: '10', p: '♥', col: '#d81e34' }
      ];
      var cw = w * 0.19, chh = h * 0.42;

      for (var i = 0; i < cartas.length; i++) {
        var ent = suave((f - 0.4 - i * 0.55) / 0.45);
        if (ent <= 0) continue;
        var x = w * 0.5 + (i - 0.5) * cw * 1.15;
        var xi = x + (1 - ent) * w * 0.55;
        var y = h * 0.5;

        c.save();
        c.translate(xi, y);
        c.rotate((1 - ent) * 0.5 + (i - 0.5) * 0.13);
        rr(c, -cw / 2, -chh / 2, cw, chh, 5);
        c.fillStyle = '#f7f9fc'; c.fill();
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
        texto(c, cartas[i].v, 0, -chh * 0.14, chh * 0.3, cartas[i].col);
        texto(c, cartas[i].p, 0, chh * 0.2, chh * 0.26, cartas[i].col);
        c.restore();
      }

      if (f > 2.0) {
        // Respira en vez de quedarse fija: el resto del ciclo ya no
        // es una imagen congelada.
        c.globalAlpha = Math.min(1, (f - 2.0) / 0.3) * (0.75 + 0.25 * Math.sin(f * 5));
        texto(c, 'BLACKJACK', w / 2, h * 0.87, 14, '#ffd257');
        c.globalAlpha = 1;
      }
    };
  };

  /* ---------- por defecto: rodillos genéricos ---------- */
  ESCENAS._ = function (w, h, g) {
    return function (c, t) {
      fondo(c, w, h, '#1a1420', '#4a3a5c');
      var y = h / 2 + Math.sin(t * 2) * 3;
      texto(c, g.emoji || '🎲', w / 2, y, Math.min(w, h) * 0.42, '#fff');
    };
  };

  /* ============================================================
     MONTAJE
     ============================================================ */
  function crear(host) {
    var id = host.getAttribute('data-arte');
    var g = MCCatalog.games[id];
    if (!g) return null;

    var r = host.getBoundingClientRect();
    var w = Math.round(r.width) || 180;
    var h = Math.round(r.height) || 135;
    if (!w || !h) return null;

    var dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.className = 'gcard-cv';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);

    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);

    // El emoji queda como respaldo: si el canvas no arranca, la
    // tarjeta se sigue viendo como antes en vez de quedar vacía.
    host.insertBefore(cv, host.firstChild);
    host.classList.add('tiene-arte');

    var fabrica = ESCENAS[g.id] || ESCENAS[g.engine] || ESCENAS._;
    var dibujar = fabrica(w, h, g);

    // Desfasaje por juego: si todas arrancan juntas el riel late al
    // mismo tiempo y se nota artificial.
    var fase = az(id.length * 7 + id.charCodeAt(0)) * 6;

    return { host: host, ctx: ctx, dibujar: dibujar, w: w, h: h, fase: fase, visible: false };
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (ts - ultimo < PASO) return;
    ultimo = ts;
    var t = ts / 1000;
    for (var i = 0; i < visibles.length; i++) {
      var a = visibles[i];
      a.ctx.clearRect(0, 0, a.w, a.h);
      a.dibujar(a.ctx, t + a.fase);
    }
  }

  function arrancar() {
    if (raf || !visibles.length || document.hidden) return;
    raf = requestAnimationFrame(loop);
  }

  function frenar() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function observar() {
    if (io || !window.IntersectionObserver) return;
    io = new IntersectionObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) {
        var e = entradas[i];
        var a = null;
        for (var k = 0; k < vivos.length; k++) {
          if (vivos[k].host === e.target) { a = vivos[k]; break; }
        }
        if (!a || a.visible === e.isIntersecting) continue;
        a.visible = e.isIntersecting;
        if (a.visible) visibles.push(a);
        else visibles.splice(visibles.indexOf(a), 1);
      }
      if (visibles.length) arrancar(); else frenar();
    }, { rootMargin: '120px' });
  }

  /**
   * Monta el arte de todas las tarjetas que haya adentro de `root`.
   * Lo llama quien acabe de dibujar tarjetas (rieles, catálogo).
   */
  function montar(root) {
    if (!root || !window.requestAnimationFrame) return;
    observar();
    var hosts = root.querySelectorAll('.gcard-art[data-arte]');
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].classList.contains('tiene-arte')) continue;
      var a = crear(hosts[i]);
      if (!a) continue;
      vivos.push(a);
      if (io) io.observe(a.host);
      else { a.visible = true; visibles.push(a); }   // sin observer, todas
    }
    arrancar();
  }

  /** Suelta las tarjetas que ya no están en el documento. */
  function limpiar() {
    for (var i = vivos.length - 1; i >= 0; i--) {
      if (document.contains(vivos[i].host)) continue;
      if (io) io.unobserve(vivos[i].host);
      var v = visibles.indexOf(vivos[i]);
      if (v > -1) visibles.splice(v, 1);
      vivos.splice(i, 1);
    }
    if (!visibles.length) frenar();
  }

  function init() {
    // Pestaña oculta: no tiene sentido dibujar para nadie.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) frenar(); else arrancar();
    });
  }

  return { init: init, montar: montar, limpiar: limpiar, escenas: ESCENAS };
})();
