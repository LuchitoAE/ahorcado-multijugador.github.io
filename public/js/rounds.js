// public/js/rounds.js
// -----------------------------------------
// Packs de contenido y utilidades de rondas
// -----------------------------------------
//
// - Define los "packs" de contenido para el juego del ahorcado.
// - Cada pack tiene un banco de palabras con tema y pista.
// - Expone funciones para seleccionar rondas aleatorias según el pack.
//
// Más adelante, si quieres, aquí puedes agregar nuevos packs
// (por ejemplo, "Comunicación", "Matemática", etc.).

// ID del pack principal que estás usando
export const PACK_PERU_PERSONAL_SOCIAL = "peru-personal-social";

// Banco de contenido: Perú – Personal Social
// Nota: Las palabras se guardan SIN tildes y en mayúsculas.
//       Sí se usa Ñ (ej. VICUÑA).
const BANCO_PERU_PERSONAL_SOCIAL = [
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
  { tema: "Valores",     pista: "Ponerse en el lugar del otro.", palabra: "EMPATIA" },
];

// -----------------------------------------
// Registro de packs
// -----------------------------------------
//
// Si en el futuro quieres más packs, solo agregas acá:
//  - Un nuevo banco (BANCO_...)
//  - Una entrada más en PACKS

const PACKS = {
  [PACK_PERU_PERSONAL_SOCIAL]: {
    id: PACK_PERU_PERSONAL_SOCIAL,
    nombre: "Perú – Personal Social",
    descripcion:
      "Perú: símbolos, regiones, patrimonio cultural, danzas, gastronomía, lenguas, animales y valores.",
    banco: BANCO_PERU_PERSONAL_SOCIAL,
  },
};

// -----------------------------------------
// Funciones públicas
// -----------------------------------------

/**
 * Devuelve la configuración de un pack:
 * { id, nombre, descripcion, banco }
 * o null si no existe.
 */
export function getPackConfig(packId) {
  return PACKS[packId] || null;
}

/**
 * Selecciona N rondas aleatorias del pack indicado.
 * Devuelve un array de objetos:
 * [{ indice, tema, pista, palabra }, ...]
 *
 * - palabra viene NORMALIZADA en mayúsculas y sin tildes.
 */
export function generarRondasParaPack(packId, numRondas) {
  const pack = getPackConfig(packId);
  if (!pack) {
    console.warn("[rounds] Pack desconocido:", packId);
    return [];
  }

  const banco = pack.banco || [];
  if (!banco.length) return [];

  const barajado = mezclarArray(banco);
  const seleccion = barajado.slice(0, Math.min(numRondas, barajado.length));

  return seleccion.map((item, index) => ({
    indice: index,
    tema: item.tema,
    pista: item.pista,
    palabra: normalizarPalabra(item.palabra),
  }));
}

/**
 * Quita tildes y pasa a MAYÚSCULAS.
 * Mantiene la Ñ tal como está.
 */
export function normalizarPalabra(texto) {
  if (!texto) return "";
  return texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // elimina acentos
}

// -----------------------------------------
// Helpers internos
// -----------------------------------------

/**
 * Devuelve una copia barajada de un array (Fisher-Yates).
 */
function mezclarArray(arr) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
