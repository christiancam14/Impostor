const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3001;

// Estado del juego
const gameState = {
  players: new Map(), // {socketId: {id, name, role, vote}}
  status: 'lobby', // 'lobby', 'playing', 'extra-round-vote', 'voting', 'results'
  secretWord: null,
  impostorId: null,
  currentTurnIndex: 0,
  currentRound: 0,
  maxRounds: 2,
  votes: new Map(),
  extraRoundVotes: new Map() // Para votar si quieren ronda extra
};

// Lista de palabras secretas
const secretWords = [
  'Perro', 'Gato', 'Árbol', 'Playa', 'Montaña', 'Libro', 'Música',
  'Café', 'Pizza', 'Coche', 'Avión', 'Teléfono', 'Computadora',
  'Casa', 'Escuela', 'Hospital', 'Restaurante', 'Cine', 'Parque',
  'Fútbol', 'Basketball', 'Natación', 'Guitarra', 'Piano', 'Pintura',
  'Fotografía', 'Baile', 'Cocina', 'Jardín', 'Océano', 'Luna', 'Sol',
  'Lluvia', 'Nieve', 'Viento', 'Fuego', 'Agua', 'Tierra', 'Amor',
  'Amistad', 'Familia', 'Trabajo', 'Viaje', 'Fiesta', 'Sueño'
];

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Funciones auxiliares
function getRandomWord() {
  return secretWords[Math.floor(Math.random() * secretWords.length)];
}

function selectRandomImpostor() {
  const playerIds = Array.from(gameState.players.keys());
  if (playerIds.length < 2) return null;
  return playerIds[Math.floor(Math.random() * playerIds.length)];
}

function getPlayersArray() {
  return Array.from(gameState.players.values());
}

function getCurrentPlayer() {
  const players = getPlayersArray();
  if (players.length === 0) return null;
  return players[gameState.currentTurnIndex];
}

function broadcastGameState() {
  io.emit('game-state-update', {
    status: gameState.status,
    players: getPlayersArray(),
    currentRound: gameState.currentRound,
    maxRounds: gameState.maxRounds,
    currentTurn: getCurrentPlayer()?.id || null
  });
}

function sendPlayerRoles() {
  gameState.players.forEach((player, socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('your-role', {
        role: player.role,
        word: player.role === 'impostor' ? null : gameState.secretWord
      });
    }
  });
}

