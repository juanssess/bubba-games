/* ============================================================
   UI / ESTADÍSTICAS DEL JUGADOR

   "Estadísticas" existía en el menú y abría el modal de cuenta: un
   ítem que prometía una cosa y hacía otra. Ahora hay pantalla, y
   contesta las tres preguntas que un jugador realmente se hace.

     1. ¿Cómo vengo?        neto, apostado, y el RTP que TE tocó
     2. ¿Qué juego me rinde? por juego, de toda la vida
     3. ¿Qué pasó recién?   las últimas rondas, con su detalle

   ---------------------------------------------------------------
   EL RTP REAL, Y POR QUÉ SE MUESTRA CON UNA ADVERTENCIA
   ---------------------------------------------------------------
   El RTP que TE tocó es devuelto / apostado. Es un dato honesto y
   además el más malinterpretado de un casino: con pocas rondas se
   va a cualquier lado, y el jugador concluye que el juego "está
   frío" o "está pagando".

   Así que se muestra junto al teórico y con el margen de error de
   verdad, que sale de la varianza del binomio:

       error ≈ 1 / √rondas

   Con 100 rondas ese margen es ±10 puntos: el número no dice nada
   todavía, y la pantalla lo dice en vez de dejar que el jugador
   saque la conclusión equivocada. Un casino que muestra el RTP
   medido sin el margen está insinuando algo que el dato no sostiene.

   Depende de: state, diario, catalog, levels, format, ui.
   ============================================================ */
