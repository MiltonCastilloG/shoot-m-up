const LETTER = 'A';
const FALLING_LETTER = 'I';
const ROWS = 5;
const COLS = 5;
const LETTER_ROW = ROWS - 1;
const STARTING_HEALTH = 3;

let square = 2; // start at column 3 (0-indexed) of the last row
let fallingLetters = []; // { row, column }
let pendingDirection = null;
let health = STARTING_HEALTH;
let gameState = 'playing'; // 'playing' | 'dying' | 'over'

export function reset() {
  square = 2;
  fallingLetters = [];
  pendingDirection = null;
  health = STARTING_HEALTH;
  gameState = 'playing';
  return getState();
}

function isCollision(row, column) {
  return fallingLetters.some((f) => f.row === row && f.column === column);
}

export function setDirection(direction) {
  pendingDirection = direction;
}

export function tick() {
  if (gameState === 'dying') {
    gameState = 'over';
    return getState();
  }

  fallingLetters = fallingLetters
    .map((f) => ({ ...f, row: f.row + 1 }))
    .filter((f) => f.row < ROWS);
  fallingLetters.push({ row: 0, column: Math.floor(Math.random() * COLS) });

  if (pendingDirection !== null) {
    square = Math.min(COLS - 1, Math.max(0, square + pendingDirection));
  }
  pendingDirection = null;

  if (isCollision(LETTER_ROW, square)) health = Math.max(0, health - 1);
  if (health <= 0) gameState = 'dying';

  return getState();
}

export function getState() {
  const letterChar = gameState === 'dying' ? 'X' : isCollision(LETTER_ROW, square) ? 'B' : LETTER;

  return {
    rows: ROWS,
    cols: COLS,
    letterRow: LETTER_ROW,
    square,
    letterChar,
    fallingChar: FALLING_LETTER,
    fallingLetters,
    health,
    gameState,
  };
}
