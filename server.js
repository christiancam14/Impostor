const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3002;

// Mapa de salas - cada sala tiene su propio estado de juego
const rooms = new Map();

// Lista de palabras secretas - Dataset expandido
const secretWords = [
  // Animales (25)
  "Perro",
  "Gato",
  "León",
  "Tigre",
  "Elefante",
  "Jirafa",
  "Mono",
  "Zebra",
  "Delfín",
  "Ballena",
  "Tiburón",
  "Águila",
  "Búho",
  "Pinguino",
  "Loro",
  "Tortuga",
  "Serpiente",
  "Cocodrilo",
  "Mariposa",
  "Abeja",
  "Hormiga",
  "Araña",
  "Conejo",
  "Ratón",
  "Caballo",

  // Naturaleza (20)
  "Árbol",
  "Flor",
  "Rosa",
  "Playa",
  "Montaña",
  "Río",
  "Lago",
  "Océano",
  "Bosque",
  "Desierto",
  "Volcán",
  "Cascada",
  "Isla",
  "Valle",
  "Selva",
  "Pradera",
  "Cueva",
  "Roca",
  "Arena",
  "Hielo",

  // Clima y Astronomía (15)
  "Luna",
  "Sol",
  "Estrella",
  "Planeta",
  "Cometa",
  "Lluvia",
  "Nieve",
  "Viento",
  "Tormenta",
  "Rayo",
  "Arcoíris",
  "Nube",
  "Niebla",
  "Granizo",
  "Eclipse",

  // Comida y Bebida (25)
  "Pizza",
  "Hamburguesa",
  "Café",
  "Té",
  "Jugo",
  "Agua",
  "Leche",
  "Pan",
  "Arroz",
  "Pasta",
  "Sopa",
  "Ensalada",
  "Helado",
  "Chocolate",
  "Pastel",
  "Galleta",
  "Queso",
  "Huevo",
  "Carne",
  "Pescado",
  "Fruta",
  "Verdura",
  "Manzana",
  "Banana",
  "Naranja",

  // Lugares (20)
  "Casa",
  "Escuela",
  "Hospital",
  "Restaurante",
  "Cine",
  "Parque",
  "Museo",
  "Biblioteca",
  "Tienda",
  "Mercado",
  "Aeropuerto",
  "Estación",
  "Hotel",
  "Iglesia",
  "Teatro",
  "Estadio",
  "Banco",
  "Oficina",
  "Universidad",
  "Gimnasio",

  // Transporte (15)
  "Coche",
  "Avión",
  "Barco",
  "Tren",
  "Bicicleta",
  "Moto",
  "Autobús",
  "Camión",
  "Helicóptero",
  "Submarino",
  "Cohete",
  "Patineta",
  "Scooter",
  "Taxi",
  "Ambulancia",

  // Tecnología (15)
  "Teléfono",
  "Computadora",
  "Tablet",
  "Reloj",
  "Cámara",
  "Televisión",
  "Radio",
  "Micrófono",
  "Audífonos",
  "Robot",
  "Dron",
  "Internet",
  "Email",
  "Video",
  "Aplicación",

  // Deportes y Actividades (20)
  "Fútbol",
  "Basketball",
  "Tenis",
  "Voleibol",
  "Béisbol",
  "Golf",
  "Natación",
  "Atletismo",
  "Ciclismo",
  "Boxeo",
  "Karate",
  "Yoga",
  "Baile",
  "Correr",
  "Escalar",
  "Surf",
  "Esquí",
  "Patinaje",
  "Gimnasia",
  "Pesca",

  // Arte y Música (20)
  "Música",
  "Guitarra",
  "Piano",
  "Violín",
  "Batería",
  "Flauta",
  "Trompeta",
  "Canción",
  "Coro",
  "Pintura",
  "Dibujo",
  "Escultura",
  "Fotografía",
  "Cine",
  "Teatro",
  "Danza",
  "Opera",
  "Poesía",
  "Novela",
  "Arte",

  // Objetos Cotidianos (20)
  "Libro",
  "Lápiz",
  "Papel",
  "Mesa",
  "Silla",
  "Cama",
  "Puerta",
  "Ventana",
  "Espejo",
  "Reloj",
  "Lámpara",
  "Llave",
  "Bolso",
  "Zapato",
  "Sombrero",
  "Paraguas",
  "Maleta",
  "Botella",
  "Vaso",
  "Plato",

  // Emociones y Conceptos Abstractos (15)
  "Amor",
  "Amistad",
  "Familia",
  "Felicidad",
  "Tristeza",
  "Miedo",
  "Sorpresa",
  "Ira",
  "Paz",
  "Guerra",
  "Libertad",
  "Justicia",
  "Verdad",
  "Mentira",
  "Sueño",

  // Profesiones (15)
  "Médico",
  "Maestro",
  "Ingeniero",
  "Chef",
  "Piloto",
  "Bombero",
  "Policía",
  "Artista",
  "Músico",
  "Escritor",
  "Científico",
  "Abogado",
  "Arquitecto",
  "Veterinario",
  "Fotógrafo",

  // Varios (10)
  "Trabajo",
  "Viaje",
  "Fiesta",
  "Cocina",
  "Jardín",
  "Juego",
  "Historia",
  "Futuro",
  "Pasado",
  "Presente",
];

