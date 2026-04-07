/**
 * HexGrid — the bounded hexagonal grid used by the Editor.
 *
 * A grid is { s, cells: Map<"q,r", {q,r,state}> } where s is the ring
 * radius (board spans rings 0…s-1).  State: 0=empty, 1=X, 2=O.
 */
const HexGrid = {
  /** Create an empty grid of radius s. */
  create(s) {
    const max = s - 1;
    const cells = new Map();
    for (let q = -max; q <= max; q++)
      for (let r = -max; r <= max; r++)
        if (Math.abs(q + r) <= max)
          cells.set(`${q},${r}`, { q, r, state: 0 });
    return { s, cells };
  },

  key:  (q, r) => `${q},${r}`,
  cell: (grid, q, r) => grid.cells.get(`${q},${r}`) ?? null,

  setState(grid, q, r, state) {
    const c = grid.cells.get(`${q},${r}`);
    if (c) c.state = state;
  },

  countStones(grid) {
    let x = 0, o = 0;
    for (const c of grid.cells.values()) {
      if      (c.state === 1) x++;
      else if (c.state === 2) o++;
    }
    return { x, o, total: x + o };
  },

  /**
   * Convert a free-form cell map (as produced by Match) into a bounded HexGrid.
   * Computes the minimum size that contains all occupied cells plus one margin ring.
   */
  fromCellMap(cellMap) {
    let maxD = 1;
    for (const cell of cellMap.values()) {
      if (cell.state) {
        const d = (Math.abs(cell.q) + Math.abs(cell.r) + Math.abs(cell.q + cell.r)) / 2;
        if (d >= maxD) maxD = d + 1;
      }
    }
    const s = Math.max(2, Math.ceil(maxD) + 1);
    const grid = HexGrid.create(s);
    for (const cell of cellMap.values()) {
      if (cell.state) HexGrid.setState(grid, cell.q, cell.r, cell.state);
    }
    return grid;
  },
};

export { HexGrid };
