// =========================
//  IMPORTS FIREBASE
// =========================
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// =========================
//  CONFIG FIREBASE
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyBQhQ9plZjjtJtKVgQQ6Tacou-V8KjjwxU",
  authDomain: "ahorcado-multijugador.firebaseapp.com",
  projectId: "ahorcado-multijugador",
  storageBucket: "ahorcado-multijugador.firebasestorage.app",
  messagingSenderId: "725333546638",
  appId: "1:725333546638:web:c148f449912cbf7b96dbdf",
  measurementId: "G-0LJBY6EMBS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// =========================
//  VARIABLES DE ESTADO
// =========================
let usuario = { nombre: "", rol: "", jugadorId: "" };
let salaActual = "";
let stopJugadoresListener = null;
let stopSalaListener = null;

// Lista de palabras por rondas
const rondas = [
  { tema: "Respeto", pista: "Valor que demuestra consideración", palabra: "RESPETO" },
  { tema: "Honestidad", pista: "Valor de decir la verdad", palabra: "HONESTIDAD" },
  { tema: "Amistad", pista: "Relación basada en confianza", palabra: "AMISTAD" },
  { tema: "Empatía", pista: "Ponerse en lugar del otro", palabra: "EMPATIA" },
  { tema: "Responsabilidad", pista: "Cumplir obligaciones", palabra: "RESPONSABILIDAD" },
];


// =========================
//  CAMBIO DE VISTAS
// =========================
function mostrarVista(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

document.getElementById("btn-docente").onclick = () => mostrarVista("view-docente");
document.getElementById("btn-estudiante").onclick = () => mostrarVista("view-estudiante");
document.getElementById("btn-volver-docente").onclick = () => mostrarVista("view-menu");
document.getElementById("btn-volver-estudiante").onclick = () => mostrarVista("view-menu");


// =========================
//  GENERAR CÓDIGO SALA
// =========================
function generarCodigo() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}


// =========================
//  DOCENTE: CREAR SALA
// =========================
document.getElementById("btn-crear-sala").onclick = async () => {
  const nombre = document.getElementById("docente-nombre").value.trim();

  if (!nombre) {
    alert("Ingresa tu nombre.");
    return;
  }

  usuario = { nombre, rol: "docente" };

  const codigo = generarCodigo();
  salaActual = codigo;

  const salaRef = doc(db, "salas", codigo);

  const salaData = {
    codigo,
    docente: nombre,
    estado: "espera",       // 👈 No se juega todavía
    ronda: 0,
    turno: "",
    palabraActual: "",
    letrasUsadas: [],
    fallos: 0,
    updatedAt: serverTimestamp()
  };

  await setDoc(salaRef, salaData);

  // Crear docente en la lista de jugadores
  const jugadoresRef = collection(salaRef, "jugadores");
  const docJugador = await addDoc(jugadoresRef, {
    nombre,
    rol: "docente",
    conectado: true,
    timestamp: serverTimestamp()
  });

  usuario.jugadorId = docJugador.id;

  document.getElementById("texto-codigo").textContent = codigo;
  document.getElementById("docente-info-sala").classList.remove("hidden");

  escucharJugadores();
  escucharSala();

  mostrarVista("view-docente");
};


// =========================
//  ESTUDIANTE: UNIRSE
// =========================
document.getElementById("btn-unirse").onclick = async () => {
  const codigo = document.getElementById("join-codigo").value.trim();
  const nombre = document.getElementById("join-nombre").value.trim();

  if (!codigo || !nombre) {
    document.getElementById("join-error").textContent = "Completa todos los campos.";
    return;
  }

  const salaRef = doc(db, "salas", codigo);
  const salaSnap = await getDoc(salaRef);

  if (!salaSnap.exists()) {
    document.getElementById("join-error").textContent = "La sala no existe.";
    return;
  }

  usuario = { nombre, rol: "estudiante" };
  salaActual = codigo;

  const jugadoresRef = collection(salaRef, "jugadores");
  const jugadorDoc = await addDoc(jugadoresRef, {
    nombre,
    rol: "estudiante",
    conectado: true,
    timestamp: serverTimestamp()
  });

  usuario.jugadorId = jugadorDoc.id;

  escucharJugadores();
  escucharSala();

  mostrarVista("view-estudiante");
};


