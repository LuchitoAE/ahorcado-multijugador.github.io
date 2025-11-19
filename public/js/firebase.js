// public/js/firebase.js
// Capa de acceso a datos: Firebase Auth + Firestore
// - Registro / login de docentes
// - Actividades (docente)
// - Grupos (códigos para estudiantes)
// - Jugadores (estudiantes en cada grupo)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --------------------------------------------------
// CONFIGURACIÓN FIREBASE
// (usa la misma que ya tenías en tu proyecto)
// --------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBQhQ9plZjjtJtKVgQQ6Tacou-V8KjjwxU",
  authDomain: "ahorcado-multijugador.firebaseapp.com",
  projectId: "ahorcado-multijugador",
  storageBucket: "ahorcado-multijugador.firebasestorage.app",
  messagingSenderId: "725333546638",
  appId: "1:725333546638:web:c148f449912cbf7b96dbdf",
  measurementId: "G-0LJBY6EMBS",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --------------------------------------------------
// UTIL: generar códigos cortos (actividad / grupo)
// --------------------------------------------------
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarCodigo(longitud = 6) {
  let code = "";
  for (let i = 0; i < longitud; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// --------------------------------------------------
// AUTH DOCENTE
// --------------------------------------------------

/**
 * Registra un docente usando Auth (email/contraseña) y
 * guarda datos básicos en la colección "users".
 */
export async function registerDocente({ nombres, apellidos, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    nombres,
    apellidos,
    email,
    rol: "docente",
    creadoEn: serverTimestamp(),
  });

  return user;
}

/**
 * Inicia sesión del docente.
 */
export function loginDocente({ email, password }) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Cierra sesión del docente.
 */
export function logoutDocente() {
  return signOut(auth);
}

/**
 * Suscribirse a cambios de auth.
 * callback(user | null)
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// --------------------------------------------------
// ACTIVIDADES (creadas por docentes)
// --------------------------------------------------

/**
 * Crea una actividad de Ahorcado y los grupos asociados.
 * - Cada actividad pertenece a un docente (docenteUid).
 * - Crea un documento en "actividades".
 * - Crea N grupos en "grupos" (uno por código de grupo).
 *
 * @param {Object} params
 * @param {string} params.docenteUid
 * @param {string} params.nombreActividad
 * @param {string} params.packId          // ej: "peru-personal-social"
 * @param {number} params.numGrupos
 * @param {number} params.maxIntegrantes
 * @param {number} params.tiempoRondaSeg
 * @param {number} params.numRondas
 *
 * @returns {Promise<{actividadId: string, codigoGeneral: string, grupos: Array}>}
 */
export async function createActividadWithGrupos({
  docenteUid,
  nombreActividad,
  packId,
  numGrupos,
  maxIntegrantes,
  tiempoRondaSeg,
  numRondas,
}) {
  const codigoGeneral = generarCodigo(6);

  // 1) Crear actividad
  const actividadesCol = collection(db, "actividades");
  const actividadDoc = await addDoc(actividadesCol, {
    nombre: nombreActividad,
    packId,
    docenteUid,
    numGrupos,
    maxIntegrantes,
    tiempoRondaSeg,
    numRondas,
    codigoGeneral,
    estado: "activa", // activa | finalizada
    creadoEn: serverTimestamp(),
  });

  const actividadId = actividadDoc.id;

  // 2) Crear grupos
  const grupos = [];
  for (let i = 0; i < numGrupos; i++) {
    const letraGrupo = String.fromCharCode(65 + i); // A, B, C...
    const nombreGrupo = `Grupo ${letraGrupo}`;
    const codigoGrupo = generarCodigo(6);

    const grupoRef = doc(db, "grupos", codigoGrupo);
    await setDoc(grupoRef, {
      codigoGrupo,
      actividadId,
      nombreGrupo,
      indiceGrupo: i,
      maxIntegrantes,
      tiempoRondaSeg,
      numRondas,
      estado: "esperando", // esperando | jugando | finalizado
      puntajeTotal: 0,
      creadoEn: serverTimestamp(),
    });

    grupos.push({
      codigoGrupo,
      nombreGrupo,
      indiceGrupo: i,
    });
  }

  return {
    actividadId,
    codigoGeneral,
    grupos,
  };
}

/**
 * Cambia el estado de una actividad (ej. "finalizada").
 */
export function updateActividadEstado(actividadId, nuevoEstado) {
  const actividadRef = doc(db, "actividades", actividadId);
  return updateDoc(actividadRef, {
    estado: nuevoEstado,
  });
}

/**
 * Obtener una actividad (una sola vez).
 */
export async function getActividad(actividadId) {
  const ref = doc(db, "actividades", actividadId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Suscribirse a una actividad (cambios en tiempo real).
 * callback(actividadData | null)
 */
export function listenActividad(actividadId, callback) {
  const ref = doc(db, "actividades", actividadId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
    } else {
      callback({ id: snap.id, ...snap.data() });
    }
  });
}

/**
 * Escuchar las actividades de un docente (lista en el dashboard).
 */
export function listenActividadesDocente(docenteUid, callback) {
  const actividadesCol = collection(db, "actividades");
  const q = query(
    actividadesCol,
    where("docenteUid", "==", docenteUid),
    orderBy("creadoEn", "desc")
  );

  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(items);
  });
}

