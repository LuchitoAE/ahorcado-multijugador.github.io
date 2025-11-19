// public/js/svg.js
// -------------------------------------------------------
// Módulo de dibujo del ahorcado (versión bonita 💅)
// -------------------------------------------------------
// - Crea un SVG con fondo (cielo, montañas, sol, nubes).
// - Soporte + personaje estilo cartoon.
// - 10 partes (p1..p10) que se muestran según los fallos.
// - Animación suave cuando aparece cada nueva parte.
//
// Uso básico:
//   import { initAhorcadoSVG, actualizarAhorcado } from "./svg.js";
//
//   initAhorcadoSVG("ahorcado-container");
//   actualizarAhorcado(fallosActuales, 10);
// -------------------------------------------------------

/**
 * Crea el SVG dentro del contenedor indicado (por defecto "ahorcado-container").
 * Solo se crea una vez (si ya existe, no lo duplica).
 */
export function initAhorcadoSVG(containerId = "ahorcado-container") {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Evitar inicializar dos veces
  if (container.dataset.ahorcadoInitialized === "1") return;
  container.dataset.ahorcadoInitialized = "1";

  container.innerHTML = getAhorcadoSVGMarkup();
}

/**
 * Actualiza el dibujo según el número de fallos.
 * @param {number} fallos Número de fallos (0..maxPartes)
 * @param {number} maxPartes Total de partes a usar (por defecto 10)
 */
