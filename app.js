// Importamos Firebase desde la CDN (sin bundlers)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === CONFIGURACIÓN DE TU PROYECTO ===
const firebaseConfig = {
  apiKey: "AIzaSyBQhQ9plZjjtJtKVgQQ6Tacou-V8KjjwxU",
  authDomain: "ahorcado-multijugador.firebaseapp.com",
  projectId: "ahorcado-multijugador",
  storageBucket: "ahorcado-multijugador.firebasestorage.app",
  messagingSenderId: "725333546638",
  appId: "1:725333546638:web:c148f449912cbf7b96dbdf",
  measurementId: "G-0LJBY6EMBS"
};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === CONSTANTES DEL JUEGO ===
const MAX_FALLOS = 6;
const RONDAS = [
  {
    tema: "Valor",
    pista: "Es importante para convivir con los demás.",
    palabra: "RESPETO"
  },
  {
    tema: "Valor",
    pista: "Ser sincero y decir la verdad.",
    palabra: "HONESTIDAD"
  },
  {
    tema: "Valor",
    pista: "Cumplir con tus tareas y compromisos.",
    palabra: "RESPONSABILIDAD"
  },
  {
    tema: "Valor",
    pista: "Ayudar a los demás sin esperar nada a cambio.",
    palabra: "SOLIDARIDAD"
  },
  {
    tema: "Valor",
    pista: "Ponerse en el lugar del otro.",
    palabra: "EMPATIA"
  }
];

// === ESTADO LOCAL ===
let salaCodigo = null;
let jugadorId = null;
let jugadorNombre = "";
let esDocente = false;
let unsubscribeSala = null;
let unsubscribeJugadores = null;
let ultimoEstadoSala = null;

// === UTILES DOM ===
const $ = (id) => document.getElementById(id);

function mostrarVista(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(id).classList.add("active");
}

// === EVENTOS INICIALES ===
window.addEventListener("DOMContentLoaded", () => {
  // Botones menú
  $("btn-docente").onclick = () => mostrarVista("view-docente");
  $("btn-estudiante").onclick = () => mostrarVista("view-estudiante");

  $("btn-volver-docente").onclick = () => mostrarVista("view-menu");
  $("btn-volver-estudiante").onclick = () => mostrarVista("view-menu");

  $("btn-crear-sala").onclick = crearSala;
  $("btn-iniciar-juego").onclick = iniciarJuego;

  $("btn-unirse").onclick = unirseSala;

  $("btn-enviar-letra").onclick = enviarLetra;
  $("btn-salir-juego").onclick = salirJuego;
});

// === LÓGICA: CREAR SALA (DOCENTE) ===
async function crearSala() {
  const nombreDocente = $("docente-nombre").value.trim() || "Docente";

  // Generar código de sala sencillo (letras y números)
  const codigo = generarCodigo();

  salaCodigo = codigo;
  jugadorNombre = nombreDocente;
  esDocente = true;

  // Crear documento de sala en Firestore
  const salaRef = doc(db, "salas", codigo);

  const salaInicial = {
    codigo,
    estado: "esperando", // esperando | jugando | terminado
    ronda: 0,
    tema: "",
    pista: "",
    palabraActual: "",
    progreso: "",
    letrasUsadas: [],
    fallos: 0,
    turnoActualId: null,
    turnoActualNombre: "",
    ordenTurnos: [],
    turnoIndex: 0,
    creadoEn: serverTimestamp()
  };

  await setDoc(salaRef, salaInicial);

  // Agregar al docente como jugador
  const jugadoresCol = collection(salaRef, "jugadores");
  const jugadorDoc = await addDoc(jugadoresCol, {
    nombre: nombreDocente,
    creadoEn: serverTimestamp()
  });
  jugadorId = jugadorDoc.id;

  // Mostrar info en pantalla
  $("texto-codigo").innerText = codigo;
  $("docente-info-sala").classList.remove("hidden");

  // Ir a la vista de juego para el docente cuando inicie el juego
  suscribirSala();
  suscribirJugadores();

  $("juego-nombre").innerText = jugadorNombre;
  $("juego-rol").innerText = "DOCENTE";
  $("juego-rol").style.display = "inline-block";
}

// === LÓGICA: UNIRSE A SALA (ESTUDIANTE) ===
async function unirseSala() {
  const codigo = $("join-codigo").value.trim().toUpperCase();
  const nombre = $("join-nombre").value.trim();
  const errorEl = $("join-error");
  errorEl.innerText = "";

  if (!codigo || !nombre) {
    errorEl.innerText = "Completa el código y tu nombre.";
    return;
  }

  const salaRef = doc(db, "salas", codigo);
  const salaSnap = await getDoc(salaRef);

  if (!salaSnap.exists()) {
    errorEl.innerText = "No existe una sala con ese código.";
    return;
  }

  const salaData = salaSnap.data();
  if (salaData.estado === "terminado") {
    errorEl.innerText = "Esta sala ya terminó.";
    return;
  }

  // Registramos jugador
  const jugadoresCol = collection(salaRef, "jugadores");
  const jugadorDoc = await addDoc(jugadoresCol, {
    nombre,
    creadoEn: serverTimestamp()
  });

  salaCodigo = codigo;
  jugadorId = jugadorDoc.id;
  jugadorNombre = nombre;
  esDocente = false;

  // Suscribirse a cambios
  suscribirSala();
  suscribirJugadores();

  // Actualizar UI
  $("juego-nombre").innerText = jugadorNombre;
  $("juego-rol").innerText = "ESTUDIANTE";
  $("juego-rol").style.display = "inline-block";

  mostrarVista("view-juego");
}

