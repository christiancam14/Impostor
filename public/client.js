// Conectar al servidor Socket.IO
const socket = io();

// Estado del cliente
const clientState = {
  playerId: null,
  playerName: null,
  currentScreen: 'login',
  hasVoted: false
};

// Elementos del DOM
const screens = {
  login: document.getElementById('login-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  extraRound: document.getElementById('extra-round-screen'),
  voting: document.getElementById('voting-screen'),
  results: document.getElementById('results-screen')
};

// Elementos del login
const nameInput = document.getElementById('name-input');
const joinButton = document.getElementById('join-button');
const connectionIndicator = document.getElementById('connection-indicator');
const connectionText = document.getElementById('connection-text');

// Elementos del lobby
const playerNameDisplay = document.getElementById('player-name-display');
const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const startGameButton = document.getElementById('start-game-button');
const changeNameButton = document.getElementById('change-name-button');
const roundsInput = document.getElementById('rounds-input');

// Elementos del juego
const roleDisplay = document.getElementById('role-display');
const currentRound = document.getElementById('current-round');
const maxRounds = document.getElementById('max-rounds');
const currentTurnEl = document.getElementById('current-turn');
const nextTurnButton = document.getElementById('next-turn-button');
const gamePlayersList = document.getElementById('game-players-list');

// Elementos de ronda extra
const voteYesExtraButton = document.getElementById('vote-yes-extra');
const voteNoExtraButton = document.getElementById('vote-no-extra');
const extraRoundStatus = document.getElementById('extra-round-status');

// Elementos de votación
const votingPlayers = document.getElementById('voting-players');
const voteStatus = document.getElementById('vote-status');

// Elementos de resultados
const resultsMessage = document.getElementById('results-message');
const impostorReveal = document.getElementById('impostor-reveal');
const wordReveal = document.getElementById('word-reveal');
const mostVoted = document.getElementById('most-voted');
const votesList = document.getElementById('votes-list');
const newGameButton = document.getElementById('new-game-button');

// =========================
// Funciones de Navegación
// =========================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  clientState.currentScreen = screenName;
}

// =========================
// Eventos de Conexión
// =========================

socket.on('connect', () => {
  console.log('Conectado al servidor');
  connectionIndicator.classList.remove('disconnected');
  connectionIndicator.classList.add('connected');
  connectionText.textContent = 'Conectado';
});

socket.on('disconnect', () => {
  console.log('Desconectado del servidor');
  connectionIndicator.classList.remove('connected');
  connectionIndicator.classList.add('disconnected');
  connectionText.textContent = 'Desconectado';
});

// =========================
// Login
// =========================

joinButton.addEventListener('click', joinGame);
nameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinGame();
});

function joinGame() {
  const name = nameInput.value.trim();
  if (!name) {
    alert('Por favor ingresa tu nombre');
    return;
  }
  
  socket.emit('join-game', { name });
}

socket.on('join-success', (data) => {
  clientState.playerId = data.id;
  clientState.playerName = data.name;
  playerNameDisplay.textContent = `👤 ${data.name}`;
  showScreen('lobby');
});

// =========================
// Lobby
// =========================

startGameButton.addEventListener('click', () => {
  const selectedRounds = parseInt(roundsInput.value);
  socket.emit('start-game', { maxRounds: selectedRounds });
});

changeNameButton.addEventListener('click', () => {
  // Limpiar estado del cliente
  clientState.playerId = null;
  clientState.playerName = null;
  clientState.hasVoted = false;
  
  // Limpiar input
  nameInput.value = '';
  
  // Desconectar y reconectar
  socket.disconnect();
  socket.connect();
  
  // Volver a la pantalla de login
  showScreen('login');
});

