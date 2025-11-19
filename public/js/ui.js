// public/js/ui.js
// ------------------------------------------------------
// Capa de UI: maneja DOM, vistas y eventos de la app.
// ------------------------------------------------------
// - Navegación de vistas (menú, docente, estudiante, juego, resultados)
// - Autenticación docente (registro / login / logout)
// - Creación y gestión de actividades (docente)
// - Unión de estudiantes a grupos y vista del juego
// - Pintado de puntajes, tiempos, rondas y SVG del ahorcado
//
// Este módulo importa la lógica de datos (firebase.js),
// la lógica de juego (game.js), los packs (rounds.js) y el SVG (svg.js).
// ------------------------------------------------------

import {
  auth,
  registerDocente,
  loginDocente,
  logoutDocente,
  onAuthChange,
  listenActividadesDocente,
  createActividadWithGrupos,
  listenGruposDeActividad,
  buscarGrupoPorCodigo,
  agregarJugadorAGrupo,
  listenJugadoresDeGrupo,
  getGruposDeActividad,
  getJugadoresDeGrupo,
  getActividad,
  updateActividadEstado,
} from "./firebase.js";

import {
  PACK_PERU_PERSONAL_SOCIAL,
} from "./rounds.js";

import {
  MAX_FALLOS,
  configurarContextoGrupo,
  actualizarEstadoGrupo,
  inicializarRondasGrupo,
  procesarIntentoLetra,
} from "./game.js";

import {
  initAhorcadoSVG,
  actualizarAhorcado,
  resetAhorcado,
} from "./svg.js";

// ------------------------------------------------------
// Helpers DOM
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

function showView(viewId) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const view = $(viewId);
  if (view) view.classList.add("active");
}

function setText(id, text) {
  const el = $(id);
  if (el) el.innerText = text;
}

function setInputValue(id, value) {
  const el = $(id);
  if (el) el.value = value;
}

function setDisabled(id, disabled) {
  const el = $(id);
  if (el) el.disabled = disabled;
}

// ------------------------------------------------------
// Estado UI global
// ------------------------------------------------------
const uiState = {
  docenteUser: null,
  docenteUid: null,

  // Actividad y grupos (docente)
  actividadActualId: null,
  actividadActualData: null,
  gruposActividad: [],

  unsubscribeActividadesDocente: null,
  unsubscribeGruposActividadDocente: null,

  // Juego (estudiante)
  grupoCodigoActual: null,
  grupoActividadId: null,
  jugadorActual: { id: null, nombre: "" },
  unsubscribeGruposActividadEstudiante: null,
  unsubscribeJugadoresGrupo: null,

  // Timer
  timerIntervalId: null,
};

// ------------------------------------------------------
// Inicialización general de la app (la llamará app.js)
// ------------------------------------------------------
export function initApp() {
  // Crear el SVG del ahorcado
  initAhorcadoSVG("ahorcado-container");
  resetAhorcado(MAX_FALLOS);

  // Registrar eventos de botones y formularios
  bindMenuEvents();
  bindDocenteLoginEvents();
  bindDocenteRegistroEvents();
  bindDocenteDashboardEvents();
  bindActividadEvents();
  bindEstudianteEvents();
  bindJuegoEvents();
  bindResultadosEvents();

  // Suscripción al estado de autenticación del docente
  onAuthChange((user) => {
    uiState.docenteUser = user;
    uiState.docenteUid = user ? user.uid : null;
    handleAuthStateChanged(user);
  });

  // Vista inicial
  showView("view-menu");
}

// ------------------------------------------------------
// Manejo de autenticación docente
// ------------------------------------------------------
function handleAuthStateChanged(user) {
  if (user) {
    // Docente autenticado
    const nombre =
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "Docente");

    setText("docente-dashboard-nombre", nombre);

    // Escuchar sus actividades
    if (uiState.unsubscribeActividadesDocente) {
      uiState.unsubscribeActividadesDocente();
    }
    uiState.unsubscribeActividadesDocente = listenActividadesDocente(
      user.uid,
      renderListaActividadesDocente
    );
  } else {
    // Cerrar subscripciones del docente
    if (uiState.unsubscribeActividadesDocente) {
      uiState.unsubscribeActividadesDocente();
      uiState.unsubscribeActividadesDocente = null;
    }
    if (uiState.unsubscribeGruposActividadDocente) {
      uiState.unsubscribeGruposActividadDocente();
      uiState.unsubscribeGruposActividadDocente = null;
    }
    uiState.actividadActualId = null;
    uiState.actividadActualData = null;
    uiState.gruposActividad = [];
    // No forzamos vista aquí para no interrumpir a estudiantes,
    // pero cuando el docente pulse "soy docente" lo mandaremos al login.
  }
}

