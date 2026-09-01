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
/** Cuánto se espera antes de subir a la nube, para no escribir en cada giro. */
const SYNC_MS = 2500;

let db = null;
let uidActual = null;
let subiendo = null;

/* ---------------- sincronía con la nube ---------------- */

async function bajarEstado(setDoc, getDoc, doc) {
  const ref = doc(db, 'players', uidActual);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e) {
    // Sin conexión o reglas mal puestas: se sigue jugando local.
    console.warn('[bubba] no se pudo leer el estado de la nube:', e.message);
    return;
  }

  if (snap.exists() && snap.data().state) {
    const nube = snap.data().state;
    const local = localStorage.getItem(MC.auth.claveEstado(uidActual));
    // Si es lo mismo, no se toca nada: recargar por gusto pierde la
    // pantalla en la que estaba el jugador.
    if (local === nube) return;
    localStorage.setItem(MC.auth.claveEstado(uidActual), nube);
    location.reload();
  } else {
    // Primera vez con esta cuenta: sube lo que haya local (que puede ser
    // el progreso que traía de invitado).
    await subirEstado(setDoc, doc, true);
  }
}

async function subirEstado(setDoc, doc, ahora) {
  if (!db || !uidActual) return;
  const guardar = async () => {
    const raw = localStorage.getItem(MC.auth.claveEstado(uidActual));
    if (!raw) return;
    try {
      await setDoc(doc(db, 'players', uidActual), {
        state: raw,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('[bubba] no se pudo guardar en la nube:', e.message);
    }
  };

  if (ahora) return guardar();
  // Retardo: MC.save() se llama en cada ronda; escribir cada vez sería
  // gastar cuota de Firestore para nada.
  clearTimeout(subiendo);
  subiendo = setTimeout(guardar, SYNC_MS);
}

/** Envuelve MC.save para que además empuje a la nube. */
function engancharGuardado(setDoc, doc) {
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
  db = store.getFirestore(app);

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
    salir: () => auth.signOut(fbAuth)
  });

  auth.onAuthStateChanged(fbAuth, async (user) => {
    if (!user) { uidActual = null; return; }

    // adoptarRemoto devuelve true si tuvo que recargar para cambiar de
    // perfil; en ese caso no hay nada más que hacer en esta vida.
    const recargo = MC.auth.adoptarRemoto({
      provider: 'google',
      id: user.uid,
      name: user.displayName || (user.email || 'Jugador').split('@')[0],
      photo: user.photoURL || null
    });
    if (recargo) return;

    uidActual = MC.auth.current().uid;
    engancharGuardado(store.setDoc, store.doc);
    await bajarEstado(store.setDoc, store.getDoc, store.doc);
  });
}

init().catch((e) => {
  // Que falle el login remoto no puede romper el casino: se sigue con
  // perfiles locales y el botón de Google queda como estaba.
  console.warn('[bubba] Firebase no disponible, se juega con perfiles locales:', e.message);
});