// Rutas específicas PRIMERO (antes del middleware estático)
// Ruta principal - página de inicio
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Ruta de sala específica
app.get("/sala/:roomName", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servir archivos estáticos DESPUÉS de las rutas específicas
app.use(express.static(path.join(__dirname, "public")));

// Funciones auxiliares para salas
function getOrCreateRoom(roomName) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, {
      name: roomName,
      players: new Map(),
      hostId: null, // ID del host/anfitrión de la sala
      status: "lobby",
      secretWord: null,
      impostorId: null,
      currentTurnIndex: 0,
      currentRound: 0,
      maxRounds: 2,
      votes: new Map(),
      extraRoundVotes: new Map(),
    });
    console.log(`Sala creada: ${roomName}`);
  }
  return rooms.get(roomName);
}

function getRandomWord() {
  return secretWords[Math.floor(Math.random() * secretWords.length)];
}

function selectRandomImpostor(roomState) {
  const playerIds = Array.from(roomState.players.keys());
  if (playerIds.length < 2) return null;
  return playerIds[Math.floor(Math.random() * playerIds.length)];
}

function getPlayersArray(roomState) {
  return Array.from(roomState.players.values());
}

function getCurrentPlayer(roomState) {
  const players = getPlayersArray(roomState);
  if (players.length === 0) return null;
  return players[roomState.currentTurnIndex];
}

function broadcastGameState(roomName) {
  const roomState = rooms.get(roomName);
  if (!roomState) return;

  io.to(roomName).emit("game-state-update", {
    status: roomState.status,
    players: getPlayersArray(roomState),
    currentRound: roomState.currentRound,
    maxRounds: roomState.maxRounds,
    currentTurn: getCurrentPlayer(roomState)?.id || null,
    hostId: roomState.hostId, // Enviar quién es el host
  });
}

function sendPlayerRoles(roomName) {
  const roomState = rooms.get(roomName);
  if (!roomState) return;

  roomState.players.forEach((player, socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("your-role", {
        role: player.role,
        word: player.role === "impostor" ? null : roomState.secretWord,
      });
    }
  });
}