// ------------------------------------------------------
// Eventos de menú principal
// ------------------------------------------------------
function bindMenuEvents() {
  const btnEstudiante = $("btn-menu-estudiante");
  const btnDocente = $("btn-menu-docente");

  if (btnEstudiante) {
    btnEstudiante.onclick = () => {
      // Flujo estudiante
      setInputValue("estudiante-codigo-grupo", "");
      setInputValue("estudiante-nombre", "");
      setText("estudiante-join-error", "");
      showView("view-estudiante-join");
    };
  }

  if (btnDocente) {
    btnDocente.onclick = () => {
      // Si ya está logueado, ir al dashboard
      if (auth.currentUser) {
        showView("view-docente-dashboard");
      } else {
        showView("view-docente-login");
      }
    };
  }
}

// ------------------------------------------------------
// LOGIN DOCENTE
// ------------------------------------------------------
function bindDocenteLoginEvents() {
  const btnLogin = $("btn-docente-login");
  const btnIrRegistro = $("btn-docente-ir-registro");
  const btnVolver = $("btn-docente-login-volver");

  if (btnLogin) {
    btnLogin.onclick = async () => {
      const email = $("docente-login-email")?.value.trim();
      const password = $("docente-login-password")?.value.trim();
      const errorEl = $("docente-login-error");

      if (errorEl) errorEl.innerText = "";

      if (!email || !password) {
        if (errorEl) errorEl.innerText = "Completa correo y contraseña.";
        return;
      }

      setDisabled("btn-docente-login", true);

      try {
        await loginDocente({ email, password });
        // onAuthChange se ocupará de actualizar dashboard
        showView("view-docente-dashboard");
      } catch (err) {
        console.error(err);
        if (errorEl) {
          errorEl.innerText =
            "No se pudo iniciar sesión. Verifica tus datos o inténtalo de nuevo.";
        }
      } finally {
        setDisabled("btn-docente-login", false);
      }
    };
  }

  if (btnIrRegistro) {
    btnIrRegistro.onclick = () => {
      // Limpiamos campos
      setInputValue("docente-reg-nombres", "");
      setInputValue("docente-reg-apellidos", "");
      setInputValue("docente-reg-email", "");
      setInputValue("docente-reg-password", "");
      setInputValue("docente-reg-password2", "");
      setText("docente-reg-error", "");
      showView("view-docente-registro");
    };
  }

  if (btnVolver) {
    btnVolver.onclick = () => {
      showView("view-menu");
    };
  }
}

// ------------------------------------------------------
// REGISTRO DOCENTE
// ------------------------------------------------------
function bindDocenteRegistroEvents() {
  const btnCrear = $("btn-docente-registrar");
  const btnVolver = $("btn-docente-registro-volver");

  if (btnCrear) {
    btnCrear.onclick = async () => {
      const nombres = $("docente-reg-nombres")?.value.trim();
      const apellidos = $("docente-reg-apellidos")?.value.trim();
      const email = $("docente-reg-email")?.value.trim();
      const pass1 = $("docente-reg-password")?.value.trim();
      const pass2 = $("docente-reg-password2")?.value.trim();
      const errorEl = $("docente-reg-error");

      if (errorEl) errorEl.innerText = "";

      if (!nombres || !apellidos || !email || !pass1 || !pass2) {
        if (errorEl) errorEl.innerText = "Completa todos los campos.";
        return;
      }
      if (pass1 !== pass2) {
        if (errorEl) errorEl.innerText = "Las contraseñas no coinciden.";
        return;
      }
      if (pass1.length < 6) {
        if (errorEl)
          errorEl.innerText = "La contraseña debe tener al menos 6 caracteres.";
        return;
      }

      setDisabled("btn-docente-registrar", true);

      try {
        await registerDocente({
          nombres,
          apellidos,
          email,
          password: pass1,
        });
        // Ya queda logueado; onAuthChange lo enviará al dashboard
        showView("view-docente-dashboard");
      } catch (err) {
        console.error(err);
        if (errorEl) {
          errorEl.innerText =
            "No se pudo registrar la cuenta. Tal vez el correo ya está en uso.";
        }
      } finally {
        setDisabled("btn-docente-registrar", false);
      }
    };
  }

  if (btnVolver) {
    btnVolver.onclick = () => {
      showView("view-docente-login");
    };
  }
}

