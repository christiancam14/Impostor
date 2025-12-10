// Detectar nombre de sala desde la URL
const urlPath = window.location.pathname;
const roomMatch = urlPath.match(/\/sala\/([^\/]+)/);
const roomName = roomMatch ? roomMatch[1] : null;

// Si no estamos en una sala válida, detener la ejecución
if (!roomName) {
  console.error('No se detectó una sala válida. Por favor accede desde la página de inicio.');
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; font-family: sans-serif; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%); color: white;">
      <h1 style="font-size: 3rem; margin-bottom: 20px;">🕵️ IMPOSTOR</h1>
      <p style="font-size: 1.2rem; margin-bottom: 30px;">No se detectó una sala válida</p>
      <a href="/" style="padding: 15px 30px; background: white; color: #667eea; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 1.1rem;">Ir al Inicio</a>
    </div>
  `;
  throw new Error('No hay sala válida'); // Detener completamente la ejecución del script
}

// Conectar al servidor Socket.IO con configuración de reconexión
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000, // Esperar 1 segundo antes de reconectar
  reconnectionDelayMax: 5000, // Máximo 5 segundos entre intentos
  reconnectionAttempts: Infinity, // Intentar reconectar indefinidamente
  timeout: 20000, // Timeout de conexión de 20 segundos
  transports: ['websocket', 'polling'] // Permitir ambos transportes
});

// Estado del cliente
const clientState = {
  playerId: null,
  playerName: null,
  roomName: roomName,
  currentScreen: 'login',
  hasVoted: false,
  isHost: false,
  hostId: null,
  myRole: null, // 'impostor' o 'normal'
  gameStatus: 'lobby' // Estado actual del juego: 'lobby', 'playing', 'voting', 'results', etc.
};

// =========================
// localStorage - Persistencia del nombre
// =========================

// Guardar nombre en localStorage
function savePlayerName(name) {
  try {
    localStorage.setItem(`impostor_player_name_${clientState.roomName}`, name);
  } catch (e) {
    console.error('Error al guardar nombre:', e);
  }
}

// Obtener nombre guardado de localStorage
function getSavedPlayerName() {
  try {
    return localStorage.getItem(`impostor_player_name_${clientState.roomName}`);
  } catch (e) {
    console.error('Error al leer nombre guardado:', e);
    return null;
  }
}

// Limpiar nombre guardado
function clearSavedPlayerName() {
  try {
    localStorage.removeItem(`impostor_player_name_${clientState.roomName}`);
  } catch (e) {
    console.error('Error al limpiar nombre:', e);
  }
}

// =========================
// Toast Notifications (Sonner-style)
// =========================

function toast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.warn('Toast container no encontrado');
    return;
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type} progress`;
  
  // Iconos según el tipo
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const icon = icons[type] || icons.info;
  
  toastEl.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-content">${message}</span>
    <button class="toast-close" aria-label="Cerrar">×</button>
    <div class="toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
  `;
  
  container.appendChild(toastEl);
  
  // Función para cerrar el toast
  const closeToast = () => {
    toastEl.classList.add('slide-out');
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300);
  };
  
  // Botón de cerrar
  const closeBtn = toastEl.querySelector('.toast-close');
  closeBtn.addEventListener('click', closeToast);
  
  // Auto-cerrar después de la duración
  const timeout = setTimeout(closeToast, duration);
  
  // Pausar el timeout al hacer hover
  toastEl.addEventListener('mouseenter', () => {
    clearTimeout(timeout);
    const progressBar = toastEl.querySelector('.toast-progress-bar');
    if (progressBar) {
      progressBar.style.animationPlayState = 'paused';
    }
  });
  
  toastEl.addEventListener('mouseleave', () => {
    const remainingTime = duration - (Date.now() - startTime);
    if (remainingTime > 0) {
      setTimeout(closeToast, remainingTime);
      const progressBar = toastEl.querySelector('.toast-progress-bar');
      if (progressBar) {
        progressBar.style.animationPlayState = 'running';
      }
    }
  });
  
  const startTime = Date.now();
  
  return {
    dismiss: closeToast
  };
}

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
const roomNameDisplay = document.getElementById('room-name-display');
const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const startGameButton = document.getElementById('start-game-button');
const changeNameButton = document.getElementById('change-name-button');
const roundsInput = document.getElementById('rounds-input');
const impostorsInput = document.getElementById('impostors-input');

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
const playersExtraRoundList = document.getElementById('players-extra-round-list');

// Elementos de votación
const votingPlayers = document.getElementById('voting-players');
const voteStatus = document.getElementById('vote-status');
const playersVotingList = document.getElementById('players-voting-list');

// Elementos de resultados
const resultsMessage = document.getElementById('results-message');
const impostorReveal = document.getElementById('impostor-reveal');
const wordReveal = document.getElementById('word-reveal');
const mostVoted = document.getElementById('most-voted');
const votesList = document.getElementById('votes-list');
const newGameButton = document.getElementById('new-game-button');
const confettiContainer = document.getElementById('confetti-container');
const darknessOverlay = document.getElementById('darkness-overlay');

// =========================
// Funciones de Navegación
// =========================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenName].classList.add('active');
  clientState.currentScreen = screenName;
}

// Función para mostrar el rol en la UI
function displayRole(roleData) {
  if (!roleDisplay) {
    console.error('❌ roleDisplay no encontrado en el DOM');
    return;
  }
  
  roleDisplay.innerHTML = '';
  
  if (roleData.role === 'impostor') {
    console.log('🕵️ Mostrando rol: IMPOSTOR');
    clientState.myRole = 'impostor'; // Guardar rol en el estado
    const impostorDiv = document.createElement('div');
    impostorDiv.className = 'role-impostor';
    impostorDiv.textContent = '🎭 ERES EL IMPOSTOR 🎭';
    roleDisplay.appendChild(impostorDiv);
  } else if (roleData.word) {
    console.log('📝 Mostrando palabra secreta:', roleData.word);
    clientState.myRole = 'normal'; // Guardar rol en el estado
    const wordDiv = document.createElement('div');
    wordDiv.className = 'role-normal';
    wordDiv.textContent = `📝 ${roleData.word}`;
    roleDisplay.appendChild(wordDiv);
  } else {
    console.error('❌ No se recibió palabra secreta ni rol de impostor');
  }
}

// Sincronizar estado del cliente con el estado del servidor
function syncGameState(gameState, roleData) {
  console.log('Sincronizando estado del juego:', gameState);
  
  // Actualizar estado del juego en el cliente
  clientState.gameStatus = gameState.status || 'lobby';
  
  // Mostrar mensaje de sincronización si no estamos en lobby
  if (gameState.status !== 'lobby') {
    console.log('📡 Sincronizando con el estado actual del juego...');
  }
  
  // Si viene el rol, mostrarlo primero
  if (roleData) {
    displayRole(roleData);
  }
  
  // Actualizar lista de jugadores
  if (gameState.players) {
    updatePlayersList(gameState.players);
  }
  
  // Determinar y mostrar la pantalla correcta según el estado
  switch (gameState.status) {
    case 'lobby':
      showScreen('lobby');
      break;
      
    case 'playing':
      showScreen('game');
      // Actualizar información del juego
      if (currentRound) currentRound.textContent = gameState.currentRound || 1;
      if (maxRounds) maxRounds.textContent = gameState.maxRounds || 2;
      
      // Actualizar turno actual
      if (gameState.currentTurn) {
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentTurn);
        if (currentPlayer && currentTurnEl) {
          currentTurnEl.textContent = currentPlayer.name;
        }
      }
      
      // Actualizar lista de jugadores en el juego
      if (gameState.players && gamePlayersList) {
        gamePlayersList.innerHTML = '';
        gameState.players.forEach(player => {
          const playerItem = document.createElement('div');
          playerItem.className = 'game-player-item';
          if (player.id === gameState.currentTurn) {
            playerItem.classList.add('active-turn');
          }
          playerItem.textContent = player.name;
          if (player.id === clientState.playerId) {
            playerItem.textContent += ' (Tú)';
          }
          gamePlayersList.appendChild(playerItem);
        });
      }
      break;
      
    case 'extra-round-vote':
      showScreen('extraRound');
      // Reiniciar estado de votación extra
      extraRoundStatus.innerHTML = '<p>⏳ Esperando a que todos voten...</p>';
      // Mostrar lista inicial de jugadores (todos en gris hasta que voten)
      if (gameState.players && playersExtraRoundList) {
        const initialPlayers = gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          hasVoted: false,
          vote: null
        }));
        updateExtraRoundPlayersList(initialPlayers);
      }
      break;
      
    case 'voting':
      showScreen('voting');
      // Limpiar votos previos
      clientState.hasVoted = false;
      voteStatus.innerHTML = '<p>⏳ Esperando a que todos voten...</p>';
      // Actualizar lista de jugadores para votar
      if (gameState.players && votingPlayers) {
        votingPlayers.innerHTML = '';
        gameState.players.forEach(player => {
          // No puedes votar por ti mismo
          if (player.id === clientState.playerId) return;
          
          const button = document.createElement('button');
          button.className = 'vote-button';
          button.textContent = player.name;
          button.onclick = () => {
            if (clientState.hasVoted) return;
            socket.emit('vote', { votedPlayerId: player.id });
            clientState.hasVoted = true;
            button.classList.add('voted');
            button.disabled = true;
            voteStatus.innerHTML = '<p>✅ Tu voto ha sido registrado</p>';
          };
          votingPlayers.appendChild(button);
        });
        // Actualizar lista visual de jugadores
        // Asegurar que todos los jugadores tengan vote = null al iniciar votación
        const cleanPlayers = gameState.players.map(p => ({
          ...p,
          vote: null // Forzar limpieza de votos previos
        }));
        updatePlayersVotingList(cleanPlayers);
      }
      break;
      
    case 'results':
      // El estado de resultados se maneja con el evento 'game-results'
      // No hacemos nada aquí para evitar mostrar resultados sin datos
      showScreen('lobby');
      break;
      
    default:
      showScreen('lobby');
  }
}

// =========================
// Eventos de Conexión
// =========================

socket.on('connect', () => {
  console.log('Conectado al servidor');
  connectionIndicator.classList.remove('disconnected');
  connectionIndicator.classList.add('connected');
  connectionText.textContent = 'Conectado';
  
  // Auto-login si hay nombre guardado y estamos en la pantalla de login
  if (clientState.currentScreen === 'login') {
    const savedName = getSavedPlayerName();
    if (savedName) {
      console.log('Nombre guardado encontrado:', savedName);
      nameInput.value = savedName;
      // Auto-conectar después de un pequeño delay
      setTimeout(() => {
        joinGame();
      }, 500);
    }
  }
});

socket.on('connect_error', (error) => {
  console.error('Error de conexión:', error);
  connectionText.textContent = 'Error de conexión';
  toast('Error al conectar con el servidor. Intentando reconectar...', 'warning', 5000);
});

socket.on('disconnect', (reason) => {
  console.log('Desconectado del servidor:', reason);
  connectionIndicator.classList.remove('connected');
  connectionIndicator.classList.add('disconnected');
  connectionText.textContent = 'Desconectado';
  
  // Si la desconexión fue por error del servidor, intentar reconectar
  if (reason === 'io server disconnect') {
    // El servidor desconectó el socket, necesitamos reconectar manualmente
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconectado al servidor después de', attemptNumber, 'intentos');
  connectionIndicator.classList.remove('disconnected');
  connectionIndicator.classList.add('connected');
  connectionText.textContent = 'Conectado';
  
  // Si estábamos en una partida, intentar reconectar automáticamente
  if (clientState.playerName && clientState.roomName) {
    console.log('Intentando reconectar a la sala...');
    setTimeout(() => {
      joinGame();
    }, 500);
  }
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Intento de reconexión', attemptNumber);
  connectionText.textContent = `Reconectando... (${attemptNumber})`;
});

socket.on('reconnect_error', (error) => {
  console.error('Error al reconectar:', error);
  connectionText.textContent = 'Error al reconectar';
});

socket.on('reconnect_failed', () => {
  console.error('Falló la reconexión después de múltiples intentos');
  connectionText.textContent = 'Error de conexión';
  toast('No se pudo reconectar al servidor. Por favor recarga la página.', 'error', 10000);
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
    toast('Por favor ingresa tu nombre', 'warning');
    return;
  }
  
  // Guardar nombre en localStorage
  savePlayerName(name);
  
  // Enviar nombre de jugador Y nombre de sala
  socket.emit('join-game', { 
    name: name,
    roomName: clientState.roomName 
  });
}

socket.on('join-success', (data) => {
  clientState.playerId = data.id;
  clientState.playerName = data.name;
  clientState.isHost = data.isHost || false;
  
  const hostBadge = data.isHost ? '<span class="host-badge-header">👑 Host</span>' : '';
  
  playerNameDisplay.innerHTML = `👤 ${data.name} ${hostBadge}`;
  
  // Mostrar nombre de la sala
  if (roomNameDisplay) {
    roomNameDisplay.textContent = `🚪 Sala: ${clientState.roomName}`;
  }
  
  // Actualizar título de la página
  document.title = `Impostor - Sala: ${clientState.roomName}`;
  
  // Si viene el rol incluido (reconexión durante partida), procesarlo ANTES de sincronizar
  if (data.role) {
    console.log('🎭 Rol recibido en join-success:', data.role);
    displayRole(data.role);
  }
  
  // SINCRONIZACIÓN DE ESTADO: Mostrar la pantalla correcta según el estado del servidor
  if (data.gameState) {
    // Actualizar estado del juego antes de sincronizar
    clientState.gameStatus = data.gameState.status || 'lobby';
    syncGameState(data.gameState, data.role);
  } else {
    // Si no hay estado del juego, mostrar lobby por defecto
    clientState.gameStatus = 'lobby';
    showScreen('lobby');
  }
  
  // Actualizar controles según si es host (después de actualizar gameStatus)
  updateHostControls();
  
  // Configurar el botón de compartir (ya está en el HTML)
  const shareBtn = document.getElementById('share-room-button');
  if (shareBtn && !shareBtn.hasAttribute('data-listener')) {
    shareBtn.addEventListener('click', shareRoomLink);
    shareBtn.setAttribute('data-listener', 'true');
  }
});

function shareRoomLink() {
  const link = `${window.location.origin}/sala/${clientState.roomName}`;
  
  // Intentar copiar al portapapeles
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => {
        toast(`¡Enlace copiado!\n\n${link}\n\nCompártelo con tus amigos para que se unan a la sala "${clientState.roomName}"`, 'success', 6000);
      })
      .catch(() => {
        // Fallback si falla el clipboard
        prompt('Copia este enlace para compartir:', link);
      });
  } else {
    // Fallback para navegadores que no soportan clipboard
    prompt('Copia este enlace para compartir:', link);
  }
}

// =========================
// Lobby
// =========================

startGameButton.addEventListener('click', () => {
  // Validar que el juego esté en lobby antes de intentar iniciar
  if (clientState.gameStatus !== 'lobby') {
    toast('El juego ya está en curso. Espera a que termine o reinicia la partida.', 'warning');
    console.warn('Intento de iniciar juego cuando el estado es:', clientState.gameStatus);
    return;
  }
  
  const selectedRounds = parseInt(roundsInput.value);
  const selectedImpostors = parseInt(impostorsInput.value) || 1;
  socket.emit('start-game', { 
    maxRounds: selectedRounds,
    numImpostors: selectedImpostors
  });
});

changeNameButton.addEventListener('click', () => {
  // Limpiar nombre guardado en localStorage
  clearSavedPlayerName();
  
  // Limpiar estado del cliente
  clientState.playerId = null;
  clientState.playerName = null;
  clientState.hasVoted = false;
  clientState.myRole = null;
  
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
  
  // Actualizar estado del juego en el cliente
  clientState.gameStatus = state.status || 'lobby';
  
  // Actualizar hostId
  clientState.hostId = state.hostId;
  clientState.isHost = (clientState.playerId === state.hostId);
  
  // Actualizar lista de jugadores
  updatePlayersList(state.players);
  
  // Actualizar controles de host (debe ir después de actualizar gameStatus)
  updateHostControls();
  
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
      // Mostrar lista inicial de jugadores (todos en gris hasta que voten)
      // Asegurar que todos los jugadores tengan vote = null al iniciar votación
      if (state.players) {
        const cleanPlayers = state.players.map(p => ({
          ...p,
          vote: null // Forzar limpieza de votos previos
        }));
        updatePlayersVotingList(cleanPlayers);
      }
    } else {
      // Si ya estamos en la pantalla de votación, actualizar con el estado real del servidor
      updateVoteStatus(state.players);
    }
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
    
    const isHost = player.id === clientState.hostId;
    const isYou = player.id === clientState.playerId;
    const icon = isHost ? '👑' : '👤';
    const hostBadge = isHost ? '<span class="host-badge">Host</span>' : '';
    
    if (isYou) {
      playerItem.classList.add('you');
      playerItem.innerHTML = `
        <span class="player-name">${icon} ${player.name} <strong>(Tú)</strong> ${hostBadge}</span>
      `;
    } else {
      playerItem.innerHTML = `
        <span class="player-name">${icon} ${player.name} ${hostBadge}</span>
        ${clientState.isHost ? `
          <button class="btn-kick" onclick="kickPlayer('${player.id}', '${player.name}')">
            ❌ Expulsar
          </button>
        ` : ''}
      `;
    }
    playersList.appendChild(playerItem);
  });
}

// Nueva función para controlar visibilidad de botones de host
function updateHostControls() {
  const isHost = clientState.isHost;
  const gameStatus = clientState.gameStatus || 'lobby';
  
  // Botón de iniciar juego - Solo visible si es host Y el juego está en lobby
  if (startGameButton) {
    if (isHost && gameStatus === 'lobby') {
      startGameButton.style.display = 'block';
      startGameButton.disabled = false;
    } else {
      startGameButton.style.display = 'none';
      startGameButton.disabled = true;
    }
  }
  
  // Botón de siguiente turno
  if (nextTurnButton) {
    if (isHost) {
      nextTurnButton.style.display = 'block';
      nextTurnButton.disabled = false;
    } else {
      nextTurnButton.style.display = 'none';
    }
  }
  
  // Botón de reiniciar
  if (newGameButton) {
    if (isHost) {
      newGameButton.style.display = 'block';
      newGameButton.disabled = false;
    } else {
      newGameButton.style.display = 'none';
    }
  }
  
  // Selector de rondas - Solo visible si es host Y el juego está en lobby
  const roundsSelector = document.querySelector('.rounds-selector');
  const impostorsSelector = document.querySelector('.impostors-selector');
  
  if (roundsSelector) {
    if (isHost && gameStatus === 'lobby') {
      roundsSelector.style.display = 'block';
    } else {
      roundsSelector.style.display = 'none';
    }
  }
  
  if (impostorsSelector) {
    if (isHost && gameStatus === 'lobby') {
      impostorsSelector.style.display = 'block';
    } else {
      impostorsSelector.style.display = 'none';
    }
  }
  
  // Selector de rondas (input)
  if (roundsInput) {
    roundsInput.disabled = !isHost;
  }
  
  // Selector de impostores (input)
  if (impostorsInput) {
    impostorsInput.disabled = !isHost;
  }
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
  console.log('🎭 Rol recibido del servidor (evento separado):', data);
  displayRole(data);
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
  
  // Actualizar lista de jugadores (respetar el orden del servidor)
  gamePlayersList.innerHTML = '';
  console.log('Orden de jugadores recibido del servidor:', state.players.map(p => p.name).join(', '));
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
  
  extraRoundStatus.innerHTML = `<p>✅ ${wantsExtraRound ? 'Has votado por <strong>una ronda más</strong>' : 'Has votado por <strong>votar ahora</strong>'}</p>`;
}

function enableExtraRoundButtons() {
  voteYesExtraButton.disabled = false;
  voteNoExtraButton.disabled = false;
  voteYesExtraButton.classList.remove('selected');
  voteNoExtraButton.classList.remove('selected');
}

socket.on('extra-round-vote-update', (data) => {
  if (clientState.currentScreen === 'extraRound') {
    if (!clientState.hasVoted) {
      extraRoundStatus.innerHTML = `<p>⏳ ${data.voted}/${data.total} jugadores han votado</p>`;
    }
    
    // Actualizar lista visual de jugadores
    if (data.players && playersExtraRoundList) {
      updateExtraRoundPlayersList(data.players);
    }
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
  
  // Actualizar lista visual de jugadores
  updatePlayersVotingList(players);
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
  
  // Actualizar lista visual de jugadores
  updatePlayersVotingList(players);
}

function updatePlayersVotingList(players) {
  if (!playersVotingList) return;
  
  playersVotingList.innerHTML = '';
  
  players.forEach(player => {
    const playerPill = document.createElement('div');
    playerPill.className = 'player-pill';
    
    const hasVoted = player.vote !== null;
    const isMe = player.id === clientState.playerId;
    
    // Clases según el estado
    if (hasVoted) {
      // Votó (verde)
      playerPill.classList.add('pill-green');
    } else {
      // No ha votado (gris)
      playerPill.classList.add('pill-gray');
    }
    
    if (isMe) {
      playerPill.classList.add('pill-me');
    }
    
    playerPill.textContent = player.name;
    playersVotingList.appendChild(playerPill);
  });
}

function updateExtraRoundPlayersList(players) {
  if (!playersExtraRoundList) return;
  
  playersExtraRoundList.innerHTML = '';
  
  players.forEach(player => {
    const playerPill = document.createElement('div');
    playerPill.className = 'player-pill';
    
    const hasVoted = player.hasVoted;
    const isMe = player.id === clientState.playerId;
    
    // Clases según el estado
    if (hasVoted) {
      if (player.vote) {
        // Votó por una ronda más (rojo)
        playerPill.classList.add('pill-red');
      } else {
        // Votó por votar ahora (verde)
        playerPill.classList.add('pill-green');
      }
    } else {
      // No ha votado (gris)
      playerPill.classList.add('pill-gray');
    }
    
    if (isMe) {
      playerPill.classList.add('pill-me');
    }
    
    playerPill.textContent = player.name;
    playersExtraRoundList.appendChild(playerPill);
  });
}

// =========================
// Animaciones de Resultados
// =========================

function createConfetti() {
  confettiContainer.innerHTML = '';
  confettiContainer.classList.add('active');
  
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
  const confettiCount = 150;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    
    // Posición aleatoria horizontal
    const left = Math.random() * 100;
    confetti.style.left = `${left}%`;
    
    // Color aleatorio
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    // Tamaño aleatorio
    const size = Math.random() * 8 + 6;
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size}px`;
    
    // Forma aleatoria (cuadrado o rectángulo)
    if (Math.random() > 0.5) {
      confetti.style.height = `${size * 0.5}px`;
    }
    
    // Duración de caída aleatoria
    const duration = Math.random() * 3 + 2;
    confetti.style.animationDuration = `${duration}s`;
    
    // Delay aleatorio
    const delay = Math.random() * 0.5;
    confetti.style.animationDelay = `${delay}s`;
    
    // Dirección de deriva aleatoria
    const drift = (Math.random() - 0.5) * 200;
    confetti.style.setProperty('--drift', `${drift}px`);
    
    // Rotación aleatoria
    const rotation = Math.random() * 720 - 360;
    confetti.style.setProperty('--rotation', `${rotation}deg`);
    
    confettiContainer.appendChild(confetti);
  }
  
  // Limpiar después de 5 segundos
  setTimeout(() => {
    confettiContainer.classList.remove('active');
  }, 5000);
}