// Conexiones WebSocket
io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado:", socket.id);

  // Unirse a una sala con nombre de jugador
  socket.on("join-game", (data) => {
    const { name, roomName } = data;
    
    if (!roomName) {
      socket.emit("error", { message: "Nombre de sala no proporcionado" });
      return;
    }

    if (!name || name.trim() === "") {
      socket.emit("error", { message: "Nombre inválido" });
      return;
    }

    // Unirse a la sala de Socket.IO
    socket.join(roomName);
    socket.roomName = roomName;

    // Obtener o crear el estado de la sala
    const roomState = getOrCreateRoom(roomName);

    // Agregar jugador a la sala
    roomState.players.set(socket.id, {
      id: socket.id,
      name: name.trim(),
      role: null,
      vote: null,
    });

    // Asignar como host si es el primer jugador
    if (roomState.hostId === null) {
      roomState.hostId = socket.id;
      console.log(`${name} es el HOST de la sala: ${roomName}`);
    }

    console.log(`${name} se unió a la sala: ${roomName}`);
    socket.emit("join-success", { 
      id: socket.id, 
      name: name.trim(),
      isHost: socket.id === roomState.hostId
    });
    broadcastGameState(roomName);
  });

  // Iniciar juego - SOLO HOST
  socket.on("start-game", (data) => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState) return;

    // Verificar que sea el host
    if (socket.id !== roomState.hostId) {
      socket.emit("error", { message: "Solo el host puede iniciar el juego" });
      return;
    }

    if (roomState.status !== "lobby") {
      socket.emit("error", { message: "El juego ya está en curso" });
      return;
    }

    if (roomState.players.size < 3) {
      socket.emit("error", { message: "Se necesitan al menos 3 jugadores" });
      return;
    }

    // Obtener rondas configuradas o usar 2 por defecto
    const maxRounds = data?.maxRounds || 2;

    // Reiniciar estado
    roomState.status = "playing";
    roomState.secretWord = getRandomWord();
    roomState.impostorId = selectRandomImpostor(roomState);
    roomState.currentTurnIndex = 0;
    roomState.currentRound = 1;
    roomState.maxRounds = maxRounds;
    roomState.votes.clear();

    // Asignar roles
    roomState.players.forEach((player, socketId) => {
      player.role =
        socketId === roomState.impostorId ? "impostor" : "normal";
      player.vote = null;
    });

    console.log(
      `Juego iniciado en sala ${roomName}. Palabra: ${
        roomState.secretWord
      }, Impostor: ${
        roomState.players.get(roomState.impostorId).name
      }, Rondas: ${maxRounds}`
    );

    sendPlayerRoles(roomName);
    broadcastGameState(roomName);
    io.to(roomName).emit("game-started", {
      message: "El juego ha comenzado!",
    });
  });

  // Siguiente turno - SOLO HOST
  socket.on("next-turn", () => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState || roomState.status !== "playing") return;

    // Verificar que sea el host
    if (socket.id !== roomState.hostId) {
      socket.emit("error", { message: "Solo el host puede avanzar turnos" });
      return;
    }

    const players = getPlayersArray(roomState);
    roomState.currentTurnIndex++;

    // Si completamos una ronda
    if (roomState.currentTurnIndex >= players.length) {
      roomState.currentTurnIndex = 0;
      roomState.currentRound++;

      // Si completamos las rondas máximas, preguntar si quieren ronda extra
      if (roomState.currentRound > roomState.maxRounds) {
        roomState.status = "extra-round-vote";
        roomState.extraRoundVotes.clear();
        io.to(roomName).emit("ask-extra-round", {
          message: "¿Desean hacer una ronda más antes de votar?",
          currentRound: roomState.currentRound,
        });
        broadcastGameState(roomName);
        return;
      }
    }

    broadcastGameState(roomName);
  });

  // Votar por ronda extra
  socket.on("vote-extra-round", (data) => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState || roomState.status !== "extra-round-vote") return;

    const { wantsExtraRound } = data;
    const player = roomState.players.get(socket.id);

    if (!player) return;

    roomState.extraRoundVotes.set(socket.id, wantsExtraRound);
    console.log(
      `${player.name} votó ${
        wantsExtraRound ? "SÍ" : "NO"
      } para ronda extra en sala ${roomName}`
    );

    // Broadcast estado actualizado
    const totalVotes = roomState.extraRoundVotes.size;
    const totalPlayers = roomState.players.size;

    io.to(roomName).emit("extra-round-vote-update", {
      voted: totalVotes,
      total: totalPlayers,
    });

    // Si todos votaron, calcular resultado
    if (totalVotes === totalPlayers) {
      processExtraRoundVotes(roomName);
    }
  });

  // Votar por impostor
  socket.on("vote", (data) => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState || roomState.status !== "voting") {
      socket.emit("error", { message: "No es momento de votar" });
      return;
    }

    const { votedPlayerId } = data;
    const player = roomState.players.get(socket.id);

    if (!player) return;

    player.vote = votedPlayerId;
    roomState.votes.set(socket.id, votedPlayerId);

    console.log(
      `${player.name} votó por ${
        roomState.players.get(votedPlayerId)?.name
      } en sala ${roomName}`
    );
    broadcastGameState(roomName);

    // Verificar si todos votaron
    if (roomState.votes.size === roomState.players.size) {
      calculateResults(roomName);
    }
  });

  // Reiniciar juego - SOLO HOST
  socket.on("reset-game", () => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState) return;

    // Verificar que sea el host
    if (socket.id !== roomState.hostId) {
      socket.emit("error", { message: "Solo el host puede reiniciar el juego" });
      return;
    }

    roomState.status = "lobby";
    roomState.secretWord = null;
    roomState.impostorId = null;
    roomState.currentTurnIndex = 0;
    roomState.currentRound = 0;
    roomState.votes.clear();

    roomState.players.forEach((player) => {
      player.role = null;
      player.vote = null;
    });

    io.to(roomName).emit("game-reset", {
      message: "El juego ha sido reiniciado",
    });
    broadcastGameState(roomName);
  });

  // Expulsar jugador
  socket.on("kick-player", (data) => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState) return;

    const { playerId } = data;
    const kickedPlayer = roomState.players.get(playerId);

    if (!kickedPlayer) {
      socket.emit("error", { message: "Jugador no encontrado" });
      return;
    }

    const kickerPlayer = roomState.players.get(socket.id);
    console.log(
      `${kickerPlayer?.name || "Alguien"} expulsó a ${
        kickedPlayer.name
      } en sala ${roomName}`
    );

    // Notificar al jugador expulsado
    const kickedSocket = io.sockets.sockets.get(playerId);
    if (kickedSocket) {
      kickedSocket.emit("kicked", {
        message: "Has sido expulsado de la partida por otro jugador",
      });
      kickedSocket.leave(roomName);
      kickedSocket.disconnect(true);
    }

    // Eliminar del juego
    roomState.players.delete(playerId);

    // Si el juego está en curso y quedan muy pocos jugadores, reiniciar
    if (roomState.status !== "lobby" && roomState.players.size < 3) {
      roomState.status = "lobby";
      io.to(roomName).emit("game-reset", {
        message: "Juego reiniciado: no hay suficientes jugadores",
      });
    }

    broadcastGameState(roomName);
  });

  // Desconexión
  socket.on("disconnect", () => {
    const roomName = socket.roomName;
    if (!roomName) return;

    const roomState = rooms.get(roomName);
    if (!roomState) return;

    const player = roomState.players.get(socket.id);
    if (player) {
      console.log(`${player.name} se desconectó de sala ${roomName}`);
      const wasHost = socket.id === roomState.hostId;
      roomState.players.delete(socket.id);

      // Si el host se desconecta, asignar nuevo host
      if (wasHost && roomState.players.size > 0) {
        const newHostId = Array.from(roomState.players.keys())[0];
        roomState.hostId = newHostId;
        const newHost = roomState.players.get(newHostId);
        console.log(`${newHost.name} es el nuevo HOST de la sala ${roomName}`);
        
        // Notificar al nuevo host
        const newHostSocket = io.sockets.sockets.get(newHostId);
        if (newHostSocket) {
          newHostSocket.emit('you-are-host', { 
            message: '¡Ahora eres el host de la sala!' 
          });
        }
        
        io.to(roomName).emit('host-changed', {
          newHostId: newHostId,
          newHostName: newHost.name
        });
      }

      // Si el juego está en curso y quedan muy pocos jugadores, reiniciar
      if (roomState.status !== "lobby" && roomState.players.size < 3) {
        roomState.status = "lobby";
        io.to(roomName).emit("game-reset", {
          message: "Juego reiniciado por falta de jugadores",
        });
      }

      broadcastGameState(roomName);

      // Si la sala está vacía, eliminarla después de un tiempo
      if (roomState.players.size === 0) {
        setTimeout(() => {
          if (roomState.players.size === 0) {
            rooms.delete(roomName);
            console.log(`Sala ${roomName} eliminada (vacía)`);
          }
        }, 60000); // 1 minuto
      }
    }
  });
});