socket.on('game-state-update', (state) => {
  console.log('Estado del juego actualizado:', state);
  
  // Actualizar lista de jugadores
  updatePlayersList(state.players);
  
  // Actualizar según el estado
  if (state.status === 'lobby') {
    if (clientState.currentScreen !== 'lobby' && clientState.playerId) {
      showScreen('lobby');
    }
  } else if (state.status === 'playing') {
    if (clientState.currentScreen !== 'game') {
      showScreen('game');
    }
    updateGameScreen(state);
  } else if (state.status === 'extra-round-vote') {
    if (clientState.currentScreen !== 'extraRound') {
      showScreen('extraRound');
      clientState.hasVoted = false;
      enableExtraRoundButtons();
    }
  } else if (state.status === 'voting') {
    if (clientState.currentScreen !== 'voting') {
      showScreen('voting');
      clientState.hasVoted = false;
      createVotingButtons(state.players);
    }
    updateVoteStatus(state.players);
  } else if (state.status === 'results') {
    // Los resultados se manejan en el evento 'game-results'
  }
});

function updatePlayersList(players) {
  playerCount.textContent = players.length;
  
  playersList.innerHTML = '';
  players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    
    if (player.id === clientState.playerId) {
      playerItem.classList.add('you');
      playerItem.innerHTML = `
        <span class="player-name">👤 ${player.name} <strong>(Tú)</strong></span>
      `;
    } else {
      playerItem.innerHTML = `
        <span class="player-name">👤 ${player.name}</span>
        <button class="btn-kick" onclick="kickPlayer('${player.id}', '${player.name}')">
          ❌ Expulsar
        </button>
      `;
    }
    playersList.appendChild(playerItem);
  });
}

function kickPlayer(playerId, playerName) {
  if (confirm(`¿Estás seguro de que quieres expulsar a ${playerName}?`)) {
    socket.emit('kick-player', { playerId });
  }
}

// =========================
// Juego
// =========================

socket.on('game-started', (data) => {
  console.log('Juego iniciado:', data.message);
});

socket.on('your-role', (data) => {
  console.log('Tu rol:', data);
  
  roleDisplay.innerHTML = '';
  
  if (data.role === 'impostor') {
    const impostorDiv = document.createElement('div');
    impostorDiv.className = 'role-impostor';
    impostorDiv.textContent = '🎭 ERES EL IMPOSTOR 🎭';
    roleDisplay.appendChild(impostorDiv);
  } else {
    const wordDiv = document.createElement('div');
    wordDiv.className = 'role-normal';
    wordDiv.textContent = `📝 ${data.word}`;
    roleDisplay.appendChild(wordDiv);
  }
});

function updateGameScreen(state) {
  currentRound.textContent = state.currentRound;
  maxRounds.textContent = state.maxRounds;
  
  // Actualizar turno actual
  const currentPlayer = state.players.find(p => p.id === state.currentTurn);
  if (currentPlayer) {
    currentTurnEl.innerHTML = `<div class="current-player">🎯 ${currentPlayer.name}</div>`;
  } else {
    currentTurnEl.innerHTML = '<div class="waiting">Esperando...</div>';
  }
  
  // Actualizar lista de jugadores
  gamePlayersList.innerHTML = '';
  state.players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'game-player-item';
    if (player.id === state.currentTurn) {
      playerItem.classList.add('active-turn');
    }
    playerItem.textContent = player.name;
    if (player.id === clientState.playerId) {
      playerItem.textContent += ' (Tú)';
    }
    gamePlayersList.appendChild(playerItem);
  });
}

nextTurnButton.addEventListener('click', () => {
  socket.emit('next-turn');
});

// =========================
// Votación de Ronda Extra
// =========================

socket.on('ask-extra-round', (data) => {
  console.log('Preguntando por ronda extra:', data.message);
  extraRoundStatus.innerHTML = `<p>⏳ Esperando votos...</p>`;
});

voteYesExtraButton.addEventListener('click', () => {
  voteExtraRound(true);
});

voteNoExtraButton.addEventListener('click', () => {
  voteExtraRound(false);
});

function voteExtraRound(wantsExtraRound) {
  if (clientState.hasVoted) return;
  
  socket.emit('vote-extra-round', { wantsExtraRound });
  clientState.hasVoted = true;
  
  // Deshabilitar botones
  voteYesExtraButton.disabled = true;
  voteNoExtraButton.disabled = true;
  
  // Marcar botón seleccionado
  if (wantsExtraRound) {
    voteYesExtraButton.classList.add('selected');
  } else {
    voteNoExtraButton.classList.add('selected');
  }
  
  extraRoundStatus.innerHTML = `<p>✅ Has votado ${wantsExtraRound ? '<strong>SÍ</strong>' : '<strong>NO</strong>'}</p>`;
}

