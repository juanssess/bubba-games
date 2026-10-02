/* ============================================================
   CORE / FIREBASE — login con Google y saldo en la nube.

   Es el proveedor remoto que auth.js dejó enchufable. Hace dos
   cosas:

     1. Login real con Google (popup).
     2. Sincroniza el estado del jugador con Firestore, para que
        las fichas te sigan entre la compu y el celular.

   ---------------------------------------------------------------
   POR QUÉ ES UN MÓDULO Y NO UN <script> COMÚN
   ---------------------------------------------------------------
   El SDK de Firebase se distribuye como módulo ES. Este archivo es
   la única parte del casino que lo es; todo lo demás sigue siendo
   ES5 plano. Si el import falla (sin internet, CDN caída, config
   incompleta), NO PASA NADA: el casino ya arrancó con perfiles
   locales y sigue jugable. El login remoto es una mejora, nunca
   un requisito.

   ---------------------------------------------------------------
   CÓMO SE SINCRONIZA EL SALDO
   ---------------------------------------------------------------
   localStorage sigue siendo la copia de trabajo: es sincrónica y
   todo el casino ya la usa. Firestore es una capa de sincronía
   encima:

     - al entrar, se baja el estado de la nube y pisa el local
     - al guardar, se sube (con retardo, no en cada giro)

   La nube gana en el arranque a propósito: si jugaste en el celu y
   después abrís la compu, querés el saldo del celu, no el que había
   quedado en esta máquina.

   ---------------------------------------------------------------
   SEGURIDAD
   ---------------------------------------------------------------
   La apiKey de abajo es pública por diseño: identifica al proyecto,
   no autoriza nada. Lo que protege los datos son las reglas de
   Firestore (ver firestore.rules), que sólo dejan a cada usuario
   leer y escribir SU documento.

   Y como son fichas virtuales sin valor, tampoco hay mucho que
   proteger: lo importante es que nadie pueda tocar el progreso
   de otro.
   ============================================================ */

const CONFIG = {
  apiKey: 'AIzaSyBK7IaBc-HRXYAGszw5BPpoJUQeVtD4p6k',
  authDomain: 'bubba-games.firebaseapp.com',
  projectId: 'bubba-games',
  storageBucket: 'bubba-games.firebasestorage.app',
  messagingSenderId: '1010692646449',
  appId: '1:1010692646449:web:a6386887520e1160449710'
};

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

/* En un teléfono los navegadores suelen bloquear o perder los popups al
   cambiar de aplicación para elegir la cuenta. Firebase recomienda el flujo
   de redirección para ese caso; en escritorio el popup evita sacar al
   jugador del casino. onAuthStateChanged, más abajo, atiende ambos flujos. */
function usarRedireccion() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * ID de la base de Firestore.
 *
 * OJO: normalmente es '(default)' (con parentesis) y el SDK lo asume solo.
 * Esta se creo con el nombre literal 'default', asi que hay que pasarselo
 * explicito o getFirestore() se conecta a una base que no existe y todo
 * falla con NOT_FOUND sin decir por que.
 *
 * Como se comprobo: pedir databases/(default) devuelve NOT_FOUND y
 * databases/default devuelve PERMISSION_DENIED. El segundo error solo
 * aparece si la base existe.
 */
const DB_ID = 'default';
/** Cuánto se espera antes de subir a la nube, para no escribir en cada giro. */
const SYNC_MS = 2500;

let db = null;
/**
 * Dos identificadores distintos, y confundirlos fue el primer bug de esto:
 *
 *  - uidPerfil: el del registro de perfiles, CON prefijo ('google:abc123').
 *    Es la clave del estado en localStorage.
 *  - uidNube: el uid crudo de Firebase ('abc123'). Es el id del documento
 *    en Firestore, porque las reglas comparan contra request.auth.uid, que
 *    viene sin prefijo. Con el prefijo puesto, cada escritura se rechazaba
 *    en silencio y el saldo nunca llegaba al otro dispositivo.
 */