function processExtraRoundVotes(roomName) {
  const roomState = rooms.get(roomName);
  if (!roomState) return;

  let yesVotes = 0;
  let noVotes = 0;

  roomState.extraRoundVotes.forEach((vote) => {
    if (vote) yesVotes++;
    else noVotes++;
  });

  console.log(
    `Votos ronda extra en sala ${roomName} - SÍ: ${yesVotes}, NO: ${noVotes}`
  );

  // Si la mayoría quiere ronda extra
  if (yesVotes > noVotes) {
    roomState.status = "playing";
    roomState.maxRounds++;
    roomState.extraRoundVotes.clear();

    io.to(roomName).emit("extra-round-approved", {
      message: `¡Ronda extra aprobada! Continuando a la ronda ${roomState.currentRound}`,
      newMaxRounds: roomState.maxRounds,
    });
    broadcastGameState(roomName);
  } else {
    // Ir a votación
    roomState.status = "voting";
    roomState.votes.clear();
    roomState.players.forEach((player) => (player.vote = null));
    roomState.extraRoundVotes.clear();

    io.to(roomName).emit("start-voting", {
      message: "Es hora de votar por el impostor!",
    });
    broadcastGameState(roomName);
  }
}

function calculateResults(roomName) {
  const roomState = rooms.get(roomName);
  if (!roomState) return;

  roomState.status = "results";

  // Contar votos
  const voteCount = new Map();
  roomState.votes.forEach((votedId) => {
    voteCount.set(votedId, (voteCount.get(votedId) || 0) + 1);
  });

  // Encontrar al jugador más votado
  let maxVotes = 0;
  let mostVotedId = null;
  voteCount.forEach((count, playerId) => {
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedId = playerId;
    }
  });

  const impostor = roomState.players.get(roomState.impostorId);
  const mostVoted = roomState.players.get(mostVotedId);
  const impostorWon = mostVotedId !== roomState.impostorId;

  const results = {
    impostorId: roomState.impostorId,
    impostorName: impostor?.name,
    secretWord: roomState.secretWord,
    mostVotedId: mostVotedId,
    mostVotedName: mostVoted?.name,
    votes: Array.from(voteCount.entries()).map(([playerId, count]) => ({
      playerId,
      playerName: roomState.players.get(playerId)?.name,
      count,
    })),
    impostorWon,
    message: impostorWon
      ? `¡El impostor (${impostor?.name}) ganó! Engañaron al grupo.`
      : `¡Atraparon al impostor (${impostor?.name})! Los jugadores ganaron.`,
  };

  io.to(roomName).emit("game-results", results);
  broadcastGameState(roomName);
}

// Limpiar salas vacías cada 5 minutos
setInterval(() => {
  rooms.forEach((roomState, roomName) => {
    if (roomState.players.size === 0) {
      rooms.delete(roomName);
      console.log(`Sala ${roomName} eliminada automáticamente (inactiva)`);
    }
  });
}, 5 * 60 * 1000);

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor del juego Impostor corriendo en http://localhost:${PORT}`);
  console.log(`Sistema de salas activado`);
});
