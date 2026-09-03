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

/* ---------------- sincronía con la nube ---------------- */

async function bajarEstado(setDoc, getDoc, doc) {
  const ref = doc(db, 'players', uidNube);
  let snap;
  try {
    snap = await getDoc(ref);
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
  const guardar = async () => {
    const raw = localStorage.getItem(MC.auth.claveEstado(uidPerfil));
    if (!raw) return;
    try {
      await setDoc(doc(db, 'players', uidNube), {
        state: raw,
        updatedAt: Date.now()
      }, { merge: true });

      // La fila del ranking viaja con el mismo guardado: es un documento
      // aparte porque es PUBLICO, y en players/ no puede entrar nada que
      // otros puedan leer.
      const fila = window.MCRanking && MCRanking.datosPropios();
      if (fila) {
        try {
          await setDoc(doc(db, 'leaderboard', uidNube), fila, { merge: true });
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
    if (!user) { uidPerfil = uidNube = null; return; }

    // adoptarRemoto devuelve true si tuvo que recargar para cambiar de
    // perfil; en ese caso no hay nada más que hacer en esta vida.
    const recargo = MC.auth.adoptarRemoto({
      provider: 'google',
      id: user.uid,
      name: user.displayName || (user.email || 'Jugador').split('@')[0],
      photo: user.photoURL || null
    });
    if (recargo) return;

    uidPerfil = MC.auth.current().uid;
    uidNube = user.uid;
    if (estadoNube === 'local') estadoNube = 'pendiente';
    engancharGuardado(store.setDoc, store.doc);
    await bajarEstado(store.setDoc, store.getDoc, store.doc);
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