// =========================
//  LISTENER: JUGADORES
// =========================
function escucharJugadores() {
  if (stopJugadoresListener) stopJugadoresListener();

  const jugadoresRef = collection(db, "salas", salaActual, "jugadores");

  stopJugadoresListener = onSnapshot(jugadoresRef, (snap) => {
    const listaDocente = document.getElementById("lista-jugadores");
    const listaJuego = document.getElementById("juego-lista-jugadores");

    listaDocente.innerHTML = "";
    listaJuego.innerHTML = "";

    snap.forEach(doc => {
      const d = doc.data();

      listaDocente.innerHTML += `<li>${d.nombre} (${d.rol})</li>`;
      listaJuego.innerHTML += `<li>${d.nombre} (${d.rol})</li>`;
    });

    if (usuario.rol === "docente") {
      const btn = document.getElementById("btn-iniciar-juego");
      btn.disabled = snap.size < 2; // docente + 1 estudiante mínimo
    }
  });
}


// =========================
//  LISTENER: SALA
// =========================
function escucharSala() {
  if (stopSalaListener) stopSalaListener();

  const salaRef = doc(db, "salas", salaActual);

  stopSalaListener = onSnapshot(salaRef, (snap) => {
    const data = snap.data();
    if (!data) return;

    // Cuando el docente inicia el juego:
    if (data.estado === "jugando") {
      cargarRonda(data);
      mostrarVista("view-juego");
    }
  });
}


// =========================
// DOCENTE: INICIAR JUEGO
// =========================
document.getElementById("btn-iniciar-juego").onclick = () => iniciarJuego();

async function iniciarJuego() {
  const salaRef = doc(db, "salas", salaActual);

  await updateDoc(salaRef, {
    estado: "jugando",
    ronda: 1,
    palabraActual: rondas[0].palabra,
    letrasUsadas: [],
    fallos: 0
  });
}


// =========================
//  CARGAR RONDA
// =========================
function cargarRonda(data) {
  const rondaIndex = data.ronda - 1;
  const info = rondas[rondaIndex];

  document.getElementById("juego-codigo").textContent = salaActual;
  document.getElementById("juego-nombre").textContent = usuario.nombre;
  document.getElementById("juego-rol").textContent = usuario.rol;

  document.getElementById("juego-ronda").textContent = data.ronda;
  document.getElementById("juego-tema").textContent = info.tema;
  document.getElementById("juego-pista").textContent = info.pista;

  renderPalabra(data);
}


// =========================
//  RENDER PALABRA
// =========================
function renderPalabra(data) {
  const palabra = data.palabraActual;
  const usadas = data.letrasUsadas;

  let visible = "";

  for (let l of palabra) {
    visible += usadas.includes(l) ? l + " " : "_ ";
  }

  document.getElementById("juego-palabra").textContent = visible;
  document.getElementById("juego-letras").textContent = usadas.join(", ");
  document.getElementById("juego-fallos").textContent = data.fallos;
}


// =========================
//  ENVIAR LETRA
// =========================
document.getElementById("btn-enviar-letra").onclick = enviarLetra;

async function enviarLetra() {
  const input = document.getElementById("input-letra");
  let letra = input.value.toUpperCase();
  input.value = "";

  if (!letra.match(/[A-Z]/)) return;

  const salaRef = doc(db, "salas", salaActual);
  const snap = await getDoc(salaRef);
  const data = snap.data();

  if (data.letrasUsadas.includes(letra)) return;

  let nuevas = [...data.letrasUsadas, letra];
  let fallos = data.fallos;

  if (!data.palabraActual.includes(letra)) fallos++;

  await updateDoc(salaRef, {
    letrasUsadas: nuevas,
    fallos
  });
}

