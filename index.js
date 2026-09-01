const game = require('./logic/game');
const { startServer } = require('./server/httpServer');

const PORT = 3000;

startServer(PORT, game);

setInterval(() => {
  game.tick();
}, 1000);
