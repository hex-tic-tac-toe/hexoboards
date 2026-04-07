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

  // Slot for future real implementations — structure shows what to fill in
  // aggressive: {
  //   id: 'aggressive',
  //   name: 'Aggressive (stub)',
  //   move(cells, turn) { return _randomFrom(_legalMoves(cells)); },
  // },
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
