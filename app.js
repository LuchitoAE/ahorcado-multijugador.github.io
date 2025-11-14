// app.js - Versión con turnos, 10 fallos y SVG cartoon
// Usa las mismas importaciones modular CDN que tenías antes (10.x)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------
// CONFIG FIREBASE (tu config)
// ---------------------------
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

// ---------------------------
// CONSTANTES / ESTADO
// ---------------------------
const PARTES_MAX = 10; // 4 del soporte + 6 del cuerpo
const RONDAS = [
  { tema: "Valor", pista: "Es importante para convivir con los demás.", palabra: "RESPETO" },
  { tema: "Valor", pista: "Ser sincero y decir la verdad.", palabra: "HONESTIDAD" },
  { tema: "Valor", pista: "Cumplir con tus tareas y compromisos.", palabra: "RESPONSABILIDAD" },
  { tema: "Valor", pista: "Ayudar a los demás sin esperar nada a cambio.", palabra: "SOLIDARIDAD" },
  { tema: "Valor", pista: "Ponerse en el lugar del otro.", palabra: "EMPATIA" }
];

let salaCodigo = null;
let jugadorId = null;
let jugadorNombre = "";
let esDocente = false;
let unsubscribeSala = null;
let unsubscribeJugadores = null;
let ultimoEstadoSala = null;
let jugadoresCache = {}; // {id: {nombre, rol}}

// ---------------------------
// UTILS DOM
// ---------------------------
const $ = (id) => document.getElementById(id);

function mostrarVista(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $(id).classList.add("active");
}

// ---------------------------
// EVENTOS INIT
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {
  $("btn-docente").onclick = () => mostrarVista("view-docente");
  $("btn-estudiante").onclick = () => mostrarVista("view-estudiante");
  $("btn-volver-docente").onclick = () => mostrarVista("view-menu");
  $("btn-volver-estudiante").onclick = () => mostrarVista("view-menu");

  $("btn-crear-sala").onclick = crearSala;
  $("btn-iniciar-juego").onclick = iniciarJuego;
  $("btn-unirse").onclick = unirseSala;

  $("btn-enviar-letra").onclick = enviarLetra;
  $("btn-salir-juego").onclick = salirJuego;

  // Crear contenedor SVG si no existe (para el dibujo)
  ensureAhorcadoSVG();
});

// ---------------------------
// SVG: Crear contenedor y elementos (cartoon)
// ---------------------------
function ensureAhorcadoSVG() {
  // Buscamos un contenedor en la vista-juego, si no existe lo añadimos
  const card = document.querySelector("#view-juego .card");
  if (!card) return;

  if (!document.getElementById("ahorcado-container")) {
    const cont = document.createElement("div");
    cont.id = "ahorcado-container";
    cont.style.width = "100%";
    cont.style.maxWidth = "320px";
    cont.style.margin = "8px auto";
    cont.style.display = "flex";
    cont.style.justifyContent = "center";
    cont.style.alignItems = "center";
    // Insert before palabra
    const palabraEl = document.getElementById("juego-palabra");
    card.insertBefore(cont, palabraEl.parentElement);
    cont.innerHTML = renderAhorcadoSVGMarkup();
  }
}

