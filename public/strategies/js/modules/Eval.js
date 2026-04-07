/**
 * Eval — board evaluation for the eval bar in the match panel.
 *
 * Mocked implementation returns 0.5 (equal) for every position.
 * Real engine drops in by replacing evaluate() alone.
 *
 * score = 0.0 (X winning) … 0.5 (equal) … 1.0 (O winning)
 */

const Eval = {
  /**
   * Evaluate a position.
   * @param {Map} cells  — visible cell map from Match
   * @param {number} turn
   * @returns {number} 0.0–1.0
   */
  async evaluate(cells /*, turn */) {
    // Mocked: return 50/50 always
    await new Promise(r => setTimeout(r, 0));
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
