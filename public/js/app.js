// public/js/app.js
// ------------------------------------------------------
// Punto de entrada de la aplicación
// ------------------------------------------------------
// - Importa la capa de UI (ui.js)
// - Inicializa la app cuando el DOM está listo
// ------------------------------------------------------

import { initApp } from "./ui.js";

window.addEventListener("DOMContentLoaded", () => {
  try {
    initApp();
  } catch (err) {
    console.error("Error inicializando la aplicación:", err);
    alert("Ocurrió un problema al iniciar la aplicación. Revisa la consola.");
  }
});