function activateDarknessEffect() {
  darknessOverlay.classList.add('active');
  
  // Remover después de que termine la animación
  setTimeout(() => {
    darknessOverlay.classList.remove('active');
  }, 10000);
}

function clearAnimations() {
  confettiContainer.classList.remove('active');
  confettiContainer.innerHTML = '';
  darknessOverlay.classList.remove('active');
}

// =========================
// Resultados
// =========================

socket.on('game-results', (results) => {
  console.log('Resultados:', results);
  showScreen('results');
  
  // Limpiar animaciones previas
  clearAnimations();
  
  // Determinar si YO gané o perdí (personalizado por jugador)
  let iWon = false;
  
  if (clientState.myRole === 'impostor') {
    // Si soy el impostor, gano si el impostor ganó
    iWon = results.impostorWon;
    console.log('🎭 Soy el impostor:', iWon ? 'GANÉ ✅' : 'PERDÍ ❌');
  } else {
    // Si NO soy el impostor, gano si atraparon al impostor
    iWon = !results.impostorWon;
    console.log('👥 Soy jugador normal:', iWon ? 'GANÉ ✅' : 'PERDÍ ❌');
  }
  
  // Mensaje principal (personalizado según el jugador)
  const isImpostor = clientState.myRole === 'impostor';
  const isImpostorAndWon = isImpostor && results.impostorWon;
  const isImpostorAndLost = isImpostor && !results.impostorWon;
  
  // Limpiar clases previas
  resultsMessage.classList.remove('impostor-won', 'impostor-victory');
  
  if (isImpostorAndWon) {
    // Si soy el impostor y gané, mensaje personalizado de victoria (VERDE)
    resultsMessage.textContent = `🎉 ¡Has ganado! Eres el impostor y engañaste al grupo. 🎭`;
    resultsMessage.classList.add('impostor-victory');
  } else if (isImpostorAndLost) {
    // Si soy el impostor y perdí, mensaje personalizado de derrota (ROJO)
    resultsMessage.textContent = `😔 Has perdido. Te atraparon y descubrieron que eras el impostor.`;
    resultsMessage.classList.add('impostor-won');
  } else if (results.impostorWon) {
    // Si NO soy el impostor y el impostor ganó, mensaje de derrota (ROJO)
    resultsMessage.textContent = results.message;
    resultsMessage.classList.add('impostor-won');
  } else {
    // Si NO soy el impostor y ganamos, mensaje de victoria (VERDE)
    resultsMessage.textContent = results.message;
    resultsMessage.classList.add('impostor-victory');
  }
  
  // Animación personalizada según MI resultado
  if (iWon) {
    // YO GANÉ - Confeti
    setTimeout(() => createConfetti(), 300);
  } else {
    // YO PERDÍ - Oscuridad
    setTimeout(() => activateDarknessEffect(), 300);
  }
  
  // Revelar impostor(es)
  const impostorLabel = document.getElementById('impostor-label');
  if (impostorLabel) {
    const numImpostors = results.numImpostors || (results.impostorNames ? results.impostorNames.split(', ').length : 1);
    impostorLabel.textContent = numImpostors > 1 
      ? `🔍 Los Impostores Eran:` 
      : `🔍 El Impostor Era:`;
  }
  impostorReveal.textContent = results.impostorNames || results.impostorName || 'Desconocido';
  
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
  clientState.myRole = null; // Limpiar rol al reiniciar
  clientState.gameStatus = 'lobby'; // Resetear estado del juego
  if (clientState.playerId) {
    showScreen('lobby');
    updateHostControls(); // Actualizar controles después del reset
  }
});

