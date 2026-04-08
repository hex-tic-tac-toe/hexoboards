/**
 * Eval — board evaluation for the eval bar in the match panel.
 *
 * Evaluates positions per tree node. Each node has a complete position
 * after a move is made. Caches eval per node for stability.
 *
 * score = 0.0 (X winning) … 0.5 (equal) … 1.0 (O winning)
 */

import { cellsToTurnsObject } from './ApiUtils.js';

const KRAKEN_URL = '/api/kraken';
const KRAKEN_TIMEOUT_MS = 15000;

// Cache eval per node ID
const _evalCache = new Map();

const Eval = {
  /**
   * Evaluate a position from a node's cells.
   * @param {Map} cells - node grid.cells
   * @param {number} nodeId - unique node identifier
   * @returns {number|null} 0.0–1.0, or null if unavailable
   */
  async evaluate(cells, nodeId) {
    // Return cached value if available
    if (_evalCache.has(nodeId)) {
      return _evalCache.get(nodeId);
    }
    
    const turnsObj = cellsToTurnsObject(cells);
    const turnsJson = JSON.stringify(turnsObj);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), KRAKEN_TIMEOUT_MS);

      const response = await fetch(`${KRAKEN_URL}/v1/compute/eval`, {
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
        return null;
      }

      const data = await response.json();
      let score = null;
      
      // Prefer winProb (X win probability) when available
      if (typeof data.winProb === 'number' && Number.isFinite(data.winProb)) {
        score = Math.max(0, Math.min(1, 1 - data.winProb));
      } else if (typeof data.score === 'number' && Number.isFinite(data.score)) {
        score = Math.max(0, Math.min(1, 0.5 + (data.score / 2)));
      }
      
      // Cache the result
      if (score !== null) {
        _evalCache.set(nodeId, score);
      }
      
      return score;
    } catch (e) {
      return null;
    }
  },

  /**
   * Get cached eval for a node without fetching
   */
  getCached(nodeId) {
    return _evalCache.get(nodeId) ?? null;
  },

  /**
   * Clear all cached evals (call on game reset)
   */
  reset() {
    _evalCache.clear();
  },

  /**
   * Remove eval for a specific node
   */
  invalidate(nodeId) {
    _evalCache.delete(nodeId);
  },

  /**
   * Render the eval bar into `container`.
   * score 0 = X winning (left, X-colour), 1 = O winning (right, O-colour).
   * If score is null, hides the eval bar.
   */
  render(container, score) {
    container.innerHTML = '';

    // Hide if no valid score
    if (score === null || typeof score !== 'number') {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';

    const bar = document.createElement('div'); bar.className = 'eval-bar';
    const x   = document.createElement('div'); x.className = 'eval-bar-x';
    const o   = document.createElement('div'); o.className = 'eval-bar-o';

    x.style.width = ((1 - score) * 100).toFixed(1) + '%';
    o.style.width = (      score * 100).toFixed(1) + '%';

    const label = document.createElement('div'); label.className = 'eval-label';
    const pct   = Math.round((1 - score) * 100);
    label.textContent = score === 0.5
      ? 'equal'
      : pct > 50
        ? `X +${pct - 50}%`
        : `O +${50 - pct}%`;

    bar.append(x, o);
    container.append(bar, label);
  },
};

export { Eval };
