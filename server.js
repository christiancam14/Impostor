const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  pingTimeout: 60000, // 60 segundos - tiempo para considerar desconectado
  pingInterval: 25000, // 25 segundos - intervalo de ping
  transports: ['websocket', 'polling'], // Permitir ambos transportes
  allowEIO3: true, // Compatibilidad con versiones antiguas
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
      disconnectedPlayers: new Map(), // Jugadores temporalmente desconectados {name: {player data, timeout}}
      hostId: null, // ID del host/anfitrión de la sala
      playerOrder: [], // Orden de los jugadores para los turnos (se aleatoriza al iniciar)
      status: "lobby",
      secretWord: null,
      impostorIds: [], // Array de IDs de impostores (soporta múltiples impostores)
      numImpostors: 1, // Número de impostores configurado por el host
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

function selectRandomImpostors(roomState) {
  const playerIds = Array.from(roomState.players.keys());
  const numImpostors = roomState.numImpostors || 1;
  
  // Validar que haya suficientes jugadores
  if (playerIds.length < numImpostors + 1) {
    console.warn(`No hay suficientes jugadores para ${numImpostors} impostores. Usando 1 impostor.`);
    return [playerIds[Math.floor(Math.random() * playerIds.length)]];
  }
  
  // Validar que quede al menos 1 jugador normal
  if (numImpostors >= playerIds.length) {
    console.warn(`Demasiados impostores solicitados. Usando máximo ${playerIds.length - 1} impostores.`);
    const maxImpostors = playerIds.length - 1;
    const shuffled = shuffleArray([...playerIds]);
    return shuffled.slice(0, maxImpostors);
  }
  
  // Seleccionar impostores aleatoriamente
  const shuffled = shuffleArray([...playerIds]);
  return shuffled.slice(0, numImpostors);
}

function getPlayersArray(roomState) {
  // Si hay un orden definido (durante el juego), usarlo
  if (roomState.playerOrder && roomState.playerOrder.length > 0) {
    const orderedPlayers = roomState.playerOrder
      .map(playerId => roomState.players.get(playerId))
      .filter(player => player !== undefined);
    
    // Si hay jugadores que no están en playerOrder (por ejemplo, se unieron después), agregarlos al final
    const orderedIds = new Set(roomState.playerOrder);
    const unorderedPlayers = Array.from(roomState.players.values())
      .filter(player => !orderedIds.has(player.id));
    
    return [...orderedPlayers, ...unorderedPlayers];
  }
  // Si no hay orden (lobby), usar el orden del Map
  return Array.from(roomState.players.values());
}

