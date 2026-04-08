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
 */

import { HexGrid } from './HexGrid.js';
import { cellsToTurnsObject, krakenEval } from './ApiUtils.js';

// ── configuration ─────────────────────────────────────────────────────────────

const KRAKEN_URL = '/api/kraken';
const KRAKEN_TIMEOUT_MS = 30000;

// ── shared utilities ─────────────────────────────────────────────────────────

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

// Check if two consecutive turns belong to the same player
function _samePlayer(turnA, turnB) {
  const p = t => { const i = t % 4; return (i === 0 || i === 3) ? 1 : 2; };
  return p(turnA) === p(turnB);
}

// ── registry ─────────────────────────────────────────────────────────────────

const BOT_REGISTRY = {
  random: {
    id:   'random',
    name: 'Random',
    move(cells /*, turn */) {
      return _randomFrom(_legalMoves(cells));
    },
  },

  kraken: {
    id:   'kraken',
    name: 'Kraken',
    _cache: null,
    _lastPositionId: null,
    
    async move(cells, turn) {
      // Return cached second move if it matches the expected turn
      if (this._cache && this._cache.turn === turn) {
        const move = this._cache.move;
        this._cache = null;
        return move;
      }
      this._cache = null;

      const turnsObj = cellsToTurnsObject(cells);
      const turnsJson = JSON.stringify(turnsObj);
      
      // Simple position key for deduplication
      let positionKey = turnsJson;
      if (turnsJson.length > 15 && crypto && crypto.subtle) {
        try {
          const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(turnsJson));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          positionKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        } catch {}
      }
      
      // Skip if same position as last call
      if (positionKey === this._lastPositionId) {
        return null;
      }
      this._lastPositionId = positionKey;
      
      // Use eval endpoint (returns both score and bestMove)
      const result = await krakenEval(turnsJson);
      
      if (result.bestMove && result.bestMove.length >= 1) {
        const first = result.bestMove[0];
        if (result.bestMove.length >= 2 && _samePlayer(turn, turn + 1)) {
          this._cache = { turn: turn + 1, move: result.bestMove[1] };
        }
        return first;
      }
      
      return null;
    },
  },
};

// ── DEPRECATED: best-move endpoint code (kept for reference) ──────────────────
// The best-move endpoint was causing issues with longer games (~20 moves).
// Now using the eval endpoint which returns bestMove in the response.

/*
async function _krakenMoveViaBestMove(turnsJson, turn) {
  const { cubeToAxial } = await import('./ApiUtils.js');
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KRAKEN_TIMEOUT_MS);

    const response = await fetch(`${KRAKEN_URL}/v1/compute/best-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position: { turnsJson: turnsJson },
        config: { botName: 'kraken' }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return await _krakenMoveViaJob(turnsJson, turn, cubeToAxial);
    }

    const data = await response.json();
    if (data.stones && data.stones.length >= 1) {
      const first = cubeToAxial(data.stones[0]);
      if (data.stones.length >= 2 && _samePlayer(turn, turn + 1)) {
        BOT_REGISTRY.kraken._cache = { turn: turn + 1, move: cubeToAxial(data.stones[1]) };
      }
      return first;
    }
  } catch (e) {
    console.warn('Kraken best-move failed:', e.message);
  }
  return null;
}

async function _krakenMoveViaJob(turnsJson, turn, cubeToAxial) {
  try {
    const jobResponse = await fetch(`${KRAKEN_URL}/v1/compute/best-move/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position: { turnsJson: turnsJson },
        config: { botName: 'kraken' }
      }),
    });

    if (!jobResponse.ok) return null;

    const job = await jobResponse.json();
    if (!job.jobId) return null;

    const result = await _waitForJob(job.jobId);
    if (result && result.stones && result.stones.length >= 1) {
      const first = cubeToAxial(result.stones[0]);
      if (result.stones.length >= 2 && _samePlayer(turn, turn + 1)) {
        BOT_REGISTRY.kraken._cache = { turn: turn + 1, move: cubeToAxial(result.stones[1]) };
      }
      return first;
    }
  } catch (e) {
    console.warn('Kraken job failed:', e.message);
  }
  return null;
}

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
*/

// ── public API ────────────────────────────────────────────────────────────────

const Bot = {
  list: () => Object.values(BOT_REGISTRY),
  get: id => BOT_REGISTRY[id] ?? null,

  async computeMove(botId, cells, turn) {
    const bot = BOT_REGISTRY[botId];
    if (!bot) return null;
    await new Promise(r => setTimeout(r, 0));
    return bot.move(cells, turn);
  },
  
  resetCaches() {
    for (const bot of Object.values(BOT_REGISTRY)) {
      if (bot._cache) bot._cache = null;
      if (bot._lastPositionId) bot._lastPositionId = null;
    }
  },
};

export { Bot };
