/**
 * BoardRenderer — builds and updates the board SVG.
 *
 * opts accepted by build():
 *   w, h         — viewport dimensions
 *   margin       — cell layout margin (px)
 *   zoom         — scale factor
 *   offset       — { x, y } translation
 *   hover        — boolean, enable hover highlight (default true)
 *   selected     — Set<"q,r"> cells to draw a selection ring on
 */
import { HexGrid }   from './HexGrid.js';
import { HexLayout } from './HexLayout.js';

const BoardRenderer = {
  _colors() {
    const s = getComputedStyle(document.documentElement);
    const v = k => s.getPropertyValue(k).trim();
    return {
      empty:   v('--hex-empty')    || '#1c1c1c',
      stroke:  v('--hex-stroke')   || '#2e2e2e',
      x:       v('--hex-x')        || '#c8c8c8',
      oStroke: v('--hex-o-stroke') || '#888',
      oBg:     v('--hex-o-bg')     || '#111',
      oStripe: v('--hex-o-stripe') || '#555',
      dot:     v('--hex-dot')      || '#3a3a3a',
      labelX:  v('--hex-label-x')  || '#1a1a1a',
      labelO:  v('--hex-label-o')  || '#a0a0a0',
      hover:   v('--hex-hover')    || '#262626',
      accent:  v('--accent')       || '#999',
      sel:     v('--sel-ring')     || '#66aaff',
      win:     v('--win-ring')     || '#ffdd44',
    };
  },

  build(svgEl, grid, labels, opts = {}) {
    svgEl.innerHTML = '';
    const ns     = 'http://www.w3.org/2000/svg';
    const w      = opts.w      ?? svgEl.parentElement.getBoundingClientRect().width;
    const h      = opts.h      ?? svgEl.parentElement.getBoundingClientRect().height;
    const margin = opts.margin ?? 80;
    const zoom   = opts.zoom   || 1;
    const offset = opts.offset || { x: 0, y: 0 };
    const R      = grid.baseR  ?? HexLayout.fitRadius(grid.s, w, h, margin);
    const hId    = 'ho' + Math.random().toString(36).slice(2, 7);
    const colors = BoardRenderer._colors();

    svgEl._hatchId = hId; svgEl._colors = colors;
    svgEl._baseR = R; svgEl._w = w; svgEl._h = h; svgEl._R = R;
    svgEl.setAttribute('viewBox', `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`);
    svgEl.setAttribute('width',  w.toFixed(1));
    svgEl.setAttribute('height', h.toFixed(1));

    BoardRenderer._defs(svgEl, ns, R, hId, colors);

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', `translate(${w/2 + offset.x}, ${h/2 + offset.y}) scale(${zoom})`);
    svgEl.appendChild(g);

    const lmap = BoardRenderer._labelMap(labels);
    const sel  = opts.selected || null;

    for (const c of grid.cells.values()) {
      const { x, y } = HexLayout.axialToPixel(c.q, c.r, R);
      const key      = HexGrid.key(c.q, c.r);
      g.appendChild(BoardRenderer._createCell(
        ns, c, x, y, R,
        lmap[key] ?? null,
        opts.hover !== false,
        hId, colors,
        c.legal === true && c.state === 0,
        sel ? sel.has(key) : false,
        opts
      ));
    }
  },

  _defs(svgEl, ns, R, hId, colors) {
    const defs = document.createElementNS(ns, 'defs');
    const sz = Math.max(3, R * 0.22), lw = Math.max(1, sz * 0.5);
    const pat = document.createElementNS(ns, 'pattern');
    pat.setAttribute('id', hId); pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('width', sz.toFixed(1)); pat.setAttribute('height', sz.toFixed(1));
    pat.setAttribute('patternTransform', 'rotate(45)');
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', sz.toFixed(1)); bg.setAttribute('height', sz.toFixed(1)); bg.setAttribute('fill', colors.oBg);
    const ln = document.createElementNS(ns, 'line');
    ln.setAttribute('x1','0'); ln.setAttribute('y1','0');
    ln.setAttribute('x2','0'); ln.setAttribute('y2', sz.toFixed(1));
    ln.setAttribute('stroke', colors.oStripe); ln.setAttribute('stroke-width', lw.toFixed(1));
    pat.append(bg, ln); defs.appendChild(pat); svgEl.appendChild(defs);
  },

  _labelMap(labels) {
    const tot = {}, idx = {}, map = {};
    for (const l of labels) { const m = l.mark ?? l.letter ?? 'a'; tot[m] = (tot[m]||0)+1; }
    for (const l of labels) {
      const m = l.mark ?? l.letter ?? 'a', i = idx[m]??0; idx[m]=i+1;
      map[HexGrid.key(l.q,l.r)] = tot[m]>1 ? `${m}${i+1}` : m;
    }
    return map;
  },

  _createCell(ns, cell, cx, cy, R, label, hover, hId, colors, isLegal, selected, opts = {}) {
    const g = document.createElementNS(ns, 'g');
    g.dataset.q = cell.q; g.dataset.r = cell.r;
    g.dataset.cx = cx.toFixed(2); g.dataset.cy = cy.toFixed(2);
    g.classList.add('cell-group');

    // Background hex face
    const face = document.createElementNS(ns, 'path');
    face.setAttribute('d', HexLayout.hexPath(cx, cy, R, Math.max(1, R*0.09)));
    face.classList.add('cell-face');
    BoardRenderer._fill(face, cell.state, hId, colors, isLegal);
    g.appendChild(face);

    // Selection / win highlight ring
    if (selected) {
      const ring = document.createElementNS(ns, 'path');
      ring.setAttribute('d', HexLayout.hexPath(cx, cy, R, Math.max(1, R*0.04)));
      ring.setAttribute('fill', 'none');
      const isWin = opts.selColor === 'win';
      ring.setAttribute('stroke', isWin ? colors.win : colors.sel);
      ring.setAttribute('stroke-width', Math.max(1.5, R * (isWin ? 0.13 : 0.09)).toFixed(1));
      ring.setAttribute('pointer-events', 'none');
      g.appendChild(ring);
    }

    // Label text or center dot
    if (label) {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', cx.toFixed(2)); t.setAttribute('y', cy.toFixed(2));
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('font-size', (R*0.52).toFixed(1)); t.setAttribute('font-family', 'Courier New,monospace');
      t.setAttribute('fill', cell.state===1 ? colors.labelX : colors.labelO);
      t.setAttribute('pointer-events', 'none');
      t.textContent = label; g.appendChild(t);
    } else if (R > 9) {
      const d = document.createElementNS(ns, 'circle');
      d.setAttribute('cx', cx.toFixed(2)); d.setAttribute('cy', cy.toFixed(2));
      d.setAttribute('r', (R*0.07).toFixed(2));
      d.setAttribute('fill', colors.dot); d.setAttribute('pointer-events', 'none');
      d.classList.add('cell-dot'); g.appendChild(d);
    }

    if (hover) {
      g.addEventListener('mouseenter', () => { if (!cell.state) face.setAttribute('fill', colors.hover); });
      g.addEventListener('mouseleave', () => BoardRenderer._fill(face, cell.state, hId, colors, isLegal));
    }
    return g;
  },

  _fill(face, s, hId, colors, legal) {
    const h = hId    || face.closest?.('svg')?._hatchId || 'hatch-o';
    const c = colors || face.closest?.('svg')?._colors  || BoardRenderer._colors();
    if      (!s)   { face.setAttribute('fill', c.empty); }
    else if (s===1){ face.setAttribute('fill', c.x);     }
    else           { face.setAttribute('fill', `url(#${h})`); }
    face.setAttribute('stroke', c.stroke); face.setAttribute('stroke-width', '0.5');
  },

  updateCell(svgEl, q, r, state) {
    const g = svgEl.querySelector(`[data-q="${q}"][data-r="${r}"]`);
    const f = g?.querySelector('.cell-face');
    if (f) BoardRenderer._fill(f, state, svgEl._hatchId, svgEl._colors);
    const c = svgEl._colors || BoardRenderer._colors();
    const t = g?.querySelector('text');
    if (t) t.setAttribute('fill', state===1 ? c.labelX : c.labelO);
  },
};

export { BoardRenderer };