// --------------------------------------------------
// GRUPOS (pertenecen a una actividad)
// --------------------------------------------------

/**
 * Escuchar los grupos de una actividad (para el detalle de actividad del docente).
 */
export function listenGruposDeActividad(actividadId, callback) {
  const gruposCol = collection(db, "grupos");
  const q = query(
    gruposCol,
    where("actividadId", "==", actividadId),
    orderBy("indiceGrupo", "asc")
  );

  return onSnapshot(q, (snap) => {
    const grupos = [];
    snap.forEach((docSnap) => {
      grupos.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(grupos);
  });
}

/**
 * Buscar un grupo por su código (para que el estudiante se una).
 */
export async function buscarGrupoPorCodigo(codigoGrupo) {
  const ref = doc(db, "grupos", codigoGrupo);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Actualizar campos de un grupo (puntaje, estado, ronda, etc.).
 * data es un objeto parcial con los campos a cambiar.
 */
export function updateGrupo(codigoGrupo, data) {
  const ref = doc(db, "grupos", codigoGrupo);
  return updateDoc(ref, data);
}

// --------------------------------------------------
// JUGADORES (estudiantes dentro de un grupo)
// --------------------------------------------------

/**
 * Agregar un estudiante a un grupo.
 * Devuelve { jugadorId, nombre }.
 */
export async function agregarJugadorAGrupo(codigoGrupo, nombre) {
  const grupoRef = doc(db, "grupos", codigoGrupo);

  const jugadoresCol = collection(grupoRef, "jugadores");
  const jugadorDoc = await addDoc(jugadoresCol, {
    nombre,
    puntaje: 0,
    creadoEn: serverTimestamp(),
  });

  return {
    jugadorId: jugadorDoc.id,
    nombre,
  };
}

/**
 * Escuchar jugadores de un grupo (para la vista del juego).
 */
export function listenJugadoresDeGrupo(codigoGrupo, callback) {
  const jugadoresCol = collection(db, "grupos", codigoGrupo, "jugadores");
  const q = query(jugadoresCol, orderBy("creadoEn", "asc"));

  return onSnapshot(q, (snap) => {
    const jugadores = [];
    snap.forEach((docSnap) => {
      jugadores.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(jugadores);
  });
}

/**
 * Actualizar puntaje (u otros campos) de un jugador.
 * changes puede ser { puntaje: nuevoValor } o { puntaje: incremento... } según el uso.
 * Aquí lo dejamos como "set directo": la lógica de sumar/restar la haces en game.js.
 */
export function updateJugador(codigoGrupo, jugadorId, changes) {
  const jugadorRef = doc(db, "grupos", codigoGrupo, "jugadores", jugadorId);
  return updateDoc(jugadorRef, changes);
}

/**
 * Obtener todos los jugadores de un grupo una sola vez (para cálculos finales,
 * ranking, etc.).
 */
export async function getJugadoresDeGrupo(codigoGrupo) {
  const jugadoresCol = collection(db, "grupos", codigoGrupo, "jugadores");
  const snap = await getDocs(jugadoresCol);
  const jugadores = [];
  snap.forEach((docSnap) => {
    jugadores.push({ id: docSnap.id, ...docSnap.data() });
  });
  return jugadores;
}

// --------------------------------------------------
// RANKING / RESULTADOS (soporte de datos)
// (La lógica de orden y cálculo la harás en game.js/ui.js)
// --------------------------------------------------

/**
 * Obtener todos los grupos de una actividad (una sola vez),
 * útil para construir el ranking final.
 */
export async function getGruposDeActividad(actividadId) {
  const gruposCol = collection(db, "grupos");
  const q = query(gruposCol, where("actividadId", "==", actividadId));
  const snap = await getDocs(q);
  const grupos = [];
  snap.forEach((docSnap) => {
    grupos.push({ id: docSnap.id, ...docSnap.data() });
  });
  return grupos;
}

// Exponemos auth y db por si se necesitan en otros módulos
export { auth, db, serverTimestamp };