export function actualizarAhorcado(fallos, maxPartes = 10) {
  const partes = Math.min(Math.max(fallos, 0), maxPartes);

  for (let i = 1; i <= maxPartes; i++) {
    const el = document.getElementById("p" + i);
    if (!el) continue;

    if (i <= partes) {
      // Mostrar con pequeña animación al aparecer
      if (el.style.display === "none" || !el.style.display) {
        el.style.display = "block";

        if (el.animate) {
          el.animate(
            [
              { opacity: 0, transform: "translateY(-4px) scale(0.9)" },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            { duration: 260, easing: "ease-out", fill: "forwards" }
          );
        } else {
          el.style.opacity = "1";
        }
      }
    } else {
      el.style.display = "none";
    }
  }
}

/**
 * Resetea el ahorcado (sin partes visibles).
 */
export function resetAhorcado(maxPartes = 10) {
  actualizarAhorcado(0, maxPartes);
}

/**
 * Devuelve el markup del SVG del ahorcado.
 * Fondo bonito + soporte + personaje cartoon.
 */
function getAhorcadoSVGMarkup() {
  return `
  <svg
    id="ahorcado-svg"
    viewBox="0 0 260 260"
    width="100%"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <!-- Degradado del cielo -->
      <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e0f2ff" />
        <stop offset="50%" stop-color="#f3f4ff" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>

      <!-- Degradado del suelo -->
      <linearGradient id="groundGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c8e6a0" />
        <stop offset="100%" stop-color="#8bc34a" />
      </linearGradient>

      <!-- Degradado de madera -->
      <linearGradient id="woodGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8b5a2b" />
        <stop offset="50%" stop-color="#a9713c" />
        <stop offset="100%" stop-color="#6b3a1c" />
      </linearGradient>

      <!-- Piel -->
      <linearGradient id="skinGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd9c0" />
        <stop offset="100%" stop-color="#ffc4a3" />
      </linearGradient>

      <!-- Sombras suaves -->
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.15" />
      </filter>

      <filter id="softShadowSmall" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.15" />
      </filter>
    </defs>

    <!-- FONDO: cielo -->
    <rect x="0" y="0" width="260" height="260" fill="url(#skyGradient)" />

    <!-- Sol -->
    <g transform="translate(210 40)">
      <circle cx="0" cy="0" r="16" fill="#ffeb3b" opacity="0.95" />
      <circle cx="0" cy="0" r="19" fill="none" stroke="#fcd34d" stroke-width="2" opacity="0.7" />
    </g>

    <!-- Nubes -->
    <g fill="#ffffff" opacity="0.9">
      <path d="M45 55c6-10 22-10 28 0 10-4 20 2 21 12-9 1-45 1-49-1-4-2-4-7 0-11z" />
      <path d="M150 35c5-8 18-8 23 0 8-3 16 2 17 9-8 1-37 1-40-1-3-2-3-6 0-8z" />
    </g>

    <!-- Montañas al fondo -->
    <g fill="#9fbadf" opacity="0.75">
      <path d="M-10 200 L60 80 L130 200 Z" />
      <path d="M70 210 L150 90 L240 210 Z" opacity="0.8" />
    </g>

    <!-- Suelo -->
    <rect x="0" y="200" width="260" height="60" fill="url(#groundGradient)" />

    <!-- Hierba delantera -->
    <g fill="#5b9b3b" opacity="0.9">
      <path d="M10 210 q10 -10 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 L260 260 L0 260 Z" />
    </g>

    <!-- Sombras bajo la estructura -->
    <ellipse cx="90" cy="215" rx="50" ry="8" fill="#000" opacity="0.08" />

    <!-- SOPORTE (partes: p1, p2, p3, p4) -->
    <!-- Base -->
    <g id="p1" style="display:none;" filter="url(#softShadow)">
      <rect x="40" y="200" width="100" height="14" rx="5" fill="url(#woodGradient)" />
      <!-- pequeños detalles de madera -->
      <line x1="50" y1="205" x2="60" y2="205"
        stroke="#f5e0c3" stroke-width="1.4" stroke-linecap="round" opacity="0.5" />
      <line x1="90" y1="208" x2="102" y2="208"
        stroke="#f5e0c3" stroke-width="1.4" stroke-linecap="round" opacity="0.4" />
    </g>

    <!-- Poste vertical -->
    <g id="p2" style="display:none;" filter="url(#softShadow)">
      <rect x="70" y="70" width="12" height="130" rx="6" fill="url(#woodGradient)" />
      <!-- clavos -->
      <circle cx="76" cy="85" r="1.4" fill="#f5e0c3" opacity="0.8" />
      <circle cx="76" cy="110" r="1.4" fill="#f5e0c3" opacity="0.7" />
      <circle cx="76" cy="135" r="1.4" fill="#f5e0c3" opacity="0.6" />
    </g>

    <!-- Poste horizontal -->
    <g id="p3" style="display:none;" filter="url(#softShadow)">
      <rect x="76" y="60" width="80" height="12" rx="6" fill="url(#woodGradient)" />
      <!-- unión con el poste -->
      <rect x="76" y="60" width="18" height="12" rx="4" fill="#6b3a1c" opacity="0.8" />
    </g>

    <!-- Cuerda -->
    <g id="p4" style="display:none;">
      <line x1="150" y1="72" x2="150" y2="98"
        stroke="#c68d53" stroke-width="4" stroke-linecap="round" />
      <!-- pequeño nudo -->
      <circle cx="150" cy="98" r="3.5" fill="#c68d53" />
    </g>

    <!-- PERSONAJE CARTOON (partes p5..p10) -->
    <!-- Cabeza y expresión -->
    <g id="p5" style="display:none;" filter="url(#softShadowSmall)">
      <!-- sombra suave detrás -->
      <circle cx="150" cy="114" r="22" fill="#000000" opacity="0.1" />
      <!-- cabeza -->
      <circle cx="150" cy="110" r="20" fill="url(#skinGradient)" stroke="#6b3a1c" stroke-width="2" />
      <!-- cabello superior -->
      <path
        d="M134 104 q8 -10 16 -10 q8 0 16 6 q-2 -10 -8 -14 q-6 -4 -12 -4 q-7 0 -13 4 q-6 4 -8 12 z"
        fill="#3b2f2f" opacity="0.95"
      />
      <!-- mejillas -->
      <circle cx="142" cy="114" r="3.2" fill="#fecaca" opacity="0.9" />
      <circle cx="158" cy="114" r="3.2" fill="#fecaca" opacity="0.9" />
      <!-- ojos -->
      <circle cx="143" cy="107" r="2.3" fill="#1f2933" />
      <circle cx="157" cy="107" r="2.3" fill="#1f2933" />
      <!-- cejas ligeras -->
      <path d="M138 102 q5 -3 10 0" stroke="#3b2f2f" stroke-width="1.2" stroke-linecap="round" />
      <path d="M152 102 q5 -3 10 0" stroke="#3b2f2f" stroke-width="1.2" stroke-linecap="round" />
      <!-- boca neutra simpática -->
      <path d="M142 118 q8 5 16 0" stroke="#6b3a1c" stroke-width="1.8" fill="none" stroke-linecap="round" />
    </g>

    <!-- Cuerpo -->
    <g id="p6" style="display:none;" stroke-linecap="round">
      <!-- tronco -->
      <line
        x1="150" y1="130"
        x2="150" y2="168"
        stroke="#1f2933" stroke-width="4"
      />
      <!-- polera/camiseta -->
      <path
        d="M138 132 q12 -10 24 0 v12 h-24 z"
        fill="#2563eb"
        opacity="0.9"
      />
    </g>

    <!-- Brazo izquierdo -->
    <g id="p7" style="display:none;" stroke-linecap="round">
      <line
        x1="150" y1="138"
        x2="132" y2="152"
        stroke="#1f2933" stroke-width="4"
      />
      <!-- manga -->
      <circle cx="132" cy="152" r="2.8" fill="#2563eb" />
    </g>

    <!-- Brazo derecho -->
    <g id="p8" style="display:none;" stroke-linecap="round">
      <line
        x1="150" y1="138"
        x2="168" y2="152"
        stroke="#1f2933" stroke-width="4"
      />
      <!-- manga -->
      <circle cx="168" cy="152" r="2.8" fill="#2563eb" />
    </g>

    <!-- Pierna izquierda -->
    <g id="p9" style="display:none;" stroke-linecap="round">
      <line
        x1="150" y1="168"
        x2="138" y2="198"
        stroke="#1f2933" stroke-width="4"
      />
      <!-- zapatilla -->
      <path
        d="M134 196 q6 4 12 0"
        stroke="#1f2933" stroke-width="3"
        stroke-linecap="round"
      />
    </g>

    <!-- Pierna derecha -->
    <g id="p10" style="display:none;" stroke-linecap="round">
      <line
        x1="150" y1="168"
        x2="162" y2="198"
        stroke="#1f2933" stroke-width="4"
      />
      <!-- zapatilla -->
      <path
        d="M158 196 q6 4 12 0"
        stroke="#1f2933" stroke-width="3"
        stroke-linecap="round"
      />
    </g>
  </svg>
  `;
}