let uidPerfil = null;
let uidNube = null;
let subiendo = null;
/** Para no repetirle el mismo problema al jugador en cada guardado. */
let avisoDeFalla = false;
/**
 * Estado de la sincronia, visible en el panel de cuenta.
 *
 *   'local'     este perfil no sincroniza (no hay cuenta remota)
 *   'pendiente' hay cuenta, la sincronia todavia no respondio
 *   'ok'        la nube respondio y el progreso viaja
 *   'error'     algo fallo (el codigo queda en errorNube)
 *
 * Existe porque la primera version fallaba en silencio: el jugador creia
 * que su saldo lo seguia entre dispositivos y no era cierto. Un estado que
 * el usuario no puede ver es un estado en el que no se puede confiar.
 *
 * Y 'pendiente' existe porque sin el no se distinguia "no sincroniza" de
 * "todavia no termino", que es justo lo que nos confundio al depurar.
 */
let estadoNube = 'local';
/** Ultimo codigo de error de Firestore, para poder diagnosticar de un vistazo. */
let errorNube = '';
let storeNube = null;
let pedidosNube = null;
let dejarFichas = null;

function mismaCuenta(perfil, uid) {
  return uidPerfil === perfil && uidNube === uid && MC.auth.current().uid === perfil;
}

function aplicarFichas(total, perfil, uid) {
  if (!mismaCuenta(perfil, uid)) return;
  const copia = JSON.parse(JSON.stringify(MC.state));
  const delta = MCPeticionesNube.integrar(copia, total);
  if (!delta) return;
  // Persiste saldo y acumulado juntos antes de mostrar la acreditacion.
  if (!MC.auth.escribirEstado(perfil, copia)) throw new Error('No se pudieron guardar las fichas recibidas.');
  MC.state.balance = copia.balance;
  MC.state.fichasNube = copia.fichasNube;
  MC.state.at = copia.at;
  MC.renderBalance(true);
  MC.save();
  MC.toast('Recibiste ' + MC.fmt(delta) + ' fichas del agente', 'win');
}

function escucharFichas() {
  if (dejarFichas) dejarFichas();
  const perfil = uidPerfil, uid = uidNube;
  dejarFichas = storeNube.onSnapshot(storeNube.doc(db, 'fichasRecibidas', uid), snap => {
    if (snap.metadata && snap.metadata.fromCache) return;
    try { aplicarFichas(snap.exists() ? snap.data().total : 0, perfil, uid); }
    catch (e) { MC.toast(e.message, 'lose'); }
  }, e => {
    if (mismaCuenta(perfil, uid)) MC.toast('No se pudieron conectar las acreditaciones del agente', 'lose');
    console.warn('[bubba] acreditaciones:', e.code || e.message);
  });
}

/* ---------------- sincronía con la nube ---------------- */

