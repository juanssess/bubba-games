/* ============================================================
   UI / PANEL DE AGENTE — la mesa vista desde arriba.

   En un casino de dinero real, el agente es quien gestiona
   jugadores: les carga y descuenta crédito, ve cuánto mueven y
   cobra comisión. Acá es lo mismo pero con las fichas virtuales
   de este dispositivo, así que sirve para ver la mecánica sin que
   haya plata de por medio.

   Los "jugadores" son los perfiles guardados en este navegador.
   Cargarle fichas a uno es mover un número en su almacenamiento
   local: no hay dinero, no hay cobro y no hay nada que pagar.

   Depende de: auth, state, levels, format, ui.
   ============================================================ */
window.MCAgente = (function () {
  'use strict';

  /* ---------------- datos ---------------- */

  // El perfil activo se lee de MC.state y no del almacenamiento: si el
  // jugador acaba de girar, lo guardado puede estar un instante atrasado.
  function estadoDe(u) {
    if (u.uid === MC.auth.current().uid) return MC.state;
    return MC.auth.leerEstado(u.uid);
  }

  /** El saldo actual de un perfil, sea el activo o no. */
  function saldoDe(u) {
    if (u.uid === MC.auth.current().uid) return MC.getBalance();
    var st = MC.auth.leerEstado(u.uid);
    return (st && st.balance) || 0;
  }

  function filaDe(u) {
    var st = estadoDe(u) || {};
    var stats = st.stats || {};
    return {
      u: u,
      saldo: st.balance || 0,
      apostado: stats.wagered || 0,
      jugadas: stats.plays || 0,
      neto: stats.net || 0,
      xp: st.xp || 0,
      activo: u.uid === MC.auth.current().uid
    };
  }

  function tabla() {
    // Sólo jugadores: un agente administra apostadores, no a otros
    // agentes. Y como el agente no apuesta, su fila estaría toda en cero.
    return MC.auth.all().filter(function (u) {
      return !MCRoles.esAgente(u);
    }).map(filaDe).sort(function (a, b) {
      // El que está jugando primero; después por volumen apostado, que es
      // lo que a un agente le importa mirar.
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      return b.apostado - a.apostado;
    });
  }

  /** Rango de un jugador a partir de su XP, sin depender del perfil activo. */
  function rangoDe(xp) {
    var t = MCLevels.TIERS[0];
    MCLevels.TIERS.forEach(function (x) { if (xp >= x.min) t = x; });
    return t;
  }

  /* ---------------- movimientos ---------------- */

  /**
   * Carga o descuenta fichas. `delta` positivo carga, negativo descuenta.
   *
   * Si el jugador es el activo se toca MC.state y se guarda por la vía
   * normal, para que la pantalla y la sincronía se enteren. Si es otro, se
   * escribe directo su almacenamiento.
   */
  function mover(uid, delta) {
    var users = MC.auth.all();
    var u = null;
    users.forEach(function (x) { if (x.uid === uid) u = x; });
    if (!u) return;

    /* La caja manda. Cargar SALE de la caja del agente y descontar
       vuelve a ella. Antes esto creaba fichas de la nada: alcanzaba para
       ver la mecanica, pero sin limite no hay decision que tomar. */
    if (!MCCajaAgente.alcanza(delta)) {
      MC.modal('No te alcanza la caja',
        '<p>Quisiste cargar <strong>' + MC.fmt(delta) + '</strong> fichas y en tu caja ' +
        'hay <strong>' + MC.fmt(MCCajaAgente.saldo()) + '</strong>.</p>' +
        '<p>Podes descontarle fichas a un jugador —vuelven a tu caja— o cobrar la ' +
        'comision que tengas disponible.</p>',
        [{ label: 'Entendido', kind: 'primary' }]);
      return;
    }
    if (!MCCajaAgente.mover(delta)) return;

    if (uid === MC.auth.current().uid) {
      var nuevo = Math.max(0, MC.getBalance() + delta);
      MC.addBalance(nuevo - MC.getBalance());
    } else {
      var st = MC.auth.leerEstado(uid);
      if (!st) {
        // Perfil que nunca jugó: se le arma un estado mínimo para poder
        // acreditarle algo. El resto lo completa state.js al abrirlo.
        st = { balance: MC.STARTING_CHIPS };
      }
      st.balance = Math.max(0, (st.balance || 0) + delta);
      MC.auth.escribirEstado(uid, st);
    }

    // Al libro del agente, antes del aviso: si algo falla, que falle
    // sin haberle dicho al agente que ya esta hecho.
    MCCaja.registrar(uid, u.name, delta, saldoDe(u));

    MC.sound[delta >= 0 ? 'win' : 'click']();
    MC.toast(
      (delta >= 0 ? 'Cargaste ' : 'Descontaste ') + MC.fmt(Math.abs(delta)) +
      ' fichas a ' + u.name,
      delta >= 0 ? 'win' : 'info'
    );
    render();
  }

  function pedirMonto(uid, signo) {
    var u = null;
    MC.auth.all().forEach(function (x) { if (x.uid === uid) u = x; });
    if (!u) return;

    var montos = [500, 1000, 5000, 25000];
    var body =
      '<p>' + (signo > 0 ? 'Cargar fichas a' : 'Descontar fichas de') +
      ' <strong>' + u.name + '</strong>.</p>' +
      '<div class="ag-montos">' +
        montos.map(function (m) {
          return '<button class="btn btn-ghost ag-monto" data-m="' + m + '">' +
            (signo > 0 ? '+' : '−') + MC.fmt(m) + '</button>';
        }).join('') +
      '</div>' +
      '<label class="auth-label">O poné el monto</label>' +
      '<input type="number" id="agMonto" class="filter-input" min="1" step="1" placeholder="0">';

    MC.modal(signo > 0 ? 'Cargar fichas' : 'Descontar fichas', body, [
      { label: 'Cancelar' },
      {
        label: 'Confirmar',
        kind: 'primary',
        onClick: function () {
          var campo = document.getElementById('agMonto');
          var n = campo ? Math.floor(Number(campo.value)) : 0;
          if (n > 0) mover(uid, n * signo);
        }
      }
    ]);

    // Los botones de monto rápido cierran el modal y aplican de una.
    document.querySelectorAll('.ag-monto').forEach(function (b) {
      b.onclick = function () {
        MC.closeModal();
        mover(uid, Number(b.dataset.m) * signo);
      };
    });
  }

  /* ============================================================
     PERIODOS

     El panel de referencia filtra por fecha, asi que hace falta
     poder contestar "hoy", "ayer", "esta semana". Eso sale del
     diario (ver diario.js), no de `stats`, que no tiene tiempo.
     ============================================================ */
  var periodo = 'hoy';

  var PERIODOS = [
    { id: 'hoy',    label: 'Hoy' },
    { id: 'ayer',   label: 'Ayer' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes',    label: 'Mes' },
    { id: 'todo',   label: 'Todo' }
  ];

  function diaDesplazado(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return MCDiario.clave(d.getTime());
  }

  /** Limites del periodo como claves 'YYYY-MM-DD'. Nulos = todo. */
  function limites() {
    var hoy = MCDiario.clave();
    if (periodo === 'hoy') return { desde: hoy, hasta: hoy };
    if (periodo === 'ayer') { var a = diaDesplazado(-1); return { desde: a, hasta: a }; }
    if (periodo === 'semana') return { desde: diaDesplazado(-6), hasta: hoy };
    if (periodo === 'mes') return { desde: diaDesplazado(-29), hasta: hoy };
    return { desde: null, hasta: null };
  }

  /** Los mismos limites en milisegundos, para el libro de caja. */
  function limitesMs() {
    var l = limites();
    if (!l.desde) return { desde: null, hasta: null };
    return {
      desde: new Date(l.desde + 'T00:00:00').getTime(),
      hasta: new Date(l.hasta + 'T23:59:59.999').getTime()
    };
  }

  /* ============================================================
     LOS NUMEROS

     "Netwin" es la cuenta de la casa: lo apostado menos lo devuelto.
     Positivo quiere decir que gano el casino. Es la cuenta al reves
     de la del jugador, y es la que mira un agente.

     El margen es netwin sobre apostado. Con los RTP de esta casa
     (96% a 97,5%) tiene que rondar el 3%. Si en un periodo corto da
     muy distinto es varianza, no que las cuentas esten mal: hacen
     falta muchas rondas para que el margen se parezca al teorico.
     ============================================================ */
  function metricas() {
    var l = limites();
    var jugadores = MC.auth.all().filter(function (u) { return !MCRoles.esAgente(u); });

    var m = {
      jugadores: jugadores.length, activos: 0,
      apostado: 0, devuelto: 0, rondas: 0,
      fichas: 0, porDia: {}, filas: []
    };

    jugadores.forEach(function (u) {
      var st = estadoDe(u) || {};
      var r = MCDiario.rango(st, l.desde, l.hasta);
      if (r.activo) m.activos++;
      m.apostado += r.apostado;
      m.devuelto += r.devuelto;
      m.rondas += r.rondas;
      m.fichas += saldoDe(u);

      r.dias.forEach(function (d) {
        var acc = m.porDia[d.dia] || (m.porDia[d.dia] = { a: 0, d: 0 });
        acc.a += d.a; acc.d += d.d;
      });

      m.filas.push({ u: u, st: st, per: r });
    });

    m.netwin = m.apostado - m.devuelto;
    m.margen = m.apostado > 0 ? m.netwin / m.apostado : 0;

    var ms = limitesMs();
    m.caja = MCCaja.resumen(ms.desde, ms.hasta);
    return m;
  }

  /* ---------------- dibujo ---------------- */
  var pestana = 'stats';

  function render() {
    var cont = document.getElementById('agenteBody');
    if (!cont) return;
    var m = metricas();

    cont.innerHTML =
      barra() +
      (pestana === 'stats' ? vistaStats(m)
        : pestana === 'jugadores' ? vistaJugadores(m)
        : pestana === 'pedidos' ? vistaPedidos()
        : vistaMovimientos()) +
      nota();

    enganchar();
  }

  function barra() {
    return '<div class="ag-barra">' +
      '<div class="ag-tabs">' +
        tab('stats', 'Mis estadisticas') +
        tab('jugadores', 'Mis jugadores') +
        tab('movimientos', 'Movimientos') +
        tab('pedidos', 'Pedidos' + (MCPeticiones.pendientes().length
              ? '<i class="ag-pin">' + MCPeticiones.pendientes().length + '</i>' : '')) +
      '</div>' +
      '<div class="ag-periodos">' +
        PERIODOS.map(function (p) {
          return '<button class="ag-per' + (periodo === p.id ? ' on' : '') +
            '" data-per="' + p.id + '">' + p.label + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function tab(id, label) {
    return '<button class="ag-tab' + (pestana === id ? ' on' : '') +
      '" data-tab="' + id + '">' + label + '</button>';
  }

  /* ---------------- pestana: estadisticas ---------------- */
  function vistaStats(m) {
    return '<div class="ag-kpis">' +
        kpi('\uD83D\uDC65', MC.fmt(m.jugadores), 'Jugadores', '') +
        kpi('\u2705', MC.fmt(m.activos), 'Jugadores activos', '') +
        kpi('\uD83C\uDFAB', MC.fmt(m.apostado), 'Apuestas totales', 'var(--gold)') +
        kpi('\uD83C\uDFC5', MC.fmt(m.devuelto), 'Devuelto a jugadores', '') +
        kpi('\uD83D\uDCB5', (m.netwin >= 0 ? '+' : '') + MC.fmt(m.netwin), 'Netwin de la casa',
            m.netwin >= 0 ? 'var(--green)' : 'var(--red)') +
        kpi('\uD83D\uDCC8', (m.margen * 100).toFixed(2).replace('.', ',') + '%', 'Margen',
            m.margen >= 0 ? 'var(--green)' : 'var(--red)') +
      '</div>' +
      grafico(m) +
      cajaBloque() +
      '<div class="ag-mini">' +
        mini('Fichas en juego', MC.fmt(m.fichas)) +
        mini('Rondas del periodo', MC.fmt(m.rondas)) +
        mini('Cargaste', '+' + MC.fmt(m.caja.cargado)) +
        mini('Descontaste', '\u2212' + MC.fmt(m.caja.descontado)) +
      '</div>' +
      avisoDesdeCuando();
  }

  /* La caja del agente, con la comision a la vista.
     La comision se calcula siempre desde el total y se le resta lo ya
     cobrado, asi que la cuenta se puede rehacer desde cero y da igual. */
  function cajaBloque() {
    var disp = MCCajaAgente.comisionDisponible();
    var net = MCCajaAgente.netwinTotal();
    return '<div class="ag-caja">' +
      '<div class="ag-caja-num">' +
        '<span>Tu caja</span>' +
        '<strong>' + MC.fmt(MCCajaAgente.saldo()) + '</strong>' +
        '<em>fichas disponibles para cargar</em>' +
      '</div>' +
      '<div class="ag-caja-num">' +
        '<span>Entregado a jugadores</span>' +
        '<strong>' + MC.fmt(MCCajaAgente.entregado()) + '</strong>' +
        '<em>neto, descontando lo que volvio</em>' +
      '</div>' +
      '<div class="ag-caja-num">' +
        '<span>Comision (' + (MCCajaAgente.COMISION * 100) + '% del netwin)</span>' +
        '<strong style="color:' + (disp > 0 ? 'var(--green)' : 'var(--txt-dim)') + '">' +
          MC.fmt(disp) + '</strong>' +
        '<em>sobre ' + (net >= 0 ? '+' : '') + MC.fmt(net) + ' de netwin acumulado</em>' +
      '</div>' +
      '<button class="btn ' + (disp > 0 ? 'btn-gold' : 'btn-ghost') + '" id="agCobrar"' +
        (disp > 0 ? '' : ' disabled') + '>Cobrar comision</button>' +
    '</div>';
  }

  function kpi(ico, valor, label, color) {
    return '<div class="ag-kpi">' +
      '<span class="ag-kpi-ico">' + ico + '</span>' +
      '<div><strong' + (color ? ' style="color:' + color + '"' : '') + '>' + valor + '</strong>' +
      '<span>' + label + '</span></div>' +
    '</div>';
  }

  function mini(k, v) {
    return '<div class="ag-minicard"><span>' + k + '</span><strong>' + v + '</strong></div>';
  }

  /* El grafico: barras de lo apostado por dia, con el netwin encima.
     Es SVG y no una libreria porque son treinta rectangulos. */
  function grafico(m) {
    var dias = Object.keys(m.porDia).sort();
    if (!dias.length) {
      return '<div class="ag-grafico ag-vacio">Todavia no hay movimiento en este periodo.</div>';
    }

    var W = 760, H = 170, pad = 26;
    var max = 0;
    dias.forEach(function (d) { if (m.porDia[d].a > max) max = m.porDia[d].a; });
    if (max <= 0) max = 1;

    /* Ancho de barra con tope. Sin esto, un periodo de un solo dia
       dibujaba una barra de 700px de ancho: no se lee como un grafico,
       se lee como un error. Con pocas barras se centra el grupo. */
    var util = W - pad * 2;
    var ancho = Math.min(util / dias.length, 64);
    var arranque = pad + (util - ancho * dias.length) / 2;

    var barras = dias.map(function (d, i) {
      var v = m.porDia[d];
      var h = (v.a / max) * (H - pad * 2);
      var x = arranque + i * ancho + ancho * 0.18;
      var w = ancho * 0.64;
      var neto = v.a - v.d;
      // El netwin se dibuja SOBRE la barra de apostado, a escala. Cuando es
      // negativo (gano el jugador) se pinta en rojo desde la base: se ve de
      // un vistazo que ese dia la casa perdio.
      var hn = Math.min(1, Math.abs(neto) / max) * (H - pad * 2);
      return '<rect x="' + x.toFixed(1) + '" y="' + (H - pad - h).toFixed(1) +
             '" width="' + w.toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) +
             '" rx="2" fill="url(#agGrad)"><title>' + d + '  apostado ' + MC.fmt(v.a) +
             '  netwin ' + (neto >= 0 ? '+' : '') + MC.fmt(neto) + '</title></rect>' +
             '<rect x="' + x.toFixed(1) + '" y="' + (H - pad - hn).toFixed(1) +
             '" width="' + w.toFixed(1) + '" height="' + Math.max(1, hn).toFixed(1) +
             '" rx="2" fill="' + (neto >= 0 ? 'rgba(80,235,160,.6)' : 'rgba(224,52,76,.6)') + '"/>';
    }).join('');

    return '<div class="ag-grafico">' +
      '<div class="ag-grafico-head"><strong>Apostado por dia</strong>' +
        '<span class="ag-leyenda"><i class="pt-a"></i>apostado <i class="pt-n"></i>netwin</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" ' +
        'aria-label="Apostado por dia">' +
        '<defs><linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#f0c243"/><stop offset="1" stop-color="#f0c24333"/>' +
        '</linearGradient></defs>' +
        '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) +
          '" stroke="rgba(255,255,255,.18)" stroke-width="1"/>' + barras +
      '</svg>' +
      '<div class="ag-grafico-pie"><span>' + dias[0] + '</span>' +
        '<span>' + dias[dias.length - 1] + '</span></div>' +
    '</div>';
  }

  /* Decir desde cuando hay datos evita que un cero parezca un dato:
     el diario se empezo a llevar recien cuando se instalo. */
  function avisoDesdeCuando() {
    var primero = null;
    MC.auth.all().forEach(function (u) {
      if (MCRoles.esAgente(u)) return;
      var d = MCDiario.desdeCuando(estadoDe(u));
      if (d && (!primero || d < primero)) primero = d;
    });
    if (!primero) {
      return '<div class="ag-note">El registro por dia arranca con la primera ronda que se ' +
        'juegue. Todavia no hay ninguna, asi que los numeros estan en cero porque no hay nada ' +
        'que contar, no porque falle algo.</div>';
    }
    return '<div class="ag-note">Hay registro diario desde el <strong>' + primero + '</strong>. ' +
      'Lo anterior a esa fecha no se puede mostrar porque nadie lo anoto. Los totales de toda ' +
      'la vida de cada jugador siguen estando en <strong>Mis jugadores</strong>.</div>';
  }

  /* ---------------- pestana: jugadores ---------------- */
  function vistaJugadores(m) {
    var filas = m.filas.slice().sort(function (a, b) {
      return b.per.apostado - a.per.apostado;
    });

    return '<div class="ag-tabla">' +
      '<div class="ag-row ag-head">' +
        '<span>Jugador</span><span>Saldo</span><span>Apostado</span>' +
        '<span>Netwin</span><span>Movimientos</span>' +
      '</div>' +
      (filas.length
        ? filas.map(filaJugador).join('')
        : '<div class="ag-vacio">No hay jugadores todavia.</div>') +
    '</div>';
  }

  function filaJugador(f) {
    var u = f.u, st = f.st, per = f.per;
    var neto = per.apostado - per.devuelto;
    var t = rangoDe(st.xp || 0);
    return '<div class="ag-row">' +
      '<span class="ag-jugador">' +
        '<span class="ag-av">' +
          (u.photo ? '<img src="' + u.photo + '" alt="" referrerpolicy="no-referrer">' : u.avatar) +
        '</span>' +
        '<span class="ag-nombre">' + escapar(u.name) +
          '<em>' + t.ico + ' ' + t.name + (u.guest ? ' invitado' : '') + '</em>' +
        '</span>' +
      '</span>' +
      '<span class="ag-mono ag-saldo">' + MC.fmt(saldoDe(u)) + '</span>' +
      '<span class="ag-mono">' + MC.fmt(per.apostado) +
        '<em>' + MC.fmt(per.rondas) + ' rondas</em></span>' +
      '<span class="ag-mono" style="color:' + (neto >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
        (neto >= 0 ? '+' : '') + MC.fmt(neto) + '</span>' +
      '<span class="ag-acciones">' +
        '<button class="btn btn-gold ag-mas" data-uid="' + u.uid + '">Cargar</button>' +
        '<button class="btn btn-ghost ag-menos" data-uid="' + u.uid + '">Quitar</button>' +
      '</span>' +
    '</div>';
  }

  /* ---------------- pestana: movimientos ---------------- */
  function vistaMovimientos() {
    var ms = limitesMs();
    var lista = MCCaja.enRango(ms.desde, ms.hasta);

    if (!lista.length) {
      return '<div class="ag-tabla"><div class="ag-vacio">' +
        'No cargaste ni descontaste fichas en este periodo.</div></div>';
    }

    return '<div class="ag-tabla">' +
      '<div class="ag-row ag-head ag-row-mov">' +
        '<span>Cuando</span><span>Jugador</span><span>Movimiento</span><span>Saldo despues</span>' +
      '</div>' +
      lista.map(function (mv) {
        var pos = mv.delta > 0;
        return '<div class="ag-row ag-row-mov">' +
          '<span class="ag-cuando">' + cuando(mv.at) + '</span>' +
          '<span class="ag-nombre">' + escapar(mv.nombre) + '</span>' +
          '<span class="ag-mono" style="color:' + (pos ? 'var(--green)' : 'var(--red)') + '">' +
            (pos ? '+' : '\u2212') + MC.fmt(Math.abs(mv.delta)) + '</span>' +
          '<span class="ag-mono">' + (mv.saldo === undefined ? '\u2014' : MC.fmt(mv.saldo)) + '</span>' +
        '</div>';
      }).join('') +
      '<div class="ag-note">Se guardan los ultimos ' + MCCaja.MAX + ' movimientos.</div>' +
    '</div>';
  }

  /* ---------------- pestana: pedidos ---------------- */
  function vistaPedidos() {
    var lista = MCPeticiones.todas(40);
    if (!lista.length) {
      return '<div class="ag-tabla"><div class="ag-vacio">' +
        'Ningun jugador pidio fichas todavia. Pueden hacerlo desde el Cajero.' +
        '</div></div>';
    }

    return '<div class="ag-pedidos">' +
      lista.map(pedido).join('') +
    '</div>';
  }

  function pedido(p) {
    var pend = p.estado === 'pendiente';
    var etiqueta = { pendiente: 'Esperando', aceptada: 'Aceptada',
                     rechazada: 'Rechazada', cancelada: 'Cancelada' }[p.estado] || p.estado;

    return '<div class="ag-pedido ' + p.estado + '">' +
      '<div class="ag-pedido-top">' +
        '<strong>' + escapar(p.nombre) + '</strong>' +
        '<span class="ag-chip ' + p.estado + '">' + etiqueta + '</span>' +
      '</div>' +
      '<div class="ag-pedido-monto">' + MC.fmt(p.monto) + ' fichas</div>' +
      (p.nota ? '<p class="ag-pedido-nota">\u201C' + escapar(p.nota) + '\u201D</p>' : '') +
      '<div class="ag-pedido-pie">' +
        '<span>' + cuando(p.at) + '</span>' +
        (pend
          ? '<span class="ag-pedido-btns">' +
              '<button class="btn btn-ghost ag-no" data-p="' + p.id + '">Rechazar</button>' +
              '<button class="btn btn-gold ag-si" data-p="' + p.id + '" ' +
                'data-m="' + p.monto + '">Aceptar</button>' +
            '</span>'
          : '<span class="ag-pedido-res">' +
              (p.resueltaAt ? cuando(p.resueltaAt) : '') + '</span>') +
      '</div>' +
    '</div>';
  }

  /* Aceptar hace las tres cosas en orden: descuenta de la caja, acredita
     al jugador y marca el pedido. Si la caja no alcanza no se marca nada,
     asi el pedido queda esperando en vez de desaparecer sin fichas. */
  function aceptar(pid, monto) {
    if (!MCCajaAgente.alcanza(monto)) {
      MC.modal('No te alcanza la caja',
        '<p>Este pedido es de <strong>' + MC.fmt(monto) + '</strong> fichas y en tu caja ' +
        'hay <strong>' + MC.fmt(MCCajaAgente.saldo()) + '</strong>.</p>' +
        '<p>El pedido queda esperando: no se pierde.</p>',
        [{ label: 'Entendido', kind: 'primary' }]);
      return;
    }
    var p = MCPeticiones.resolver(pid, 'aceptada');
    if (!p) return;
    mover(p.uid, p.monto);
    render();
  }

  function rechazar(pid) {
    if (!MCPeticiones.resolver(pid, 'rechazada')) return;
    MC.sound.click();
    render();
  }

  function cuando(ts) {
    var d = new Date(ts);
    var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (MCDiario.clave() === MCDiario.clave(ts)) return 'Hoy ' + hh;
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + hh;
  }

  // Los nombres los elige quien crea el perfil: nunca van al DOM sin limpiar.
  function escapar(t) {
    return String(t || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nota() {
    return '<div class="ag-note">' +
      '<strong>Los jugadores son los perfiles de este dispositivo.</strong> ' +
      'Cargar o descontar fichas mueve un numero guardado en este navegador: ' +
      'no hay dinero, no se cobra nada y no hay nada que pagar. Es la mecanica ' +
      'de un panel de agente, sin la parte de la plata.' +
    '</div>';
  }

  function enganchar() {
    document.querySelectorAll('.ag-tab').forEach(function (b) {
      b.onclick = function () { pestana = b.dataset.tab; MC.sound.click(); render(); };
    });
    document.querySelectorAll('.ag-per').forEach(function (b) {
      b.onclick = function () { periodo = b.dataset.per; MC.sound.click(); render(); };
    });
    document.querySelectorAll('.ag-si').forEach(function (b) {
      b.onclick = function () { aceptar(b.dataset.p, Number(b.dataset.m)); };
    });
    document.querySelectorAll('.ag-no').forEach(function (b) {
      b.onclick = function () { rechazar(b.dataset.p); };
    });

    var cobrar = document.getElementById('agCobrar');
    if (cobrar) cobrar.onclick = function () {
      var got = MCCajaAgente.cobrarComision();
      if (!got) return;
      MC.sound.win();
      MC.toast('Cobraste ' + MC.fmt(got) + ' fichas de comision', 'win');
      render();
    };

    document.querySelectorAll('.ag-mas').forEach(function (b) {
      b.onclick = function () { pedirMonto(b.dataset.uid, 1); };
    });
    document.querySelectorAll('.ag-menos').forEach(function (b) {
      b.onclick = function () { pedirMonto(b.dataset.uid, -1); };
    });
  }

  function open() {
    if (!MCRoles.activoEsAgente()) return negar();
    MC.showView('agente');
    render();
  }

  /* La puerta se cierra acá y no sólo escondiendo el botón: a la vista
     se puede llegar por consola o por un enlace viejo. Esconder un botón
     no es cerrar una puerta.

     Y antes de negar nada se reacomoda la interfaz. Si alguien llegó hasta
     acá es porque vio un botón que no debería estar: la pantalla quedó
     mostrando un perfil y adentro hay otro. Negar sin corregir dejaría al
     jugador discutiendo con una barra lateral que le miente. */
  function negar() {
    MCRoles.aplicar();
    var u = MC.auth.current();
    MC.modal('El panel es de las cuentas de agente',
      '<p>Estás jugando como <strong>' + (u ? u.name : 'jugador') + '</strong>, ' +
      'que es una cuenta de jugador.</p>' +
      '<p>Para entrar al panel, abrí <strong>tu cuenta</strong> y cambiá a la ' +
      'cuenta de agente. Si todavía no tenés una, ahí mismo la creás.</p>',
      [
        { label: 'Cerrar' },
        { label: 'Ir a mi cuenta', kind: 'primary', onClick: function () {
            var box = document.getElementById('userBox');
            if (box) box.click();
          } }
      ]);
    MC.showView('lobby');
  }

  function init() {
    MC.onEnter('agente', function () {
      if (!MCRoles.activoEsAgente()) return negar();
      render();
    });
  }

  return { init: init, open: open, render: render };
})();
