/* ============================================================
   UI / TORNEO — la pantalla de El Golpe de la Semana.

   Tres bloques, en el orden en que importan:

     1. TU GOLPE. El multiplicador más alto que sacaste esta semana,
        grande, con la próxima marca y cuánto falta. Es lo primero
        porque es lo único que depende de vos.
     2. LAS MARCAS. Qué paga cada una y cuáles ya cobraste.
     3. LA TABLA. Quiénes más jugaron esta semana, ordenados por su
        mejor golpe. Es la competencia.

   ---------------------------------------------------------------
   POR QUÉ LA TABLA SE ORDENA EN EL NAVEGADOR
   ---------------------------------------------------------------
   La tabla de posiciones ordena `apostado` en el SERVIDOR, y está
   bien: es un total de toda la vida y crece siempre, así que
   Firestore puede indexarlo.

   Acá no. El dato de la semana viaja adentro del mismo documento
   `leaderboard/{uid}` que ya existía —así no hubo que tocar las
   reglas de Firestore ni crear una colección nueva— pero eso deja
   el multiplicador semanal como un campo más, sin índice propio. Se
   traen las filas y se ordenan acá.

   Aguanta hasta unos cientos de jugadores. Pasado eso hay que darle
   su propia colección con su índice, y ahí sí hay que volver a la
   consola de Firebase. Está escrito para que el día que pase se
   sepa qué hay que hacer y por qué.

   Depende de: torneo, ranking (publica la fila), estadisticas.
   ============================================================ */
