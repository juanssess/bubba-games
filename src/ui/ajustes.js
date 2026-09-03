/* ============================================================
   UI / AJUSTES

   Tres bloques, en orden de importancia real:

     1. Juego responsable. Va primero a propósito. Un casino que
        esconde los límites abajo de todo está diciendo algo, y no
        es algo bueno. Acá son fichas virtuales, pero la costumbre
        de tenerlos a mano se practica igual.
     2. Experiencia: sonido, animaciones, confirmaciones.
     3. Datos: exportar, importar y borrar. Tu progreso es tuyo y
        te lo tenés que poder llevar.

   Los ajustes viven en MC.state.ajustes, así que viajan con el
   perfil y se sincronizan con la nube como todo lo demás.

   Depende de: state, wallet, ui, format.
   ============================================================ */
window.MCAjustes = (function () {
  'use strict';

  var POR_DEFECTO = {
    sonido: true,
    animaciones: true,
    confirmarApuestaAlta: true,
    limiteApuesta: 0,        // 0 = sin límite
    recordatorioMin: 0       // 0 = sin recordatorio
  };

  var arranqueSesion = Date.now();
  var timerRecordatorio = null;

  /* ---------------- lectura y escritura ---------------- */
  function todos() {
    if (!MC.state.ajustes) MC.state.ajustes = {};
    var a = {};
    Object.keys(POR_DEFECTO).forEach(function (k) {
      a[k] = MC.state.ajustes[k] === undefined ? POR_DEFECTO[k] : MC.state.ajustes[k];
    });
    return a;
  }

  function get(k) { return todos()[k]; }

  function set(k, v) {
    if (!MC.state.ajustes) MC.state.ajustes = {};
    MC.state.ajustes[k] = v;
    MC.save();
    aplicar();
  }

  /** Lleva los ajustes al resto del casino. */
  function aplicar() {
    var a = todos();

    // El sonido ya tenía su propio interruptor: se mantiene en sincronía
    // para no terminar con dos verdades sobre lo mismo.
    MC.state.soundOn = a.sonido;

    document.body.classList.toggle('sin-animaciones', !a.animaciones);
    programarRecordatorio(a.recordatorioMin);
  }

  /* ---------------- juego responsable ---------------- */

  /**
   * ¿Se puede apostar este monto? La billetera lo consulta antes de cobrar.
   * Devuelve null si está permitido, o el texto del motivo si no.
   */
  function bloqueaApuesta(monto) {
    var lim = get('limiteApuesta');
    if (lim > 0 && monto > lim) {
      return 'Tu límite por ronda es de ' + MC.fmt(lim) + ' fichas';
    }
    return null;
  }

  function programarRecordatorio(min) {
    clearInterval(timerRecordatorio);
    if (!min) return;
    timerRecordatorio = setInterval(function () {
      var mins = Math.round((Date.now() - arranqueSesion) / 60000);
      MC.modal('Pasó un rato',
        '<p>Llevás <strong>' + mins + ' minutos</strong> jugando en esta sesión.</p>' +
        '<p>Son fichas virtuales y no se pierde nada real, pero está bueno ' +
        'saber cuánto tiempo se va.</p>',
        [{ label: 'Sigo jugando', kind: 'primary' }]);
    }, min * 60000);
  }

  /* ---------------- datos ---------------- */
  function exportar() {
    var datos = JSON.stringify(MC.state, null, 2);
    var blob = new Blob([datos], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bubba-' + (MC.auth.current().name || 'perfil').toLowerCase() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    MC.toast('Progreso descargado', 'win');
  }

  function importar() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var lector = new FileReader();
      lector.onload = function () {
        // Se confirma antes de pisar: importar es destructivo y no hay
        // deshacer. Mejor una pregunta de más que un progreso perdido.
        MC.modal('¿Importar este progreso?',
          '<p>Se reemplaza todo lo que tenés en este perfil por lo del archivo.</p>' +
          '<p style="color:var(--red)">Esto no se puede deshacer.</p>',
          [
            { label: 'Cancelar' },
            {
              label: 'Importar',
              kind: 'primary',
              onClick: function () {
                if (MC.aplicarEstado(String(lector.result))) {
                  MC.toast('Progreso importado', 'win');
                  render();
                } else {
                  MC.toast('El archivo no es un progreso válido', 'lose');
                }
              }
            }
          ]);
      };
      lector.readAsText(f);
    };
    input.click();
  }

  /* ---------------- dibujo ---------------- */
  function render() {
    var cont = document.getElementById('ajustesBody');
    if (!cont) return;
    var a = todos();

    cont.innerHTML =
      bloque('Juego responsable',
        'Acá son fichas virtuales, pero los límites existen igual: la costumbre de tenerlos a mano se practica.',
        interruptor('confirmarApuestaAlta', 'Avisarme antes de una apuesta grande',
          'Pregunta antes de arriesgar más del 25% de tu saldo.', a.confirmarApuestaAlta) +
        selector('limiteApuesta', 'Límite por ronda',
          'La apuesta más alta que te vas a permitir.',
          [[0, 'Sin límite'], [500, '500 fichas'], [1000, '1.000'], [5000, '5.000'], [25000, '25.000']],
          a.limiteApuesta) +
        selector('recordatorioMin', 'Recordarme el tiempo jugado',
          'Un aviso cada tanto con los minutos de la sesión.',
          [[0, 'Nunca'], [15, 'Cada 15 min'], [30, 'Cada 30 min'], [60, 'Cada hora']],
          a.recordatorioMin)
      ) +

      bloque('Experiencia', '',
        interruptor('sonido', 'Sonido', 'Efectos de las mesas y los juegos.', a.sonido) +
        interruptor('animaciones', 'Animaciones', 'Apagalas si el casino te va lento o te marean.', a.animaciones)
      ) +

      bloque('Tus datos',
        'Tu progreso es tuyo. Te lo podés llevar cuando quieras.',
        '<div class="aj-acciones">' +
          '<button class="btn btn-ghost" id="ajExport">Descargar progreso</button>' +
          '<button class="btn btn-ghost" id="ajImport">Importar progreso</button>' +
          '<button class="btn btn-accent" id="ajReset">Reiniciar cuenta</button>' +
        '</div>' +
        '<p class="aj-hint">El archivo descargado es un JSON con tu saldo, ' +
        'estadísticas e historial. Sirve de respaldo y para pasarte a otro navegador.</p>'
      ) +

      bloque('Sobre Bubba', '',
        '<div class="aj-info">' +
          filaInfo('Juegos disponibles', MC.fmt(MCCatalog.size)) +
          filaInfo('Progreso', textoNube()) +
          filaInfo('Perfil', MC.auth.current().name +
            (MC.auth.current().provider === 'google' ? ' · Google' : ' · local')) +
        '</div>' +
        '<p class="aj-hint">Casino de práctica con fichas virtuales. No se apuesta ' +
        'ni se gana dinero real. Solo para mayores de 18 años.</p>'
      );

    enganchar();
  }

  function textoNube() {
    var e = MC.auth.estadoNube();
    if (e === 'ok') return 'Guardado en la nube';
    if (e === 'pendiente') return 'Sincronizando…';
    if (e === 'error') return 'Sólo local (falló la nube)';
    return 'Sólo en este navegador';
  }

  function bloque(titulo, sub, contenido) {
    return '<section class="aj-bloque">' +
      '<h3>' + titulo + '</h3>' +
      (sub ? '<p class="aj-sub">' + sub + '</p>' : '') +
      contenido +
      '</section>';
  }

  function interruptor(clave, titulo, sub, valor) {
    return '<label class="aj-fila">' +
      '<span class="aj-txt"><strong>' + titulo + '</strong><em>' + sub + '</em></span>' +
      '<input type="checkbox" class="aj-check" data-k="' + clave + '"' +
        (valor ? ' checked' : '') + '>' +
      '<span class="aj-switch"></span>' +
      '</label>';
  }

  function selector(clave, titulo, sub, opciones, valor) {
    return '<label class="aj-fila">' +
      '<span class="aj-txt"><strong>' + titulo + '</strong><em>' + sub + '</em></span>' +
      '<select class="filter-input aj-select" data-k="' + clave + '">' +
        opciones.map(function (o) {
          return '<option value="' + o[0] + '"' +
            (Number(valor) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') +
      '</select>' +
      '</label>';
  }

  function filaInfo(k, v) {
    return '<div class="aj-info-row"><span>' + k + '</span><strong>' + v + '</strong></div>';
  }

  function enganchar() {
    document.querySelectorAll('.aj-check').forEach(function (c) {
      c.onchange = function () { set(c.dataset.k, c.checked); MC.sound.click(); };
    });
    document.querySelectorAll('.aj-select').forEach(function (s) {
      s.onchange = function () { set(s.dataset.k, Number(s.value)); MC.sound.click(); };
    });
    var ex = document.getElementById('ajExport');
    if (ex) ex.onclick = exportar;
    var im = document.getElementById('ajImport');
    if (im) im.onclick = importar;
    var rs = document.getElementById('ajReset');
    if (rs) rs.onclick = function () {
      MC.modal('¿Reiniciar todo?',
        '<p>Volvés a ' + MC.fmt(MC.STARTING_CHIPS) + ' fichas y se borran ' +
        'estadísticas, historial y misiones.</p>' +
        '<p style="color:var(--red)">Esto no se puede deshacer.</p>',
        [
          { label: 'Cancelar' },
          { label: 'Sí, reiniciar', kind: 'primary', onClick: function () {
            MC.resetProgress();
            render();
          } }
        ]);
    };
  }

  function open() {
    MC.showView('ajustes');
    render();
  }

  function init() {
    aplicar();
    MC.onEnter('ajustes', render);
  }

  return {
    init: init, open: open, render: render,
    get: get, set: set, bloqueaApuesta: bloqueaApuesta
  };
})();