async function bajarEstado(setDoc, getDoc, doc) {
  const perfil = uidPerfil, uid = uidNube;
  const ref = doc(db, 'players', uid);
  let snap;
  try {
    snap = await getDoc(ref);
    if (!mismaCuenta(perfil, uid)) return;
  } catch (e) {
    // Sin conexión o reglas mal puestas: se sigue jugando local.
    errorNube = e.code || e.message;
    console.warn('[bubba] no se pudo leer el estado de la nube:', errorNube);
    estadoNube = 'error';
    return;
  }

  // La nube respondio: eso ya alcanza para saber que la sincronia funciona.
  // Antes esto estaba despues del return/reload de mas abajo y no se
  // ejecutaba nunca, asi que el panel decia "solo en este navegador"
  // aunque estuviera todo bien.
  estadoNube = 'ok';

  if (snap.exists() && snap.data().state) {
    const nube = snap.data().state;
    const local = localStorage.getItem(MC.auth.claveEstado(uidPerfil));
    if (local === nube) return;

    /* GANA LA COPIA MAS NUEVA, no la de la nube.
       -----------------------------------------------------------------
       Antes la nube ganaba siempre, y eso se comia cambios reales. El
       caso que lo destapo: el agente le carga fichas al jugador mientras
       ese perfil no esta activo, asi que nada sube; despues el jugador
       entra con Google, baja la copia vieja, y las fichas desaparecen.
       Verificado que pasaba: 10.000 -> 5.000.

       Ahora cada guardado deja su hora (state.at) y se compara con la
       del documento remoto. Si lo local es mas nuevo, se sube en vez de
       pisarse.

       Si la nube no trae hora es un documento viejo, de antes de este
       cambio: ahi gana la nube como siempre, que es lo unico seguro
       cuando no hay con que comparar. */
    const horaNube = snap.data().updatedAt || 0;
    let horaLocal = 0;
    let esHeredado = false;
    try {
      const l = JSON.parse(local || '{}') || {};
      horaLocal = l.at || 0;
      esHeredado = l.heredado === true;
    } catch (e) {}

    /* Un estado HEREDADO del invitado nunca le gana a la nube, mire lo que
       mire el reloj. Es progreso de otra cuenta al que se le puso fecha
       nueva al copiarlo: por sello siempre parece mas reciente, y por eso
       se comia la cuenta de verdad. Si la nube tiene algo, la nube manda. */
    if (esHeredado) {
      localStorage.setItem(MC.auth.claveEstado(uidPerfil), nube);
      if (!MC.aplicarEstado(nube)) {
        console.warn('[bubba] el estado de la nube no se pudo aplicar');
        estadoNube = 'error';
        errorNube = 'estado-invalido';
        return;
      }
      MC.toast('Progreso recuperado de tu cuenta', 'win');
      return;
    }

    if (horaNube && horaLocal && horaLocal > horaNube) {
      await subirEstado(setDoc, doc, true);
      return;
    }

    // Se aplica EN CALIENTE, sin recargar.
    //
    // Antes esto hacia location.reload() y provocaba un bucle infinito: al
    // recargar, el casino toca el estado enseguida (regenera las misiones
    // del dia, el temporizador del bono), asi que volvia a diferir del
    // remoto y recargaba otra vez. La pagina quedaba inusable.
    localStorage.setItem(MC.auth.claveEstado(uidPerfil), nube);
    if (!MC.aplicarEstado(nube)) {
      // Si el estado remoto vino corrupto, no se insiste: mejor seguir con
      // lo local que dejar al jugador sin nada.
      console.warn('[bubba] el estado de la nube no se pudo aplicar');
      estadoNube = 'error';
      errorNube = 'estado-invalido';
      return;
    }
    MC.toast('Progreso recuperado de tu cuenta', 'win');
  } else {
    // Primera vez con esta cuenta: sube lo que haya local (que puede ser
    // el progreso que traía de invitado).
    await subirEstado(setDoc, doc, true);
  }
}