window.MCTorneo_UI = (function () {
  'use strict';

  var TOPE = 50;
  var filas = null;
  var error = '';
  var cargando = false;
  var reloj = 0;

  var ICO_COPA =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/>' +
    '<path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.5M17 6h2.5A2.5 2.5 0 0 1 17 8.5"/>' +
    '<path d="M12 14v3M9 20h6"/></svg>';

  var ICO_COMPARTIR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '  +
    'stroke-linecap="round" stroke-linejoin="round" class="tor-ico">' +
    '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/>' +
    '<circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg>';

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * El multiplicador, con la precisión que el número merece y NI UN
   * DECIMAL DE MÁS.
   *
   * Las marcas son ×25, ×100 y ×300: números redondos, elegidos para que
   * se digan en voz alta. Escritos "×25.0" dejan de parecer una meta y
   * empiezan a parecer una medición.
   */
  function equis(x) {
    if (!x) return '—';
    var v = x >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
    return '×' + (v % 1 === 0 ? v : v.toFixed(1));
  }

  /* ---------------- cargar ---------------- */
  function cargar(cb) {
    if (cargando) return;
    var api = MC.auth.rankingApi && MC.auth.rankingApi();
    if (!api) { error = 'sin-conexion'; if (cb) cb(); return; }
    cargando = true;
    api.leer(TOPE).then(function (res) {
      var sem = MCTorneo.semanaActual();
      /* Solo los de ESTA semana. Una fila cuyo `sem` es de la semana
         pasada es de alguien que todavía no volvió a jugar: su golpe
         viejo no compite contra los de ahora. */
      filas = res
        .filter(function (f) { return f.sem === sem && (f.golpe || 0) > 0; })
        .sort(function (a, b) { return (b.golpe || 0) - (a.golpe || 0); });
      error = '';
    }).catch(function (e) {
      error = e.code || e.message || 'error';
    }).then(function () {
      cargando = false;
      if (cb) cb();
    });
  }

  /* ---------------- bloques ---------------- */

  function bloqueMio() {
    var t = MCTorneo.mio();
    var prox = MCTorneo.proximaMarca();
    var alc = MCTorneo.marcaAlcanzada();
    var porCobrar = MCTorneo.porCobrar();
    var total = 0;
    porCobrar.forEach(function (m) { total += m.premio; });

    // Cuánto del camino a la próxima marca lleva recorrido.
    var pisoAnterior = 0;
    MCTorneo.MARCAS.forEach(function (m) {
      if (prox && m.x < prox.x && t.golpe >= m.x) pisoAnterior = m.x;
    });
    var pct = prox
      ? Math.max(0, Math.min(100, ((t.golpe - pisoAnterior) / (prox.x - pisoAnterior)) * 100))
      : 100;

    return '' +
      '<div class="tor-mio">' +
        '<div class="tor-golpe">' +
          '<span class="tor-golpe-lab">Tu mejor golpe de la semana</span>' +
          '<strong class="tor-golpe-val' + (t.golpe ? '' : ' vacio') + '">' +
            equis(t.golpe) + '</strong>' +
          '<span class="tor-golpe-sub">' +
            (t.rondas
              ? MC.fmt(t.rondas) + (t.rondas === 1 ? ' ronda · ' : ' rondas · ') +
                MC.fmt(t.apostado) + ' apostadas'
              : 'todavía no jugaste esta semana') +
          '</span>' +
        '</div>' +
        '<div class="tor-prox">' +
          (prox
            ? '<span class="tor-prox-lab">Próxima marca: <strong>' + prox.nombre +
                ' ' + equis(prox.x) + '</strong> — paga ' + MC.fmt(prox.premio) + '</span>' +
              '<div class="tor-barra"><i style="width:' + pct.toFixed(1) + '%"></i></div>'
            : '<span class="tor-prox-lab tor-todo">Alcanzaste las tres marcas de la semana.</span>') +
        '</div>' +
        '<div class="tor-acciones">' +
          (total > 0
            ? '<button class="btn btn-gold tor-cobrar" id="torCobrar">' +
                'Cobrar ' + MC.fmt(total) + ' fichas</button>'
            : (alc
                ? '<span class="tor-cobrado">✓ ' + alc.nombre + ' ' + equis(alc.x) + ' cobrado</span>'
                : '')) +
          /* Compartir aparece en cuanto hay UN golpe, por chico que sea.
             Atarlo a una marca sería perder justo al que recién empieza,
             que es el que más ganas tiene de mostrar algo. */
          (t.golpe > 0
            ? '<button class="btn btn-ghost tor-compartir" id="torCompartir">' +
                ICO_COMPARTIR + 'Compartir</button>'
            : '') +
        '</div>' +
      '</div>';
  }

  function bloqueMarcas() {
    var t = MCTorneo.mio();
    return '<div class="tor-marcas">' +
      MCTorneo.MARCAS.map(function (m) {
        var logrado = t.golpe >= m.x;
        var cobrado = t.cobradas.indexOf(m.x) > -1;
        return '<div class="tor-marca' + (logrado ? ' ok' : '') + '">' +
          '<span class="tor-marca-x">' + equis(m.x) + '</span>' +
          '<span class="tor-marca-n">' + m.nombre + '</span>' +
          '<span class="tor-marca-p">' + MC.fmt(m.premio) + '</span>' +
          (cobrado ? '<span class="tor-marca-ok">cobrado</span>' : '') +
        '</div>';
      }).join('') +
    '</div>';
  }

  function filaTabla(f, i, esMia) {
    var pos = i + 1;
    var medalla = pos === 1 ? 'oro' : pos === 2 ? 'plata' : pos === 3 ? 'bronce' : '';
    return '<div class="tor-row' + (esMia ? ' mia' : '') + '">' +
      '<span class="tor-pos ' + medalla + '">' + pos + '</span>' +
      '<span class="tor-jug">' +
        (f.foto ? '<img src="' + escapar(f.foto) + '" alt="" referrerpolicy="no-referrer">' : '<i></i>') +
        escapar(f.nombre || 'Jugador') +
      '</span>' +
      '<span class="tor-x">' + equis(f.golpe) + '</span>' +
      '<span class="tor-ap">' + MC.fmt(f.semApostado || 0) + '</span>' +
    '</div>';
  }

  /* ---------------- dibujo ---------------- */
  function render() {
    var cont = document.getElementById('torneoBody');
    if (!cont) return;
    var u = MC.auth.current();

    var cabecera =
      '<div class="tor-head">' +
        '<div>' +
          '<span class="tor-kicker">Torneo semanal</span>' +
          '<h3>El Golpe de la Semana</h3>' +
          '<p>Gana el multiplicador más alto de UNA ronda. No importa cuánto apostás: ' +
          'importa cuánto lo multiplicaste.</p>' +
        '</div>' +
        '<div class="tor-reloj">' +
          '<span>cierra en</span><strong>' + MCTorneo.faltan() + '</strong>' +
        '</div>' +
      '</div>';

    var mio = bloqueMio() + bloqueMarcas();

    var tabla;
    if (filas === null && !error) {
      tabla = '<div class="tor-tabla-wrap">' +
        MCEstadisticas.vacio(ICO_COPA, 'Cargando la tabla…', '') + '</div>';
      cont.innerHTML = cabecera + mio + tabla;
      enganchar();
      cargar(render);
      return;
    }

    if (error) {
      var esPermiso = /permission/i.test(error);
      tabla = MCEstadisticas.vacio(
        ICO_COPA,
        esPermiso ? 'Falta publicar las reglas' : 'No se pudo cargar la tabla',
        esPermiso
          ? 'La tabla lee la colección pública de Firestore y todavía no tiene permiso.'
          : (error === 'sin-conexion'
              ? 'Necesitás conexión y una cuenta de Google para ver quién más está jugando. ' +
                'Tu golpe y tus marcas se cuentan igual: son tuyos y viven en este dispositivo.'
              : 'Firestore devolvió: ' + escapar(error)),
        '<button class="btn btn-ghost" id="torRefrescar">Reintentar</button>',
      );
    } else if (!filas.length) {
      tabla = MCEstadisticas.vacio(
        ICO_COPA,
        'Nadie marcó todavía esta semana',
        'La tabla arranca vacía cada lunes. Pegá un golpe y sos el primero.',
        '<button class="btn btn-gold" id="torJugar">Jugar una ronda</button>',
      );
    } else {
      var miId = u && u.uid ? u.uid.replace('google:', '') : '';
      tabla =
        '<div class="tor-tabla">' +
          '<div class="tor-row tor-th">' +
            '<span>#</span><span>Jugador</span><span>Mejor golpe</span><span>Apostado</span>' +
          '</div>' +
          filas.map(function (f, i) { return filaTabla(f, i, f.id === miId); }).join('') +
        '</div>' +
        '<p class="tor-nota">Se resetea todos los lunes a las 00:00. Solo aparecen las ' +
        'cuentas de Google: las fichas de invitado viven en un solo navegador.</p>';
    }

    cont.innerHTML = cabecera + mio + '<div class="tor-tabla-wrap">' + tabla + '</div>';
    enganchar();
  }

  function enganchar() {
    var c = document.getElementById('torCobrar');
    if (c) c.onclick = function () {
      var fichas = MCTorneo.cobrar();
      if (fichas > 0) {
        MC.sound.win();
        MC.toast('¡Cobraste ' + MC.fmt(fichas) + ' fichas del torneo!', 'win');
      }
      render();
    };
    var s = document.getElementById('torCompartir');
    if (s) s.onclick = async function () {
      s.disabled = true;
      var antes = s.innerHTML;
      s.textContent = 'Preparando…';
      try {
        var como = await MCCompartir.compartir();
        /* Se dice QUÉ pasó y no un "listo" genérico: en escritorio la
           imagen se baja y el texto va al portapapeles, y si nadie lo
           avisa el jugador cree que no funcionó. */
        if (como === 'copiado') MC.toast('Mensaje copiado y tarjeta descargada', 'win');
        else if (como === 'bajado') MC.toast('Tarjeta descargada', 'win');
        else if (como === 'imagen' || como === 'texto') MC.toast('¡Compartido!', 'win');
      } catch (e) {
        MC.toast('No se pudo compartir', 'lose');
      }
      s.disabled = false;
      s.innerHTML = antes;
    };

    var r = document.getElementById('torRefrescar');
    if (r) r.onclick = function () { filas = null; error = ''; MC.sound.click(); render(); };
    var j = document.getElementById('torJugar');
    if (j) j.onclick = function () { MC.showView('lobby'); };
  }

  function init() {
    MC.onEnter('torneo', function () {
      filas = null;
      error = '';
      render();
      /* El reloj de cierre se repinta solo. Sin esto, alguien que deja
         la pantalla abierta ve "cierra en 3d 5h" durante horas y el
         número se vuelve mentira. */
      clearInterval(reloj);
      reloj = setInterval(function () {
        var e = document.querySelector('#torneoBody .tor-reloj strong');
        if (e) e.textContent = MCTorneo.faltan();
      }, 30000);
    });
    MC.onLeave('torneo', function () { clearInterval(reloj); });

    var b = document.getElementById('sbTorneo');
    if (b) b.onclick = function () { MC.sound.click(); MC.showView('torneo'); };
  }

  return { init: init, render: render };
})();
