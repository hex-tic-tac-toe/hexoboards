/**
 * Eval — board evaluation for the eval bar in the match panel.
 *
 * Evaluates positions per tree node. Each node has a complete position
 * after a move is made. Caches eval per node for stability.
 *
 * score = 0.0 (X winning) … 0.5 (equal) … 1.0 (O winning)
 */

import { cellsToTurnsObject, krakenEval } from './ApiUtils.js';

const _evalCache = new Map();

const Eval = {
  /**
   * Evaluate a position from a node's cells.
   * @param {Map} cells - node grid.cells
   * @param {number} nodeId - unique node identifier
   * @returns {number|null} 0.0–1.0, or null if unavailable
   */
  async evaluate(cells, nodeId) {
    if (_evalCache.has(nodeId)) {
      return _evalCache.get(nodeId);
    }
    
    const turnsObj = cellsToTurnsObject(cells);
    const turnsJson = JSON.stringify(turnsObj);
    
    const result = await krakenEval(turnsJson);
    
    if (result.score !== null) {
      _evalCache.set(nodeId, result.score);
    }
    
    return result.score;
  },

  getCached(nodeId) {
    return _evalCache.get(nodeId) ?? null;
  },

  reset() {
    _evalCache.clear();
  },

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
