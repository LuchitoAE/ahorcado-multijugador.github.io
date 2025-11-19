// app.js - Versión con:
// - Turnos, 10 fallos y SVG cartoon
// - Contenido Personal Social (Perú) con rondas dinámicas
// - Flujo ampliado Docente (login/registro/selección/crear sala)

// ---------------------------
// IMPORTS FIREBASE
// ---------------------------
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
  // query,
  // orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------
// CONFIG FIREBASE
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
// CONSTANTES / ESTADO GLOBAL
// ---------------------------
const PARTES_MAX = 10;   // 4 del soporte + 6 del cuerpo
const NUM_RONDAS = 5;    // número de rondas por partida

// Banco de contenido: Personal Social (Perú)
const BANCO_PERU = [
  // Símbolos y cívica
  { tema: "Símbolos", pista: "Rojo y blanco, símbolo del país.", palabra: "BANDERA" },
  { tema: "Símbolos", pista: "Tiene vicuña, quina y cornucopia.", palabra: "ESCUDO" },
  { tema: "Símbolos", pista: "Lo cantamos en actos cívicos.", palabra: "HIMNO" },
  { tema: "Cívica",   pista: "Nuestro país en Sudamérica.", palabra: "PERU" },
  { tema: "Cívica",   pista: "Se celebra el 28 de julio.", palabra: "INDEPENDENCIA" },

  // Regiones y geografía
  { tema: "Regiones",   pista: "Zona pegada al mar.", palabra: "COSTA" },
  { tema: "Regiones",   pista: "Zona de montañas altas.", palabra: "SIERRA" },
  { tema: "Regiones",   pista: "Zona de bosques y ríos.", palabra: "SELVA" },
  { tema: "Geografía",  pista: "Grandes montañas del Perú.", palabra: "ANDES" },
  { tema: "Geografía",  pista: "Océano al oeste del Perú.", palabra: "PACIFICO" },
  { tema: "Ríos",       pista: "Nace en Perú y cruza Sudamérica.", palabra: "AMAZONAS" },
  { tema: "Lagos",      pista: "Lago alto compartido con Bolivia.", palabra: "TITICACA" },
  { tema: "Geografía",  pista: "Famoso cañón en Arequipa.", palabra: "COLCA" },

  // Ciudades y regiones
  { tema: "Capitales",  pista: "Capital del Perú.", palabra: "LIMA" },
  { tema: "Ciudades",   pista: "Ciudad inca y turística.", palabra: "CUSCO" },
  { tema: "Ciudades",   pista: "Ciudad blanca del Misti.", palabra: "AREQUIPA" },
  { tema: "Ciudades",   pista: "Región cálida al norte.", palabra: "PIURA" },
  { tema: "Ciudades",   pista: "Región de uvas y dunas.", palabra: "ICA" },
  { tema: "Ciudades",   pista: "Región del lago Titicaca.", palabra: "PUNO" },

  // Patrimonio
  { tema: "Patrimonio", pista: "Ciudadela inca en la montaña.", palabra: "MACHUPICCHU" },
  { tema: "Patrimonio", pista: "Líneas misteriosas del desierto.", palabra: "NAZCA" },
  { tema: "Patrimonio", pista: "Ciudad de barro chimú.", palabra: "CHANCHAN" },
  { tema: "Patrimonio", pista: "Ciudad muy antigua de América.", palabra: "CARAL" },
  { tema: "Patrimonio", pista: "Fortaleza de los chachapoyas.", palabra: "KUELAP" },

  // Danzas
  { tema: "Danzas",     pista: "Baile elegante del norte.", palabra: "MARINERA" },
  { tema: "Danzas",     pista: "Baile andino tradicional.", palabra: "HUAYNO" },
  { tema: "Danzas",     pista: "Baile afroperuano alegre.", palabra: "FESTEJO" },

  // Gastronomía
  { tema: "Gastronomía", pista: "Plato de pescado con limón.", palabra: "CEVICHE" },
  { tema: "Gastronomía", pista: "Cocción bajo tierra con piedras.", palabra: "PACHAMANCA" },

  // Lenguas y pueblos
  { tema: "Lenguas",     pista: "Lengua andina del Tahuantinsuyo.", palabra: "QUECHUA" },
  { tema: "Lenguas",     pista: "Lengua del altiplano.", palabra: "AIMARA" },

  // Animales emblemáticos
  { tema: "Animales",    pista: "Ave de los Andes, vuela alto.", palabra: "CONDOR" },
  { tema: "Animales",    pista: "Camélido de lana fina.", palabra: "ALPACA" },
  { tema: "Animales",    pista: "Camélido que carga y escupe.", palabra: "LLAMA" },
  { tema: "Animales",    pista: "Animal nacional con Ñ.", palabra: "VICUÑA" },

  // Valores (refuerzo)
  { tema: "Valores",     pista: "Tratar bien a los demás.", palabra: "RESPETO" },
  { tema: "Valores",     pista: "Decir la verdad.", palabra: "HONESTIDAD" },
  { tema: "Valores",     pista: "Cumplir tareas y compromisos.", palabra: "RESPONSABILIDAD" },
  { tema: "Valores",     pista: "Ayudar a otros.", palabra: "SOLIDARIDAD" },
  { tema: "Valores",     pista: "Ponerse en el lugar del otro.", palabra: "EMPATIA" }
];

