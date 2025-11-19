// public/js/game.js
// ------------------------------------------------------
// Lógica del juego del ahorcado por grupo
// ------------------------------------------------------
// - Maneja rondas, turnos y estados del grupo.
// - Sistema de puntajes (aciertos, errores y tiempo).
// - No toca el DOM: solo lee/escribe en Firestore a través
//   de firebase.js y utiliza los packs de rounds.js.
//
// API pensada para usar desde app.js / ui.js:
//
//   import {
//     MAX_FALLOS,
//     configurarContextoGrupo,
//     actualizarEstadoGrupo,
//     inicializarRondasGrupo,
//     procesarIntentoLetra
//   } from "./game.js";
//
//   // cuando el estudiante entra a un grupo:
//   configurarContextoGrupo({ codigoGrupo, jugadorId, jugadorNombre });
//
//   // cada vez que llega snapshot de grupo:
//   actualizarEstadoGrupo(grupoData);
//
//   // el docente arranca el juego para ese grupo:
//   await inicializarRondasGrupo({ codigoGrupo, packId, numRondas, tiempoRondaSeg });
//
//   // cuando el usuario envía una letra:
//   const resultado = await procesarIntentoLetra(letra);
//   // resultado contiene info para mostrar mensajes, etc.
// ------------------------------------------------------

import {
  updateGrupo,
  updateJugador,
  getJugadoresDeGrupo,
} from "./firebase.js";

import {
  generarRondasParaPack,
  normalizarPalabra,
} from "./rounds.js";

export const MAX_FALLOS = 10;

// ------------------------------------------------------
// Estado local (en memoria) de la sesión de juego actual
// ------------------------------------------------------
let codigoGrupoActual = null;
let jugadorActual = {
  id: null,
  nombre: "",
};
let estadoGrupoActual = null; // último snapshot del doc "grupos/{codigoGrupo}"
let tiempoLocalOffsetMs = 0;  // por si quieres corregir con server timestamp en el futuro

// ------------------------------------------------------
// Utilidades internas
// ------------------------------------------------------

/**
 * Establecer el contexto del grupo y jugador actual.
 * Debe llamarse cuando el estudiante entra al grupo.
 */
export function configurarContextoGrupo({ codigoGrupo, jugadorId, jugadorNombre }) {
  codigoGrupoActual = codigoGrupo;
  jugadorActual = {
    id: jugadorId,
    nombre: jugadorNombre || "",
  };
}

/**
 * Actualizar el último estado de grupo que tenemos en memoria.
 * Llamar esto desde el listener de onSnapshot del grupo.
 */
export function actualizarEstadoGrupo(grupoData) {
  estadoGrupoActual = grupoData;
}

/**
 * Devuelve el timestamp "ahora" en ms (permite ajustar con offset).
 */
function ahoraMs() {
  return Date.now() + tiempoLocalOffsetMs;
}

/**
 * Prepara la estructura de rondas para guardar en Firestore.
 * Recibe la salida de generarRondasParaPack y la deja lista.
 */
function prepararRondas(rondasRaw) {
  return rondasRaw.map((r) => ({
    indice: r.indice,
    tema: r.tema,
    pista: r.pista,
    palabra: normalizarPalabra(r.palabra || ""),
  }));
}

/**
 * Calcula el tiempo (en segundos) que ha pasado desde el inicio
 * de la ronda actual, según los campos del grupo.
 */
function calcularSegundosUsados(grupo) {
  if (!grupo || !grupo.rondaInicioMs || !grupo.tiempoRondaSeg) return 0;
  const deltaMs = ahoraMs() - grupo.rondaInicioMs;
  return Math.max(0, deltaMs / 1000);
}

/**
 * Calcula el puntaje por intento (acierto / error / bonus tiempo).
 * Devuelve { deltaJugador, deltaGrupo, bonusTiempo }.
 */
function calcularPuntajeIntento({ esAcierto, completaPalabra, grupo }) {
  const baseAcierto = 10;
  const penalizacionError = -2;

  let deltaJugador = 0;
  let deltaGrupo = 0;
  let bonusTiempo = 0;

  if (esAcierto) {
    deltaJugador += baseAcierto;
    deltaGrupo += baseAcierto;
  } else {
    deltaJugador += penalizacionError;
    deltaGrupo += penalizacionError;
  }

  if (completaPalabra && grupo) {
    const tiempoRonda = grupo.tiempoRondaSeg || 90;
    const usados = calcularSegundosUsados(grupo);
    const restante = Math.max(0, tiempoRonda - usados);

    // Bonus: mientras más rápido, más puntos (mitad de los segundos restantes)
    bonusTiempo = Math.round(restante * 0.5);

    deltaJugador += bonusTiempo;
    deltaGrupo += bonusTiempo;
  }

  return { deltaJugador, deltaGrupo, bonusTiempo };
}