// ------------------------------------------------------
// DASHBOARD DOCENTE
// ------------------------------------------------------
function bindDocenteDashboardEvents() {
  const btnNueva = $("btn-docente-nueva-actividad");
  const btnCerrarSesion = $("btn-docente-cerrar-sesion");
  const btnVolverMenu = $("btn-docente-dashboard-volver");

  if (btnNueva) {
    btnNueva.onclick = () => {
      if (!auth.currentUser) {
        showView("view-docente-login");
        return;
      }
      // Valores por defecto del formulario de nueva actividad
      setInputValue(
        "actividad-nombre",
        "Personal Social - Actividad sobre Perú"
      );
      setInputValue("actividad-num-grupos", "3");
      setInputValue("actividad-max-integrantes", "4");
      setInputValue("actividad-tiempo-ronda", "90");
      setInputValue("actividad-num-rondas", "5");
      setText("actividad-crear-error", "");
      showView("view-docente-crear-actividad");
    };
  }

  if (btnCerrarSesion) {
    btnCerrarSesion.onclick = async () => {
      try {
        await logoutDocente();
      } catch (err) {
        console.error(err);
      } finally {
        showView("view-menu");
      }
    };
  }

  if (btnVolverMenu) {
    btnVolverMenu.onclick = () => {
      showView("view-menu");
    };
  }
}

/**
 * Renderiza la lista de actividades del docente en el dashboard.
 * items: [{id, nombre, estado, creadoEn, ...}, ...]
 */
function renderListaActividadesDocente(items) {
  const ul = $("docente-actividades-lista");
  if (!ul) return;

  ul.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "actividad-empty";
    li.innerText = "Aún no tienes actividades creadas.";
    ul.appendChild(li);
    return;
  }

  items.forEach((act) => {
    const li = document.createElement("li");
    li.className = "actividad-item";
    li.dataset.id = act.id;

    const estado = act.estado || "activa";
    const fecha = act.creadoEn?.toDate
      ? act.creadoEn.toDate().toLocaleString()
      : "";

    li.innerHTML = `
      <div class="actividad-main">
        <span class="actividad-nombre">${act.nombre || "Actividad sin título"}</span>
        <span class="actividad-estado pill pill-${estado}">${estado}</span>
      </div>
      <div class="actividad-meta">
        <span>${act.numGrupos || 0} grupos · ${
      act.numRondas || 0
    } rondas</span>
        <span class="actividad-fecha">${fecha}</span>
      </div>
    `;

    li.onclick = () => {
      abrirDetalleActividad(act.id);
    };

    ul.appendChild(li);
  });
}

// ------------------------------------------------------
// CREACIÓN DE ACTIVIDAD
// ------------------------------------------------------
function bindActividadEvents() {
  const btnCrear = $("btn-actividad-crear");
  const btnCancelar = $("btn-actividad-crear-cancelar");

  if (btnCrear) {
    btnCrear.onclick = async () => {
      if (!auth.currentUser) {
        showView("view-docente-login");
        return;
      }

      const docenteUid = auth.currentUser.uid;
      const nombreActividad = $("actividad-nombre")?.value.trim();
      const packId = $("actividad-pack")?.value || PACK_PERU_PERSONAL_SOCIAL;
      const numGrupos = parseInt(
        $("actividad-num-grupos")?.value || "1",
        10
      );
      const maxIntegrantes = parseInt(
        $("actividad-max-integrantes")?.value || "4",
        10
      );
      const tiempoRondaSeg = parseInt(
        $("actividad-tiempo-ronda")?.value || "90",
        10
      );
      const numRondas = parseInt(
        $("actividad-num-rondas")?.value || "5",
        10
      );
      const errorEl = $("actividad-crear-error");

      if (errorEl) errorEl.innerText = "";

      if (!nombreActividad) {
        if (errorEl) errorEl.innerText = "Ponle un nombre a la actividad.";
        return;
      }
      if (numGrupos < 1 || numGrupos > 10) {
        if (errorEl)
          errorEl.innerText = "La cantidad de grupos debe ser entre 1 y 10.";
        return;
      }
      if (maxIntegrantes < 2 || maxIntegrantes > 8) {
        if (errorEl)
          errorEl.innerText = "Integrantes por grupo: entre 2 y 8.";
        return;
      }
      if (tiempoRondaSeg < 20 || tiempoRondaSeg > 300) {
        if (errorEl)
          errorEl.innerText =
            "Tiempo por ronda entre 20 y 300 segundos.";
        return;
      }
      if (numRondas < 3 || numRondas > 10) {
        if (errorEl)
          errorEl.innerText = "Número de rondas entre 3 y 10.";
        return;
      }

      setDisabled("btn-actividad-crear", true);

      try {
        const { actividadId } = await createActividadWithGrupos({
          docenteUid,
          nombreActividad,
          packId,
          numGrupos,
          maxIntegrantes,
          tiempoRondaSeg,
          numRondas,
        });

        // Abrimos directamente el detalle de la nueva actividad
        await abrirDetalleActividad(actividadId);
      } catch (err) {
        console.error(err);
        if (errorEl) {
          errorEl.innerText =
            "No se pudo crear la actividad. Intenta nuevamente.";
        }
      } finally {
        setDisabled("btn-actividad-crear", false);
      }
    };
  }

  if (btnCancelar) {
    btnCancelar.onclick = () => {
      showView("view-docente-dashboard");
    };
  }
}