async function subirEstado(setDoc, doc, ahora) {
  if (!db || !uidNube) return;
  const perfil = uidPerfil, uid = uidNube;
  const guardar = async () => {
    if (!mismaCuenta(perfil, uid)) return;
    const raw = localStorage.getItem(MC.auth.claveEstado(perfil));
    if (!raw) return;
    try {
      // updatedAt es la hora DEL ESTADO, no la de la subida: si fueran
      // distintas, subir sin cambios haria "ganar" a la nube por reloj.
      let horaEstado = Date.now();
      let subir = raw;
      try {
        const st = JSON.parse(raw) || {};
        horaEstado = st.at || horaEstado;
        /* Si lo que sube es el regalo del invitado, deja de ser heredado en
           cuanto llega: ya es el progreso de esta cuenta y de ahora en mas
           compite por sello como cualquier otro. */
        if (st.heredado) {
          st.heredado = false;
          st.at = horaEstado = Date.now();
          subir = JSON.stringify(st);
          localStorage.setItem(MC.auth.claveEstado(uidPerfil), subir);
          MC.state.heredado = false;
          MC.state.at = horaEstado;
        }
      } catch (e) {}

      // Una carga que llegue durante la subida hace reintentar la transaccion.
      const total = await storeNube.runTransaction(db, async tx => {
        const s = await tx.get(doc(db, 'fichasRecibidas', uid));
        if (!mismaCuenta(perfil, uid)) throw new Error('La cuenta cambio durante el guardado.');
        const total = s.exists() ? s.data().total : 0;
        const st = JSON.parse(subir);
        MCPeticionesNube.integrar(st, total);
        tx.set(doc(db, 'players', uid), { state: JSON.stringify(st), updatedAt: horaEstado }, { merge: true });
        return total;
      });
      if (!mismaCuenta(perfil, uid)) return;
      aplicarFichas(total, perfil, uid);

      // La fila del ranking viaja con el mismo guardado: es un documento
      // aparte porque es PUBLICO, y en players/ no puede entrar nada que
      // otros puedan leer.
      const fila = window.MCRanking && MCRanking.datosPropios();
      if (fila) {
        try {
          await setDoc(doc(db, 'leaderboard', uid), fila, { merge: true });
        } catch (e) {
          // Que falle el ranking no puede romper el guardado del progreso.
          console.warn('[bubba] no se pudo publicar en el ranking:', e.code || e.message);
        }
      }

      estadoNube = 'ok';
      avisoDeFalla = false;
    } catch (e) {
      estadoNube = 'error';
      // Un fallo de sincronía NO puede ser invisible: el jugador cree que su
      // saldo lo sigue entre dispositivos y no es cierto. Se avisa una vez.
      errorNube = e.code || e.message;
      console.warn('[bubba] no se pudo guardar en la nube:', errorNube);
      if (!avisoDeFalla) {
        avisoDeFalla = true;
        MC.toast('Tu progreso no se está guardando en la nube', 'lose');
      }
    }
  };

  if (ahora) return guardar();
  // Retardo: MC.save() se llama en cada ronda; escribir cada vez sería
  // gastar cuota de Firestore para nada.
  clearTimeout(subiendo);
  subiendo = setTimeout(guardar, SYNC_MS);
}

/**
 * Envuelve MC.save para que además empuje a la nube.
 *
 * El guard no es paranoia: onAuthStateChanged puede dispararse más de una
 * vez en la misma sesión (al refrescarse el token, por ejemplo). Sin él,
 * MC.save quedaba envuelta dos veces y cada guardado disparaba dos subidas
 * a Firestore — el doble de escrituras para nada.
 */
let guardadoEnganchado = false;

function engancharGuardado(setDoc, doc) {
  if (guardadoEnganchado) return;
  guardadoEnganchado = true;
  const original = MC.save;
  MC.save = function () {
    original.apply(this, arguments);
    subirEstado(setDoc, doc, false);
  };
}

/* ============================================================
   EL RETORNO DE LA CASA, EN VIVO

   Un solo documento —`casa/retorno`— con cuánto paga cada mesa. Lo
   lee CUALQUIERA, también quien entra sin cuenta, porque es parte
   de las reglas del juego y no un dato de nadie. Lo escribe sólo
   quien esté en la lista de firestore.rules.

   Se escucha con onSnapshot y no se lee una vez: así, cuando la casa
   mueve el retorno desde el panel, las pantallas que ya están
   abiertas se enteran solas. Esa es toda la diferencia entre esto y
   tener que pegar código, commitear y pushear.

   Si Firestore no contesta —sin internet, reglas mal, proyecto
   caído— no pasa nada: MC.rtp ya arrancó con la copia guardada en
   este navegador, y abajo de esa copia está el valor del código.
   El casino nunca se queda sin saber cuánto paga.
   ============================================================ */
const DOC_RETORNO = ['casa', 'retorno'];

