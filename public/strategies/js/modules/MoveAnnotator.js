/**
 * MoveAnnotator — auto-labels moves after they are placed.
 *
 * Mocked implementation checks for a specific pattern and applies a label.
 * Real analysis drops in by replacing annotate() alone.
 *
 * Returns null (no annotation) or a label object matching the format
 * used by Match node labels: { type, icon, text }
 *
 * Current mock: flags any move that creates a run of 4 in a row
 * where both ends have at least 2 empty cells ('potential win').
 */

const MoveAnnotator = {

  /**
   * Annotate a freshly placed move.
   * @param {number} q
   * @param {number} r
   * @param {number} state  1=X, 2=O
   * @param {Map}    cells  full visible cell map after the move
   * @returns {{ type, icon, text } | null}
   */
  async annotate(q, r, state, cells) {
    await new Promise(res => setTimeout(res, 0));

    const dirs3 = [[1,0],[0,1],[1,-1]];
    for (const [dq, dr] of dirs3) {
      const run   = MoveAnnotator._runLength(q, r, dq,  dr, state, cells)
                  + MoveAnnotator._runLength(q, r, -dq, -dr, state, cells) + 1;
      const freeA = MoveAnnotator._freeCount(q, r, dq,  dr, state, cells);
      const freeB = MoveAnnotator._freeCount(q, r, -dq, -dr, state, cells);

      if (run >= 4 && freeA >= 2 && freeB >= 2) {
        return { type: 'potential-win', icon: '!', text: 'Potential win' };
      }
      if (run >= 5 && (freeA >= 1 || freeB >= 1)) {
        return { type: 'missed-win', icon: '!!', text: 'Missed win threat' };
      }
    }
    return null;
  },

  /** Count consecutive same-state cells from (q,r) in direction (dq,dr). */
  _runLength(q, r, dq, dr, state, cells) {
    let len = 0, cq = q + dq, cr = r + dr;
    while (true) {
      const c = cells.get(`${cq},${cr}`);
      if (!c || c.state !== state) break;
      len++; cq += dq; cr += dr;
    }
    return len;
  },

  /** Count consecutive empty cells from (q,r) in direction (dq,dr). */
  _freeCount(q, r, dq, dr, state, cells) {
    let n = 0, cq = q + dq, cr = r + dr;
    // Skip past own stones first
    while (true) {
      const c = cells.get(`${cq},${cr}`);
      if (!c || c.state !== state) break;
      cq += dq; cr += dr;
    }
    // Count empty
    while (true) {
      const c = cells.get(`${cq},${cr}`);
      if (!c || c.state !== 0) break;
      n++; cq += dq; cr += dr;
    }
    return n;
  },
};

export { MoveAnnotator };