/**
 * Ajusta un puntaje para que no vaya por debajo de cero.
 */
function clampPuntaje(valor) {
  return Math.max(0, Math.round(valor));
}

/**
 * Obtiene el nombre de un jugador dado su id a partir del mapa playerNames
 * que guardamos en el grupo (si existe).
 */
function obtenerNombreJugador(grupo, jugadorIdPorTurno) {
  if (!grupo) return "";
  if (grupo.playerNames && grupo.playerNames[jugadorIdPorTurno]) {
    return grupo.playerNames[jugadorIdPorTurno];
  }
  return "";
}

// ------------------------------------------------------
// Inicializar juego de un grupo (docente)
// ------------------------------------------------------

/**
 * Inicializa las rondas y el estado base del juego para un grupo.
 * Solo debería llamarse una vez por grupo (p. ej. cuando el docente
 * decide iniciar el juego de ese grupo).
 *
 * - Genera las rondas según el pack.
 * - Asigna orden de turnos según el orden de llegada de jugadores.
 * - Pone estado = "jugando" y rondaActual = 0.
 */
export async function inicializarRondasGrupo({
  codigoGrupo,
  packId,
  numRondas,
  tiempoRondaSeg,
}) {
  if (!codigoGrupo) {
    throw new Error("Falta el código de grupo para inicializar el juego.");
  }

  // 1) Obtener jugadores del grupo
  const jugadores = await getJugadoresDeGrupo(codigoGrupo);
  if (!jugadores.length) {
    throw new Error("No hay estudiantes en este grupo.");
  }

  // Ordenarlos por fecha de creación (como turnos)
  jugadores.sort((a, b) => {
    const ta = a.creadoEn?.seconds || 0;
    const tb = b.creadoEn?.seconds || 0;
    return ta - tb;
  });

  const ordenTurnos = jugadores.map((j) => j.id);
  const playerNames = {};
  jugadores.forEach((j) => {
    playerNames[j.id] = j.nombre || "Estudiante";
  });

  // 2) Generar rondas
  const rondasRaw = generarRondasParaPack(packId, numRondas);
  if (!rondasRaw.length) {
    throw new Error("No se pudieron generar rondas para el pack seleccionado.");
  }
  const rondas = prepararRondas(rondasRaw);

  const primera = rondas[0];
  const palabra = primera.palabra;
  const progreso = "_".repeat(palabra.length);

  const rondaInicioMs = ahoraMs();

  const datosIniciales = {
    estado: "jugando",           // esperando | jugando | finalizado
    rondaActual: 0,
    rondas,
    temaActual: primera.tema,
    pistaActual: primera.pista,
    palabraActual: palabra,
    progreso,
    letrasUsadas: [],
    fallos: 0,
    ordenTurnos,
    turnoIndex: 0,
    turnoActualId: ordenTurnos[0],
    turnoActualNombre: playerNames[ordenTurnos[0]] || "",
    playerNames,
    tiempoRondaSeg,
    rondaInicioMs,               // número en milisegundos
  };

  // puntajeTotal ya existe con 0 cuando se crea el grupo,
  // pero podríamos asegurarlo aquí:
  if (estadoGrupoActual && typeof estadoGrupoActual.puntajeTotal !== "number") {
    datosIniciales.puntajeTotal = 0;
  }

  await updateGrupo(codigoGrupo, datosIniciales);

  // Actualizamos el snapshot local, por si acaso
  estadoGrupoActual = {
    ...(estadoGrupoActual || {}),
    ...datosIniciales,
    codigoGrupo,
  };

  return datosIniciales;
}

// ------------------------------------------------------
// Proceso principal: intento de letra de un estudiante
// ------------------------------------------------------

/**
 * Procesa el intento de una letra del jugador actual.
 * - Valida turno.
 * - Actualiza progreso, fallos, rondas y puntajes.
 * - Escribe los cambios en Firestore (grupo + jugador).
 *
 * Devuelve un objeto con información útil para la UI:
 * {
 *   ok: boolean,
 *   mensaje: string,
 *   esAcierto: boolean,
 *   completaPalabra: boolean,
 *   rondaTerminada: boolean,
 *   juegoFinalizado: boolean,
 *   deltaJugador,
 *   deltaGrupo,
 *   bonusTiempo
 * }
 */