function engancharRetorno(store) {
  const ref = store.doc(db, DOC_RETORNO[0], DOC_RETORNO[1]);

  store.onSnapshot(ref, (snap) => {
    const d = snap.exists() ? snap.data() : null;
    MC.rtp.setNube(d ? { global: d.global, juegos: d.juegos || {}, at: d.at, por: d.por } : null);
  }, (e) => {
    // Que no se pueda leer no puede romper nada: queda la copia local.
    console.warn('[bubba] no pude leer el retorno de la casa:', e.code || e.message);
  });

  /* La escritura la usa el panel. Vive acá y no en ui/casa.js porque
     es el único archivo que tiene el SDK cargado, y porque así el
     panel sigue sin saber que Firestore existe. */
  MC.rtp.publicarEnNube = async function (config) {
    const u = MC.auth.current();
    await store.setDoc(ref, {
      global: config.global,
      juegos: config.juegos || {},
      at: Date.now(),
      /* Sin el 'google:' que el casino le pone a sus perfiles: así el
         que quede anotado acá es el mismo texto que está en la lista
         de firestore.rules, y comparar los dos no requiere traducir. */
      por: u && u.uid ? u.uid.replace(/^[a-z]+:/, '') : ''
    });
  };

  MC.rtp.nubeDisponible = function () { return true; };
}

/* ---------------- arranque ---------------- */
async function init() {
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);

  const app = initializeApp(CONFIG);
  const fbAuth = auth.getAuth(app);
  db = store.getFirestore(app, DB_ID);
  storeNube = store;
  pedidosNube = MCPeticionesNube.crear(store, db, () => uidNube);
  MCPeticiones.attachNube(pedidosNube);
  MC.auth.onChange(() => {
    clearTimeout(subiendo);
    if (!uidPerfil || MC.auth.current().uid !== uidPerfil) {
      pedidosNube.parar();
      if (dejarFichas) { dejarFichas(); dejarFichas = null; }
      return;
    }
    pedidosNube.iniciar();
  });

  // El retorno de la casa, antes que el login: lo lee cualquiera,
  // también quien entra sin cuenta.
  engancharRetorno(store);

  // Mantiene la sesión abierta entre visitas.
  await auth.setPersistence(fbAuth, auth.browserLocalPersistence);

  MC.auth.attachRemote({
    // Apple necesita el Apple Developer Program (99 USD/año) y un
    // servidor que firme el token: no se puede hacer desde el navegador.
    soporta: (proveedor) => proveedor === 'google',
    entrarCon: async (proveedor) => {
      if (proveedor !== 'google') {
        MC.toast('Por ahora sólo está conectado Google', 'info');
        return;
      }
      try {
        const prov = new auth.GoogleAuthProvider();
        if (usarRedireccion()) {
          await auth.signInWithRedirect(fbAuth, prov);
          return;
        }
        await auth.signInWithPopup(fbAuth, prov);
        // onAuthStateChanged se encarga del resto.
      } catch (e) {
        if (e.code === 'auth/popup-closed-by-user') return;
        if (e.code === 'auth/unauthorized-domain') {
          MC.toast('Falta autorizar este dominio en Firebase', 'lose');
        } else {
          MC.toast('No se pudo entrar con Google', 'lose');
        }
        console.warn('[bubba] login:', e.code || e.message);
      }
    },
    salir: () => auth.signOut(fbAuth),
    estado: () => estadoNube,
    error: () => errorNube,

    /**
     * Lectura de la tabla de posiciones.
     *
     * Se ordena por `apostado` en el servidor: traer todo y ordenar en el
     * navegador funcionaría con diez jugadores y se rompería con mil.
     */
    ranking: {
      leer: async (tope) => {
        const q = store.query(
          store.collection(db, 'leaderboard'),
          store.orderBy('apostado', 'desc'),
          store.limit(tope)
        );
        const snap = await store.getDocs(q);
        const out = [];
        snap.forEach((d) => out.push(Object.assign({ id: d.id }, d.data())));
        return out;
      }
    }
  });

  auth.onAuthStateChanged(fbAuth, async (user) => {
    clearTimeout(subiendo);
    pedidosNube.parar();
    if (dejarFichas) { dejarFichas(); dejarFichas = null; }
    if (!user) { uidPerfil = uidNube = null; estadoNube = 'local'; return; }

    // adoptarRemoto devuelve true si tuvo que recargar para cambiar de
    // perfil; en ese caso no hay nada más que hacer en esta vida.
    const recargo = MC.auth.adoptarRemoto({
      provider: 'google',
      id: user.uid,
      name: user.displayName || (user.email || 'Jugador').split('@')[0],
      photo: user.photoURL || null
    });
    if (recargo) return;

    /* La nube es del perfil de Google, no del que este activo.

       Antes esto ataba la sincronia a MC.auth.current() sin mirar cual
       era, y solo funcionaba de casualidad: el perfil activo SIEMPRE era
       el de Google. Con la cuenta de agente dejo de serlo, y ahi la cuenta
       se volvia peligrosa en las dos direcciones — subia el estado del
       agente encima del guardado del jugador, y bajaba el del jugador
       encima del agente.

       Asi que si estas usando otro perfil, la sincronia se sienta a
       esperar. No sube, no baja, y no toca nada. Tu progreso en la nube
       queda intacto hasta que vuelvas a la cuenta de Google. */
    const uidEsperado = 'google:' + user.uid;
    if (MC.auth.current().uid !== uidEsperado) {
      uidPerfil = uidNube = null;
      estadoNube = 'otro-perfil';
      return;
    }

    uidPerfil = MC.auth.current().uid;
    uidNube = user.uid;
    if (estadoNube === 'local') estadoNube = 'pendiente';
    engancharGuardado(store.setDoc, store.doc);
    await bajarEstado(store.setDoc, store.getDoc, store.doc);
    if (!mismaCuenta(uidEsperado, user.uid)) return;
    escucharFichas();
    pedidosNube.iniciar();
  });
}