// === SUSCRIPCIONES A FIRESTORE ===
function suscribirSala() {
  if (!salaCodigo) return;
  const salaRef = doc(db, "salas", salaCodigo);

  if (unsubscribeSala) unsubscribeSala();

  unsubscribeSala = onSnapshot(salaRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    ultimoEstadoSala = data;
    actualizarVistaJuego(data);
  });

  $("juego-codigo").innerText = salaCodigo;
}

function suscribirJugadores() {
  if (!salaCodigo) return;
  const salaRef = doc(db, "salas", salaCodigo);
  const jugadoresCol = collection(salaRef, "jugadores");

  if (unsubscribeJugadores) unsubscribeJugadores();

  unsubscribeJugadores = onSnapshot(jugadoresCol, (querySnap) => {
    const jugadores = [];
    querySnap.forEach((doc) => {
      jugadores.push({ id: doc.id, ...doc.data() });
    });

    // Orden por hora de ingreso
    jugadores.sort((a, b) => (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0));

    // Pintar lista en vista docente y juego
    const ulDoc = $("lista-jugadores");
    const ulJuego = $("juego-lista-jugadores");
    ulDoc.innerHTML = "";
    ulJuego.innerHTML = "";

    jugadores.forEach((j) => {
      const li1 = document.createElement("li");
      li1.textContent = j.nombre;
      ulDoc.appendChild(li1);

      const li2 = document.createElement("li");
      li2.textContent = j.nombre + (j.id === jugadorId ? " (tú)" : "");
      ulJuego.appendChild(li2);
    });

    // Habilitar botón "Iniciar juego" si es docente y hay al menos 2 jugadores
    if (esDocente) {
      $("btn-iniciar-juego").disabled = jugadores.length < 2;
    }
  });
}

// === INICIAR JUEGO (solo docente) ===
async function iniciarJuego() {
  if (!esDocente || !salaCodigo) return;
  const salaRef = doc(db, "salas", salaCodigo);
  const salaSnap = await getDoc(salaRef);
  if (!salaSnap.exists()) return;

  // Obtenemos lista de jugadores para el orden de turnos
  const salaData = salaSnap.data();

  // Para obtener jugadores de forma sencilla:
  // volvemos a leer subcolección (podría optimizarse usando estado local, pero simple es mejor aquí)
  const jugadoresCol = collection(salaRef, "jugadores");
  const querySnap = await new Promise((resolve, reject) => {
    const unsub = onSnapshot(
      jugadoresCol,
      (q) => {
        resolve(q);
        unsub();
      },
      reject
    );
  });

  const jugadores = [];
  querySnap.forEach((d) => jugadores.push({ id: d.id, ...d.data() }));

  if (jugadores.length < 2) {
    alert("Necesitas al menos 2 jugadores para empezar.");
    return;
  }

  // Orden de turnos por hora de entrada
  jugadores.sort((a, b) => (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0));
  const ordenIds = jugadores.map((j) => j.id);
  const turnoIndex = 0;
  const turnoActualId = ordenIds[0];
  const turnoActualNombre = jugadores[0].nombre;

  // Primera ronda
  const ronda = 0;
  const info = RONDAS[ronda];
  const palabra = info.palabra.toUpperCase();
  const progreso = "_".repeat(palabra.length);

  await updateDoc(salaRef, {
    estado: "jugando",
    ronda,
    tema: info.tema,
    pista: info.pista,
    palabraActual: palabra,
    progreso,
    letrasUsadas: [],
    fallos: 0,
    ordenTurnos: ordenIds,
    turnoIndex,
    turnoActualId,
    turnoActualNombre
  });

  mostrarVista("view-juego");
}

// === ACTUALIZAR VISTA DE JUEGO CON ESTADO DE SALA ===
function actualizarVistaJuego(data) {
  if (!data) return;

  $("juego-ronda").innerText = data.ronda + 1;
  $("juego-tema").innerText = data.tema || "-";
  $("juego-pista").innerText = data.pista || "-";
  $("juego-palabra").innerText = separarLetras(data.progreso || "");
  $("juego-letras").innerText = (data.letrasUsadas || []).join(", ");
  $("juego-fallos").innerText = data.fallos || 0;
  $("juego-turno-nombre").innerText = data.turnoActualNombre || "-";

  // Mensajes según estado
  const msgEl = $("juego-mensaje");
  msgEl.innerText = "";

  if (data.estado === "esperando") {
    msgEl.innerText = "Esperando a que el docente inicie el juego.";
    deshabilitarInput(true);
  } else if (data.estado === "jugando") {
    if (jugadorId === data.turnoActualId) {
      msgEl.innerText = "¡Es tu turno! Escribe una letra.";
      deshabilitarInput(false);
    } else {
      msgEl.innerText = "Es turno de " + (data.turnoActualNombre || "");
      deshabilitarInput(true);
    }
  } else if (data.estado === "terminado") {
    msgEl.innerText = "Juego terminado. ¡Buen trabajo!";
    deshabilitarInput(true);
  }

  // Aseguramos que la vista de juego esté visible si ya estamos dentro de una sala
  if (data.estado === "jugando") {
    mostrarVista("view-juego");
}

}