// ------------------------------------------------------
// DETALLE DE ACTIVIDAD (DOCENTE)
// ------------------------------------------------------
async function abrirDetalleActividad(actividadId) {
  if (!actividadId) return;

  uiState.actividadActualId = actividadId;

  // Limpiar subscripciones previas de grupos
  if (uiState.unsubscribeGruposActividadDocente) {
    uiState.unsubscribeGruposActividadDocente();
    uiState.unsubscribeGruposActividadDocente = null;
  }

  // Cargar datos básicos de la actividad (una sola vez)
  const actividad = await getActividad(actividadId);
  uiState.actividadActualData = actividad || null;

  const nombre = actividad?.nombre || "Actividad";
  const codigoGen = actividad?.codigoGeneral || "------";

  setText("actividad-detalle-titulo", nombre);
  setText("actividad-detalle-codigo", codigoGen);
  setText("actividad-detalle-mensaje", "");

  // Escuchar grupos de esta actividad
  uiState.unsubscribeGruposActividadDocente = listenGruposDeActividad(
    actividadId,
    (grupos) => {
      uiState.gruposActividad = grupos;
      renderGruposActividadDocente(grupos);
    }
  );

  // Botón "Ver resultados" habilitado si hay algún grupo finalizado
  setDisabled("btn-actividad-ver-resultados", true);

  showView("view-docente-actividad");
}

function renderGruposActividadDocente(grupos) {
  const ul = $("actividad-grupos-lista");
  const btnResultados = $("btn-actividad-ver-resultados");
  if (!ul) return;

  ul.innerHTML = "";

  if (!grupos.length) {
    const li = document.createElement("li");
    li.className = "actividad-empty";
    li.innerText = "Aún no se han creado grupos para esta actividad.";
    ul.appendChild(li);
    if (btnResultados) btnResultados.disabled = true;
    return;
  }

  let hayFinalizado = false;

  grupos.forEach((g) => {
    const li = document.createElement("li");
    li.className = "grupo-item";

    const estado = g.estado || "esperando";
    const puntaje = typeof g.puntajeTotal === "number" ? g.puntajeTotal : 0;

    if (estado === "finalizado") hayFinalizado = true;

    li.innerHTML = `
      <div class="grupo-main">
        <div>
          <span class="grupo-nombre">${g.nombreGrupo || "Grupo"}</span>
          <span class="grupo-estado pill pill-${estado}">${estado}</span>
        </div>
        <div class="grupo-codigo">
          Código: <strong>${g.codigoGrupo}</strong>
        </div>
      </div>
      <div class="grupo-meta">
        <span>Puntaje total: <strong>${puntaje}</strong> pts</span>
        <div class="grupo-actions">
          <button class="btn small-btn btn-copiar-codigo" data-codigo="${g.codigoGrupo}">
            Copiar código
          </button>
          ${
            estado === "esperando"
              ? `<button class="btn small-btn btn-iniciar-grupo" data-codigo="${g.codigoGrupo}">
                  Iniciar juego
                </button>`
              : ""
          }
        </div>
      </div>
    `;

    ul.appendChild(li);
  });

  // Eventos de los botones dentro de la lista
  ul.querySelectorAll(".btn-copiar-codigo").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const codigo = btn.getAttribute("data-codigo");
      if (codigo && navigator.clipboard) {
        navigator.clipboard.writeText(codigo).catch(() => {});
      }
    });
  });

  ul.querySelectorAll(".btn-iniciar-grupo").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const codigo = btn.getAttribute("data-codigo");
      await handleIniciarJuegoGrupo(codigo);
    });
  });

  if (btnResultados) {
    btnResultados.disabled = !hayFinalizado;
  }
}

async function handleIniciarJuegoGrupo(codigoGrupo) {
  if (!codigoGrupo || !uiState.actividadActualData) return;

  const actividad = uiState.actividadActualData;

  const packId = actividad.packId || PACK_PERU_PERSONAL_SOCIAL;
  const numRondas = actividad.numRondas || 5;
  const tiempoRondaSeg = actividad.tiempoRondaSeg || 90;

  try {
    await inicializarRondasGrupo({
      codigoGrupo,
      packId,
      numRondas,
      tiempoRondaSeg,
    });
    setText(
      "actividad-detalle-mensaje",
      `Se inició el juego para el grupo con código ${codigoGrupo}.`
    );
  } catch (err) {
    console.error(err);
    setText(
      "actividad-detalle-mensaje",
      "No se pudo iniciar el juego para este grupo."
    );
  }
}