// Conexiones WebSocket
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Jugador se une con nombre
  socket.on('join-game', (data) => {
    const { name } = data;
    if (!name || name.trim() === '') {
      socket.emit('error', { message: 'Nombre inválido' });
      return;
    }

    gameState.players.set(socket.id, {
      id: socket.id,
      name: name.trim(),
      role: null,
      vote: null
    });

    console.log(`${name} se unió al juego`);
    socket.emit('join-success', { id: socket.id, name: name.trim() });
    broadcastGameState();
  });

  // Iniciar juego
  socket.on('start-game', () => {
    if (gameState.status !== 'lobby') {
      socket.emit('error', { message: 'El juego ya está en curso' });
      return;
    }

    if (gameState.players.size < 3) {
      socket.emit('error', { message: 'Se necesitan al menos 3 jugadores' });
      return;
    }

    // Reiniciar estado
    gameState.status = 'playing';
    gameState.secretWord = getRandomWord();
    gameState.impostorId = selectRandomImpostor();
    gameState.currentTurnIndex = 0;
    gameState.currentRound = 1;
    gameState.votes.clear();

    // Asignar roles
    gameState.players.forEach((player, socketId) => {
      player.role = socketId === gameState.impostorId ? 'impostor' : 'normal';
      player.vote = null;
    });

    console.log(`Juego iniciado. Palabra: ${gameState.secretWord}, Impostor: ${gameState.players.get(gameState.impostorId).name}`);
    
    sendPlayerRoles();
    broadcastGameState();
    io.emit('game-started', { message: 'El juego ha comenzado!' });
  });

  // Siguiente turno
  socket.on('next-turn', () => {
    if (gameState.status !== 'playing') return;

    const players = getPlayersArray();
    gameState.currentTurnIndex++;

    // Si completamos una ronda
    if (gameState.currentTurnIndex >= players.length) {
      gameState.currentTurnIndex = 0;
      gameState.currentRound++;

      // Si completamos las rondas máximas, preguntar si quieren ronda extra
      if (gameState.currentRound > gameState.maxRounds) {
        gameState.status = 'extra-round-vote';
        gameState.extraRoundVotes.clear();
        io.emit('ask-extra-round', { 
          message: '¿Desean hacer una ronda más antes de votar?',
          currentRound: gameState.currentRound
        });
        broadcastGameState();
        return;
      }
    }

    broadcastGameState();
  });

  // Votar por ronda extra
  socket.on('vote-extra-round', (data) => {
    if (gameState.status !== 'extra-round-vote') return;

    const { wantsExtraRound } = data; // true o false
    const player = gameState.players.get(socket.id);
    
    if (!player) return;

    gameState.extraRoundVotes.set(socket.id, wantsExtraRound);
    console.log(`${player.name} votó ${wantsExtraRound ? 'SÍ' : 'NO'} para ronda extra`);

    // Broadcast estado actualizado
    const totalVotes = gameState.extraRoundVotes.size;
    const totalPlayers = gameState.players.size;
    
    io.emit('extra-round-vote-update', {
      voted: totalVotes,
      total: totalPlayers
    });

    // Si todos votaron, calcular resultado
    if (totalVotes === totalPlayers) {
      processExtraRoundVotes();
    }
  });

  // Votar
  socket.on('vote', (data) => {
    if (gameState.status !== 'voting') {
      socket.emit('error', { message: 'No es momento de votar' });
      return;
    }

    const { votedPlayerId } = data;
    const player = gameState.players.get(socket.id);
    
    if (!player) return;

    player.vote = votedPlayerId;
    gameState.votes.set(socket.id, votedPlayerId);

    console.log(`${player.name} votó por ${gameState.players.get(votedPlayerId)?.name}`);
    broadcastGameState();

    // Verificar si todos votaron
    if (gameState.votes.size === gameState.players.size) {
      calculateResults();
    }
  });

  // Reiniciar juego
  socket.on('reset-game', () => {
    gameState.status = 'lobby';
    gameState.secretWord = null;
    gameState.impostorId = null;
    gameState.currentTurnIndex = 0;
    gameState.currentRound = 0;
    gameState.votes.clear();

    gameState.players.forEach(player => {
      player.role = null;
      player.vote = null;
    });

    io.emit('game-reset', { message: 'El juego ha sido reiniciado' });
    broadcastGameState();
  });

  // Desconexión
  socket.on('disconnect', () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      console.log(`${player.name} se desconectó`);
      gameState.players.delete(socket.id);
      
      // Si el juego está en curso y quedan muy pocos jugadores, reiniciar
      if (gameState.status !== 'lobby' && gameState.players.size < 3) {
        gameState.status = 'lobby';
        io.emit('game-reset', { message: 'Juego reiniciado por falta de jugadores' });
      }
      
      broadcastGameState();
    }
  });
});

function processExtraRoundVotes() {
  let yesVotes = 0;
  let noVotes = 0;

  gameState.extraRoundVotes.forEach((vote) => {
    if (vote) yesVotes++;
    else noVotes++;
  });

  console.log(`Votos ronda extra - SÍ: ${yesVotes}, NO: ${noVotes}`);

  // Si la mayoría quiere ronda extra
  if (yesVotes > noVotes) {
    gameState.status = 'playing';
    gameState.maxRounds++;
    gameState.extraRoundVotes.clear();
    
    io.emit('extra-round-approved', { 
      message: `¡Ronda extra aprobada! Continuando a la ronda ${gameState.currentRound}`,
      newMaxRounds: gameState.maxRounds
    });
    broadcastGameState();
  } else {
    // Ir a votación
    gameState.status = 'voting';
    gameState.votes.clear();
    gameState.players.forEach(player => player.vote = null);
    gameState.extraRoundVotes.clear();
    
    io.emit('start-voting', { message: 'Es hora de votar por el impostor!' });
    broadcastGameState();
  }
}

function calculateResults() {
  gameState.status = 'results';

  // Contar votos
  const voteCount = new Map();
  gameState.votes.forEach((votedId) => {
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

  const impostor = gameState.players.get(gameState.impostorId);
  const mostVoted = gameState.players.get(mostVotedId);
  const impostorWon = mostVotedId !== gameState.impostorId;

  const results = {
    impostorId: gameState.impostorId,
    impostorName: impostor?.name,
    secretWord: gameState.secretWord,
    mostVotedId: mostVotedId,
    mostVotedName: mostVoted?.name,
    votes: Array.from(voteCount.entries()).map(([playerId, count]) => ({
      playerId,
      playerName: gameState.players.get(playerId)?.name,
      count
    })),
    impostorWon,
    message: impostorWon 
      ? `¡El impostor (${impostor?.name}) ganó! Engañaron al grupo.`
      : `¡Atraparon al impostor (${impostor?.name})! Los jugadores ganaron.`
  };

  io.emit('game-results', results);
  broadcastGameState();
}

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor del juego Impostor corriendo en http://localhost:${PORT}`);
});
