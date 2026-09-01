const game = require('./logic/game');
const { startServer } = require('./server/httpServer');

const PORT = 3000;
const TICK_MS = 1000;

const { broadcast } = startServer(PORT, game);

// The single game loop. Each tick advances state and pushes it to every
// connected client (browser via SSE); the terminal UI still polls /state.
setInterval(() => {
  broadcast(game.tick());
}, TICK_MS);