// Eventos específicos de la vista de actividad (botones inferiores)
function bindActividadEventsExtra() {
  // Ya integrados en bindDocenteDashboardEvents y bindResultadosEvents,
  // pero por claridad dejamos esta función si hubiese más lógica.
}

// ------------------------------------------------------
// BOTONES INFERIORES DE ACTIVIDAD (ver resultados / finalizar)
// ------------------------------------------------------
function bindActividadEvents() {
  const btnCrear = $("btn-actividad-crear");
  const btnCancelar = $("btn-actividad-crear-cancelar");
  const btnVolverDash = $("btn-actividad-volver-dashboard");
  const btnVerResultados = $("btn-actividad-ver-resultados");
  const btnFinalizar = $("btn-actividad-finalizar");

  // (La lógica de creación ya está arriba, la volvemos a enganchar aquí.)
  if (btnCrear && !btnCrear._yaLigado) {
    btnCrear._yaLigado = true;
    btnCrear.onclick = async () => {
      if (!auth.currentUser) {
        showView("view-docente-login");
        return;
      }

      const docenteUid = auth.currentUser.uid;
      const nombreActividad = $("actividad-nombre")?.value.trim();
      const packId = $("actividad-pack")?.value || PACK_PERU_PERSONAL_SOCIAL;
      const numGrupos = parseInt(
        $("actividad-num-grupos")?.value || "1",
        10
      );
      const maxIntegrantes = parseInt(
        $("actividad-max-integrantes")?.value || "4",
        10
      );
      const tiempoRondaSeg = parseInt(
        $("actividad-tiempo-ronda")?.value || "90",
        10
      );
      const numRondas = parseInt(
        $("actividad-num-rondas")?.value || "5",
        10
      );
      const errorEl = $("actividad-crear-error");

      if (errorEl) errorEl.innerText = "";

      if (!nombreActividad) {
        if (errorEl) errorEl.innerText = "Ponle un nombre a la actividad.";
        return;
      }
      if (numGrupos < 1 || numGrupos > 10) {
        if (errorEl)
          errorEl.innerText = "La cantidad de grupos debe ser entre 1 y 10.";
        return;
      }
      if (maxIntegrantes < 2 || maxIntegrantes > 8) {
        if (errorEl)
          errorEl.innerText = "Integrantes por grupo: entre 2 y 8.";
        return;
      }
      if (tiempoRondaSeg < 20 || tiempoRondaSeg > 300) {
        if (errorEl)
          errorEl.innerText =
            "Tiempo por ronda entre 20 y 300 segundos.";
        return;
      }
      if (numRondas < 3 || numRondas > 10) {
        if (errorEl)
          errorEl.innerText = "Número de rondas entre 3 y 10.";
        return;
      }

      setDisabled("btn-actividad-crear", true);

      try {
        const { actividadId } = await createActividadWithGrupos({
          docenteUid,
          nombreActividad,
          packId,
          numGrupos,
          maxIntegrantes,
          tiempoRondaSeg,
          numRondas,
        });

        await abrirDetalleActividad(actividadId);
      } catch (err) {
        console.error(err);
        if (errorEl) {
          errorEl.innerText =
            "No se pudo crear la actividad. Intenta nuevamente.";
        }
      } finally {
        setDisabled("btn-actividad-crear", false);
      }
    };
  }

  if (btnCancelar) {
    btnCancelar.onclick = () => {
      showView("view-docente-dashboard");
    };
  }

  if (btnVolverDash) {
    btnVolverDash.onclick = () => {
      showView("view-docente-dashboard");
    };
  }

  if (btnVerResultados) {
    btnVerResultados.onclick = async () => {
      if (!uiState.actividadActualId) return;
      await cargarResultadosActividad(uiState.actividadActualId);
    };
  }

  if (btnFinalizar) {
    btnFinalizar.onclick = async () => {
      if (!uiState.actividadActualId) return;
      try {
        await updateActividadEstado(uiState.actividadActualId, "finalizada");
        setText(
          "actividad-detalle-mensaje",
          "La actividad ha sido marcada como finalizada."
        );
      } catch (err) {
        console.error(err);
        setText(
          "actividad-detalle-mensaje",
          "No se pudo finalizar la actividad."
        );
      }
    };
  }
}

