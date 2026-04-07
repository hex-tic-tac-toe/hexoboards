/**
 * WinDetector — checks for 6 consecutive same-state hexes after each move.
 *
 * check(q, r, state, cells) is called after every stone placement.
 * Returns an array of winning { q, r } cells (6+) if the move completed a win,
 * or null otherwise.
 */

const WinDetector = {
  _DIRS: [[1,0],[0,1],[1,-1]],  // three hex axes; each covers both directions

  /**
   * Check whether placing a stone at (q,r) with `state` completes a win.
   * @returns {Array<{q,r}>|null}  the winning run, or null
   */
  check(q, r, state, cells) {
    for (const [dq, dr] of WinDetector._DIRS) {
      const run = WinDetector._buildRun(q, r, dq, dr, state, cells);
      if (run.length >= 6) return run;
    }
    return null;
  },

  _buildRun(q, r, dq, dr, state, cells) {
    const run = [{ q, r }];

    // Walk forward
    let cq = q + dq, cr = r + dr;
    while (cells.get(`${cq},${cr}`)?.state === state) {
      run.push({ q: cq, r: cr }); cq += dq; cr += dr;
    }
    // Walk backward
    cq = q - dq; cr = r - dr;
    while (cells.get(`${cq},${cr}`)?.state === state) {
      run.unshift({ q: cq, r: cr }); cq -= dq; cr -= dr;
    }

    return run;
  },
};

export { WinDetector };