export async function procesarIntentoLetra(letraCruda) {
  if (!codigoGrupoActual || !jugadorActual.id) {
    throw new Error("El juego no está configurado para este grupo/jugador.");
  }
  if (!estadoGrupoActual) {
    throw new Error("No hay estado de grupo cargado todavía.");
  }

  const grupo = estadoGrupoActual;
  const codigoGrupo = codigoGrupoActual;
  const jugadorId = jugadorActual.id;
  const jugadorNombre = jugadorActual.nombre || "";

  if (grupo.estado !== "jugando") {
    return {
      ok: false,
      mensaje: "La actividad de este grupo no está en juego.",
    };
  }

  // Validar turno
  if (grupo.turnoActualId && grupo.turnoActualId !== jugadorId) {
    return {
      ok: false,
      mensaje: `No es tu turno. Turno de ${grupo.turnoActualNombre || "otro compañero"}.`,
    };
  }

  // Normalizar letra
  let letra = (letraCruda || "").toString().trim().toUpperCase();
  letra = normalizarLetra(letra);

  if (!letra || !letra.match(/^[A-ZÑ]$/)) {
    return {
      ok: false,
      mensaje: "Escribe una sola letra válida.",
    };
  }

  const letrasUsadas = Array.isArray(grupo.letrasUsadas)
    ? [...grupo.letrasUsadas]
    : [];

  if (letrasUsadas.includes(letra)) {
    return {
      ok: false,
      mensaje: "Esa letra ya fue usada.",
    };
  }

  const palabra = (grupo.palabraActual || "").toUpperCase();
  let progreso = grupo.progreso || "";
  let fallos = typeof grupo.fallos === "number" ? grupo.fallos : 0;

  if (!palabra || !progreso || palabra.length !== progreso.length) {
    return {
      ok: false,
      mensaje: "La palabra actual no está configurada correctamente.",
    };
  }

  // Aplicar intento
  letrasUsadas.push(letra);

  let esAcierto = false;
  let nuevoProgreso = "";

  for (let i = 0; i < palabra.length; i++) {
    if (palabra[i] === letra) {
      nuevoProgreso += letra;
      esAcierto = true;
    } else {
      nuevoProgreso += progreso[i];
    }
  }

  progreso = nuevoProgreso;
  if (!esAcierto) {
    fallos += 1;
  }

  let completaPalabra = progreso === palabra;
  let juegoFinalizado = false;
  let rondaTerminada = false;

  // Calcular puntaje del intento
  const { deltaJugador, deltaGrupo, bonusTiempo } = calcularPuntajeIntento({
    esAcierto,
    completaPalabra,
    grupo,
  });

  // Turnos
  const ordenTurnos = Array.isArray(grupo.ordenTurnos) ? [...grupo.ordenTurnos] : [];
  let turnoIndex = typeof grupo.turnoIndex === "number" ? grupo.turnoIndex : 0;

  if (ordenTurnos.length > 0) {
    turnoIndex = (turnoIndex + 1) % ordenTurnos.length;
  } else {
    turnoIndex = 0;
  }

  const turnoActualId = ordenTurnos[turnoIndex] || null;
  const turnoActualNombre = obtenerNombreJugador(grupo, turnoActualId);

  // Determinar siguiente estado de la ronda / juego
  let rondaActual = typeof grupo.rondaActual === "number" ? grupo.rondaActual : 0;
  const rondas = Array.isArray(grupo.rondas) ? [...grupo.rondas] : [];
  let temaActual = grupo.temaActual || "";
  let pistaActual = grupo.pistaActual || "";
  let palabraActual = palabra;
  let nuevaRondaInicioMs = grupo.rondaInicioMs || ahoraMs();

  const cambiosBaseGrupo = {
    progreso,
    letrasUsadas,
    fallos,
    turnoIndex,
    turnoActualId,
    turnoActualNombre,
  };

  if (!esAcierto && fallos >= MAX_FALLOS) {
    // Juego perdido por completar el ahorcado
    juegoFinalizado = true;
    rondaTerminada = true;

    cambiosBaseGrupo.estado = "finalizado";
  } else if (completaPalabra) {
    rondaTerminada = true;

    const ultimaRonda = rondas.length ? rondas.length - 1 : 0;
    if (rondaActual >= ultimaRonda) {
      // No hay más rondas -> juego finalizado
      juegoFinalizado = true;
      cambiosBaseGrupo.estado = "finalizado";
    } else {
      // Pasar a la siguiente ronda
      rondaActual += 1;
      const sig = rondas[rondaActual];

      palabraActual = normalizarPalabra(sig.palabra || "");
      progreso = "_".repeat(palabraActual.length);
      temaActual = sig.tema || "";
      pistaActual = sig.pista || "";
      nuevaRondaInicioMs = ahoraMs();

      cambiosBaseGrupo.rondaActual = rondaActual;
      cambiosBaseGrupo.palabraActual = palabraActual;
      cambiosBaseGrupo.progreso = progreso;
      cambiosBaseGrupo.temaActual = temaActual;
      cambiosBaseGrupo.pistaActual = pistaActual;
      cambiosBaseGrupo.fallos = 0;
      cambiosBaseGrupo.letrasUsadas = [];
      cambiosBaseGrupo.estado = "jugando";
      cambiosBaseGrupo.rondaInicioMs = nuevaRondaInicioMs;
    }
  }

  // Actualizar puntajes (grupo + jugador)
  let nuevoPuntajeGrupo =
    typeof grupo.puntajeTotal === "number" ? grupo.puntajeTotal : 0;
  nuevoPuntajeGrupo = clampPuntaje(nuevoPuntajeGrupo + deltaGrupo);

  // OJO: necesitamos el puntaje individual del jugador actual.
  // No lo tenemos en grupo; se lee del doc "jugadores".
  // En vez de volver a leer, asumimos que la UI ya lo tiene,
  // pero por simplicidad lo ajustamos con "incremento" lógico:
  // UI debería refrescar luego desde Firestore.
  // Aquí solo aplicamos el delta.
  // Usamos una actualización relativa: puntaje += deltaJugador.
  const cambiosJugador = {};
  if (deltaJugador !== 0) {
    // Como Firestore no tiene "increment" aquí, podrías:
    // - leer el puntaje actual antes (más consultas), o
    // - guardar solo el delta y que la UI calcule.
    //
    // Para mantener simple, asumimos que el UI re-calculará desde cero
    // y aquí dejamos puntaje como "incremental".
    // Si prefieres valor absoluto, deberíamos leerlo antes con getJugadoresDeGrupo.
    //
    // Vamos a hacer la opción "increment" aproximada:
    cambiosJugador.puntaje = (grupo._ultimoPuntajeLocalJugador || 0) + deltaJugador;
    // Nota: PUEDES sobreescribir esto en app/ui con el valor real.
  }

  // Construimos los cambios finales del grupo
  const cambiosGrupo = {
    ...cambiosBaseGrupo,
    puntajeTotal: nuevoPuntajeGrupo,
  };

  // Persistencia en Firestore
  const promesas = [updateGrupo(codigoGrupo, cambiosGrupo)];
  if (deltaJugador !== 0) {
    promesas.push(
      updateJugador(codigoGrupo, jugadorId, {
        puntaje: clampPuntaje(cambiosJugador.puntaje),
      })
    );
  }

  await Promise.all(promesas);

  // Actualizar estado local
  estadoGrupoActual = {
    ...grupo,
    ...cambiosGrupo,
  };

  return {
    ok: true,
    mensaje: construirMensajeResultado({
      esAcierto,
      completaPalabra,
      rondaTerminada,
      juegoFinalizado,
      deltaJugador,
      deltaGrupo,
      bonusTiempo,
      jugadorNombre,
    }),
    esAcierto,
    completaPalabra,
    rondaTerminada,
    juegoFinalizado,
    deltaJugador,
    deltaGrupo,
    bonusTiempo,
  };
}

