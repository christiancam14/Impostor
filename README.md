# 🕵️ Impostor - Juego de Palabras en Tiempo Real

Un juego multijugador en tiempo real donde los jugadores deben descubrir quién es el impostor basándose en sinónimos de palabras secretas.

## 🎮 Cómo Jugar

### Objetivo
Todos los jugadores excepto uno recibirán una palabra secreta. El impostor no recibe ninguna palabra. Los jugadores deben descubrir quién es el impostor antes de que este se integre con el grupo.

### Reglas del Juego

1. **Inicio**: Se necesitan mínimo 3 jugadores para comenzar
2. **Asignación de Roles**:
   - A N-1 jugadores se les muestra una palabra secreta
   - A 1 jugador se le asigna el rol de "IMPOSTOR"
3. **Turnos**: Los jugadores rotan turnos dando sinónimos de su palabra (presencialmente)
4. **Rondas**: El juego tiene 2 rondas completas
5. **Votación**: Después de las rondas, todos votan por quién creen que es el impostor
6. **Resultados**: Se revelan:
   - Quién era el impostor
   - La palabra secreta
   - Los resultados de la votación

### Victoria
- **Los jugadores normales ganan** si identifican correctamente al impostor
- **El impostor gana** si no es descubierto

## 🚀 Características

- ✅ WebSockets en tiempo real con Socket.IO
- ✅ Sistema de lobby con nombres personalizados
- ✅ Sistema de turnos rotativos
- ✅ Sistema de votación democrática
- ✅ Pantalla de resultados detallada
- ✅ Interfaz moderna y responsive
- ✅ Más de 45 palabras secretas predefinidas
- ✅ Controles de juego (iniciar, reiniciar)
- ✅ Fácil de desplegar gratuitamente

## 📋 Requisitos

- Node.js >= 14.0.0
- npm o yarn

## 🛠️ Instalación

1. Clona el repositorio:
```bash
git clone <tu-repositorio>
cd Impostor
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura el puerto (opcional):
```bash
# Edita server.js o crea archivo .env
PORT=3001
```

## 🎯 Uso

### Desarrollo local

1. Inicia el servidor:
```bash
npm start
```

2. Abre varios navegadores o pestañas en:
```
http://localhost:3001
```

3. En cada navegador:
   - Ingresa un nombre diferente
   - Espera a que se unan al menos 3 jugadores
   - Cualquier jugador puede iniciar el juego

### Flujo del Juego

1. **Lobby**: 
   - Los jugadores se conectan e ingresan sus nombres
   - Esperan a que se unan suficientes jugadores (mín. 3)
   - Cualquier jugador puede presionar "Iniciar Juego"

2. **Fase de Juego**:
   - Cada jugador ve su rol (palabra secreta o "IMPOSTOR")
   - Se muestra quién tiene el turno actual
   - Los jugadores dan sinónimos presencialmente
   - Usar "Siguiente Turno" para avanzar
   - Después de 2 rondas completas, automáticamente pasa a votación

3. **Votación**:
   - Cada jugador vota por quién cree que es el impostor
   - No puedes votarte a ti mismo
   - Una vez que todos votan, se muestran los resultados

4. **Resultados**:
   - Se revela quién era el impostor
   - Se muestra la palabra secreta
   - Se muestran los votos de todos
   - Se declara al ganador
   - Opción de "Nueva Partida" para volver al lobby

## 🌐 Despliegue Gratuito

Esta aplicación puede desplegarse gratuitamente en varias plataformas que soportan WebSockets:

### Render.com (Recomendado)

1. Crea una cuenta en [Render.com](https://render.com)
2. Conecta tu repositorio de GitHub
3. Crea un nuevo **Web Service**
4. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Render detectará automáticamente el soporte de WebSockets
6. Tu juego estará disponible en: `https://tu-app.onrender.com`

### Railway

1. Crea una cuenta en [Railway.app](https://railway.app)
2. Crea un nuevo proyecto
3. Conecta tu repositorio de GitHub
4. Railway detectará automáticamente la configuración de Node.js
5. El puerto se configura automáticamente

### Fly.io

1. Instala [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Ejecuta:
```bash
fly launch
fly deploy
```

## 📁 Estructura del Proyecto

```
Impostor/
├── server.js              # Servidor Express + Socket.IO con lógica del juego
├── public/                # Archivos del cliente
│   ├── index.html         # Interfaz con múltiples pantallas
│   ├── styles.css         # Estilos modernos y responsive
│   └── client.js          # Lógica del cliente WebSocket
├── package.json           # Dependencias y scripts
├── .gitignore            # Archivos ignorados por Git
└── README.md             # Este archivo
```

## 🔧 Configuración

### Variables de Entorno

- `PORT`: Puerto del servidor (default: 3001)

### Personalización

#### Agregar más palabras secretas

Edita el array `secretWords` en `server.js`:

```javascript
const secretWords = [
  'Perro', 'Gato', 'Árbol', // ... tus palabras
];
```

#### Cambiar el número de rondas

En `server.js`, modifica:

```javascript
const gameState = {
  // ...
  maxRounds: 2, // Cambia este valor
};
```

## 🎨 Tecnologías Utilizadas

- **Backend**: Node.js + Express
- **WebSockets**: Socket.IO
- **Frontend**: HTML5 + CSS3 + JavaScript (Vanilla)
- **Diseño**: CSS Grid + Flexbox

## 📡 Eventos Socket.IO

### Del cliente al servidor:

- `join-game`: Unirse al juego con un nombre
- `start-game`: Iniciar una nueva partida
- `next-turn`: Avanzar al siguiente turno
- `vote`: Votar por un jugador
- `reset-game`: Reiniciar el juego al lobby

### Del servidor al cliente:

- `join-success`: Confirmación de entrada al juego
- `game-state-update`: Actualización del estado del juego
- `your-role`: Asignación de rol (palabra o impostor)
- `game-started`: Notificación de inicio
- `start-voting`: Inicio de la fase de votación
- `game-results`: Resultados finales
- `game-reset`: Notificación de reinicio
- `error`: Mensajes de error

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 💡 Ideas de Mejoras

- [ ] Agregar categorías de palabras (animales, objetos, etc.)
- [ ] Sistema de puntuación acumulativa
- [ ] Salas privadas con códigos
- [ ] Chat de texto durante el juego
- [ ] Modo espectador
- [ ] Historial de partidas
- [ ] Temporizador por turno
- [ ] Efectos de sonido
- [ ] Modo de dificultad (fácil/difícil)
- [ ] Traducción a otros idiomas

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

## 👤 Autor

**Christian Stiven Camacho Galvis**

## 🙏 Agradecimientos

- Socket.IO por su excelente librería de WebSockets
- Express.js por el framework web
- La comunidad de desarrolladores

---

¡Diviértete jugando! 🎉
