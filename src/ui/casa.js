/* ============================================================
   UI / PANEL DE LA CASA — cuánto paga cada mesa.

   Es la pantalla que configura MC.rtp. No tiene matemática propia:
   todo lo que hace es leer y escribir el factor de cada juego y
   mostrar qué resultado tiene. La matemática está en core/rtp.js y
   en cada motor.

   ---------------------------------------------------------------
   POR QUÉ EL DESLIZADOR DICE "RTP" Y NO "FACTOR"
   ---------------------------------------------------------------
   Internamente lo que se guarda es un factor (0,50 a 1,00), porque
   es lo que se multiplica. Pero nadie piensa en factores: uno quiere
   que Bubba Gold pague el 90%. Así que el control de cada juego se
   mueve en puntos de RTP y la conversión a factor se hace acá, en un
   solo lugar. El control global sí va en factor, porque abarca mesas
   con RTP de fábrica distintos y no habría un número común.

   ---------------------------------------------------------------
   ESTE PANEL NO ES UNA BARRERA DE SEGURIDAD
   ---------------------------------------------------------------
   Está del lado del agente porque decidir el margen es trabajo de
   la casa, no del que apuesta. Pero igual que el rol, vive en el
   almacenamiento de este navegador: quien abra las herramientas de
   desarrollo puede cambiarlo. Separa dos usos, no los blinda. Ver el
   encabezado de core/roles.js, que explica por qué no puede ser otra
   cosa mientras el casino corra entero en la máquina del jugador.

   Depende de: MC.rtp, MCCatalog, MC (router, ui).
   ============================================================ */