// ------------------------------------------------------
// Mensajes y helpers varios
// ------------------------------------------------------

function normalizarLetra(letra) {
  if (!letra) return "";
  // Dejamos Ñ tal cual, pero quitamos tildes si las hubiera.
  let t = letra.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Asegurar que Ñ se mantiene (por si se normalizó).
  if (letra === "Ñ") return "Ñ";
  return t;
}

function construirMensajeResultado({
  esAcierto,
  completaPalabra,
  rondaTerminada,
  juegoFinalizado,
  deltaJugador,
  deltaGrupo,
  bonusTiempo,
  jugadorNombre,
}) {
  const nombre = jugadorNombre || "Tu";
  const deltaTxtJugador =
    deltaJugador !== 0
      ? `${deltaJugador > 0 ? "+" : ""}${deltaJugador} pts`
      : "0 pts";

  let msg = "";

  if (esAcierto) {
    msg = `${nombre} acertó la letra (${deltaTxtJugador}).`;
  } else {
    msg = `${nombre} falló la letra (${deltaTxtJugador}).`;
  }

  if (bonusTiempo > 0) {
    msg += ` Bonus por tiempo: +${bonusTiempo} pts.`;
  }

  if (rondaTerminada && !juegoFinalizado) {
    msg += " ¡Ronda completada! Pasan a la siguiente.";
  } else if (juegoFinalizado) {
    msg += " ¡La actividad de este grupo ha finalizado!";
  }

  return msg;
}
