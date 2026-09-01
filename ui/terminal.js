const http = require('http');
const readline = require('readline');

const API_HOST = 'localhost';
const API_PORT = 3000;

let firstDraw = true;
let lastLineCount = 0;

function center(text, width) {
  return ' '.repeat(Math.max(0, Math.floor((width - text.length) / 2))) + text;
}

function render(state) {
  const width = process.stdout.columns;
  const lines = [];

  if (state.gameState === 'over') {
    lines.push(center('GAME OVER', width));
  } else {
    const healthStr = 'o '.repeat(state.health).trim();
    lines.push(center(healthStr, width));

    for (let r = 0; r < state.rows; r++) {
      const rowStr = Array.from({ length: state.cols }, (_, c) => {
        if (r === state.letterRow && c === state.square) return `[${state.letterChar}]`;
        if (state.fallingLetters.some((f) => f.row === r && f.column === c)) return `[${state.fallingChar}]`;
        return '[ ]';
      }).join(' ');
      lines.push(center(rowStr, width));
    }
  }

  if (!firstDraw) process.stdout.write(`\x1b[${lastLineCount}A`);
  firstDraw = false;
  lastLineCount = lines.length;

  for (const line of lines) process.stdout.write(`\x1b[2K\r${line}\n`);
}

function getState(callback) {
  http.get({ host: API_HOST, port: API_PORT, path: '/state' }, (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => callback(JSON.parse(body)));
  });
}

function postMove(direction) {
  const data = JSON.stringify({ direction });
  const req = http.request({
    host: API_HOST,
    port: API_PORT,
    path: '/move',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  });
  req.write(data);
  req.end();
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
  if (key.name === 'left') postMove('left');
  else if (key.name === 'right') postMove('right');
  else if (key.ctrl && key.name === 'c') process.exit();
});

setInterval(() => {
  getState(render);
}, 1000);