// SVG markup with 10 parts (hidden by default)
function renderAhorcadoSVGMarkup() {
  // Parts have ids p1..p10 - style controlled by JS
  return `
  <svg id="ahorcado-svg" viewBox="0 0 220 240" width="100%" preserveAspectRatio="xMidYMid meet">
    <!-- Base (p1) -->
    <rect id="p1" x="10" y="220" width="120" height="8" rx="3" style="fill:#8B5E34; display:none;"></rect>
    <!-- Poste vertical (p2) -->
    <rect id="p2" x="30" y="40" width="8" height="180" rx="4" style="fill:#8B5E34; display:none;"></rect>
    <!-- Poste horizontal (p3) -->
    <rect id="p3" x="30" y="40" width="80" height="8" rx="4" style="fill:#8B5E34; display:none;"></rect>
    <!-- Cuerda (p4) -->
    <line id="p4" x1="110" y1="48" x2="110" y2="80" style="stroke:#B46A4A; stroke-width:3; stroke-linecap:round; display:none;"></line>

    <!-- Cabeza (p5) - cartoon -->
    <g id="p5" style="display:none;">
      <circle cx="110" cy="96" r="14" style="fill:#FFD9C0; stroke:#6B3B2A; stroke-width:2"></circle>
      <circle cx="104" cy="92" r="2" style="fill:#6B3B2A"></circle>
      <circle cx="116" cy="92" r="2" style="fill:#6B3B2A"></circle>
      <path d="M102 100 q8 6 16 0" style="stroke:#6B3B2A; stroke-width:1.5; fill:none" />
    </g>

    <!-- Cuerpo (p6) -->
    <line id="p6" x1="110" y1="110" x2="110" y2="150" style="stroke:#6B3B2A; stroke-width:4; stroke-linecap:round; display:none;"></line>

    <!-- Brazo izquierdo (p7) -->
    <line id="p7" x1="110" y1="118" x2="92" y2="136" style="stroke:#6B3B2A; stroke-width:4; stroke-linecap:round; display:none;"></line>

    <!-- Brazo derecho (p8) -->
    <line id="p8" x1="110" y1="118" x2="128" y2="136" style="stroke:#6B3B2A; stroke-width:4; stroke-linecap:round; display:none;"></line>

    <!-- Pierna izquierda (p9) -->
    <line id="p9" x1="110" y1="150" x2="96" y2="178" style="stroke:#6B3B2A; stroke-width:4; stroke-linecap:round; display:none;"></line>

    <!-- Pierna derecha (p10) -->
    <line id="p10" x1="110" y1="150" x2="124" y2="178" style="stroke:#6B3B2A; stroke-width:4; stroke-linecap:round; display:none;"></line>

    <!-- Extras: decoración (aura de color) -->
    <circle cx="110" cy="96" r="22" style="fill:none; stroke:#FDE68A; stroke-width:0.8; opacity:0.0; display:none;" id="p-deco"></circle>
  </svg>
  `;
}

// Function to reveal parts according to number (1..10)
function dibujarAhorcado(fallos) {
  for (let i = 1; i <= PARTES_MAX; i++) {
    const el = document.getElementById("p" + i);
    if (!el) continue;
    if (i <= fallos) {
      el.style.display = ""; // show
      // cartoon accent: slight animation for body parts
      el.animate ? el.animate([{ transform: "translateY(-4px)" }, { transform: "translateY(0px)" }], { duration: 300, iterations: 1 }) : null;
    } else {
      el.style.display = "none";
    }
  }
}

// ---------------------------
// CREAR SALA (docente)
// ---------------------------
async function crearSala() {
  const nombreDocente = $("docente-nombre").value.trim() || "Docente";
  const codigo = generarCodigo();

  salaCodigo = codigo;
  jugadorNombre = nombreDocente;
  esDocente = true;

  const salaRef = doc(db, "salas", codigo);

  const salaInicial = {
    codigo,
    estado: "esperando", // esperando | jugando | terminado
    juegoIniciado: false,
    ronda: 0,
    tema: "",
    pista: "",
    palabraActual: "",
    progreso: "",
    letrasUsadas: [],
    fallos: 0,
    ordenTurnos: [],
    turnoIndex: 0,
    turnoActualId: null,
    turnoActualNombre: "",
    creadoEn: serverTimestamp()
  };

  await setDoc(salaRef, salaInicial);

  // Agregar al docente como jugador (subcolección)
  const jugadoresCol = collection(salaRef, "jugadores");
  const jugadorDoc = await addDoc(jugadoresCol, {
    nombre: nombreDocente,
    rol: "docente",
    creadoEn: serverTimestamp()
  });
  jugadorId = jugadorDoc.id;

  // UI
  $("texto-codigo").innerText = codigo;
  $("docente-info-sala").classList.remove("hidden");

  suscribirSala();
  suscribirJugadores();

  $("juego-nombre").innerText = jugadorNombre;
  $("juego-rol").innerText = "DOCENTE";
  $("juego-rol").style.display = "inline-block";

  mostrarVista("view-docente");
}

// ---------------------------
// UNIRSE A SALA (estudiante)
// ---------------------------
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
    rol: "estudiante",
    creadoEn: serverTimestamp()
  });

  salaCodigo = codigo;
  jugadorId = jugadorDoc.id;
  jugadorNombre = nombre;
  esDocente = false;

  suscribirSala();
  suscribirJugadores();

  $("juego-nombre").innerText = jugadorNombre;
  $("juego-rol").innerText = "ESTUDIANTE";
  $("juego-rol").style.display = "inline-block";

  // Mostrar vista de juego en modo espera (para que vea tablero y lista)
  mostrarVista("view-juego");
}