// ------------------------------------------------------
// FLUJO ESTUDIANTE: UNIRSE A GRUPO
// ------------------------------------------------------
function bindEstudianteEvents() {
  const btnUnirse = $("btn-estudiante-unirse");
  const btnVolver = $("btn-estudiante-join-volver");

  if (btnUnirse) {
    btnUnirse.onclick = async () => {
      const codigo = $("estudiante-codigo-grupo")?.value.trim().toUpperCase();
      const nombre = $("estudiante-nombre")?.value.trim();
      const errorEl = $("estudiante-join-error");

      if (errorEl) errorEl.innerText = "";

      if (!codigo || !nombre) {
        if (errorEl) errorEl.innerText = "Completa el código y tu nombre.";
        return;
      }

      setDisabled("btn-estudiante-unirse", true);

      try {
        const grupo = await buscarGrupoPorCodigo(codigo);
        if (!grupo) {
          if (errorEl) errorEl.innerText = "No existe un grupo con ese código.";
          return;
        }

        if (grupo.estado === "finalizado") {
          if (errorEl)
            errorEl.innerText = "Este grupo ya ha finalizado su actividad.";
          return;
        }

        // Control de aforo
        const jugadoresExistentes = await getJugadoresDeGrupo(codigo);
        const maxInt = grupo.maxIntegrantes || 4;
        if (jugadoresExistentes.length >= maxInt) {
          if (errorEl)
            errorEl.innerText =
              "Este grupo ya está completo. Pide otro código a tu docente.";
          return;
        }

        // Registrar jugador
        const { jugadorId } = await agregarJugadorAGrupo(codigo, nombre);

        uiState.grupoCodigoActual = codigo;
        uiState.grupoActividadId = grupo.actividadId || null;
        uiState.jugadorActual = { id: jugadorId, nombre };

        configurarContextoGrupo({
          codigoGrupo: codigo,
          jugadorId,
          jugadorNombre: nombre,
        });

        // Suscripciones: grupo (via listenGruposDeActividad) + jugadores
        suscribirGrupoComoEstudiante(grupo.actividadId, codigo);
        suscribirJugadoresGrupo(codigo);

        // UI inicial
        setText("juego-nombre", nombre);
        setText("juego-grupo-nombre", grupo.nombreGrupo || "Grupo");
        setText("juego-grupo-codigo", grupo.codigoGrupo || codigo);
        setText("juego-puntaje-jugador", "0");
        setText("juego-puntaje-grupo", `${grupo.puntajeTotal || 0}`);
        setText("juego-tiempo-restante", "--");
        resetAhorcado(MAX_FALLOS);

        showView("view-juego");
      } catch (err) {
        console.error(err);
        if (errorEl) {
          errorEl.innerText =
            "No se pudo unir al grupo. Intenta nuevamente.";
        }
      } finally {
        setDisabled("btn-estudiante-unirse", false);
      }
    };
  }

  if (btnVolver) {
    btnVolver.onclick = () => {
      showView("view-menu");
    };
  }
}

function suscribirGrupoComoEstudiante(actividadId, codigoGrupo) {
  // Cerramos subscripciones previas
  if (uiState.unsubscribeGruposActividadEstudiante) {
    uiState.unsubscribeGruposActividadEstudiante();
    uiState.unsubscribeGruposActividadEstudiante = null;
  }

  if (!actividadId) return;

  uiState.unsubscribeGruposActividadEstudiante = listenGruposDeActividad(
    actividadId,
    (grupos) => {
      const grupo = grupos.find((g) => g.codigoGrupo === codigoGrupo);
      if (!grupo) return;

      // Actualizamos estado en game.js
      actualizarEstadoGrupo(grupo);
      // Actualizamos UI
      renderEstadoGrupoEnJuego(grupo);
    }
  );
}

function suscribirJugadoresGrupo(codigoGrupo) {
  if (uiState.unsubscribeJugadoresGrupo) {
    uiState.unsubscribeJugadoresGrupo();
    uiState.unsubscribeJugadoresGrupo = null;
  }

  uiState.unsubscribeJugadoresGrupo = listenJugadoresDeGrupo(
    codigoGrupo,
    (jugadores) => {
      renderJugadoresEnJuego(jugadores);
    }
  );
}

