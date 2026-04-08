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

// Convert hexoboards cells to six-tac stones format
// Format: {"stones":[[q,r],[q,r],...]}
// IMPORTANT: Must sort by turn to send moves in chronological order
function _cellsToStonesObject(cells) {
  const stones = [];

  // Get all occupied cells and sort by turn chronologically
  const cellsArray = Array.from(cells.values())
    .filter(c => c.state !== 0)
    .sort((a, b) => a.turn - b.turn);

  for (const cell of cellsArray) {
    stones.push([cell.q, cell.r]);
  }

  return { stones };
}

// Convert cube {x,y,z} to axial {q,r}
function _cubeToAxial(stone) {
  // Handle both object {x,y,z} and array [q,r] formats
  if (Array.isArray(stone)) return { q: stone[0], r: stone[1] };
  return { q: stone.x, r: stone.z };
}

// Check if two consecutive turns belong to the same player
// Hextic turn structure: X plays 1 (turn 0), then pairs: OO XX OO XX …
function _samePlayer(turnA, turnB) {
  const p = t => { const i = t % 4; return (i === 0 || i === 3) ? 1 : 2; };
  return p(turnA) === p(turnB);
}

// Poll job until complete
async function _waitForJob(jobId, signal) {
  const maxAttempts = 20;
  const interval = 500;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) return null;
    try {
      const resp = await fetch(`${KRAKEN_URL}/v1/compute/jobs/${jobId}`);
      if (!resp.ok) return null;
      const job = await resp.json();
      if (job.status === 'done' && job.result) return job.result;
      if (job.status === 'failed' || job.status === 'done') return null;
      if (job.status === 'running' && i >= 5) return null;
    } catch { return null; }
    await new Promise(r => setTimeout(r, interval));
  }
  return null;
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
    _cache: null, // { turn, move } — second move of the pair
    /** Neural MCTS bot via remote API. */
    async move(cells, turn) {
      // Return cached second move if it matches the expected turn
      if (this._cache && this._cache.turn === turn) {
        const move = this._cache.move;
        this._cache = null;
        return move;
      }
      this._cache = null;

      // Convert cells to stones format and stringify
      const stonesObj = _cellsToStonesObject(cells);
      const stonesJson = JSON.stringify(stonesObj); // "{\"stones\":[...]}"
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), KRAKEN_TIMEOUT_MS);

        const response = await fetch(`${KRAKEN_URL}/v1/compute/best-move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            position: { turnsJson: stonesJson },
            config: { botName: 'kraken' }
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return await _krakenMoveViaJob(cells, stonesJson, turn);
        }

        const data = await response.json();
        if (data.stones && data.stones.length >= 1) {
          const first = _cubeToAxial(data.stones[0]);
          // Only cache second move if the next turn belongs to the same player
          if (data.stones.length >= 2 && _samePlayer(turn, turn + 1)) {
            this._cache = { turn: turn + 1, move: _cubeToAxial(data.stones[1]) };
          }
          return first;
        }
      } catch {
        // Fall back to job-based
      }
      return null;
    },
  },
};

// Use job-based approach as fallback
async function _krakenMoveViaJob(cells, stonesJson, turn) {
  try {
    const jobResponse = await fetch(`${KRAKEN_URL}/v1/compute/best-move/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position: { turnsJson: stonesJson },
        config: { botName: 'kraken' }
      }),
    });

    if (!jobResponse.ok) return null;

    const job = await jobResponse.json();
    if (!job.jobId) return null;

    const waitController = new AbortController();
    const waitTimeout = setTimeout(() => waitController.abort(), 10000);
    const result = await _waitForJob(job.jobId, waitController);
    clearTimeout(waitTimeout);

    if (result && result.stones && result.stones.length >= 1) {
      const first = _cubeToAxial(result.stones[0]);
      if (result.stones.length >= 2 && _samePlayer(turn, turn + 1)) {
        BOT_REGISTRY.kraken._cache = { turn: turn + 1, move: _cubeToAxial(result.stones[1]) };
      }
      return first;
    }
  } catch { }
  return null;
}

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