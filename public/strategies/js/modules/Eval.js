/**
 * Eval — board evaluation for the eval bar in the match panel.
 *
 * Mocked implementation returns 0.5 (equal) for every position.
 * Real engine drops in by replacing evaluate() alone.
 *
 * score = 0.0 (X winning) … 0.5 (equal) … 1.0 (O winning)
 */

const KRAKEN_URL = '/api/kraken';
const KRAKEN_TIMEOUT_MS = 60000;

// Convert hexoboards cells to six-tac turns object
function _cellsToTurnsObject(cells) {
  const turns = [];
  const stonesByTurn = new Map();

  for (const [, cell] of cells) {
    if (cell.state === 0) continue;
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

  return { turns };
}

const Eval = {
  /**
   * Evaluate a position.
   * @param {Map} cells  — visible cell map from Match
   * @param {number} turn
   * @returns {number} 0.0–1.0
   */
  async evaluate(cells /*, turn */) {
    const turnsObj = _cellsToTurnsObject(cells);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), KRAKEN_TIMEOUT_MS);

      // Try sync endpoint first - send object directly
      const response = await fetch(`${KRAKEN_URL}/v1/compute/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: { turnsJson: turnsObj },
          config: { botName: 'kraken' }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return 0.5;
      }

      const data = await response.json();
      if (typeof data.score === 'number' && Number.isFinite(data.score)) {
        const normalized = 0.5 - (data.score / 2);
        return Math.max(0, Math.min(1, normalized));
      }
    } catch {
      // Fall back to mock
    }

    return 0.5;
  },

  /**
   * Render the eval bar into `container`.
   * score 0 = X winning (left, X-colour), 1 = O winning (right, O-colour).
   */
  render(container, score) {
    container.innerHTML = '';

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
