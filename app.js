// =============================
// CONFIGURACIÓN DEL JUEGO
// =============================
const palabras = ["RESPETO", "HONESTIDAD", "RESPONSABILIDAD", "SOLIDARIDAD", "EMPATIA"];
let ronda = 0;
let palabraActual = "";
let progreso = "";
let letrasUsadas = [];
let turno = 0;

// =============================
// PEERJS
// =============================
let peer;
let host = false;
let conexiones = [];
let miNombre = "";
let miID = "";

function crearSala() {
    esconderTodo();
    host = true;

    peer = new Peer();
    peer.on("open", id => {
        document.getElementById("miCodigo").innerText = id;
        mostrar("host");
    });

    peer.on("connection", conn => {
        conexiones.push(conn);
        conn.on("data", recibirMensaje);
        actualizarListaJugadores();
    });
}

function mostrarUnirse() {
    esconderTodo();
    mostrar("unirse");
}

function unirseSala() {
    const codigo = document.getElementById("codigoSala").value;
    miNombre = document.getElementById("nombreJugador").value;

    if (!codigo || !miNombre) return alert("Completa todos los campos");

    esconderTodo();
    mostrar("juego");

    peer = new Peer();
    peer.on("open", id => {
        miID = id;
        const conn = peer.connect(codigo);
        conn.on("open", () => {
            conex = conn;
            conn.send({ tipo: "nuevo_jugador", nombre: miNombre, id: id });
        });
        conn.on("data", recibirMensaje);
    });
}

function iniciarJuego() {
    ronda = 0;
    iniciarRonda();
}

function iniciarRonda() {
    palabraActual = palabras[ronda];
    progreso = "_".repeat(palabraActual.length);
    letrasUsadas = [];
    turno = 0;

    enviarTodos({
        tipo: "estado_juego",
        ronda,
        progreso,
        letrasUsadas,
        turno,
        jugadores: conexiones.length
    });

    mostrar("juego");
    actualizarPantallaJuego();
}

function enviarLetra() {
    const letra = document.getElementById("inputLetra").value.toUpperCase();
    if (!letra.match(/[A-Z]/)) return;

    enviarTodos({
        tipo: "letra",
        letra
    });

    document.getElementById("inputLetra").value = "";
}

// =============================
// ACTUALIZADOR GENERAL
// =============================
function recibirMensaje(msg) {
    switch (msg.tipo) {
        case "nuevo_jugador":
            if (host) {
                conexiones.push(this);
                actualizarListaJugadores();
            }
            break;

        case "estado_juego":
            ronda = msg.ronda;
            progreso = msg.progreso;
            letrasUsadas = msg.letrasUsadas;
            turno = msg.turno;
            actualizarPantallaJuego();
            break;

        case "letra":
            procesarLetra(msg.letra);
            break;
    }
}

function procesarLetra(letra) {
    if (letrasUsadas.includes(letra)) return;

    letrasUsused.push(letra);

    let nuevoProgreso = "";
    let acierto = false;

    for (let i = 0; i < palabraActual.length; i++) {
        if (palabraActual[i] === letra) {
            nuevoProgreso += letra;
            acierto = true;
        } else {
            nuevoProgreso += progreso[i];
        }
    }

    progreso = nuevoProgreso;

    if (!acierto) turno = (turno + 1) % 4;

    enviarTodos({
        tipo: "estado_juego",
        ronda,
        progreso,
        letrasUsadas,
        turno
    });

    if (progreso === palabraActual) {
        ronda++;
        if (ronda < palabras.length) {
            setTimeout(iniciarRonda, 2000);
        } else {
            alert("¡Juego terminado!");
        }
    }
}

function actualizarPantallaJuego() {
    document.getElementById("rondaActual").innerText = ronda + 1;
    document.getElementById("palabraOculta").innerText = progreso;
    document.getElementById("letrasUsadas").innerText = letrasUsadas.join(", ");
}

function enviarTodos(msg) {
    conexiones.forEach(c => c.send(msg));
}

// =============================
// INTERFAZ
// =============================
function esconderTodo() {
    document.querySelectorAll("div").forEach(d => d.classList.add("hidden"));
}

function mostrar(id) {
    document.getElementById(id).classList.remove("hidden");
}

function volverMenu() {
    location.reload();
}