/**
 * Diagnostico de la sincronia, para correr desde la consola:
 *
 *     await window.bubbaDiag()
 *
 * Hace el viaje completo —leer y escribir el documento propio— y devuelve
 * que paso en cada paso. Existe porque adivinar por que falla Firestore
 * mirando la interfaz es lento: el codigo de error dice en una linea si el
 * problema son las reglas, el nombre de la base o la sesion.
 */
window.bubbaDiag = async function () {
  const r = { logueado: !!uidNube, uidNube: uidNube, uidPerfil: uidPerfil, estado: estadoNube, error: errorNube };
  if (!uidNube) { r.conclusion = 'No hay sesion de Google iniciada'; return r; }

  const store = await import(SDK + 'firebase-firestore.js');
  try {
    const snap = await store.getDoc(store.doc(db, 'players', uidNube));
    r.lectura = snap.exists() ? 'ok, documento existe' : 'ok, documento vacio';
  } catch (e) { r.lectura = 'FALLO: ' + (e.code || e.message); }

  try {
    await store.setDoc(store.doc(db, 'players', uidNube), { ping: Date.now() }, { merge: true });
    r.escritura = 'ok';
  } catch (e) { r.escritura = 'FALLO: ' + (e.code || e.message); }

  r.conclusion = (r.lectura.startsWith('ok') && r.escritura === 'ok')
    ? 'La sincronia funciona'
    : 'Revisar las reglas de Firestore';
  return r;
};

// Escotilla de emergencia: con ?nosync=1 en la URL la sincronia no arranca.
// Si algun dia la nube deja la pagina en un estado raro, esto permite entrar
// igual y arreglarlo desde adentro en vez de quedar afuera del casino.
if (new URLSearchParams(location.search).has('nosync')) {
  console.warn('[bubba] sincronia desactivada por ?nosync=1');
} else {
init().catch((e) => {
  // Que falle el login remoto no puede romper el casino: se sigue con
  // perfiles locales y el botón de Google queda como estaba.
  console.warn('[bubba] Firebase no disponible, se juega con perfiles locales:', e.message);
});
}
