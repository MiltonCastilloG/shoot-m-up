const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? 'web/index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(ROOT, rel);

  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

function startServer(port, game) {
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/state') {
      sendJson(res, 200, game.getState());
      return;
    }

    if (req.method === 'POST' && req.url === '/move') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { direction } = JSON.parse(body || '{}');
          if (direction === 'left') game.setDirection(-1);
          else if (direction === 'right') game.setDirection(1);
          sendJson(res, 200, game.getState());
        } catch {
          sendJson(res, 400, { error: 'invalid body' });
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/reset') {
      sendJson(res, 200, game.reset());
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  });

  server.listen(port, () => {
    console.log(`API + web client on http://localhost:${port}`);
  });

  return server;
}

module.exports = { startServer };