window.MCEstadisticas = (function () {
  'use strict';

  var periodo = 'semana';

  var PERIODOS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: '7 días' },
    { id: 'mes', label: '30 días' },
    { id: 'todo', label: 'Todo' }
  ];

  function diaDesplazado(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return MCDiario.clave(d.getTime());
  }

  function limites() {
    var hoy = MCDiario.clave();
    if (periodo === 'hoy') return { desde: hoy, hasta: hoy };
    if (periodo === 'semana') return { desde: diaDesplazado(-6), hasta: hoy };
    if (periodo === 'mes') return { desde: diaDesplazado(-29), hasta: hoy };
    return { desde: null, hasta: null };
  }

  /**
   * ESTADO VACIO.
   *
   * Un cero no explica nada. Lo primero que ve un jugador nuevo en esta
   * pantalla —y en Misiones, y en el Ranking— son ceros sobre negro, y un
   * cero sin contexto se lee como "esto no anda" y no como "esto todavia
   * no tiene datos".
   *
   * Estas piezas dicen las dos cosas que faltan: QUE va a aparecer ahi y
   * QUE hay que hacer para que aparezca. Con un boton, porque mandar a
   * alguien a buscar el camino solo es la mitad del trabajo.
   */
  function vacio(ico, titulo, texto, boton) {
    return '<div class="vacio">' +
      '<span class="vacio-ico">' + ico + '</span>' +
      '<strong>' + titulo + '</strong>' +
      '<p>' + texto + '</p>' +
      (boton || '') +
    '</div>';
  }

  /** Los iconos de los vacios: de trazo, como el resto de la interfaz. */
  var ICO = {
    dados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/>' +
      '<circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/>' +
      '<circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>' +
      '<circle cx="12" cy="12" r="1.1" fill="currentColor"/></svg>',
    grafico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16"/>' +
      '<path d="m7 15 3.5-4 3 2.5L20 7"/></svg>',
  };

  /* ---------------- dibujo ---------------- */
  function render() {
    var cont = document.getElementById('statsBody');
    if (!cont) return;

    var l = limites();
    var r = MCDiario.rango(MC.state, l.desde, l.hasta);
    var s = MC.state.stats || {};

    // El neto del JUGADOR es al revés del de la casa: lo que le volvió
    // menos lo que puso.
    var neto = r.devuelto - r.apostado;
    var rtp = r.apostado > 0 ? r.devuelto / r.apostado : 0;

    cont.innerHTML =
      periodos() +
      '<div class="st-kpis">' +
        kpi(MC.fmt(r.rondas), 'Rondas', '') +
        kpi(MC.fmt(r.apostado), 'Apostado', 'var(--gold)') +
        kpi((neto >= 0 ? '+' : '') + MC.fmt(neto), 'Resultado',
            neto >= 0 ? 'var(--green)' : 'var(--red)') +
        kpi(r.rondas ? (rtp * 100).toFixed(1).replace('.', ',') + '%' : '—',
            'Te volvió', '') +
      '</div>' +
      avisoRTP(r, rtp) +
      curva(r) +
      porJuego() +
      ultimasRondas() +
      '<div class="ag-note">Los totales de toda tu vida en el casino: ' +
        '<strong>' + MC.fmt(s.plays || 0) + '</strong> rondas, ' +
        '<strong>' + MC.fmt(s.wagered || 0) + '</strong> apostado, ' +
        'mejor golpe <strong>+' + MC.fmt(s.best || 0) + '</strong>.</div>';

    enganchar();
  }

  function periodos() {
    return '<div class="st-periodos">' +
      PERIODOS.map(function (p) {
        return '<button class="ag-per' + (periodo === p.id ? ' on' : '') +
          '" data-per="' + p.id + '">' + p.label + '</button>';
      }).join('') +
    '</div>';
  }

  function kpi(valor, label, color) {
    return '<div class="st-kpi">' +
      '<strong' + (color ? ' style="color:' + color + '"' : '') + '>' + valor + '</strong>' +
      '<span>' + label + '</span></div>';
  }

  /* El margen de error es lo que separa un dato de una superstición. */
  function avisoRTP(r, rtp) {
    if (!r.rondas) {
      return vacio(
        ICO.grafico,
        'Todavía no jugaste en este período',
        'Acá vas a ver cuánto apostaste, cómo te fue día por día y qué juego ' +
        'te rinde mejor. El registro arranca con tu primera ronda.',
        '<button class="btn btn-gold" id="stVacioJugar">Ir al salón</button>',
      );
    }
    var margen = 1 / Math.sqrt(r.rondas);   // ±, en tanto por uno
    var confiable = r.rondas >= 2000;
    return '<div class="st-rtp' + (confiable ? ' ok' : '') + '">' +
      '<strong>Te volvió el ' + (rtp * 100).toFixed(1).replace('.', ',') + '% ' +
        'de lo que apostaste.</strong>' +
      '<span>Con ' + MC.fmt(r.rondas) + ' rondas, el margen de error es de ' +
        '±' + (margen * 100).toFixed(1).replace('.', ',') + ' puntos. ' +
        (confiable
          ? 'Ya son suficientes rondas para que el número quiera decir algo.'
          : 'Todavía son pocas rondas: este número se mueve muchísimo y no dice ' +
            'si un juego está “frío” o “caliente”. Los RTP de la casa son del 96% al 97,5% ' +
            'y no cambian nunca.') +
      '</span></div>';
  }

  /* La curva del resultado acumulado. Es el gráfico que un jugador
     entiende sin explicación: si baja, viene perdiendo. */
  function curva(r) {
    if (r.dias.length < 2) return '';

    var W = 760, H = 150, pad = 24;
    var acum = 0, pts = [], min = 0, max = 0;
    r.dias.forEach(function (d) {
      acum += (d.d - d.a);
      pts.push(acum);
      if (acum < min) min = acum;
      if (acum > max) max = acum;
    });
    if (max === min) { max = min + 1; }

    var paso = (W - pad * 2) / Math.max(1, pts.length - 1);
    var y = function (v) { return H - pad - ((v - min) / (max - min)) * (H - pad * 2); };
    var linea = pts.map(function (v, i) {
      return (i ? 'L' : 'M') + (pad + i * paso).toFixed(1) + ' ' + y(v).toFixed(1);
    }).join(' ');

    var cero = y(0);
    var sube = pts[pts.length - 1] >= 0;

    return '<div class="ag-grafico">' +
      '<div class="ag-grafico-head"><strong>Resultado acumulado</strong>' +
        '<span class="ag-leyenda">' + (sube ? 'vas arriba' : 'vas abajo') + '</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" ' +
        'aria-label="Resultado acumulado por día">' +
        '<line x1="' + pad + '" y1="' + cero.toFixed(1) + '" x2="' + (W - pad) +
          '" y2="' + cero.toFixed(1) + '" stroke="rgba(255,255,255,.22)" ' +
          'stroke-width="1" stroke-dasharray="4 4"/>' +
        '<path d="' + linea + '" fill="none" stroke="' +
          (sube ? '#4fe3b0' : '#e0344c') + '" stroke-width="2.5" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="ag-grafico-pie"><span>' + r.dias[0].dia + '</span>' +
        '<span>' + r.dias[r.dias.length - 1].dia + '</span></div>' +
    '</div>';
  }

  /* Por juego: de toda la vida, no del período. Cuál rinde no es una
     pregunta sobre esta semana. */
  function porJuego() {
    var pj = MC.state.porJuego || {};
    var ids = Object.keys(pj).filter(function (k) { return pj[k].r > 0; });
    if (!ids.length) return '';

    ids.sort(function (a, b) { return pj[b].a - pj[a].a; });
    var max = pj[ids[0]].a || 1;

    return '<div class="st-juegos">' +
      '<h3>Por juego <em>de toda tu vida en el casino</em></h3>' +
      ids.map(function (id) {
        var g = MCCatalog.games[id];
        var x = pj[id];
        var neto = x.d - x.a;
        return '<div class="st-juego">' +
          '<span class="st-juego-ico">' + (g ? g.emoji : '🎲') + '</span>' +
          '<span class="st-juego-nombre">' + (g ? g.name : id) +
            '<em>' + MC.fmt(x.r) + ' rondas · ' + MC.fmt(x.a) + ' apostado</em></span>' +
          '<span class="st-barra"><i style="width:' +
            Math.max(3, x.a / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="st-juego-neto" style="color:' +
            (neto >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
            (neto >= 0 ? '+' : '') + MC.fmt(neto) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function ultimasRondas() {
    var h = (MC.state.history || []).slice(0, 25);
    if (!h.length) return '';
    return '<div class="st-rondas">' +
      '<h3>Últimas rondas</h3>' +
      h.map(function (e) {
        var g = MCCatalog.games[e.game];
        var pos = e.net >= 0;
        return '<div class="st-ronda">' +
          '<span class="st-r-ico">' + (g ? g.emoji : '🎲') + '</span>' +
          '<span class="st-r-juego">' + (g ? g.name : e.game) +
            (e.detail ? '<em>' + escapar(e.detail) + '</em>' : '') + '</span>' +
          '<span class="st-r-ap">−' + MC.fmt(e.staked) + '</span>' +
          '<span class="st-r-net" style="color:' + (pos ? 'var(--green)' : 'var(--red)') + '">' +
            (pos ? '+' : '') + MC.fmt(e.net) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function escapar(t) {
    return String(t || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function enganchar() {
    var ir = document.getElementById('stVacioJugar');
    if (ir) ir.onclick = function () { MC.sound.click(); MC.showView('lobby'); };

    document.querySelectorAll('#statsBody .ag-per').forEach(function (b) {
      b.onclick = function () { periodo = b.dataset.per; MC.sound.click(); render(); };
    });
  }

  function open() { MC.showView('stats'); render(); }

  function init() { MC.onEnter('stats', render); }

  // Se exportan para que Misiones y el Ranking usen la MISMA pieza. Tres
  // estados vacios dibujados por separado se separan al primer retoque.
  return { init: init, open: open, render: render, vacio: vacio, ICO: ICO };
})();