socket.on('kicked', (data) => {
  toast(data.message, 'error', 5000);
  // Limpiar estado y volver al login
  clientState.playerId = null;
  clientState.playerName = null;
  clientState.hasVoted = false;
  clientState.isHost = false;
  clientState.hostId = null;
  clientState.myRole = null;
  nameInput.value = '';
  showScreen('login');
});

// Evento cuando te conviertes en host
socket.on('you-are-host', (data) => {
  clientState.isHost = true;
  toast(data.message, 'success');
  updateHostControls();
  
  // Actualizar el header
  const hostBadge = '<span class="host-badge-header">👑 Host</span>';
  const shareBtn = document.getElementById('share-room-btn');
  if (shareBtn) {
    playerNameDisplay.innerHTML = `
      <span>👤 ${clientState.playerName} ${hostBadge}</span>
    `;
    playerNameDisplay.appendChild(shareBtn);
  }
});

// Evento cuando cambia el host
socket.on('host-changed', (data) => {
  console.log(`Nuevo host: ${data.newHostName}`);
  clientState.hostId = data.newHostId;
  clientState.isHost = (clientState.playerId === data.newHostId);
  updateHostControls();
});

// =========================
// Manejo de Errores
// =========================

socket.on('error', (data) => {
  toast(data.message, 'error');
  console.error('Error del servidor:', data.message);
});

// =========================
// Inicialización
// =========================

console.log('Cliente del juego Impostor iniciado');