window.MCCasa = (function () {
  'use strict';

  /* Cómo baja el retorno cada motor. No es decoración: es lo que
     permite entender por qué la pantalla del juego acompaña el cambio
     en vez de quedar mintiendo. Cada texto apunta al número concreto
     que el factor multiplica. */
  var MECANISMO = {
    crash:     'mueve el punto de reventón (0,97/(1−r)): el multiplicador que se ve es el que se cobra',
    mines:     'mueve la constante de ventaja, que es el RTP de este juego para cualquier estrategia',
    slots777:  'escala la tabla de pagos; la tabla en pantalla sale del mismo número',
    slots5:    'escala la tabla de pagos en slots5-math, el mismo módulo que mide la herramienta',
    plantilla: 'baja el 1,95 del acierto, y el cartel de la mesa lo dice',
    sports:    'cotiza más bajo, como lo haría un corredor de apuestas',
    roulette:  'baja el 36 del que se deriva todo pago, así las trece apuestas siguen teniendo el mismo margen',
    blackjack: 'escala la ganancia y deja el empate intacto'
  };

  /* Blackjack es el único donde el factor no da el RTP exacto, y el
     motivo está explicado en su propio archivo: el empate devuelve la
     apuesta y no es un premio, así que no se escala. Eso deja el
     retorno real un poco por encima del objetivo. */
  var APROXIMADO = { blackjack: true };

  var PRESETS = [100, 97, 95, 92, 90, 85];

  /* ---------------- helpers ---------------- */
  function jugablesAlcanzables() {
    return MCCatalog.all.filter(function (g) {
      return g.rtpValue > 0 && !MC.rtp.fueraDeAlcance(g.id);
    });
  }

  function fueraDeAlcance() {
    return MCCatalog.all.filter(function (g) {
      return MC.rtp.fueraDeAlcance(g.id);
    });
  }

  function pct1(x) { return (x * 100).toFixed(1).replace('.', ','); }

  /* ---------------- pintado ---------------- */
  function render() {
    var cont = document.getElementById('casaBody');
    if (!cont) return;

    var juegos = jugablesAlcanzables();
    var afuera = fueraDeAlcance();
    var gl = MC.rtp.global();

    cont.innerHTML =
      intro() +
      bloqueGlobal(gl) +
      '<div class="casa-lista">' + juegos.map(fila).join('') + '</div>' +
      bloqueAfuera(afuera) +
      bloquePie();

    enganchar();
  }

  function intro() {
    var hay = MC.rtp.hayAjustes();
    var local = MC.rtp.hayLocal();

    return '<div class="casa-intro' + (hay ? ' activo' : '') + '">' +
      '<h3>Cuánto paga cada mesa</h3>' +
      '<p>Bajar el retorno no recorta el premio al final: mueve el número con el ' +
      'que cada juego expresa su ventaja —una constante, una tabla, una cuota— ' +
      '<strong>antes</strong> de que llegue a la pantalla. Por eso la tabla de pagos, ' +
      'los multiplicadores y las cuotas se corrigen solos: lo que se ve es lo que se cobra.</p>' +
      (hay
        ? '<p class="casa-aviso">Hay mesas con el retorno bajado. Las tarjetas del salón ' +
          'muestran el RTP nuevo, no el de fábrica.</p>'
        : '<p class="casa-aviso">Ahora mismo todas las mesas pagan el RTP con el que ' +
          'fueron diseñadas.</p>') +
      '</div>' +

      /* Esto es lo que más se presta a malentendido, así que va arriba
         de todo y con el estado concreto en vez de una explicación
         general: mover una perilla acá no le cambia el retorno a nadie
         más. Sólo publicar lo hace. */
      '<div class="casa-capas' + (local ? ' pisando' : '') + '">' +
        '<div class="cc-fila">' +
          '<span class="cc-ico">🌐</span>' +
          '<div><strong>Lo que ve todo el mundo</strong>' +
          '<span>Viaja en el código, en <code>PUBLICADO</code> de ' +
          '<code>src/core/rtp.js</code>. ' +
          (MC.rtp.hayPublicado()
            ? 'Hoy la casa publica un recorte.'
            : 'Hoy la casa no publica ningún recorte: todos ven el RTP de fábrica.') +
          '</span></div>' +
        '</div>' +
        '<div class="cc-fila">' +
          '<span class="cc-ico">💻</span>' +
          '<div><strong>Lo que ves vos, en esta compu</strong>' +
          '<span>' + (local
            ? 'Estás pisando lo publicado desde este navegador. <strong>Nadie más lo ve.</strong>'
            : 'No estás pisando nada: ves lo mismo que todos.') +
          '</span></div>' +
        '</div>' +
        (local
          ? '<button class="btn btn-gold" id="casaPublicar">Publicar esto para todos</button>'
          : '') +
      '</div>';
  }

  function bloqueGlobal(gl) {
    return '<div class="casa-global">' +
      '<div class="cg-head">' +
        '<div><strong>Todas las mesas</strong>' +
        '<span>Paga el <b id="casaGlobalVal">' + Math.round(gl * 100) + '%</b> de lo que ' +
        'cada juego paga de fábrica. Un juego con ajuste propio no sigue a este control.</span></div>' +
        (MC.state.rtp && MC.state.rtp.global !== undefined
          ? '<button class="cf-soltar" id="casaSoltarGlobal">volver a lo publicado</button>'
          : '') +
      '</div>' +
      '<input type="range" id="casaGlobal" class="casa-range" min="' +
        Math.round(MC.rtp.MIN * 100) + '" max="100" step="1" value="' +
        Math.round(gl * 100) + '">' +
      '<div class="casa-presets">' +
        PRESETS.map(function (v) {
          return '<button data-preset="' + v + '"' +
                 (Math.round(gl * 100) === v ? ' class="on"' : '') + '>' + v + '%</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function fila(g) {
    var nominal = g.rtpValue;
    var efectivo = MC.rtp.efectivo(g.id);
    var propio = MC.state.rtp && MC.state.rtp.juegos[g.id] !== undefined;
    var tocado = MC.rtp.ajustado(g.id);

    // El deslizador se mueve en puntos de RTP, de MIN·nominal al nominal.
    var min = (nominal * MC.rtp.MIN * 100).toFixed(1);
    var max = (nominal * 100).toFixed(1);

    return '<div class="casa-fila' + (tocado ? ' tocado' : '') + '" data-game="' + g.id + '">' +
      '<div class="cf-top">' +
        '<span class="cf-emoji">' + g.emoji + '</span>' +
        '<div class="cf-id">' +
          '<strong>' + g.name + '</strong>' +
          '<span>' + (MECANISMO[g.id] || 'escala sus pagos') + '</span>' +
        '</div>' +
        '<div class="cf-nums">' +
          '<span class="cf-fab">de fábrica ' + pct1(nominal) + '%</span>' +
          '<strong class="cf-hoy">' + (APROXIMADO[g.id] && tocado ? '≈ ' : '') +
            pct1(efectivo) + '%</strong>' +
          '<span class="cf-margen">ventaja ' + pct1(1 - efectivo) + '%</span>' +
        '</div>' +
      '</div>' +
      '<div class="cf-ctrl">' +
        '<input type="range" class="casa-range cf-range" data-game="' + g.id + '" ' +
          'min="' + min + '" max="' + max + '" step="0.1" value="' + (efectivo * 100).toFixed(1) + '">' +
        (propio
          ? '<button class="cf-soltar" data-soltar="' + g.id + '">seguir al global</button>'
          : '<span class="cf-sigue">' +
            (MC.rtp.hayLocal() ? 'sigue al global' : 'como se publica') + '</span>') +
        (MC.rtp.pisado(g.id)
          ? '<span class="cf-pisado" title="Publicado: ' +
            pct1(g.rtpValue * MC.rtp.factorPublicado(g.id)) + '%">sólo en esta compu</span>'
          : '') +
      '</div>' +
      (APROXIMADO[g.id] && tocado
        ? '<p class="cf-nota">El empate devuelve la apuesta y no se escala, así que esta ' +
          'mesa paga un poco <strong>más</strong> que el objetivo. Por eso el número va con ≈.</p>'
        : '') +
    '</div>';
  }

  function bloqueAfuera(afuera) {
    if (!afuera.length) return '';
    return '<div class="casa-afuera">' +
      '<h4>Fuera de alcance</h4>' +
      '<p>Estas tragamonedas corren en un iframe con su propia matemática, servida ' +
      'desde <code>games/slots/</code>. Este panel no las toca: su RTP se cambia en ' +
      'ese proyecto. Se listan igual para que no parezca que el panel las cubre.</p>' +
      '<div class="ca-chips">' +
        afuera.map(function (g) {
          return '<span><b>' + g.emoji + ' ' + g.name + '</b> ' + pct1(g.rtpValue) + '%</span>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function bloquePie() {
    var juegos = jugablesAlcanzables();
    var sumaNom = 0, sumaEf = 0;
    juegos.forEach(function (g) {
      sumaNom += g.rtpValue;
      sumaEf += MC.rtp.efectivo(g.id);
    });
    var n = juegos.length || 1;

    return '<div class="casa-pie">' +
      '<div class="cp-dato"><span>Retorno medio de fábrica</span><strong>' +
        pct1(sumaNom / n) + '%</strong></div>' +
      '<div class="cp-dato"><span>Retorno medio de hoy</span><strong>' +
        pct1(sumaEf / n) + '%</strong></div>' +
      '<div class="cp-dato"><span>Ventaja media de la casa</span><strong>' +
        pct1(1 - sumaEf / n) + '%</strong></div>' +
      '<button class="btn btn-ghost" id="casaReset">Borrar lo de este navegador</button>' +
      '<p class="cp-nota">Estos promedios son por mesa, no ponderados por lo que se ' +
      'apuesta en cada una: sirven para ver el conjunto, no para proyectar la caja.</p>' +
    '</div>';
  }

  /* ---------------- interacción ---------------- */
  function enganchar() {
    var gl = document.getElementById('casaGlobal');
    if (gl) {
      // `input` pinta mientras se arrastra; `change` guarda al soltar.
      gl.oninput = function () {
        document.getElementById('casaGlobalVal').textContent = gl.value + '%';
      };
      gl.onchange = function () {
        MC.rtp.setGlobal(Number(gl.value) / 100);
        aplicado();
      };
    }

    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.onclick = function () {
        MC.rtp.setGlobal(Number(b.dataset.preset) / 100);
        MC.sound.click();
        aplicado();
      };
    });

    document.querySelectorAll('.cf-range').forEach(function (r) {
      var fila = r.closest('.casa-fila');
      var hoy = fila.querySelector('.cf-hoy');
      var margen = fila.querySelector('.cf-margen');

      r.oninput = function () {
        var objetivo = Number(r.value) / 100;
        hoy.textContent = (APROXIMADO[r.dataset.game] ? '≈ ' : '') +
                          pct1(objetivo) + '%';
        margen.textContent = 'ventaja ' + pct1(1 - objetivo) + '%';
      };
      r.onchange = function () {
        /* De puntos de RTP a factor. El nominal se lee de nuevo acá y no
           se guarda en el HTML: así el panel sigue siendo correcto si
           mañana se retoca la tabla de pagos de un juego. */
        var nominal = MC.rtp.nominal(r.dataset.game);
        if (!nominal) return;
        MC.rtp.set(r.dataset.game, (Number(r.value) / 100) / nominal);
        aplicado();
      };
    });

    var sg = document.getElementById('casaSoltarGlobal');
    if (sg) sg.onclick = function () {
      MC.rtp.quitarGlobal();
      MC.sound.click();
      aplicado();
    };

    document.querySelectorAll('[data-soltar]').forEach(function (b) {
      b.onclick = function () {
        MC.rtp.quitar(b.dataset.soltar);
        MC.sound.click();
        aplicado();
      };
    });

    var pub = document.getElementById('casaPublicar');
    if (pub) pub.onclick = publicar;

    var reset = document.getElementById('casaReset');
    if (reset) reset.onclick = function () {
      MC.modal('¿Borrar lo de este navegador?',
        '<p>Se va todo lo que ajustaste en esta compu. Las mesas vuelven a pagar ' +
        '<strong>lo que la casa publica</strong> en el código.</p>' +
        '<p style="font-size:12.5px;color:var(--txt-dim)">No toca saldos ni historial, ' +
        'ni lo publicado: sólo cuánto paga cada juego de acá en adelante, y sólo acá.</p>',
        [
          { label: 'Cancelar' },
          { label: 'Sí, volver', kind: 'primary', onClick: function () {
            MC.rtp.reset();
            aplicado();
            MC.toast('Listo: ves lo mismo que el resto', 'info');
          } }
        ]);
    };
  }

  /* ============================================================
     PUBLICAR

     El panel corre en el navegador: no tiene manos sobre el disco y
     no puede escribir un archivo. Lo único honesto que puede hacer es
     devolver el texto exacto que va en el código, y decir con todas
     las letras qué falta después — porque hasta que no haya push, el
     cambio sigue siendo sólo tuyo.
     ============================================================ */
  function publicar() {
    var codigo = MC.rtp.codigo();
    MC.sound.click();

    /* El botón de copiar va DENTRO del cuerpo y no en las acciones:
       MC.modal cierra el diálogo antes de llamar al onClick de una
       acción, y copiar necesita que el <pre> siga en pantalla para
       poder seleccionarlo si el portapapeles falla. */
    MC.modal('Publicar esto para todos',
      '<p>Pegá esto en <code>src/core/rtp.js</code>, reemplazando el bloque ' +
      '<code>var PUBLICADO = { ... }</code>:</p>' +
      '<pre class="casa-codigo" id="casaCodigo">' + escapar(codigo) + '</pre>' +
      '<button class="btn btn-ghost casa-copiar" id="casaCopiar">Copiar</button>' +
      '<p style="font-size:12.5px;color:var(--txt-dim)">Después <strong>commit y ' +
      'push</strong>. Recién cuando GitHub Pages reconstruya, el retorno nuevo es el ' +
      'de la casa. Hasta entonces sigue siendo sólo el de esta compu.</p>' +
      '<p style="font-size:12.5px;color:var(--txt-dim)">Cuando eso esté publicado, ' +
      'conviene borrar lo de este navegador: si no, seguís viendo lo tuyo encima y no ' +
      'lo que ve el resto.</p>',
      [{ label: 'Listo' }]);

    var btn = document.getElementById('casaCopiar');
    if (btn) btn.onclick = function () { copiar(codigo); };
  }

  function escapar(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function copiar(texto) {
    /* El portapapeles moderno falla sin https y sin permiso, así que
       si no anda se deja el texto seleccionado: copiar a mano con
       Ctrl+C siempre funciona, y es mejor que un botón que no hace
       nada sin decir por qué. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        MC.toast('Copiado. Pegalo en src/core/rtp.js', 'win');
      }, seleccionar);
    } else {
      seleccionar();
    }
  }

  function seleccionar() {
    var pre = document.getElementById('casaCodigo');
    if (!pre) return;
    var rango = document.createRange();
    rango.selectNodeContents(pre);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(rango);
    MC.toast('No pude copiar solo: te lo dejé seleccionado, Ctrl+C', 'info');
  }

  /* Después de cada cambio: repintar el panel y corregir las etiquetas
     del salón. Se actualizan sólo los carteles de RTP en vez de
     reconstruir los rieles: reconstruirlos volvería a montar el arte y
     los manejadores de click de cada tarjeta para cambiar un texto. */
  function aplicado() {
    render();
    refrescarVitrina();
  }

  function refrescarVitrina() {
    document.querySelectorAll('.gcard[data-game]').forEach(function (card) {
      var g = MC.getGame(card.dataset.game);
      var live = card.querySelector('.gcard-live');
      if (!g || !live) return;
      live.textContent = MC.rtp.etiqueta(g);
      live.classList.toggle('ajustado', MC.rtp.ajustado(g.id));
    });
  }

  /* ---------------- ciclo de vida ---------------- */
  // El render lo dispara el router al entrar (ver onEnter), así que acá
  // no se pinta dos veces.
  function open() {
    MC.showView('casa');
  }

  function init() {
    var btn = document.getElementById('sbCasa');
    if (btn) btn.onclick = function () { MC.sound.click(); open(); };

    // Si alguien entra por el router (recarga parado en la vista), se pinta.
    MC.onEnter('casa', render);
  }

  return { init: init, open: open, render: render, refrescarVitrina: refrescarVitrina };
})();