// ------------------------------------------------------
// VISTA DEL JUEGO (ESTUDIANTES)
// ------------------------------------------------------
function bindJuegoEvents() {
  const btnSalir = $("btn-juego-salir");
  const btnEnviar = $("btn-juego-enviar-letra");
  const inputLetra = $("juego-input-letra");

  if (btnSalir) {
    btnSalir.onclick = () => {
      salirDeJuego();
    };
  }

  if (btnEnviar) {
    btnEnviar.onclick = async () => {
      const letra = inputLetra?.value || "";
      if (!letra.trim()) return;
      inputLetra.value = "";

      try {
        const resultado = await procesarIntentoLetra(letra);
        if (!resultado.ok) {
          setText("juego-mensaje", resultado.mensaje || "No se pudo procesar.");
        } else {
          setText("juego-mensaje", resultado.mensaje || "");
        }
      } catch (err) {
        console.error(err);
        setText(
          "juego-mensaje",
          "Ocurrió un error al procesar la letra. Intenta otra vez."
        );
      }
    };
  }

  if (inputLetra) {
    inputLetra.addEventListener("keyup", (ev) => {
      if (ev.key === "Enter") {
        btnEnviar?.click();
      }
    });
  }
}

function salirDeJuego() {
  // Cancelar timers
  if (uiState.timerIntervalId) {
    clearInterval(uiState.timerIntervalId);
    uiState.timerIntervalId = null;
  }

  // Cancelar subscripciones
  if (uiState.unsubscribeGruposActividadEstudiante) {
    uiState.unsubscribeGruposActividadEstudiante();
    uiState.unsubscribeGruposActividadEstudiante = null;
  }
  if (uiState.unsubscribeJugadoresGrupo) {
    uiState.unsubscribeJugadoresGrupo();
    uiState.unsubscribeJugadoresGrupo = null;
  }

  uiState.grupoCodigoActual = null;
  uiState.grupoActividadId = null;
  uiState.jugadorActual = { id: null, nombre: "" };

  resetAhorcado(MAX_FALLOS);
  showView("view-menu");
}

/**
 * Renderiza en la UI el estado del grupo (juego).
 */
function renderEstadoGrupoEnJuego(grupo) {
  if (!grupo) return;

  const ronda = typeof grupo.rondaActual === "number" ? grupo.rondaActual + 1 : 1;
  const tema = grupo.temaActual || "-";
  const pista = grupo.pistaActual || "-";
  const progreso = (grupo.progreso || "").split("").join(" ");
  const letras = Array.isArray(grupo.letrasUsadas)
    ? grupo.letrasUsadas.join(", ")
    : "-";
  const fallos = typeof grupo.fallos === "number" ? grupo.fallos : 0;
  const turnoNombre = grupo.turnoActualNombre || "-";
  const puntajeGrupo =
    typeof grupo.puntajeTotal === "number" ? grupo.puntajeTotal : 0;

  setText("juego-ronda", `${ronda}`);
  setText("juego-tema", tema);
  setText("juego-pista", pista);
  setText("juego-palabra", progreso || "_");
  setText("juego-letras", letras || "-");
  setText("juego-fallos", `${fallos}`);
  setText("juego-turno-nombre", turnoNombre);
  setText("juego-puntaje-grupo", `${puntajeGrupo}`);

  // Dibujo SVG según fallos
  actualizarAhorcado(fallos, MAX_FALLOS);

  // Tiempo restante
  iniciarOActualizarTimer(grupo);

  // Habilitar o deshabilitar input según turno
  const esMiTurno =
    grupo.turnoActualId && grupo.turnoActualId === uiState.jugadorActual.id;
  const enJuego = grupo.estado === "jugando";

  const puedeJugar = esMiTurno && enJuego;

  const inputLetra = $("juego-input-letra");
  const btnEnviar = $("btn-juego-enviar-letra");

  if (inputLetra) inputLetra.disabled = !puedeJugar;
  if (btnEnviar) btnEnviar.disabled = !puedeJugar;

  if (!enJuego) {
    let msg = "La actividad de este grupo ha finalizado.";
    if (fallos >= MAX_FALLOS) {
      msg = "¡Perdieron! El ahorcado se completó.";
    }
    setText("juego-mensaje", msg);
  }
}

/**
 * Renderiza la lista de jugadores en la vista del juego.
 */
function renderJugadoresEnJuego(jugadores) {
  const ul = $("juego-lista-jugadores");
  if (!ul) return;

  ul.innerHTML = "";

  let miPuntaje = 0;

  jugadores.forEach((j) => {
    const li = document.createElement("li");
    li.className = "jugador-item";

    const puntaje =
      typeof j.puntaje === "number" ? j.puntaje : 0;

    if (j.id === uiState.jugadorActual.id) {
      miPuntaje = puntaje;
      li.classList.add("jugador-actual");
      li.innerHTML = `<span>${j.nombre} (tú)</span><span>${puntaje} pts</span>`;
    } else {
      li.innerHTML = `<span>${j.nombre}</span><span>${puntaje} pts</span>`;
    }

    ul.appendChild(li);
  });

  setText("juego-puntaje-jugador", `${miPuntaje}`);
}