function enableExtraRoundButtons() {
  voteYesExtraButton.disabled = false;
  voteNoExtraButton.disabled = false;
  voteYesExtraButton.classList.remove('selected');
  voteNoExtraButton.classList.remove('selected');
}

socket.on('extra-round-vote-update', (data) => {
  if (!clientState.hasVoted && clientState.currentScreen === 'extraRound') {
    extraRoundStatus.innerHTML = `<p>⏳ ${data.voted}/${data.total} jugadores han votado</p>`;
  }
});

socket.on('extra-round-approved', (data) => {
  console.log('Ronda extra aprobada:', data.message);
  // El estado se actualiza automáticamente con game-state-update
});


// =========================
// Votación
// =========================

socket.on('start-voting', (data) => {
  console.log('Iniciando votación:', data.message);
  voteStatus.innerHTML = `<p>⏳ Esperando a que todos voten...</p>`;
});

function createVotingButtons(players) {
  votingPlayers.innerHTML = '';
  
  players.forEach(player => {
    // No puedes votar por ti mismo
    if (player.id === clientState.playerId) return;
    
    const button = document.createElement('button');
    button.className = 'vote-button';
    button.textContent = player.name;
    button.onclick = () => voteForPlayer(player.id, button);
    votingPlayers.appendChild(button);
  });
}

function voteForPlayer(playerId, button) {
  if (clientState.hasVoted) return;
  
  socket.emit('vote', { votedPlayerId: playerId });
  clientState.hasVoted = true;
  
  // Marcar botón como votado
  document.querySelectorAll('.vote-button').forEach(btn => {
    btn.disabled = true;
    btn.classList.remove('voted');
  });
  button.classList.add('voted');
  
  voteStatus.innerHTML = `<p>✅ Has votado por <strong>${button.textContent}</strong></p>`;
}

function updateVoteStatus(players) {
  const totalPlayers = players.length;
  const votedPlayers = players.filter(p => p.vote !== null).length;
  
  if (!clientState.hasVoted && clientState.currentScreen === 'voting') {
    voteStatus.innerHTML = `<p>⏳ ${votedPlayers}/${totalPlayers} jugadores han votado</p>`;
  }
}

// =========================
// Resultados
// =========================

socket.on('game-results', (results) => {
  console.log('Resultados:', results);
  showScreen('results');
  
  // Mensaje principal
  resultsMessage.textContent = results.message;
  if (results.impostorWon) {
    resultsMessage.classList.add('impostor-won');
  } else {
    resultsMessage.classList.remove('impostor-won');
  }
  
  // Revelar impostor
  impostorReveal.textContent = results.impostorName;
  
  // Revelar palabra
  wordReveal.textContent = results.secretWord;
  
  // Más votado
  mostVoted.textContent = `${results.mostVotedName} (${results.votes.find(v => v.playerId === results.mostVotedId)?.count || 0} votos)`;
  
  // Desglose de votos
  votesList.innerHTML = '';
  results.votes
    .sort((a, b) => b.count - a.count)
    .forEach(vote => {
      const voteItem = document.createElement('div');
      voteItem.className = 'vote-item';
      voteItem.innerHTML = `
        <span>${vote.playerName}</span>
        <span class="vote-count">${vote.count} ${vote.count === 1 ? 'voto' : 'votos'}</span>
      `;
      votesList.appendChild(voteItem);
    });
});

newGameButton.addEventListener('click', () => {
  socket.emit('reset-game');
});

socket.on('game-reset', (data) => {
  console.log('Juego reiniciado:', data.message);
  clientState.hasVoted = false;
  if (clientState.playerId) {
    showScreen('lobby');
  }
});

socket.on('kicked', (data) => {
  alert(data.message);
  // Limpiar estado y volver al login
  clientState.playerId = null;
  clientState.playerName = null;
  clientState.hasVoted = false;
  nameInput.value = '';
  showScreen('login');
});

// =========================
// Manejo de Errores
// =========================

socket.on('error', (data) => {
  alert(data.message);
  console.error('Error del servidor:', data.message);
});

// =========================
// Inicialización
// =========================

console.log('Cliente del juego Impostor iniciado');
