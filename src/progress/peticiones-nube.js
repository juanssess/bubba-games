/* Pedidos compartidos. El SDK se inyecta desde auth-firebase.js. */
window.MCPeticionesNube = (function () {
  'use strict';

  /* ============================================================
     QUIÉN ES LA CASA — la fuente de verdad del lado JS

     El uid PELADO de Firebase, sin el 'google:' que el casino le
     pone a sus perfiles (ver MC.auth.uidFirebase).

     El mismo dato vive también en firestore.rules, en agentes(). No
     se puede compartir una constante entre las reglas y el
     navegador, así que son dos lugares y no uno — pero eran siete,
     repartidos en cinco archivos, y cuando este dato cambia no falla
     ruidosamente: deja de autorizar y se ve un permission-denied que
     no explica nada.

     Las pruebas NO lo repiten: lo sacan de acá leyendo este archivo.
     Si se renombra la constante, se caen ruidosamente, que es lo que
     uno quiere de una prueba.
     ============================================================ */
  var AGENTE = 'ZlnbdcBiASbUoEy5vheJBHTIDFg1';

  function crear(store, db, sesion) {
    var bajas = [], actuales = [], historial = [], caja = null;
    var estado = 'pendiente', error = '', epoch = 0;

    function disponible() {
      var u = MC.auth.current();
      // El perfil guarda 'google:abc' y la sesión de Firebase es 'abc'.
      return !!(sesion() && MC.auth.uidFirebase(u) === sesion());
    }
    function esAgente() { return disponible() && sesion() === AGENTE && MCRoles.activoEsAgente(); }
    function avisar() {
      if (window.MCCajero && document.querySelector('#view-cajero.active')) MCCajero.pintar();
      if (window.MCAgente && document.querySelector('#view-agente.active')) MCAgente.render();
    }
    function ref(col, id) { return store.doc(db, col, id); }
    function comprobar(agente) {
      if (!disponible() || (agente && !esAgente())) throw new Error('Entra con una cuenta de Google autorizada.');
      if (estado !== 'ok') throw new Error('Espera a que se conecten los pedidos.');
    }
    function fallo(e) {
      estado = 'error'; error = e.code || e.message; avisar();
    }
    function observar(q, recibir, token) {
      var listo = false;
      return new Promise(function (resolve, reject) {
        bajas.push(store.onSnapshot(q, function (snap) {
          if (token !== epoch || !disponible()) return;
          recibir(snap);
          if (!listo) { listo = true; resolve(); }
          avisar();
        }, function (e) {
          if (token !== epoch) return;
          fallo(e); if (!listo) { listo = true; reject(e); }
        }));
      });
    }
    function lista(snap) {
      var out = [];
      snap.forEach(function (d) { out.push(d.data()); });
      return out;
    }
    function parar() {
      epoch++; bajas.forEach(function (f) { f(); }); bajas = [];
      actuales = []; historial = []; caja = null; estado = 'pendiente'; error = '';
    }
    async function iniciar() {
      parar(); if (!disponible()) return;
      var token = epoch, uid = sesion(), agente = esAgente();
      try {
        if (agente) {
          await store.runTransaction(db, async function (tx) {
            var r = ref('cajasAgentes', uid), s = await tx.get(r);
            if (!s.exists()) tx.set(r, { saldo: 500000, entregado: 0, ultimoPedido: '' });
          });
        }
        if (token !== epoch || !disponible()) return;
        var campo = agente ? 'agente' : 'uid';
        var lecturas = [
          observar(agente ? store.query(store.collection(db, 'pedidosNube'), store.where('agente', '==', uid))
            : ref('pedidosNube', uid), function (snap) {
              actuales = agente ? lista(snap) : (snap.exists() ? [snap.data()] : []);
            }, token),
          observar(store.query(store.collection(db, 'historialPedidos'), store.where(campo, '==', uid),
            store.orderBy('at', 'desc'), store.limit(40)), function (snap) { historial = lista(snap); }, token)
        ];
        if (agente) lecturas.push(observar(ref('cajasAgentes', uid), function (s) { caja = s.exists() ? s.data() : null; }, token));
        await Promise.all(lecturas);
        if (token !== epoch) return;
        estado = 'ok'; error = ''; avisar();
      } catch (e) { if (token === epoch) fallo(e); }
    }
    function todas(tope) {
      var mapa = {};
      historial.concat(actuales).forEach(function (p) { mapa[p.id] = p; });
      return Object.keys(mapa).map(function (id) { return Object.assign({}, mapa[id], { nube: true }); })
        .sort(function (a, b) { return (b.estado === 'pendiente') - (a.estado === 'pendiente') || b.at - a.at; })
        .slice(0, tope || 40);
    }
    async function pedir(monto, nota) {
      comprobar(false);
      if (MCRoles.activoEsAgente() || sesion() === AGENTE) throw new Error('Un agente no se pide fichas a si mismo.');
      monto = Math.floor(Number(monto));
      if (!Number.isSafeInteger(monto) || monto < 100 || monto > 500000) throw new Error('El pedido debe ser de 100 a 500.000 fichas.');
      var uid = sesion(), u = MC.auth.current();
      var h = store.doc(store.collection(db, 'historialPedidos'));
      var p = { id: h.id, at: Date.now(), uid: uid, nombre: String(u.name || 'Jugador').slice(0, 80),
        monto: monto, nota: String(nota || '').slice(0, 80), estado: 'pendiente', agente: AGENTE };
      await store.runTransaction(db, async function (tx) {
        var r = ref('pedidosNube', uid), s = await tx.get(r);
        if (s.exists() && s.data().estado === 'pendiente') throw new Error('Ya tenes un pedido esperando respuesta.');
        tx.set(r, p); tx.set(h, p);
      });
      return { ok: true };
    }
    async function resolver(pid, nuevo) {
      comprobar(nuevo !== 'cancelada');
      if (['aceptada', 'rechazada', 'cancelada'].indexOf(nuevo) < 0) throw new Error('Estado invalido.');
      var uid = sesion();
      var h = ref('historialPedidos', pid);
      try { return await store.runTransaction(db, async function (tx) {
        var hs = await tx.get(h);
        if (!hs.exists()) throw new Error('El pedido ya no existe.');
        var p = hs.data();
        if ((nuevo === 'cancelada' && p.uid !== uid) || (nuevo !== 'cancelada' && p.agente !== uid)) throw new Error('Este pedido pertenece a otra cuenta.');
        if (p.estado !== 'pendiente') {
          if (p.estado === nuevo) return p;
          throw new Error('El pedido ya fue resuelto.');
        }
        var r = ref('pedidosNube', p.uid), s = await tx.get(r);
        if (!s.exists() || s.data().id !== pid || s.data().estado !== 'pendiente') throw new Error('El pedido ya cambio.');
        if (nuevo === 'aceptada') {
          var cr = ref('cajasAgentes', uid), cs = await tx.get(cr);
          var fr = ref('fichasRecibidas', p.uid), fs = await tx.get(fr);
          var c = cs.exists() ? cs.data() : null;
          var total = fs.exists() ? fs.data().total : 0;
          if (!c || !Number.isSafeInteger(c.saldo) || c.saldo < p.monto) throw new Error('No te alcanza la caja. El pedido queda esperando.');
          if (!Number.isSafeInteger(total) || !Number.isSafeInteger(total + p.monto)) throw new Error('No se pudo validar la acreditacion.');
          tx.set(cr, { saldo: c.saldo - p.monto, entregado: c.entregado + p.monto, ultimoPedido: pid });
          tx.set(fr, { total: total + p.monto, ultimoPedido: pid });
        }
        p = Object.assign({}, p, { estado: nuevo, resueltaAt: Date.now() });
        tx.set(r, p); tx.set(h, p);
        return p;
      }); } catch (e) {
        // Una segunda aprobacion simultanea puede ser rechazada por las reglas
        // antes de reintentar la transaccion. Confirma el resultado en el servidor.
        if (store.getDocFromServer) {
          try {
            var final = await store.getDocFromServer(h);
            var p = final.exists() ? final.data() : null;
            if (p && p.id === pid && p.estado === nuevo &&
                (nuevo === 'cancelada' ? p.uid === uid : p.agente === uid)) return p;
          } catch (ignorado) {}
        }
        throw e;
      }
    }
    return { disponible: disponible, esAgente: esAgente, iniciar: iniciar, parar: parar, todas: todas,
      pedir: pedir, resolver: resolver, caja: function () { return caja; },
      estado: function () { return estado; }, error: function () { return error; } };
  }

  // El acumulado remoto es independiente del progreso: una copia vieja no lo puede borrar.
  function integrar(st, total) {
    var aplicado = st.fichasNube || 0;
    if (!Number.isSafeInteger(total) || total < aplicado || !Number.isSafeInteger(aplicado) || aplicado < 0 ||
        !Number.isSafeInteger(st.balance) || !Number.isSafeInteger(st.balance + total - aplicado)) {
      throw new Error('No se pudo validar el saldo recibido.');
    }
    st.balance += total - aplicado;
    st.fichasNube = total;
    return total - aplicado;
  }
  return { crear: crear, integrar: integrar, AGENTE: AGENTE };
})();