function deshabilitarInput(disabled) {
  $("input-letra").disabled = disabled;
  $("btn-enviar-letra").disabled = disabled;
}

function separarLetras(str) {
  return str.split("").join(" ");
}

// === ENVIAR LETRA (cuando es tu turno) ===
async function enviarLetra() {
  if (!salaCodigo || !ultimoEstadoSala) return;

  const salaRef = doc(db, "salas", salaCodigo);
  const data = ultimoEstadoSala;

  if (data.estado !== "jugando") return;
  if (jugadorId !== data.turnoActualId) return; // no es tu turno

  let letra = $("input-letra").value.trim().toUpperCase();
  $("input-letra").value = "";

  if (!letra.match(/^[A-ZÑ]$/)) {
    $("juego-mensaje").innerText = "Escribe una sola letra.";
    return;
  }

  if ((data.letrasUsadas || []).includes(letra)) {
    $("juego-mensaje").innerText = "Esa letra ya se usó.";
    return;
  }

  const palabra = data.palabraActual;
  let progreso = data.progreso;
  let letrasUsadas = [...(data.letrasUsadas || []), letra];
  let fallos = data.fallos || 0;

  let acierto = false;
  let nuevoProgreso = "";

  for (let i = 0; i < palabra.length; i++) {
    if (palabra[i] === letra) {
      nuevoProgreso += letra;
      acierto = true;
    } else {
      nuevoProgreso += progreso[i];
    }
  }

  progreso = nuevoProgreso;
  if (!acierto) {
    fallos += 1;
  }

  // Calcular siguiente turno
  const ordenTurnos = data.ordenTurnos || [];
  let turnoIndex = data.turnoIndex || 0;
  if (ordenTurnos.length > 0) {
    turnoIndex = (turnoIndex + 1) % ordenTurnos.length;
  }
  const turnoActualId = ordenTurnos[turnoIndex] || null;

  // Para mostrar el nombre del nuevo turno necesitamos buscarlo
  let turnoActualNombre = data.turnoActualNombre;
  // Como no tenemos lista de jugadores aquí, dejamos el nombre igual
  // (los jugadores ya saben la rotación en la práctica).

  let nuevoEstado = {
    progreso,
    letrasUsadas,
    fallos,
    turnoIndex,
    turnoActualId,
    turnoActualNombre
  };

  // ¿Completó palabra?
  if (progreso === palabra) {
    // Pasar a la siguiente ronda
    let siguienteRonda = data.ronda + 1;
    if (siguienteRonda >= RONDAS.length) {
      // Juego terminado
      nuevoEstado.estado = "terminado";
    } else {
      const info = RONDAS[siguienteRonda];
      const nuevaPalabra = info.palabra.toUpperCase();
      const nuevoProgresoRonda = "_".repeat(nuevaPalabra.length);

      nuevoEstado = {
        ...nuevoEstado,
        ronda: siguienteRonda,
        tema: info.tema,
        pista: info.pista,
        palabraActual: nuevaPalabra,
        progreso: nuevoProgresoRonda,
        letrasUsadas: [],
        fallos: 0,
        estado: "jugando"
      };
    }
  } else if (fallos >= MAX_FALLOS) {
    // Si llegan al máximo de fallos, también pasamos de ronda
    let siguienteRonda = data.ronda + 1;
    if (siguienteRonda >= RONDAS.length) {
      nuevoEstado.estado = "terminado";
    } else {
      const info = RONDAS[siguienteRonda];
      const nuevaPalabra = info.palabra.toUpperCase();
      const nuevoProgresoRonda = "_".repeat(nuevaPalabra.length);

      nuevoEstado = {
        ...nuevoEstado,
        ronda: siguienteRonda,
        tema: info.tema,
        pista: info.pista,
        palabraActual: nuevaPalabra,
        progreso: nuevoProgresoRonda,
        letrasUsadas: [],
        fallos: 0,
        estado: "jugando"
      };
    }
  }

  await updateDoc(salaRef, nuevoEstado);
}

// === SALIR DEL JUEGO ===
function salirJuego() {
  // No borramos la sala, solo salimos visualmente
  if (unsubscribeSala) unsubscribeSala();
  if (unsubscribeJugadores) unsubscribeJugadores();

  salaCodigo = null;
  jugadorId = null;
  jugadorNombre = "";
  esDocente = false;
  ultimoEstadoSala = null;

  mostrarVista("view-menu");
}

// === UTIL: generar código de sala ===
function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
