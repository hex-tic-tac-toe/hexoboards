/**
 * Notation — encode/decode grids to/from text notation formats.
 *
 * FORMATS is the single source of truth for all supported formats.
 * Adding a new format here makes it available everywhere automatically
 * (convert tab selects, notation panel, import pipeline, batch convert).
 *
 * Each format entry: { label, encode(grid) → string, decode(text) → grid|null }
 *
 * loadFromSource(source) is the canonical entry point for all imports —
 * it accepts a Source descriptor (see Source.js) and decodes via the
 * appropriate format, making it trivial to add URL-based sources later.
 */

import { HexGrid } from './HexGrid.js';
import { HTN }     from './HTN.js';
import { Source }  from './Source.js';

// ── internal helpers ────────────────────────────────────────────────────────

const _dist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

function _ringCells(d) {
  if (d === 0) return [{ q: 0, r: 0 }];
  const dirs = [[-1,1],[-1,0],[0,-1],[1,-1],[1,0],[0,1]];
  const cells = []; let q = d, r = 0;
  for (const [dq, dr] of dirs)
    for (let i = 0; i < d; i++) { cells.push({ q, r }); q += dq; r += dr; }
  return cells;
}

function _bkeLetter(d) {
  if (d <= 0) return 'Z';
  let s = '', n = d;
  while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
  return s;
}

function _bkeLetterToD(letter) {
  if (letter === 'Z') return 0;
  let d = 0;
  for (let i = 0; i < letter.length; i++) d = d * 26 + (letter.charCodeAt(i) - 64);
  return d;
}

