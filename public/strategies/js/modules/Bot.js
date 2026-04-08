/**
 * Bot — registry and runner for match AI players.
 *
 * Single source of truth: BOT_REGISTRY is the only place to add bots.
 * Each entry implements:
 *   id      — unique string key
 *   name    — display label
 *   move(cells, turn) → { q, r } | null
 *       cells: Map<"q,r", {q,r,state,legal}> — current visible cell map
 *       turn:  integer (same as Match._getTurn())
 *
 * Everything mocked for now. Real implementations drop in by replacing
 * the move() function and leaving the rest of the structure intact.
 */

import { HexGrid } from './HexGrid.js';

// ── configuration ─────────────────────────────────────────────────────────────

const KRAKEN_URL = '/api/kraken';
const KRAKEN_TIMEOUT_MS = 30000;

// ── helpers shared by all bots ───────────────────────────────────────────────

function _legalMoves(cells) {
  const moves = [];
  for (const [, cell] of cells) {
    if (cell.legal && cell.state === 0) moves.push({ q: cell.q, r: cell.r });
  }
  return moves;
}

function _randomFrom(arr) {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

// Convert hexoboards cells to six-tac game_json format
// Format: {"turns":[{"stones":[[q,r],[q,r]]},...]}
function _cellsToGameJson(cells) {
  const turns = [];
  const stonesByTurn = new Map();

  for (const [, cell] of cells) {
    if (cell.state === 0) continue;
    const player = cell.state === 1 ? 'One' : 'Two';
    const turn = cell.turn;
    if (!stonesByTurn.has(turn)) {
      stonesByTurn.set(turn, []);
    }
    stonesByTurn.get(turn).push([cell.q, cell.r]);
  }

  const sortedTurns = Array.from(stonesByTurn.keys()).sort((a, b) => a - b);
  for (const turn of sortedTurns) {
    const stones = stonesByTurn.get(turn);
    if (stones.length >= 2) {
      turns.push({ stones: [stones[0], stones[1]] });
    }
  }

  return JSON.stringify({ turns });
}

// ── registry ─────────────────────────────────────────────────────────────────

const BOT_REGISTRY = {
  random: {
    id:   'random',
    name: 'Random',
    /** Plays a uniformly random legal move. */
    move(cells /*, turn */) {
      return _randomFrom(_legalMoves(cells));
    },
  },

  kraken: {
    id:   'kraken',
    name: 'Kraken',
    /** Neural MCTS bot via remote API. */
    async move(cells, turn) {
      const gameJson = _cellsToGameJson(cells);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), KRAKEN_TIMEOUT_MS);

        const response = await fetch(`${KRAKEN_URL}/v1/best-move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot_name: 'kraken', game_json: gameJson }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          console.error('Kraken API error:', response.status, response.statusText);
          return _randomFrom(_legalMoves(cells));
        }

        const data = await response.json();
        if (data.stones && data.stones.length >= 2) {
          const [first, second] = data.stones;
          return { q: first[0], r: first[1] };
        }
      } catch (err) {
        console.error('Kraken move failed:', err.message);
      }
      return _randomFrom(_legalMoves(cells));
    },
  },
};

// ── public API ────────────────────────────────────────────────────────────────

const Bot = {
  /** All available bots as an ordered array. */
  list: () => Object.values(BOT_REGISTRY),

  /** Get a bot by id, or null. */
  get: id => BOT_REGISTRY[id] ?? null,

  /**
   * Ask a bot to compute a move.
   * Returns { q, r } or null if no legal move exists.
   * Wraps in a microtask so callers can treat it as async even now.
   */
  async computeMove(botId, cells, turn) {
    const bot = BOT_REGISTRY[botId];
    if (!bot) return null;
    // Yield to allow UI to update before potentially heavy work
    await new Promise(r => setTimeout(r, 0));
    return bot.move(cells, turn);
  },
};

export { Bot };
