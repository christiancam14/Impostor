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

// =========================
// FUNCIONES DE VALIDACIÓN Y SANITIZACIÓN
// =========================

/**
 * Valida y sanitiza el nombre de un jugador
 * @param {string} name - Nombre a validar
 * @returns {object} - { valid: boolean, value: string|null, error: string|null }
 */
function validatePlayerName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, value: null, error: 'El nombre es requerido' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, value: null, error: 'El nombre debe tener al menos 2 caracteres' };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, value: null, error: 'El nombre no puede tener más de 20 caracteres' };
  }
  
  // Solo permitir letras, números, espacios y algunos caracteres especiales
  if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_]+$/.test(trimmed)) {
    return { valid: false, value: null, error: 'El nombre solo puede contener letras, números, espacios y guiones' };
  }
  
  return { valid: true, value: trimmed, error: null };
}

/**
 * Sanitiza y valida el nombre de una sala
 * @param {string} roomName - Nombre de sala a sanitizar
 * @returns {string|null} - Nombre sanitizado o null si es inválido
 */
function sanitizeRoomName(roomName) {
  if (!roomName || typeof roomName !== 'string') {
    return null;
  }
  
  // Convertir a minúsculas y eliminar caracteres especiales
  const sanitized = roomName.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
  
  // Validar longitud
  if (sanitized.length < 3 || sanitized.length > 20) {
    return null;
  }
  
  return sanitized;
}

/**
 * Valida el número de rondas
 * @param {any} maxRounds - Número de rondas a validar
 * @returns {object} - { valid: boolean, value: number|null, error: string|null }
 */
function validateMaxRounds(maxRounds) {
  const num = parseInt(maxRounds);
  
  if (isNaN(num)) {
    return { valid: false, value: null, error: 'El número de rondas debe ser un número válido' };
  }
  
  if (num < 1) {
    return { valid: false, value: null, error: 'El número de rondas debe ser al menos 1' };
  }
  
  if (num > 10) {
    return { valid: false, value: null, error: 'El número de rondas no puede ser mayor a 10' };
  }
  
  return { valid: true, value: num, error: null };
}

/**
 * Valida el número de impostores
 * @param {any} numImpostors - Número de impostores a validar
 * @param {number} totalPlayers - Número total de jugadores
 * @returns {object} - { valid: boolean, value: number|null, error: string|null }
 */
function validateNumImpostors(numImpostors, totalPlayers) {
  const num = parseInt(numImpostors);
  
  if (isNaN(num)) {
    return { valid: false, value: null, error: 'El número de impostores debe ser un número válido' };
  }
  
  if (num < 1) {
    return { valid: false, value: null, error: 'Debe haber al menos 1 impostor' };
  }
  
  if (num > 5) {
    return { valid: false, value: null, error: 'No puede haber más de 5 impostores' };
  }
  
  // Validar que quede al menos 1 jugador normal
  if (num >= totalPlayers) {
    return { valid: false, value: null, error: `No puede haber ${num} impostores con solo ${totalPlayers} jugadores. Debe quedar al menos 1 jugador normal.` };
  }
  
  // Validar que no haya más impostores que jugadores normales
  const maxImpostors = Math.floor(totalPlayers / 2);
  if (num > maxImpostors) {
    return { valid: false, value: null, error: `No puedes tener más de ${maxImpostors} ${maxImpostors === 1 ? 'impostor' : 'impostores'} con ${totalPlayers} jugadores` };
  }
  
  return { valid: true, value: num, error: null };
}

/**
 * Valida que un playerId exista en la sala
 * @param {string} playerId - ID del jugador a validar
 * @param {Map} players - Mapa de jugadores de la sala
 * @returns {boolean}
 */
function validatePlayerId(playerId, players) {
  if (!playerId || typeof playerId !== 'string') {
    return false;
  }
  return players.has(playerId);
}

// Constantes de límites
const MAX_PLAYERS_PER_ROOM = 20;
const MAX_DISCONNECTED_PLAYERS = 10;

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

