/* ============================================================
   CORE / AUTENTICACIÓN — quién está jugando.

   Mismo patrón que usamos para la billetera de los juegos
   externos: una INTERFAZ con una implementación local que
   funciona hoy, y el lugar exacto donde enchufar Google mañana
   sin tocar nada más.

   ---------------------------------------------------------------
   POR QUÉ EMPIEZA EN LOCAL
   ---------------------------------------------------------------
   El sitio es estático (GitHub Pages): no hay servidor donde
   guardar cuentas. Un perfil local resuelve el 90% de lo que la
   gente espera de "tener cuenta" —nombre, avatar, tu saldo, poder
   cambiar de usuario— y funciona en el link compartido sin
   configurar nada.

   Para login real con Google se escribe un proveedor nuevo que
   implemente esta misma interfaz (ver PROVEEDOR REMOTO abajo) y
   se cambia una línea en init(). El resto del casino no se entera.

   ---------------------------------------------------------------
   ORDEN DE CARGA
   ---------------------------------------------------------------
   Este archivo va ANTES de state.js: el estado se guarda por
   perfil, así que primero hay que saber qué perfil está activo.
   ============================================================ */
window.MC = window.MC || {};

(function (MC) {
  'use strict';

  var AUTH_KEY = 'bubba_auth_v1';
  // Saldos guardados antes de que existieran los perfiles. Se adoptan una
  // sola vez, para el primer perfil, y después se borran: si quedaran, cada
  // perfil nuevo los heredaría.
  var LEGACY_STATE_KEYS = ['bubba_games_v1', 'maverick_casino_v2'];

  var AVATARS = ['🐶', '🦊', '🐼', '🦁', '🐸', '🦉', '🐺', '🐯', '🦄', '🐙', '🦈', '🐲'];

  var listeners = [];
  var data = null;   // { users: [...], activeUid }

  /* ---------------- persistencia ---------------- */
  function read() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage bloqueado: se juega igual, sin guardar */ }
    return null;
  }

  function write() {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function uid() {
    return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------------- perfiles ---------------- */
  function crear(nombre, opts) {
    opts = opts || {};
    var u = {
      uid: opts.uid || uid(),
      name: nombre,
      avatar: opts.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
      provider: opts.provider || 'local',   // 'local' | 'google' | 'apple'
      guest: !!opts.guest,
      createdAt: Date.now()
    };
    data.users.push(u);
    data.activeUid = u.uid;
    write();
    return u;
  }

  function current() {
    if (!data) return null;
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i].uid === data.activeUid) return data.users[i];
    }
    return data.users[0] || null;
  }

  function all() { return data ? data.users.slice() : []; }

  function emitir() {
    var u = current();
    listeners.forEach(function (fn) { fn(u); });
  }

  function onChange(fn) { listeners.push(fn); }

  /* ---------------- acciones ---------------- */
  // Cambiar de perfil recarga la página: el estado, la billetera y los
  // juegos ya tomaron referencias del perfil viejo. Recargar es más
  // barato y mucho más seguro que reconstruir medio casino en caliente.
  function usar(uidNuevo) {
    if (!data || uidNuevo === data.activeUid) return;
    data.activeUid = uidNuevo;
    write();
    location.reload();
  }

  function registrar(nombre, avatar) {
    nombre = (nombre || '').trim().slice(0, 18);
    if (!nombre) return null;

    var u = current();
    // Si el que está jugando es el invitado automático, se le pone
    // nombre en vez de crear un perfil nuevo: así no pierde sus fichas
    // por haberse registrado después de jugar un rato.
    if (u && u.guest) {
      u.name = nombre;
      u.guest = false;
      if (avatar) u.avatar = avatar;
      write();
      emitir();
      return u;
    }

    var nuevo = crear(nombre, { avatar: avatar });
    location.reload();
    return nuevo;
  }

  function renombrar(nombre, avatar) {
    var u = current();
    if (!u) return;
    nombre = (nombre || '').trim().slice(0, 18);
    if (nombre) u.name = nombre;
    if (avatar) u.avatar = avatar;
    u.guest = false;
    write();
    emitir();
  }

  function salir() {
    if (!data) return;
    // "Salir" no borra nada: vuelve al invitado, y el perfil queda
    // guardado para volver a entrar. Borrar la cuenta de alguien
    // porque toco "cerrar sesion" seria una sorpresa desagradable.
    var invitado = null;
    for (var i = 0; i < data.users.length; i++) {
      if (data.users[i].guest) invitado = data.users[i];
    }
    if (!invitado) invitado = crear('Invitado', { guest: true });
    data.activeUid = invitado.uid;
    write();
    location.reload();
  }

  /* ---------------- PROVEEDOR REMOTO (pendiente) ----------------
     Para login real con Google:

     1. Crear un proyecto en Firebase y habilitar Google en
        Authentication. La config es publicable, no es un secreto.
     2. Escribir un proveedor con esta misma forma:
          { current, all, onChange, registrar, usar, salir,
            entrarCon: function (proveedor) { ... } }
        donde `entrarCon('google')` hace signInWithPopup y mapea el
        usuario de Firebase a { uid, name, avatar, provider }.
     3. Cambiar la asignación de abajo por el proveedor nuevo.

     El saldo pasaría a guardarse en Firestore por uid en vez de
     localStorage; el resto del casino no cambia porque ya lee todo
     por MC.auth.

     Apple necesita ademas el Apple Developer Program (99 USD/año).
     -------------------------------------------------------------- */
  function entrarCon(proveedor) {
    MC.toast('El login con ' + proveedor + ' todavía no está conectado', 'info');
  }

  function disponibleRemoto() { return false; }

  /* ---------------- arranque ---------------- */
  function init() {
    data = read();

    if (!data || !data.users || !data.users.length) {
      data = { users: [], activeUid: null };
      // Migración: si ya venías jugando sin cuentas, ese saldo pasa a
      // ser el primer perfil en vez de perderse.
      var venia = null;
      try {
        for (var k = 0; !venia && k < LEGACY_STATE_KEYS.length; k++) {
          venia = localStorage.getItem(LEGACY_STATE_KEYS[k]);
        }
      } catch (e) {}
      var u = crear('Invitado', { guest: true });
      if (venia) {
        try {
          localStorage.setItem(claveEstado(u.uid), venia);
          LEGACY_STATE_KEYS.forEach(function (k) { localStorage.removeItem(k); });
        } catch (e) {}
      }
    }
    write();
  }

  /** Clave de almacenamiento del estado de juego de un perfil. */
  function claveEstado(u) {
    return 'bubba_games_v2.' + u;
  }

  MC.auth = {
    init: init,
    current: current,
    all: all,
    onChange: onChange,
    emitir: emitir,
    registrar: registrar,
    renombrar: renombrar,
    usar: usar,
    salir: salir,
    entrarCon: entrarCon,
    disponibleRemoto: disponibleRemoto,
    claveEstado: claveEstado,
    AVATARS: AVATARS
  };

  // Corre en cuanto se carga el archivo: state.js lo necesita listo.
  init();
})(window.MC);