// ---------------------------
// SUSCRIPCIONES
// ---------------------------
function suscribirSala() {
  if (!salaCodigo) return;
  const salaRef = doc(db, "salas", salaCodigo);

  if (unsubscribeSala) unsubscribeSala();

  unsubscribeSala = onSnapshot(salaRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    ultimoEstadoSala = data;

    // Actualizar UI
    actualizarVistaJuego(data);

    // Mostrar dibujo segun fallos
    dibujarAhorcado(data.fallos || 0);

    // Control vistas: solo pasar a view-juego si el juego inició
    if (data.juegoIniciado || data.estado === "jugando") {
      mostrarVista("view-juego");
    } else {
      // Si soy docente, asegurar vista de docente para gestión
      if (esDocente) {
        $("texto-codigo").innerText = salaCodigo;
        $("docente-info-sala").classList.remove("hidden");
        mostrarVista("view-docente");
      }
    }

    // Si el juego terminó: mostrar mensaje final
    if (data.estado === "terminado") {
      if (data.fallos >= PARTES_MAX) {
        $("juego-mensaje").innerText = "¡Perdieron! El ahorcado quedó completo.";
      } else {
        $("juego-mensaje").innerText = "¡Juego terminado!";
      }
      deshabilitarInput(true);
    }
  });
}

function suscribirJugadores() {
  if (!salaCodigo) return;
  const jugadoresCol = collection(db, "salas", salaCodigo, "jugadores");

  if (unsubscribeJugadores) unsubscribeJugadores();

  unsubscribeJugadores = onSnapshot(jugadoresCol, (querySnap) => {
    const jugadores = [];
    jugadoresCache = {};
    querySnap.forEach((doc) => {
      jugadores.push({ id: doc.id, ...doc.data() });
      jugadoresCache[doc.id] = { ...(doc.data()) };
    });

    // Orden por timestamp (creadoEn)
    jugadores.sort((a, b) => (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0));

    // Pintar lista en vista docente y juego
    const ulDoc = $("lista-jugadores");
    const ulJuego = $("juego-lista-jugadores");
    ulDoc.innerHTML = "";
    ulJuego.innerHTML = "";

    jugadores.forEach((j) => {
      const li1 = document.createElement("li");
      li1.textContent = j.nombre + (j.rol ? ` (${j.rol})` : "");
      ulDoc.appendChild(li1);

      const li2 = document.createElement("li");
      li2.textContent = j.nombre + (j.id === jugadorId ? " (tú)" : "");
      ulJuego.appendChild(li2);
    });

    // Activar botón iniciar si docente y hay 2+ jugadores
    if (esDocente) {
      $("btn-iniciar-juego").disabled = jugadores.length < 2;
    }

    // Si el juego ya inició, actualizar nombre del turno si es posible
    if (ultimoEstadoSala && ultimoEstadoSala.ordenTurnos) {
      const turnoId = ultimoEstadoSala.turnoActualId;
      if (turnoId && jugadoresCache[turnoId]) {
        // actualizar nombre del turno en sala local
        // (nota: la sala doc ya contiene turnoActualNombre, pero mantenemos cache sincronizada)
      }
    }
  });
}

// ---------------------------
// INICIAR JUEGO (DOCENTE)
// ---------------------------
async function iniciarJuego() {
  if (!esDocente || !salaCodigo) return;
  const salaRef = doc(db, "salas", salaCodigo);

  // Tomar jugadores actuales y armar orden
  const jugadoresSnap = await getDocs(collection(salaRef, "jugadores"));
  const jugadores = [];
  jugadoresSnap.forEach(d => jugadores.push({ id: d.id, ...d.data() }));

  if (jugadores.length < 2) {
    alert("Necesitas al menos 2 jugadores para empezar.");
    return;
  }

  // Orden por timestamp de ingreso
  jugadores.sort((a, b) => (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0));
  const ordenIds = jugadores.map(j => j.id);

  // Construir mapping id->nombre para que la sala pueda mostrar nombres sin leer subcolección
  const nombresMap = {};
  jugadores.forEach(j => nombresMap[j.id] = j.nombre);

  const ronda = 0;
  const info = RONDAS[ronda];
  const palabra = info.palabra.toUpperCase();
  const progreso = "_".repeat(palabra.length);

  await updateDoc(salaRef, {
    estado: "jugando",
    juegoIniciado: true,
    ronda: ronda,
    tema: info.tema,
    pista: info.pista,
    palabraActual: palabra,
    progreso,
    letrasUsadas: [],
    fallos: 0,
    ordenTurnos: ordenIds,
    turnoIndex: 0,
    turnoActualId: ordenIds[0],
    turnoActualNombre: nombresMap[ordenIds[0]] || "",
    playerNames: nombresMap
  });

  // Mostrar vista juego localmente
  mostrarVista("view-juego");
}