// Mezclar y tomar N rondas del banco
function sampleRondas(banco, n) {
  const arr = [...banco];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// Estado en memoria
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
  const view = $(id);
  if (view) view.classList.add("active");
}

function bindClick(id, handler) {
  const el = $(id);
  if (el) el.onclick = handler;
}

// ---------------------------
// EVENTOS INIT
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {
  // Menú principal
  bindClick("btn-estudiante", () => mostrarVista("view-estudiante"));

  // "Soy docente" → login docente
  bindClick("btn-docente", () => mostrarVista("view-login-docente"));

  // Botones de volver básicos
  bindClick("btn-volver-docente", () => mostrarVista("view-menu"));
  bindClick("btn-volver-estudiante", () => mostrarVista("view-menu"));

  // Flujo antiguo (docente/estudiante)
  bindClick("btn-crear-sala", crearSala);
  bindClick("btn-iniciar-juego", iniciarJuego);
  bindClick("btn-unirse", unirseSala);

  // Juego
  bindClick("btn-enviar-letra", enviarLetra);
  bindClick("btn-salir-juego", salirJuego);

  // -----------------------
  // NUEVO FLUJO DOCENTE
  // -----------------------

  // LOGIN DOCENTE
  bindClick("btn-doc-login-volver", () => mostrarVista("view-menu"));
  bindClick("btn-doc-login-registrarse", () => mostrarVista("view-registro-docente"));
  bindClick("btn-doc-login-ingresar", () => {
    const u = $("doc-login-usuario")?.value?.trim();
    if (u) {
      const nameField1 = $("docente-nombre");      // input en vista-docente original
      const nameField2 = $("docente-nombre-alt");  // input en vista-crear-sala nueva
      if (nameField1) nameField1.value = u;
      if (nameField2) nameField2.value = u;
    }
    mostrarVista("view-seleccionar-juego");
  });

  // REGISTRO DOCENTE (maquetación)
  bindClick("btn-doc-reg-volver", () => mostrarVista("view-login-docente"));
  bindClick("btn-doc-reg-crear", () => {
    // Aquí en el futuro podrías guardar en Firestore/Auth
    mostrarVista("view-registro-ok");
  });
  bindClick("btn-ir-a-login", () => mostrarVista("view-login-docente"));

  // SELECCIONAR JUEGO
  bindClick("btn-seljuego-volver", () => mostrarVista("view-login-docente"));
  bindClick("btn-ir-crear-sala", () => {
    // En futuro, podrías leer el select de juego (solo "ahorcado" por ahora)
    mostrarVista("view-crear-sala");
  });

  // CREAR SALA (flujo nuevo que luego llama a crearSala real)
  bindClick("btn-crear-sala-volver", () => mostrarVista("view-seleccionar-juego"));
  bindClick("btn-crear-sala-flow", () => {
    const altName = $("docente-nombre-alt")?.value?.trim();
    if (altName && $("docente-nombre")) $("docente-nombre").value = altName;

    // Crear sala usando la lógica original
    crearSala();
  });

  // Crear contenedor SVG si no existe (para el dibujo)
  ensureAhorcadoSVG();
});

// ---------------------------
// SVG: contenedor y dibujo cartoon
// ---------------------------
function ensureAhorcadoSVG() {
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

    const palabraEl = document.getElementById("juego-palabra");
    if (palabraEl && palabraEl.parentElement) {
      card.insertBefore(cont, palabraEl.parentElement);
    } else {
      card.appendChild(cont);
    }
    cont.innerHTML = renderAhorcadoSVGMarkup();
  }
}

