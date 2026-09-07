/* ============================================================
   UI / CAJERO — de dónde salen las fichas.

   Es la pantalla que en un casino de plata real sería el depósito.
   Acá NO se cobra nada ni se piden datos de pago: las fichas son
   virtuales y se consiguen jugando. Lo que se conserva del diseño
   de un cajero de verdad es la claridad — que se vea de un vistazo
   cuánto tenés, cuánto podés conseguir y cuándo.

   Las tres vías son las que ya existían en el casino, juntas y
   explicadas en un solo lugar por primera vez:
     1. el bono recargable (cada 8 h, escalado por rango)
     2. las misiones del día
     3. subir de rango, que agranda el bono para siempre

   Depende de: wallet, levels, missions, ui, format.
   ============================================================ */
window.MCCajero = (function () {
  'use strict';

  var timer = null;

  /* ---------------- datos ---------------- */
  function bonoActual() {
    return Math.round(MC.BONUS_AMOUNT * MCLevels.bonusMultiplier());
  }

  function misionesPendientes() {
    // Se leen por el módulo y no de MC.state: MCMissions.items() regenera
    // las del día si cambió la fecha. Leyendo el estado crudo mostrábamos
    // las de ayer hasta que el jugador abriera la pantalla de misiones.
    var items = (window.MCMissions && MCMissions.items()) || [];
    var falta = 0, premio = 0;
    items.forEach(function (m) {
      if (m.claimed) return;
      falta++;
      // reward es { chips, xp }: acá interesan las fichas.
      premio += (m.reward && m.reward.chips) || 0;
    });
    return { falta: falta, premio: premio, total: items.length };
  }

  /* ---------------- dibujo ---------------- */
  function pintar() {
    var cont = document.getElementById('cajeroBody');
    if (!cont) return;

    var t = MCLevels.current();
    var sig = MCLevels.next();
    var listo = MC.bonusReadyIn() === 0;
    var mis = misionesPendientes();

    cont.innerHTML =
      // ---- el bono de bienvenida manda mientras haya algo que reclamar ----
      (MCBienvenida.hayAlgo() ? MCBienvenida.tarjeta() : '') +

      // ---- pedirle fichas al agente ----
      bloquePedido() +

      // ---- saldo, arriba y grande: es el dato que se viene a ver ----
      '<div class="cj-hero">' +
        '<div class="cj-hero-main">' +
          '<span class="cj-kicker">Tu saldo</span>' +
          '<strong class="cj-balance">' + MC.fmt(MC.getBalance()) + '</strong>' +
          '<span class="cj-unit">fichas virtuales</span>' +
        '</div>' +
        '<div class="cj-hero-rank">' +
          '<span class="cj-rank-ico">' + t.ico + '</span>' +
          '<div>' +
            '<strong>' + t.name + '</strong>' +
            '<span>Bono ×' + t.bonus.toFixed(2).replace('.', ',') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ---- la acción principal ----
      '<div class="cj-claim' + (listo ? ' on' : '') + '">' +
        '<div class="cj-claim-txt">' +
          '<strong>' + MC.fmt(bonoActual()) + ' fichas</strong>' +
          '<span>' + (listo
            ? 'Tu recarga está lista'
            : 'Próxima recarga en ' + MC.humanTime(MC.bonusReadyIn())) + '</span>' +
        '</div>' +
        '<button class="btn btn-gold" id="cjClaim"' + (listo ? '' : ' disabled') + '>' +
          (listo ? 'Recargar fichas' : 'Todavía no') +
        '</button>' +
      '</div>' +

      // ---- la tabla: mismo ritmo que un cajero de verdad ----
      '<div class="cj-table">' +
        '<div class="cj-row cj-head">' +
          '<span>Cómo conseguir fichas</span>' +
          '<span>Cuánto</span>' +
          '<span>Cada cuánto</span>' +
          '<span>Estado</span>' +
        '</div>' +
        filaTabla('Bono recargable', MC.fmt(bonoActual()), 'Cada 8 horas',
          listo ? 'Disponible' : MC.humanTime(MC.bonusReadyIn()), listo) +
        filaTabla('Misiones del día',
          mis.premio ? 'Hasta ' + MC.fmt(mis.premio) : 'Completadas',
          'Se renuevan a medianoche',
          mis.falta ? mis.falta + ' pendientes' : 'Todo hecho', mis.falta > 0) +
        filaTabla('Subir de rango',
          sig ? 'Bono ×' + sig.bonus.toFixed(2).replace('.', ',') : 'Rango máximo',
          'Apostando',
          sig ? 'Faltan ' + MC.fmt(sig.min - (MC.state.xp || 0)) + ' XP' : 'Sos leyenda', !!sig) +
        filaTabla('Ganar jugando', 'Lo que salga', 'En cada ronda', 'Siempre', true) +
      '</div>' +

      // ---- métodos de pago ----
      metodosDePago() +

      // ---- accesos, para que la pantalla no sea un callejón sin salida ----
      '<div class="cj-actions">' +
        '<button class="btn btn-accent" id="cjMissions">Ver misiones</button>' +
        '<button class="btn btn-ghost" id="cjVip">Club VIP</button>' +
        '<button class="btn btn-ghost" id="cjPlay">Ir a jugar</button>' +
      '</div>' +

      // ---- el aviso, sin letra chica ----
      '<div class="cj-note">' +
        '<strong>Esto es un casino de práctica.</strong> Las fichas son virtuales, se ' +
        'consiguen gratis y no tienen ningún valor. Nunca te vamos a pedir datos de una ' +
        'tarjeta ni de una cuenta bancaria: no hay forma de depositar ni de retirar dinero.' +
      '</div>';

    enganchar();
  }

  /**
   * Métodos de pago.
   *
   * Un cajero de verdad tiene esta tabla, así que la tiene. Con una
   * diferencia que NO es un detalle y por eso va arriba y en rojo, no en
   * letra chica al pie: acá no existe ninguno de estos métodos.
   *
   * No hay formulario, no hay dónde escribir un número de tarjeta y no se
   * puede depositar ni retirar. Está para mostrar cómo se ve la pantalla,
   * no para que nadie crea que puede pagar.
   *
   * Esa es la línea: mostrar el diseño, sí; pedir un dato de pago, nunca.
   */
  function metodosDePago() {
    var metodos = [
      ['💳', 'Tarjeta de débito', 'No disponible', '—', '—'],
      ['📱', 'Billetera virtual', 'No disponible', '—', '—'],
      ['🏦', 'Transferencia bancaria', 'No disponible', '—', '—'],
      ['🎟️', 'Tarjeta prepaga', 'No disponible', '—', '—'],
      ['🪙', 'Fichas Bubba', 'Activo', 'Al instante', 'Sin comisión']
    ];

    return '<div class="cj-pagos">' +
      '<div class="cj-pagos-head">' +
        '<h3>Métodos de pago</h3>' +
        '<span class="cj-demo">Demostración</span>' +
      '</div>' +
      '<p class="cj-pagos-sub">Así se ve el cajero de un casino de dinero real. ' +
      'En Bubba <strong>ninguno de estos métodos existe</strong>: no hay formulario, ' +
      'no hay dónde cargar una tarjeta y no se puede depositar ni retirar.</p>' +

      '<div class="cj-table">' +
        '<div class="cj-row cj-head">' +
          '<span>Método</span><span>Estado</span><span>Acreditación</span><span>Comisión</span>' +
        '</div>' +
        metodos.map(function (m) {
          var activo = m[2] === 'Activo';
          return '<div class="cj-row' + (activo ? '' : ' cj-off') + '">' +
            '<span class="cj-name">' + m[0] + ' ' + m[1] + '</span>' +
            '<span class="cj-state' + (activo ? ' on' : '') + '">' + m[2] + '</span>' +
            '<span class="cj-when">' + m[3] + '</span>' +
            '<span class="cj-when">' + m[4] + '</span>' +
            '</div>';
        }).join('') +
      '</div>' +
      '</div>';
  }

  function filaTabla(nombre, cuanto, cadaCuanto, estado, activo) {
    return '<div class="cj-row">' +
      '<span class="cj-name">' + nombre + '</span>' +
      '<span class="cj-mono">' + cuanto + '</span>' +
      '<span class="cj-when">' + cadaCuanto + '</span>' +
      '<span class="cj-state' + (activo ? ' on' : '') + '">' + estado + '</span>' +
      '</div>';
  }

  function enganchar() {
    MCBienvenida.enganchar(pintar);
    var claim = document.getElementById('cjClaim');
    if (claim) claim.onclick = function () {
      MC.claimBonus();
      pintar();
    };
    var pedir = document.getElementById('cjPedir');
    if (pedir) pedir.onclick = abrirPedido;
    var canc = document.getElementById('cjCancelar');
    if (canc) canc.onclick = function () {
      var p = MCPeticiones.miPendiente();
      if (p && MCPeticiones.cancelar(p.id)) { MC.toast('Pedido cancelado', 'info'); pintar(); }
    };

    var mis = document.getElementById('cjMissions');
    if (mis) mis.onclick = function () { MCMissionsView.open(); };
    var vip = document.getElementById('cjVip');
    if (vip) vip.onclick = function () { MCVip.open(); };
    var play = document.getElementById('cjPlay');
    if (play) play.onclick = function () { MC.showView('lobby'); };
  }

  /* ============================================================
     PEDIRLE FICHAS AL AGENTE

     La otra mitad del circuito: hasta ahora el agente empujaba y el
     jugador esperaba. Solo aparece si hay una cuenta de agente en
     este dispositivo; sin agente a quien pedirle, un boton para
     pedir es una promesa vacia.
     ============================================================ */
  function hayAgente() {
    return MC.auth.all().some(MCRoles.esAgente);
  }

  function bloquePedido() {
    if (!hayAgente() || MCRoles.activoEsAgente()) return '';

    var pend = MCPeticiones.miPendiente();
    if (pend) {
      return '<div class="cj-pedido esperando">' +
        '<div>' +
          '<strong>Pediste ' + MC.fmt(pend.monto) + ' fichas</strong>' +
          '<span>Esperando que el agente conteste.</span>' +
        '</div>' +
        '<button class="btn btn-ghost" id="cjCancelar">Cancelar</button>' +
      '</div>';
    }

    // La ultima respuesta, para que el jugador se entere de que le contestaron.
    var ultima = MCPeticiones.mios(1)[0];
    var aviso = '';
    if (ultima && ultima.estado === 'aceptada') {
      aviso = '<span class="cj-pedido-ok">Tu ultimo pedido de ' +
        MC.fmt(ultima.monto) + ' se acredito.</span>';
    } else if (ultima && ultima.estado === 'rechazada') {
      aviso = '<span class="cj-pedido-no">Tu ultimo pedido de ' +
        MC.fmt(ultima.monto) + ' fue rechazado.</span>';
    }

    return '<div class="cj-pedido">' +
      '<div>' +
        '<strong>Pedirle fichas al agente</strong>' +
        '<span>El agente las carga de su caja. ' + aviso + '</span>' +
      '</div>' +
      '<button class="btn btn-gold" id="cjPedir">Pedir fichas</button>' +
    '</div>';
  }

  function abrirPedido() {
    var montos = [1000, 5000, 25000, 100000];
    MC.modal('Pedirle fichas al agente',
      '<p>El agente ve tu pedido en su panel y decide. Las fichas salen de ' +
      '<strong>su caja</strong>, asi que puede rechazarlo.</p>' +
      '<div class="ag-montos">' +
        montos.map(function (m) {
          return '<button class="btn btn-ghost cj-monto" data-m="' + m + '">' +
            MC.fmt(m) + '</button>';
        }).join('') +
      '</div>' +
      '<label class="auth-label">O poné el monto</label>' +
      '<input type="number" id="cjMonto" class="filter-input" min="' + MCPeticiones.MIN +
        '" step="100" placeholder="' + MCPeticiones.MIN + '">' +
      '<label class="auth-label">Nota para el agente (opcional)</label>' +
      '<input type="text" id="cjNota" class="filter-input" maxlength="80" ' +
        'placeholder="Para el finde">' +
      '<p class="auth-legal">El agente es una cuenta de este mismo dispositivo. ' +
      'Sin servidor no hay forma de pedirle nada a alguien que este en otro telefono.</p>',
      [
        { label: 'Cancelar' },
        { label: 'Pedir', kind: 'primary', onClick: function () {
            var mo = document.getElementById('cjMonto');
            var no = document.getElementById('cjNota');
            enviar(mo ? mo.value : 0, no ? no.value : '');
          } }
      ]);

    document.querySelectorAll('.cj-monto').forEach(function (b) {
      b.onclick = function () {
        var campo = document.getElementById('cjMonto');
        if (campo) campo.value = b.dataset.m;
        document.querySelectorAll('.cj-monto').forEach(function (x) {
          x.classList.toggle('btn-gold', x === b);
          x.classList.toggle('btn-ghost', x !== b);
        });
      };
    });
  }

  function enviar(monto, nota) {
    var r = MCPeticiones.pedir(monto, nota);
    if (r.error) { MC.toast(r.error, 'lose'); return; }
    MC.sound.click();
    MC.toast('Pedido enviado al agente', 'win');
    pintar();
  }

  /* ---------------- ciclo de vida ---------------- */
  function init() {
    MC.onEnter('cajero', function () {
      pintar();
      // El contador del bono corre solo mientras la pantalla está abierta.
      clearInterval(timer);
      timer = setInterval(pintar, 1000 * 30);
    });
    MC.onLeave('cajero', function () { clearInterval(timer); });
  }

  return { init: init, pintar: pintar };
})();
