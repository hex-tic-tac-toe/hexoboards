/**
 * BoardView — thin wrapper that binds the shared BoardRenderer to a
 * specific SVG element identified by ID.
 *
 * Both Editor and Match own a BoardView instance rather than importing
 * BoardRenderer and repeating getElementById() calls everywhere.
 * Swapping the underlying SVG element only requires changing the svgId.
 */
import { BoardRenderer } from './BoardRenderer.js';

const BoardView = {
  /** Create a view bound to the SVG element with the given ID. */
  create(svgId) {
    return {
      get el() { return document.getElementById(svgId); },

      /** Rebuild the board from scratch. Accepts the same opts as BoardRenderer.build. */
      build(grid, labels, opts) {
        BoardRenderer.build(this.el, grid, labels, opts);
      },

      /** Fast single-cell repaint — no full rebuild needed for stone changes. */
      updateCell(q, r, state) {
        BoardRenderer.updateCell(this.el, q, r, state);
      },
    };
  },
};

export { BoardView };