function renderAhorcadoSVGMarkup() {
  // Partes p1..p10, ocultas por defecto
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
  </svg>
  `;
}

function dibujarAhorcado(fallos) {
  for (let i = 1; i <= PARTES_MAX; i++) {
    const el = document.getElementById("p" + i);
    if (!el) continue;
    if (i <= fallos) {
      el.style.display = "";
      if (el.animate) {
        el.animate(
          [{ transform: "translateY(-4px)" }, { transform: "translateY(0px)" }],
          { duration: 300, iterations: 1 }
        );
      }
    } else {
      el.style.display = "none";
    }
  }
}

// ---------------------------
// CREAR SALA (docente)
// ---------------------------
async function crearSala() {
  const nombreDocente = $("docente-nombre")?.value?.trim() || "Docente";
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
  if ($("texto-codigo")) $("texto-codigo").innerText = codigo;
  const infoSala = $("docente-info-sala");
  if (infoSala) infoSala.classList.remove("hidden");

  suscribirSala();
  suscribirJugadores();

  if ($("juego-nombre")) $("juego-nombre").innerText = jugadorNombre;
  if ($("juego-rol")) {
    $("juego-rol").innerText = "DOCENTE";
    $("juego-rol").style.display = "inline-block";
  }

  mostrarVista("view-docente");
}

// ---------------------------
// UNIRSE A SALA (estudiante)
// ---------------------------
async function unirseSala() {
  const codigo = $("join-codigo")?.value?.trim().toUpperCase();
  const nombre = $("join-nombre")?.value?.trim();
  const errorEl = $("join-error");

  if (errorEl) errorEl.innerText = "";

  if (!codigo || !nombre) {
    if (errorEl) errorEl.innerText = "Completa el código y tu nombre.";
    return;
  }

  const salaRef = doc(db, "salas", codigo);
  const salaSnap = await getDoc(salaRef);

  if (!salaSnap.exists()) {
    if (errorEl) errorEl.innerText = "No existe una sala con ese código.";
    return;
  }

  const salaData = salaSnap.data();
  if (salaData.estado === "terminado") {
    if (errorEl) errorEl.innerText = "Esta sala ya terminó.";
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

  if ($("juego-nombre")) $("juego-nombre").innerText = jugadorNombre;
  if ($("juego-rol")) {
    $("juego-rol").innerText = "ESTUDIANTE";
    $("juego-rol").style.display = "inline-block";
  }

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

    // Código de sala en la vista de juego
    if ($("juego-codigo")) $("juego-codigo").innerText = data.codigo || salaCodigo || "";

    // Dibujo según fallos
    dibujarAhorcado(data.fallos || 0);

    // Control vistas
    if (data.juegoIniciado || data.estado === "jugando") {
      mostrarVista("view-juego");
    } else {
      if (esDocente) {
        if ($("texto-codigo")) $("texto-codigo").innerText = salaCodigo;
        const infoSala = $("docente-info-sala");
        if (infoSala) infoSala.classList.remove("hidden");
        mostrarVista("view-docente");
      }
    }

    // Fin del juego
    if (data.estado === "terminado") {
      const msgEl = $("juego-mensaje");
      if (msgEl) {
        if (data.fallos >= PARTES_MAX) {
          msgEl.innerText = "¡Perdieron! El ahorcado quedó completo.";
        } else {
          msgEl.innerText = "¡Juego terminado!";
        }
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
    querySnap.forEach((d) => {
      jugadores.push({ id: d.id, ...d.data() });
      jugadoresCache[d.id] = { ...(d.data()) };
    });

    // Orden por timestamp
    jugadores.sort((a, b) => (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0));

    const ulDoc = $("lista-jugadores");
    const ulJuego = $("juego-lista-jugadores");
    if (ulDoc) ulDoc.innerHTML = "";
    if (ulJuego) ulJuego.innerHTML = "";

    jugadores.forEach((j) => {
      if (ulDoc) {
        const li1 = document.createElement("li");
        li1.textContent = j.nombre + (j.rol ? ` (${j.rol})` : "");
        ulDoc.appendChild(li1);
      }
      if (ulJuego) {
        const li2 = document.createElement("li");
        li2.textContent = j.nombre + (j.id === jugadorId ? " (tú)" : "");
        ulJuego.appendChild(li2);
      }
    });

    // Botón iniciar juego
    if (esDocente && $("btn-iniciar-juego")) {
      $("btn-iniciar-juego").disabled = jugadores.length < 2;
    }
  });
}

// ---------------------------
// INICIAR JUEGO (DOCENTE)
// ---------------------------
async function iniciarJuego() {
  if (!esDocente || !salaCodigo) return;
  const salaRef = doc(db, "salas", salaCodigo);

  const jugadoresSnap = await getDocs(collection(salaRef, "jugadores"));
  const jugadores = [];
  jugadoresSnap.forEach((d) => jugadores.push({ id: d.id, ...d.data() }));

  if (jugadores.length < 2) {
    alert("Necesitas al menos 2 jugadores para empezar.");
    return;
  }

  jugadores.sort((a, b) => (a.creadoEn?.seconds || 0) - (b.creadoEn?.seconds || 0));
  const ordenIds = jugadores.map((j) => j.id);

  const nombresMap = {};
  jugadores.forEach((j) => (nombresMap[j.id] = j.nombre));

  const ronda = 0;
  const rondasSesion = sampleRondas(BANCO_PERU, NUM_RONDAS);
  const info = rondasSesion[ronda];
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
    playerNames: nombresMap,
    // Guardamos la selección de rondas para esta sala
    rondas: rondasSesion
  });

  mostrarVista("view-juego");
}

// ---------------------------
// ACTUALIZAR UI DE JUEGO
// ---------------------------
function actualizarVistaJuego(data) {
  if (!data) return;

  if ($("juego-ronda")) $("juego-ronda").innerText = (data.ronda || 0) + 1;
  if ($("juego-tema")) $("juego-tema").innerText = data.tema || "-";
  if ($("juego-pista")) $("juego-pista").innerText = data.pista || "-";
  if ($("juego-palabra")) $("juego-palabra").innerText = separarLetras(data.progreso || "");
  if ($("juego-letras")) $("juego-letras").innerText = (data.letrasUsadas || []).join(", ");
  if ($("juego-fallos")) $("juego-fallos").innerText = data.fallos || 0;
  if ($("juego-turno-nombre")) $("juego-turno-nombre").innerText = data.turnoActualNombre || "-";

  const msgEl = $("juego-mensaje");
  if (msgEl) msgEl.innerText = "";

  if (data.estado === "esperando") {
    if (msgEl) msgEl.innerText = "Esperando a que el docente inicie el juego.";
    deshabilitarInput(true);
  } else if (data.estado === "jugando") {
    if (jugadorId === data.turnoActualId) {
      if (msgEl) msgEl.innerText = "¡Es tu turno! Escribe una letra.";
      deshabilitarInput(false);
    } else {
      if (msgEl) msgEl.innerText = "Turno de " + (data.turnoActualNombre || "-");
      deshabilitarInput(true);
    }
  } else if (data.estado === "terminado") {
    deshabilitarInput(true);
    if (msgEl) {
      if (data.fallos >= PARTES_MAX) {
        msgEl.innerText = "¡Perdieron! El ahorcado quedó completo.";
      } else {
        msgEl.innerText = "Juego terminado. ¡Buen trabajo!";
      }
    }
  }
}

function deshabilitarInput(disabled) {
  if ($("input-letra")) $("input-letra").disabled = disabled;
  if ($("btn-enviar-letra")) $("btn-enviar-letra").disabled = disabled;
}

function separarLetras(str) {
  return str.split("").join(" ");
}

// ---------------------------
// ENVIAR LETRA
// ---------------------------
async function enviarLetra() {
  if (!salaCodigo || !ultimoEstadoSala) return;

  const salaRef = doc(db, "salas", salaCodigo);
  const data = ultimoEstadoSala;

  if (data.estado !== "jugando") return;

  if (jugadorId !== data.turnoActualId) {
    const msg = $("juego-mensaje");
    if (msg) msg.innerText = "No es tu turno.";
    return;
  }

  let letra = $("input-letra")?.value?.trim().toUpperCase();
  if ($("input-letra")) $("input-letra").value = "";

  if (!letra || !letra.match(/^[A-ZÑ]$/)) {
    const msg = $("juego-mensaje");
    if (msg) msg.innerText = "Escribe una sola letra válida.";
    return;
  }

  if ((data.letrasUsadas || []).includes(letra)) {
    const msg = $("juego-mensaje");
    if (msg) msg.innerText = "Esa letra ya se usó.";
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

  const ordenTurnos = data.ordenTurnos || [];
  let turnoIndex = typeof data.turnoIndex === "number" ? data.turnoIndex : 0;
  if (ordenTurnos.length > 0) {
    turnoIndex = (turnoIndex + 1) % ordenTurnos.length;
  }
  const turnoActualId = ordenTurnos[turnoIndex] || null;

  let turnoActualNombre =
    (data.playerNames && data.playerNames[turnoActualId]) ||
    data.turnoActualNombre ||
    "";

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
    const rondasSesion =
      Array.isArray(data.rondas) && data.rondas.length
        ? data.rondas
        : sampleRondas(BANCO_PERU, NUM_RONDAS);

    let siguienteRonda = (data.ronda || 0) + 1;

    if (siguienteRonda >= rondasSesion.length) {
      nuevoEstado.estado = "terminado";
      nuevoEstado.juegoIniciado = false;
    } else {
      const info = rondasSesion[siguienteRonda];
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
  } else if (fallos >= PARTES_MAX) {
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