// ---------------------------
// ACTUALIZAR UI DE JUEGO
// ---------------------------
function actualizarVistaJuego(data) {
  if (!data) return;

  $("juego-ronda").innerText = (data.ronda || 0) + 1;
  $("juego-tema").innerText = data.tema || "-";
  $("juego-pista").innerText = data.pista || "-";
  $("juego-palabra").innerText = separarLetras(data.progreso || "");
  $("juego-letras").innerText = (data.letrasUsadas || []).join(", ");
  $("juego-fallos").innerText = data.fallos || 0;
  $("juego-turno-nombre").innerText = data.turnoActualNombre || "-";

  // Mensaje y habilitación input según estado
  const msgEl = $("juego-mensaje");
  msgEl.innerText = "";

  if (data.estado === "esperando") {
    msgEl.innerText = "Esperando a que el docente inicie el juego.";
    deshabilitarInput(true);
  } else if (data.estado === "jugando") {
    // Solo permite jugar si eres el que tiene el turno
    if (jugadorId === data.turnoActualId) {
      msgEl.innerText = "¡Es tu turno! Escribe una letra.";
      deshabilitarInput(false);
    } else {
      msgEl.innerText = "Turno de " + (data.turnoActualNombre || "-");
      deshabilitarInput(true);
    }
  } else if (data.estado === "terminado") {
    deshabilitarInput(true);
    if (data.fallos >= PARTES_MAX) {
      msgEl.innerText = "¡Perdieron! El ahorcado quedó completo.";
    } else {
      msgEl.innerText = "Juego terminado. ¡Buen trabajo!";
    }
  }
}

// Disable/enable input
function deshabilitarInput(disabled) {
  $("input-letra").disabled = disabled;
  $("btn-enviar-letra").disabled = disabled;
}

// separador para mostrar espacios
function separarLetras(str) {
  return str.split("").join(" ");
}

// ---------------------------
// ENVIAR LETRA (SOLO JUGADOR ACTIVO)
// ---------------------------
async function enviarLetra() {
  if (!salaCodigo || !ultimoEstadoSala) return;

  const salaRef = doc(db, "salas", salaCodigo);
  const data = ultimoEstadoSala;

  if (data.estado !== "jugando") return;

  // Validar turno
  if (jugadorId !== data.turnoActualId) {
    $("juego-mensaje").innerText = "No es tu turno.";
    return;
  }

  let letra = $("input-letra").value.trim().toUpperCase();
  $("input-letra").value = "";

  if (!letra.match(/^[A-ZÑ]$/)) {
    $("juego-mensaje").innerText = "Escribe una sola letra válida.";
    return;
  }

  if ((data.letrasUsadas || []).includes(letra)) {
    $("juego-mensaje").innerText = "Esa letra ya se usó.";
    return;
  }

  const palabra = data.palabraActual || "";
  let progreso = data.progreso || "";
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

  // Calcular siguiente turno (round robin)
  const ordenTurnos = data.ordenTurnos || [];
  let turnoIndex = (typeof data.turnoIndex === "number") ? data.turnoIndex : 0;
  if (ordenTurnos.length > 0) {
    turnoIndex = (turnoIndex + 1) % ordenTurnos.length;
  }
  const turnoActualId = ordenTurnos[turnoIndex] || null;

  // Obtener nombre del siguiente turno desde playerNames si existe
  let turnoActualNombre = data.playerNames && data.playerNames[turnoActualId] ? data.playerNames[turnoActualId] : data.turnoActualNombre || "";

  // Preparamos nuevo estado
  let nuevoEstado = {
    progreso,
    letrasUsadas,
    fallos,
    turnoIndex,
    turnoActualId,
    turnoActualNombre
  };

  // ¿Se completó la palabra?
  if (progreso === palabra) {
    // Siguiente ronda o terminar
    let siguienteRonda = (data.ronda || 0) + 1;
    if (siguienteRonda >= RONDAS.length) {
      nuevoEstado.estado = "terminado";
      nuevoEstado.juegoIniciado = false;
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
        estado: "jugando",
      };
    }
  } else if (fallos >= PARTES_MAX) {
    // Perdieron
    nuevoEstado.estado = "terminado";
    nuevoEstado.juegoIniciado = false;
  }

  await updateDoc(salaRef, nuevoEstado);
}

// ---------------------------
// SALIR DEL JUEGO
// ---------------------------
function salirJuego() {
  if (unsubscribeSala) unsubscribeSala();
  if (unsubscribeJugadores) unsubscribeJugadores();

  salaCodigo = null;
  jugadorId = null;
  jugadorNombre = "";
  esDocente = false;
  ultimoEstadoSala = null;
  jugadoresCache = {};

  mostrarVista("view-menu");
}

// ---------------------------
// UTIL GENERAR CODIGO
// ---------------------------
function generarCodigo() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