// ------------------------------------------------------
// TIMER DE RONDA
// ------------------------------------------------------
function iniciarOActualizarTimer(grupo) {
  if (uiState.timerIntervalId) {
    clearInterval(uiState.timerIntervalId);
    uiState.timerIntervalId = null;
  }

  const tiempoTotal = grupo.tiempoRondaSeg || 0;
  const inicioMs = grupo.rondaInicioMs || null;

  if (!tiempoTotal || !inicioMs || grupo.estado !== "jugando") {
    setText("juego-tiempo-restante", "--");
    return;
  }

  const actualizar = () => {
    const ahora = Date.now();
    const elapsed = (ahora - inicioMs) / 1000;
    let restante = Math.max(0, Math.round(tiempoTotal - elapsed));
    setText("juego-tiempo-restante", `${restante}s`);
  };

  actualizar();
  uiState.timerIntervalId = setInterval(actualizar, 1000);
}

// ------------------------------------------------------
// RESULTADOS / RANKING DE GRUPOS
// ------------------------------------------------------
function bindResultadosEvents() {
  const btnVolverDashboard = $("btn-resultados-volver-dashboard");
  const btnVolverMenu = $("btn-resultados-volver-menu-estudiante");

  if (btnVolverDashboard) {
    btnVolverDashboard.onclick = () => {
      showView("view-docente-dashboard");
    };
  }

  if (btnVolverMenu) {
    btnVolverMenu.onclick = () => {
      showView("view-menu");
    };
  }
}

/**
 * Construye la vista de resultados de la actividad actual.
 */
async function cargarResultadosActividad(actividadId) {
  if (!actividadId) return;

  const actividad = uiState.actividadActualData || (await getActividad(actividadId));
  const nombreActividad = actividad?.nombre || "Actividad";

  setText("resultados-actividad-nombre", nombreActividad);

  const rankingOl = $("resultados-ranking");
  const detalleDiv = $("resultados-grupos-detalle");
  if (rankingOl) rankingOl.innerHTML = "";
  if (detalleDiv) detalleDiv.innerHTML = "";

  const grupos = await getGruposDeActividad(actividadId);
  if (!grupos.length) {
    if (rankingOl) {
      const li = document.createElement("li");
      li.innerText = "No hay grupos para esta actividad.";
      rankingOl.appendChild(li);
    }
    showView("view-resultados");
    return;
  }

  // Para cada grupo, obtener sus jugadores
  const gruposConJugadores = await Promise.all(
    grupos.map(async (g) => {
      const jugadores = await getJugadoresDeGrupo(g.codigoGrupo);
      return {
        ...g,
        jugadores,
      };
    })
  );

  // Ordenar por puntajeTotal descendente
  gruposConJugadores.sort((a, b) => {
    const pa = typeof a.puntajeTotal === "number" ? a.puntajeTotal : 0;
    const pb = typeof b.puntajeTotal === "number" ? b.puntajeTotal : 0;
    return pb - pa;
  });

  // Ranking
  if (rankingOl) {
    gruposConJugadores.forEach((g, idx) => {
      const li = document.createElement("li");
      const puntaje = typeof g.puntajeTotal === "number" ? g.puntajeTotal : 0;
      li.innerHTML = `
        <span class="ranking-posicion">#${idx + 1}</span>
        <span class="ranking-grupo">${g.nombreGrupo || "Grupo"}</span>
        <span class="ranking-puntaje">${puntaje} pts</span>
      `;
      rankingOl.appendChild(li);
    });
  }

  // Detalle por grupo
  if (detalleDiv) {
    gruposConJugadores.forEach((g) => {
      const puntaje = typeof g.puntajeTotal === "number" ? g.puntajeTotal : 0;
      const detalle = document.createElement("details");
      const summary = document.createElement("summary");
      summary.innerText = `${g.nombreGrupo || "Grupo"} – ${puntaje} pts`;
      detalle.appendChild(summary);

      const ul = document.createElement("ul");
      ul.className = "lista-jugadores-detalle";

      if (!g.jugadores.length) {
        const li = document.createElement("li");
        li.innerText = "Sin jugadores registrados.";
        ul.appendChild(li);
      } else {
        g.jugadores.forEach((j) => {
          const li = document.createElement("li");
          const pj = typeof j.puntaje === "number" ? j.puntaje : 0;
          li.innerText = `${j.nombre}: ${pj} pts`;
          ul.appendChild(li);
        });
      }

      detalle.appendChild(ul);
      detalleDiv.appendChild(detalle);
    });
  }

  showView("view-resultados");
}