// Ruta de sala específica - con sanitización
app.get("/sala/:roomName", (req, res) => {
  const sanitizedRoomName = sanitizeRoomName(req.params.roomName);
  
  if (!sanitizedRoomName) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - Nombre de sala inválido</title>
        <style>
          body {
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%);
            color: white;
            margin: 0;
          }
          .error-container {
            text-align: center;
            padding: 2rem;
          }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
          p { font-size: 1.2rem; margin-bottom: 2rem; }
          a {
            padding: 15px 30px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            font-size: 1.1rem;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>❌ Nombre de sala inválido</h1>
          <p>El nombre de sala debe tener entre 3 y 20 caracteres y solo contener letras, números, guiones y guiones bajos.</p>
          <a href="/">Volver al Inicio</a>
        </div>
      </body>
      </html>
    `);
  }
  
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
    // Validar que data sea un objeto
    if (!data || typeof data !== 'object') {
      socket.emit("error", { message: "Datos inválidos" });
      return;
    }
    
    const { name, roomName } = data;
    
    // Validar y sanitizar nombre de sala
    const sanitizedRoomName = sanitizeRoomName(roomName);
    if (!sanitizedRoomName) {
      socket.emit("error", { 
        message: "Nombre de sala inválido. Debe tener entre 3 y 20 caracteres y solo contener letras, números, guiones y guiones bajos." 
      });
      return;
    }
    
    // Validar nombre de jugador
    const nameValidation = validatePlayerName(name);
    if (!nameValidation.valid) {
      socket.emit("error", { message: nameValidation.error });
      return;
    }
    
    const validatedName = nameValidation.value;

    // Unirse a la sala de Socket.IO
    socket.join(sanitizedRoomName);
    socket.roomName = sanitizedRoomName;

    // Obtener o crear el estado de la sala
    const roomState = getOrCreateRoom(sanitizedRoomName);
    
    // Validar límite de jugadores por sala
    if (roomState.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit("error", { 
        message: `La sala está llena (máximo ${MAX_PLAYERS_PER_ROOM} jugadores)` 
      });
      socket.leave(sanitizedRoomName);
      return;
    }

    // Verificar si existe un jugador temporalmente desconectado con el mismo nombre
    const disconnectedData = roomState.disconnectedPlayers.get(validatedName);
    
    if (disconnectedData) {
      // Reconexión de un jugador que se desconectó temporalmente
      console.log(`${validatedName} se está reconectando a la sala ${sanitizedRoomName} (rol preservado: ${disconnectedData.player.role})`);
      
      // Cancelar el timeout de eliminación
      if (disconnectedData.timeout) {
        clearTimeout(disconnectedData.timeout);
      }
      
      // Verificar si este jugador era un impostor
      const wasImpostor = roomState.impostorIds && roomState.impostorIds.includes(disconnectedData.player.id);
      
      // Restaurar el jugador con su rol y voto preservados
      roomState.players.set(socket.id, {
        id: socket.id,
        name: validatedName,
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
          console.log(`${validatedName} recuperó su rol de IMPOSTOR (ID actualizado)`);
        }
      }
      
      // Si el jugador era el host, actualizar el hostId y notificar a todos
      if (disconnectedData.wasHost) {
        const previousHostId = roomState.hostId;
        roomState.hostId = socket.id;
        console.log(`${validatedName} recuperó su posición como HOST`);
        
        // Si había un host temporal, notificar que el host original regresó
        if (previousHostId && previousHostId !== socket.id) {
          const previousHostSocket = io.sockets.sockets.get(previousHostId);
          if (previousHostSocket) {
            previousHostSocket.emit('host-changed', {
              newHostId: socket.id,
              newHostName: validatedName,
              message: 'El host original ha regresado'
            });
          }
        }
        
        // Notificar a todos que el host original regresó
        io.to(sanitizedRoomName).emit('host-changed', {
          newHostId: socket.id,
          newHostName: validatedName,
          message: 'El host original ha regresado'
        });
        
        // Notificar al host que recuperó su posición
        socket.emit('you-are-host', {
          message: 'Has recuperado tu posición como host de la sala'
        });
      }
      
      // Eliminar de la lista de desconectados
      roomState.disconnectedPlayers.delete(validatedName);
    } else {
      // Verificar si ya existe un jugador conectado con el mismo nombre
      let existingPlayer = null;
      let existingPlayerId = null;
      
      for (const [playerId, player] of roomState.players.entries()) {
        if (player.name === validatedName) {
          existingPlayer = player;
          existingPlayerId = playerId;
          break;
        }
      }
      
      if (existingPlayer && existingPlayerId !== socket.id) {
        // Jugador duplicado conectándose simultáneamente (reemplazar)
        console.log(`${validatedName} se está conectando nuevamente (reemplazando conexión anterior)`);
        
        const preservedRole = existingPlayer.role;
        const preservedVote = existingPlayer.vote;
        const wasHost = roomState.hostId === existingPlayerId;
        const wasImpostor = roomState.impostorIds && roomState.impostorIds.includes(existingPlayerId);
        
        roomState.players.delete(existingPlayerId);
        
        roomState.players.set(socket.id, {
          id: socket.id,
          name: validatedName,
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
          const previousHostId = roomState.hostId;
          roomState.hostId = socket.id;
          
          // Si había un host temporal diferente, notificar que el host original regresó
          if (previousHostId && previousHostId !== socket.id) {
            const previousHostSocket = io.sockets.sockets.get(previousHostId);
            if (previousHostSocket) {
              previousHostSocket.emit('host-changed', {
                newHostId: socket.id,
                newHostName: validatedName,
                message: 'El host original ha regresado'
              });
            }
            
            // Notificar a todos que el host original regresó
            io.to(sanitizedRoomName).emit('host-changed', {
              newHostId: socket.id,
              newHostName: validatedName,
              message: 'El host original ha regresado'
            });
          }
          
          // Notificar al host que recuperó su posición
          socket.emit('you-are-host', {
            message: 'Has recuperado tu posición como host de la sala'
          });
        }
        
        if (wasImpostor && roomState.impostorIds) {
          const impostorIndex = roomState.impostorIds.indexOf(existingPlayerId);
          if (impostorIndex !== -1) {
            roomState.impostorIds[impostorIndex] = socket.id;
            console.log(`${validatedName} recuperó su rol de IMPOSTOR (ID actualizado en conexión duplicada)`);
          }
        }
      } else {
        // Jugador completamente nuevo
        roomState.players.set(socket.id, {
          id: socket.id,
          name: validatedName,
          role: null,
          vote: null,
        });
        
        // Agregar al playerOrder solo si estamos en lobby
        if (roomState.status === "lobby") {
          roomState.playerOrder.push(socket.id);
        }
      }
    }

    // Verificar y corregir hostId antes de asignar
    // Si el hostId actual apunta a un socket que ya no existe, limpiarlo
    if (roomState.hostId !== null) {
      const currentHostSocket = io.sockets.sockets.get(roomState.hostId);
      const currentHostPlayer = roomState.players.get(roomState.hostId);
      
      if (!currentHostSocket || !currentHostPlayer) {
        // El host actual ya no existe, limpiar para asignar uno nuevo
        roomState.hostId = null;
        console.log(`Host anterior ya no existe en sala ${sanitizedRoomName}, se asignará uno nuevo`);
      }
    }

    // Asignar como host si es el primer jugador o si el hostId actual es null
    if (roomState.hostId === null) {
      roomState.hostId = socket.id;
      console.log(`${validatedName} es el HOST de la sala: ${sanitizedRoomName}`);
    }

    console.log(`${validatedName} se unió a la sala: ${sanitizedRoomName}`);
    
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
      name: validatedName,
      isHost: socket.id === roomState.hostId,
      roomName: sanitizedRoomName,
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
    
    broadcastGameState(sanitizedRoomName);
    
    // Si el juego está en curso, forzar sincronización inmediata después de unirse
    if (roomState.status !== "lobby") {
      // Enviar estado completo inmediatamente para asegurar sincronización
      setTimeout(() => {
        broadcastGameState(sanitizedRoomName);
      }, 100);
    }
  });

  // Iniciar juego - SOLO HOST
  socket.on("start-game", (data) => {
    const roomName = socket.roomName;
    if (!roomName) {
      socket.emit("error", { message: "No estás en una sala válida" });
      return;
    }

    const roomState = rooms.get(roomName);
    if (!roomState) {
      socket.emit("error", { message: "La sala no existe" });
      return;
    }

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
      socket.emit("error", { message: "Se necesitan al menos 3 jugadores para iniciar" });
      return;
    }

    // Validar número de rondas
    const roundsValidation = validateMaxRounds(data?.maxRounds || roomState.maxRounds || 2);
    if (!roundsValidation.valid) {
      socket.emit("error", { message: roundsValidation.error });
      return;
    }
    const maxRounds = roundsValidation.value;

    // Validar número de impostores
    const impostorsValidation = validateNumImpostors(
      data?.numImpostors || roomState.numImpostors || 1,
      roomState.players.size
    );
    if (!impostorsValidation.valid) {
      socket.emit("error", { message: impostorsValidation.error });
      return;
    }
    const numImpostors = impostorsValidation.value;
    
    // Guardar número de impostores configurado
    roomState.numImpostors = numImpostors;

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
    if (!roomName) {
      socket.emit("error", { message: "No estás en una sala válida" });
      return;
    }

    const roomState = rooms.get(roomName);
    if (!roomState) {
      socket.emit("error", { message: "La sala no existe" });
      return;
    }

    // Verificar que sea el host
    if (socket.id !== roomState.hostId) {
      socket.emit("error", { message: "Solo el host puede avanzar turnos" });
      return;
    }

    if (roomState.status !== "playing") {
      socket.emit("error", { message: "El juego no está en curso" });
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
    if (!roomName) {
      socket.emit("error", { message: "No estás en una sala válida" });
      return;
    }

    const roomState = rooms.get(roomName);
    if (!roomState) {
      socket.emit("error", { message: "La sala no existe" });
      return;
    }

    if (roomState.status !== "extra-round-vote") {
      socket.emit("error", { message: "No es momento de votar por ronda extra" });
      return;
    }

    // Validar datos de entrada
    if (!data || typeof data !== 'object') {
      socket.emit("error", { message: "Datos de voto inválidos" });
      return;
    }

    const { wantsExtraRound } = data;
    
    // Validar que wantsExtraRound sea un booleano
    if (typeof wantsExtraRound !== 'boolean') {
      socket.emit("error", { message: "El voto debe ser verdadero o falso" });
      return;
    }

    const player = roomState.players.get(socket.id);
    if (!player) {
      socket.emit("error", { message: "Jugador no encontrado en la sala" });
      return;
    }

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
    if (!roomName) {
      socket.emit("error", { message: "No estás en una sala válida" });
      return;
    }

    const roomState = rooms.get(roomName);
    if (!roomState) {
      socket.emit("error", { message: "La sala no existe" });
      return;
    }

    if (roomState.status !== "voting") {
      socket.emit("error", { message: "No es momento de votar" });
      return;
    }

    const player = roomState.players.get(socket.id);
    if (!player) {
      socket.emit("error", { message: "Jugador no encontrado en la sala" });
      return;
    }

    // Validar datos de entrada
    if (!data || typeof data !== 'object') {
      socket.emit("error", { message: "Datos de voto inválidos" });
      return;
    }

    const { votedPlayerId } = data;
    
    // Validar que el ID del jugador votado sea válido
    if (!validatePlayerId(votedPlayerId, roomState.players)) {
      socket.emit("error", { message: "El jugador votado no existe en esta sala" });
      return;
    }

    // No permitir votarse a sí mismo
    if (votedPlayerId === socket.id) {
      socket.emit("error", { message: "No puedes votar por ti mismo" });
      return;
    }

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
    if (!roomName) {
      socket.emit("error", { message: "No estás en una sala válida" });
      return;
    }

    const roomState = rooms.get(roomName);
    if (!roomState) {
      socket.emit("error", { message: "La sala no existe" });
      return;
    }

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
    if (!roomName) {
      socket.emit("error", { message: "No estás en una sala válida" });
      return;
    }

    const roomState = rooms.get(roomName);
    if (!roomState) {
      socket.emit("error", { message: "La sala no existe" });
      return;
    }

    // Verificar que sea el host
    if (socket.id !== roomState.hostId) {
      socket.emit("error", { message: "Solo el host puede expulsar jugadores" });
      return;
    }

    // Validar datos de entrada
    if (!data || typeof data !== 'object') {
      socket.emit("error", { message: "Datos inválidos" });
      return;
    }

    const { playerId } = data;
    
    // Validar que el ID del jugador sea válido
    if (!validatePlayerId(playerId, roomState.players)) {
      socket.emit("error", { message: "El jugador no existe en esta sala" });
      return;
    }

    // No permitir expulsarse a sí mismo
    if (playerId === socket.id) {
      socket.emit("error", { message: "No puedes expulsarte a ti mismo" });
      return;
    }

    const kickedPlayer = roomState.players.get(playerId);

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
      
      // Guardar temporalmente al jugador para reconexión (si era host o si el juego está en curso)
      // Esto permite que el host recupere su posición al reconectarse
      if (wasHost || (roomState.status !== "lobby" && player.role)) {
        console.log(`💾 Guardando estado de ${player.name} para posible reconexión (rol: ${player.role || 'sin rol'}, host: ${wasHost})`);
        
        // Limitar tamaño de disconnectedPlayers para evitar acumulación de memoria
        if (roomState.disconnectedPlayers.size >= MAX_DISCONNECTED_PLAYERS) {
          // Eliminar el más antiguo (primero en el Map)
          const oldestName = Array.from(roomState.disconnectedPlayers.keys())[0];
          const oldestData = roomState.disconnectedPlayers.get(oldestName);
          if (oldestData && oldestData.timeout) {
            clearTimeout(oldestData.timeout);
          }
          roomState.disconnectedPlayers.delete(oldestName);
          console.log(`🧹 Limpiando jugador desconectado antiguo: ${oldestName}`);
        }
        
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

      // Si el host se desconecta, manejar la transferencia de host
      if (wasHost) {
        // Limpiar hostId temporalmente - se asignará nuevo host solo si es necesario
        roomState.hostId = null;
        
        if (roomState.players.size > 0) {
          // Hay otros jugadores
          // Si el host se guardó en disconnectedPlayers, esperar un momento antes de asignar nuevo host
          // para dar tiempo a que el host se reconecte rápidamente (como al actualizar la página)
          const hostCanReconnect = roomState.disconnectedPlayers.has(player.name);
          
          if (hostCanReconnect) {
            // El host puede reconectarse, esperar un momento antes de asignar nuevo host
            setTimeout(() => {
              const roomStateCheck = rooms.get(roomName);
              if (!roomStateCheck) return;
              
              // Solo asignar nuevo host si:
              // 1. El host original aún no se reconectó (sigue en disconnectedPlayers)
              // 2. No hay host asignado actualmente
              // 3. Hay jugadores en la sala
              const originalHostStillDisconnected = roomStateCheck.disconnectedPlayers.has(player.name);
              
              if (originalHostStillDisconnected && roomStateCheck.hostId === null && roomStateCheck.players.size > 0) {
                const newHostId = Array.from(roomStateCheck.players.keys())[0];
                roomStateCheck.hostId = newHostId;
                const newHost = roomStateCheck.players.get(newHostId);
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
                
                broadcastGameState(roomName);
              }
            }, 3000); // Esperar 3 segundos antes de asignar nuevo host (tiempo suficiente para reconexión rápida)
          } else {
            // El host no se guardó (probablemente salió completamente), asignar nuevo host inmediatamente
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
        } else {
          // Es el único jugador, hostId ya está en null, se asignará cuando se reconecte
          console.log(`Host desconectado y es el único jugador en sala ${roomName}, hostId limpiado`);
        }
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
            // Limpiar todos los timeouts antes de eliminar
            roomState.disconnectedPlayers.forEach((data) => {
              if (data.timeout) {
                clearTimeout(data.timeout);
              }
            });
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
      // Limpiar todos los timeouts de jugadores desconectados antes de eliminar la sala
      roomState.disconnectedPlayers.forEach((data) => {
        if (data.timeout) {
          clearTimeout(data.timeout);
        }
      });
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