function _buildRefMap(firstO) {
  if (!firstO) return null;
  const angle = Math.atan2(firstO.r * Math.sqrt(3) / 2, firstO.q + firstO.r / 2);
  const map = new Map();
  for (let d = 1; d <= 30; d++) {
    const cells = _ringCells(d);
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < cells.length; i++) {
      const a    = Math.atan2(cells[i].r * Math.sqrt(3) / 2, cells[i].q + cells[i].r / 2);
      const diff = Math.abs(((a - angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    map.set(d, best);
  }
  return map;
}

function _bkeCoord(q, r, refMap) {
  const d = _dist(q, r);
  if (d === 0) return 'Z0';
  const cells = _ringCells(d);
  const nat   = cells.findIndex(c => c.q === q && c.r === r);
  const ref   = refMap?.get(d) ?? 0;
  return `${_bkeLetter(d)}${(nat - ref + cells.length) % cells.length}`;
}

function _sortStones(stones) {
  const key = (q, r) => {
    const d = _dist(q, r);
    return d * 1000 + _ringCells(d).findIndex(c => c.q === q && c.r === r);
  };
  return stones.slice().sort((a, b) => key(a.q, a.r) - key(b.q, b.r));
}

function _gridFromStones(stones) {
  if (!stones.length) return null;
  // Ensure origin stone exists (required by BKE convention)
  if (!stones.some(s => s.q === 0 && s.r === 0)) stones.unshift({ q: 0, r: 0, state: 1 });
  let maxD = 1;
  for (const { q, r } of stones) { const d = _dist(q, r); if (d >= maxD) maxD = d + 1; }
  const grid = HexGrid.create(Math.max(2, Math.ceil(maxD)));
  for (const { q, r, state } of stones) HexGrid.setState(grid, q, r, state);
  return grid;
}

// ── format implementations ──────────────────────────────────────────────────

function encodeBKE(grid) {
  const x = [], o = [];
  for (const c of grid.cells.values()) {
    if (c.state === 1) x.push(c); else if (c.state === 2) o.push(c);
  }
  const xRest  = _sortStones(x.filter(c => !(c.q === 0 && c.r === 0)));
  const os     = _sortStones(o);
  const refMap = _buildRefMap(os[0] || null);
  const fmt    = c => _bkeCoord(c.q, c.r, refMap);
  const tokens = [];
  let xi = 0, oi = 0, turn = 0;
  while (oi < os.length || xi < xRest.length) {
    if (turn % 2 === 0 && oi < os.length) {
      const a = os[oi++], b = oi < os.length ? os[oi++] : null;
      tokens.push('o ' + fmt(a) + (b ? ' ' + fmt(b) : ''));
    } else if (turn % 2 === 1 && xi < xRest.length) {
      const a = xRest[xi++], b = xi < xRest.length ? xRest[xi++] : null;
      tokens.push('x ' + fmt(a) + (b ? ' ' + fmt(b) : ''));
    } else { turn++; continue; }
    turn++;
  }
  return tokens.join(' ');
}

function decodeBKE(text) {
  const tokens = text.trim().split(/\s+/);
  let state = 1;
  const raw = [];
  for (const tok of tokens) {
    if (tok === 'x') { state = 1; continue; }
    if (tok === 'o') { state = 2; continue; }
    const m = tok.match(/^([A-Z]+)(\d+)$/i);
    if (m) raw.push({ letter: m[1].toUpperCase(), offset: +m[2], state });
  }
  if (!raw.length) return null;
  const stones = raw.map(({ letter, offset, state }) => {
    const d = _bkeLetterToD(letter);
    if (d === 0) return { q: 0, r: 0, state };
    const cells = _ringCells(d);
    return { ...cells[offset % cells.length], state };
  });
  return _gridFromStones(stones);
}

function encodeHTN(grid) {
  const xs = [], os = [];
  for (const c of grid.cells.values()) {
    if (c.state === 1 && !(c.q === 0 && c.r === 0)) xs.push(c);
    else if (c.state === 2) os.push(c);
  }
  _sortStones(xs); _sortStones(os);
  const lines = []; let oi = 0, xi = 0, t = 1;
  while (oi < os.length || xi < xs.length) {
    let pair;
    if (t % 2 === 1 && oi < os.length) {
      const a = os[oi++], b = oi < os.length ? os[oi++] : a; pair = [a, b];
    } else if (t % 2 === 0 && xi < xs.length) {
      const a = xs[xi++], b = xi < xs.length ? xs[xi++] : a; pair = [a, b];
    } else { t++; continue; }
    lines.push(`${t}. [${pair[0].q},${pair[0].r}][${pair[1].q},${pair[1].r}];`);
    t++;
  }
  return lines.join('\n');
}

function decodeHTN(text) {
  try {
    const { turns } = HTN.parse(text.trim());
    if (!turns.length) return null;
    return HTN.buildGrid(turns);
  } catch { return null; }
}

function encodeAxial(grid) {
  const x = [], o = [];
  for (const c of grid.cells.values()) {
    if (c.state === 1) x.push(`[${c.q},${c.r}]`);
    else if (c.state === 2) o.push(`[${c.q},${c.r}]`);
  }
  return [x.length ? 'X: ' + x.join(' ') : '', o.length ? 'O: ' + o.join(' ') : ''].filter(Boolean).join('\n');
}

function decodeAxial(text) {
  const stones = [];
  for (const [, side, coords] of text.matchAll(/([XO]):\s*([\[\]\-\d,\s]+)/gi)) {
    const state = side.toUpperCase() === 'X' ? 1 : 2;
    for (const [, q, r] of coords.matchAll(/\[(-?\d+),(-?\d+)\]/g))
      stones.push({ q: +q, r: +r, state });
  }
  return _gridFromStones(stones);
}

// ── public API ──────────────────────────────────────────────────────────────

const Notation = {
  /**
   * Format registry — the single source of truth for all supported notations.
   * UI elements (convert selects, notation panel) are populated from this.
   */
  FORMATS: {
    bke:   { label: 'BKE',   encode: encodeBKE,   decode: decodeBKE   },
    htn:   { label: 'HTN',   encode: encodeHTN,   decode: decodeHTN   },
    axial: { label: 'Axial', encode: encodeAxial, decode: decodeAxial },
  },

  gridToFmt: (grid, fmtId) => Notation.FORMATS[fmtId]?.encode(grid) ?? '',
  gridFromFmt: (text, fmtId) => Notation.FORMATS[fmtId]?.decode(text) ?? null,

  /**
   * Canonical import entry point — resolve a Source and decode with its format.
   * Returns the decoded grid, or null on any failure.
   */
  async loadFromSource(source) {
    const text = await Source.resolve(source);
    if (!text) return null;
    return Notation.gridFromFmt(text, source.format);
  },

  /** Parse a multi-entry batch (JSON array of strings, or a single string). */
  parseMulti(text) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) return arr.map(s => String(s));
    } catch {}
    return [text];
  },

  /** Convert an array of strings between two formats. */
  convertBatch(entries, fromFmt, toFmt) {
    return entries.map(text => {
      const grid = Notation.gridFromFmt(text, fromFmt);
      return grid ? Notation.gridToFmt(grid, toFmt) : '(parse error)';
    });
  },
};

export { Notation };