function shuffleArray(array) {
  if (!array || array.length === 0) return [];
  const shuffled = [...array];
  // Usar Math.random() con seed para asegurar aleatoriedad
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

    // Verificar si existe un jugador temporalmente desconectado con el mismo nombre
    const disconnectedData = roomState.disconnectedPlayers.get(name.trim());
    
    if (disconnectedData) {
      // Reconexión de un jugador que se desconectó temporalmente
      console.log(`${name} se está reconectando a la sala ${roomName} (rol preservado: ${disconnectedData.player.role})`);
      
      // Cancelar el timeout de eliminación
      if (disconnectedData.timeout) {
        clearTimeout(disconnectedData.timeout);
      }
      
      // Verificar si este jugador era un impostor
      const wasImpostor = roomState.impostorIds && roomState.impostorIds.includes(disconnectedData.player.id);
      
      // Restaurar el jugador con su rol y voto preservados
      roomState.players.set(socket.id, {
        id: socket.id,
        name: name.trim(),
        role: disconnectedData.player.role,
        vote: disconnectedData.player.vote,
      });
      
      // Actualizar playerOrder si el juego está en curso (mantener posición)
      if (roomState.status !== "lobby" && roomState.playerOrder.length > 0) {
        const oldId = disconnectedData.player.id;
        const index = roomState.playerOrder.indexOf(oldId);
        if (index !== -1) {
          roomState.playerOrder[index] = socket.id; // Reemplazar ID antiguo con nuevo
        }
      }
      
      // Si el jugador era un impostor, actualizar el impostorIds
      if (wasImpostor && roomState.impostorIds) {
        const impostorIndex = roomState.impostorIds.indexOf(disconnectedData.player.id);
        if (impostorIndex !== -1) {
          roomState.impostorIds[impostorIndex] = socket.id;
          console.log(`${name} recuperó su rol de IMPOSTOR (ID actualizado)`);
        }
      }
      
      // Si el jugador era el host, actualizar el hostId
      if (disconnectedData.wasHost) {
        roomState.hostId = socket.id;
        console.log(`${name} recuperó su posición como HOST`);
      }
      
      // Eliminar de la lista de desconectados
      roomState.disconnectedPlayers.delete(name.trim());
    } else {
      // Verificar si ya existe un jugador conectado con el mismo nombre
      let existingPlayer = null;
      let existingPlayerId = null;
      
      for (const [playerId, player] of roomState.players.entries()) {
        if (player.name === name.trim()) {
          existingPlayer = player;
          existingPlayerId = playerId;
          break;
        }
      }
      
      if (existingPlayer && existingPlayerId !== socket.id) {
        // Jugador duplicado conectándose simultáneamente (reemplazar)
        console.log(`${name} se está conectando nuevamente (reemplazando conexión anterior)`);
        
        const preservedRole = existingPlayer.role;
        const preservedVote = existingPlayer.vote;
        const wasHost = roomState.hostId === existingPlayerId;
        const wasImpostor = roomState.impostorIds && roomState.impostorIds.includes(existingPlayerId);
        
        roomState.players.delete(existingPlayerId);
        
        roomState.players.set(socket.id, {
          id: socket.id,
          name: name.trim(),
          role: preservedRole,
          vote: preservedVote,
        });
        
        // Actualizar playerOrder si el juego está en curso (mantener posición)
        if (roomState.status !== "lobby" && roomState.playerOrder.length > 0) {
          const index = roomState.playerOrder.indexOf(existingPlayerId);
          if (index !== -1) {
            roomState.playerOrder[index] = socket.id; // Reemplazar ID antiguo con nuevo
          }
        }
        
        if (wasHost) {
          roomState.hostId = socket.id;
        }
        
        if (wasImpostor && roomState.impostorIds) {
          const impostorIndex = roomState.impostorIds.indexOf(existingPlayerId);
          if (impostorIndex !== -1) {
            roomState.impostorIds[impostorIndex] = socket.id;
            console.log(`${name} recuperó su rol de IMPOSTOR (ID actualizado en conexión duplicada)`);
          }
        }
      } else {
        // Jugador completamente nuevo
        roomState.players.set(socket.id, {
          id: socket.id,
          name: name.trim(),
          role: null,
          vote: null,
        });
        
        // Agregar al playerOrder solo si estamos en lobby
        if (roomState.status === "lobby") {
          roomState.playerOrder.push(socket.id);
        }
      }
    }

    // Asignar como host si es el primer jugador
    if (roomState.hostId === null) {
      roomState.hostId = socket.id;
      console.log(`${name} es el HOST de la sala: ${roomName}`);
    }

    console.log(`${name} se unió a la sala: ${roomName}`);
    
    // Preparar datos del rol si el juego está en curso
    let roleData = null;
    if (roomState.status === "playing" || roomState.status === "voting" || roomState.status === "extra-round-vote") {
      const player = roomState.players.get(socket.id);
      if (player && player.role) {
        console.log(`Enviando rol a ${player.name}: ${player.role} (reconexión durante partida)`);
        roleData = {
          role: player.role,
          word: player.role === "impostor" ? null : roomState.secretWord,
        };
      } else if (player) {
        console.log(`⚠️ ADVERTENCIA: ${player.name} no tiene rol asignado durante partida activa`);
      }
    }
    
    // Enviar estado de conexión exitosa con el estado actual del juego Y el rol
    socket.emit("join-success", { 
      id: socket.id, 
      name: name.trim(),
      isHost: socket.id === roomState.hostId,
      roomName: roomName,
      // Enviar rol si está disponible (INCLUIDO EN join-success para evitar problemas de timing)
      role: roleData,
      // Enviar estado actual del juego para sincronización
      gameState: {
        status: roomState.status,
        currentRound: roomState.currentRound,
        maxRounds: roomState.maxRounds,
        currentTurn: getCurrentPlayer(roomState)?.id || null,
        players: getPlayersArray(roomState)
      }
    });
    
    broadcastGameState(roomName);
    
    // Si el juego está en curso, forzar sincronización inmediata después de unirse
    if (roomState.status !== "lobby") {
      // Enviar estado completo inmediatamente para asegurar sincronización
      setTimeout(() => {
        broadcastGameState(roomName);
      }, 100);
    }
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

    // Validar número de impostores
    const numImpostors = data?.numImpostors || roomState.numImpostors || 1;
    const minPlayersForImpostors = numImpostors + 1; // Al menos 1 jugador normal
    
    if (roomState.players.size < minPlayersForImpostors) {
      socket.emit("error", { 
        message: `Se necesitan al menos ${minPlayersForImpostors} jugadores para ${numImpostors} ${numImpostors === 1 ? 'impostor' : 'impostores'}` 
      });
      return;
    }
    
    // Validar que no haya más impostores que jugadores normales
    const maxImpostors = Math.floor(roomState.players.size / 2); // Máximo la mitad de jugadores
    if (numImpostors > maxImpostors) {
      socket.emit("error", { 
        message: `No puedes tener más de ${maxImpostors} ${maxImpostors === 1 ? 'impostor' : 'impostores'} con ${roomState.players.size} jugadores` 
      });
      return;
    }
    
    // Guardar número de impostores configurado
    roomState.numImpostors = numImpostors;

    // Obtener rondas configuradas o usar 2 por defecto
    const maxRounds = data?.maxRounds || 2;

    // Aleatorizar el orden de los jugadores al iniciar la partida
    // Limpiar playerOrder primero para asegurar que no haya datos residuales
    roomState.playerOrder = [];
    const playerIds = Array.from(roomState.players.keys());
    console.log(`IDs de jugadores antes de aleatorizar en sala ${roomName}:`, playerIds);
    
    // Aleatorizar múltiples veces para asegurar aleatoriedad
    let shuffled = shuffleArray(playerIds);
    // Hacer una segunda pasada de aleatorización para mayor aleatoriedad
    shuffled = shuffleArray(shuffled);
    
    roomState.playerOrder = shuffled;
    console.log(`Orden aleatorio de jugadores en sala ${roomName}:`, 
      roomState.playerOrder.map(id => roomState.players.get(id)?.name).join(', '));

    // Reiniciar estado
    roomState.status = "playing";
    roomState.secretWord = getRandomWord();
    roomState.impostorIds = selectRandomImpostors(roomState);
    roomState.currentTurnIndex = 0;
    roomState.currentRound = 1;
    roomState.maxRounds = maxRounds;
    roomState.votes.clear();

    // Asignar roles
    roomState.players.forEach((player, socketId) => {
      player.role = roomState.impostorIds.includes(socketId) ? "impostor" : "normal";
      player.vote = null;
    });

    const impostorNames = roomState.impostorIds.map(id => roomState.players.get(id)?.name).join(', ');
    console.log(
      `Juego iniciado en sala ${roomName}. Palabra: ${
        roomState.secretWord
      }, Impostor${roomState.impostorIds.length > 1 ? 'es' : ''}: ${impostorNames}, Rondas: ${maxRounds}`
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
        
        // Preparar información inicial de votos para enviar al cliente
        const initialVotesInfo = Array.from(roomState.players.entries()).map(([playerId, player]) => ({
          id: playerId,
          name: player.name,
          hasVoted: false,
          vote: null
        }));
        
        io.to(roomName).emit("ask-extra-round", {
          message: "¿Desean hacer una ronda más antes de votar?",
          currentRound: roomState.currentRound,
        });
        
        // Enviar estado inicial de votación
        io.to(roomName).emit("extra-round-vote-update", {
          voted: 0,
          total: roomState.players.size,
          players: initialVotesInfo
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

    // Broadcast estado actualizado con información detallada
    const totalVotes = roomState.extraRoundVotes.size;
    const totalPlayers = roomState.players.size;
    
    // Preparar información de votos para enviar al cliente
    const votesInfo = Array.from(roomState.players.entries()).map(([playerId, player]) => {
      const hasVoted = roomState.extraRoundVotes.has(playerId);
      const vote = hasVoted ? roomState.extraRoundVotes.get(playerId) : null;
      return {
        id: playerId,
        name: player.name,
        hasVoted: hasVoted,
        vote: vote // true = quiere ronda extra, false = votar ahora, null = no ha votado
      };
    });

    io.to(roomName).emit("extra-round-vote-update", {
      voted: totalVotes,
      total: totalPlayers,
      players: votesInfo
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
    roomState.impostorIds = [];
    roomState.currentTurnIndex = 0;
    roomState.currentRound = 0;
    roomState.votes.clear();
    roomState.playerOrder = []; // Limpiar orden para que se aleatorice en la próxima partida

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
      roomState.playerOrder = []; // Limpiar orden para que se aleatorice en la próxima partida
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
      
      // Si estamos en lobby, remover del playerOrder
      if (roomState.status === "lobby") {
        const index = roomState.playerOrder.indexOf(socket.id);
        if (index !== -1) {
          roomState.playerOrder.splice(index, 1);
        }
      }
      
      // Si el juego está en curso, guardar temporalmente al jugador para reconexión
      if (roomState.status !== "lobby" && player.role) {
        console.log(`💾 Guardando estado de ${player.name} para posible reconexión (rol: ${player.role})`);
        
        // Guardar jugador temporalmente (60 segundos para reconectar)
        const timeout = setTimeout(() => {
          console.log(`⏰ Tiempo de reconexión agotado para ${player.name}`);
          roomState.disconnectedPlayers.delete(player.name);
        }, 60000); // 60 segundos para reconectar (más tiempo para conexiones lentas)
        
        roomState.disconnectedPlayers.set(player.name, {
          player: { ...player }, // Copia del jugador con su rol
          wasHost: wasHost,
          timeout: timeout
        });
      }
      
      // Eliminar de jugadores activos
      roomState.players.delete(socket.id);

      // Si el host se desconecta, asignar nuevo host temporalmente
      if (wasHost && roomState.players.size > 0) {
        const newHostId = Array.from(roomState.players.keys())[0];
        roomState.hostId = newHostId;
        const newHost = roomState.players.get(newHostId);
        console.log(`${newHost.name} es el nuevo HOST temporal de la sala ${roomName}`);
        
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
        roomState.playerOrder = []; // Limpiar orden para que se aleatorice en la próxima partida
        io.to(roomName).emit("game-reset", {
          message: "Juego reiniciado por falta de jugadores",
        });
      }

      broadcastGameState(roomName);

      // Si la sala está vacía, eliminarla después de un tiempo
      if (roomState.players.size === 0) {
        setTimeout(() => {
          if (roomState.players.size === 0 && roomState.disconnectedPlayers.size === 0) {
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

  // Buscar a los impostores
  const impostorIds = roomState.impostorIds || [];
  const impostors = impostorIds
    .map(id => roomState.players.get(id))
    .filter(p => p !== undefined);
  
  // Si no se encuentran impostores (reconexión fallida), buscarlos por rol
  if (impostors.length === 0) {
    console.log('⚠️ ADVERTENCIA: impostorIds no encontrados, buscando por rol...');
    const foundImpostors = [];
    for (const [playerId, player] of roomState.players.entries()) {
      if (player.role === 'impostor') {
        foundImpostors.push({ id: playerId, player });
        if (!roomState.impostorIds.includes(playerId)) {
          roomState.impostorIds.push(playerId);
        }
      }
    }
    impostors.push(...foundImpostors.map(f => f.player));
    console.log(`Impostores encontrados: ${impostors.map(p => p.name).join(', ')}`);
  }
  
  const mostVoted = roomState.players.get(mostVotedId);
  // El impostor gana si el más votado NO es un impostor
  const impostorWon = !impostorIds.includes(mostVotedId);
  
  const impostorNames = impostors.map(p => p.name).join(', ') || 'Desconocido';
  const impostorText = impostors.length > 1 ? 'impostores' : 'impostor';

  const results = {
    impostorIds: impostorIds,
    impostorNames: impostorNames,
    numImpostors: impostors.length,
    secretWord: roomState.secretWord,
    mostVotedId: mostVotedId,
    mostVotedName: mostVoted?.name || 'Nadie',
    votes: Array.from(voteCount.entries()).map(([playerId, count]) => ({
      playerId,
      playerName: roomState.players.get(playerId)?.name || 'Desconocido',
      count,
    })),
    impostorWon,
    message: impostorWon
      ? `¡Los ${impostorText} (${impostorNames}) ganaron! Engañaron al grupo.`
      : `¡Atraparon ${impostors.length > 1 ? 'a los impostores' : 'al impostor'} (${impostorNames})! Los jugadores ganaron.`,
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
// Función para obtener la IP local de la máquina
function getLocalIP() {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Buscar IPv4 que no sea interna (localhost)
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "No se pudo obtener la IP local";
}

server.listen(PORT, "0.0.0.0", () => {
  const localIP = getLocalIP();
  console.log(`\n🎮 Servidor del juego Impostor iniciado`);
  console.log(`Sistema de salas activado\n`);
  console.log(`📍 Accesos disponibles:`);
  console.log(`   Local:        http://localhost:${PORT}`);
  console.log(`   Red Local:    http://${localIP}:${PORT}`);
  console.log(`\n💡 Para acceder desde otros dispositivos en tu red:`);
  console.log(`   1. Asegúrate de que estén en la misma red Wi-Fi`);
  console.log(`   2. Usa la dirección: http://${localIP}:${PORT}`);
  console.log(`   3. Si no funciona, verifica el firewall de Windows\n`);
});
