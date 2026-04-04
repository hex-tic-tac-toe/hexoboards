import { HexGrid } from '../utils/HexGrid.js';
import { HexLayout } from '../utils/HexLayout.js';
import { URLCodec } from '../utils/URLCodec.js';
import { Notation } from '../utils/Notation.js';
import { Layout } from '../utils/Layout.js';

const BoardRenderer = {
  _colors() {
    const s = getComputedStyle(document.documentElement);
    const v = k => s.getPropertyValue(k).trim();
    return {
      empty:   v('--hex-empty')   || '#1c1c1c',
      stroke:  v('--hex-stroke')  || '#2e2e2e',
      x:       v('--hex-x')       || '#c8c8c8',
      oStroke: v('--hex-o-stroke')|| '#888',
      oBg:     v('--hex-o-bg')    || '#111',
      oStripe: v('--hex-o-stripe')|| '#555',
      dot:     v('--hex-dot')     || '#3a3a3a',
      labelX:  v('--hex-label-x') || '#1a1a1a',
      labelO:  v('--hex-label-o') || '#a0a0a0',
      hover:   v('--hex-hover')   || '#262626',
    };
  },

  build(svgEl, grid, labels, opts = {}) {
    svgEl.innerHTML = '';
    const ns      = 'http://www.w3.org/2000/svg';
    const w       = opts.w ?? svgEl.parentElement.getBoundingClientRect().width;
    const h       = opts.h ?? svgEl.parentElement.getBoundingClientRect().height;
    const R       = HexLayout.fitRadius(grid.s, w, h, opts.margin ?? 22);
    const hatchId = 'ho' + Math.random().toString(36).slice(2, 7);
    const colors  = BoardRenderer._colors();
    svgEl._hatchId = hatchId;
    svgEl._colors  = colors;
    BoardRenderer._defs(svgEl, ns, R, hatchId, colors);

    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (const c of grid.cells.values()) {
      const {x,y} = HexLayout.axialToPixel(c.q, c.r, R), hw = R * Math.sqrt(3) / 2;
      if (x-hw<minX) minX=x-hw; if (x+hw>maxX) maxX=x+hw;
      if (y-R <minY) minY=y-R;  if (y+R >maxY) maxY=y+R;
    }
    const pad=R*0.28, vw=maxX-minX+pad*2, vh=maxY-minY+pad*2, ox=-minX+pad, oy=-minY+pad;
    svgEl.setAttribute('viewBox', `0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}`);
    if (opts.mini) { svgEl.setAttribute('width','100%'); svgEl.setAttribute('height','100%'); }
    else { svgEl.setAttribute('width',vw.toFixed(1)); svgEl.setAttribute('height',vh.toFixed(1)); }
    svgEl._R = R;

    const lmap = BoardRenderer._labelMap(labels);
    for (const c of grid.cells.values()) {
      const {x,y} = HexLayout.axialToPixel(c.q, c.r, R);
      BoardRenderer._cell(svgEl, ns, c, x+ox, y+oy, R, lmap[HexGrid.key(c.q,c.r)]??null, opts.hover!==false, hatchId, colors);
    }
  },

  _defs(svgEl, ns, R, hatchId, colors) {
    const defs=document.createElementNS(ns,'defs'), sz=Math.max(3,R*0.22), lw=Math.max(1,sz*0.5);
    const pat=document.createElementNS(ns,'pattern');
    pat.setAttribute('id', hatchId); pat.setAttribute('patternUnits','userSpaceOnUse');
    pat.setAttribute('width',sz.toFixed(1)); pat.setAttribute('height',sz.toFixed(1));
    pat.setAttribute('patternTransform','rotate(45)');
    const bg=document.createElementNS(ns,'rect');
    bg.setAttribute('width',sz.toFixed(1)); bg.setAttribute('height',sz.toFixed(1)); bg.setAttribute('fill', colors.oBg);
    pat.appendChild(bg);
    const ln=document.createElementNS(ns,'line');
    ln.setAttribute('x1','0'); ln.setAttribute('y1','0'); ln.setAttribute('x2','0'); ln.setAttribute('y2',sz.toFixed(1));
    ln.setAttribute('stroke', colors.oStripe); ln.setAttribute('stroke-width',lw.toFixed(1));
    pat.appendChild(ln); defs.appendChild(pat); svgEl.appendChild(defs);
  },

  _labelMap(labels) {
    const tot={}, idx={}, map={};
    for (const l of labels) { const m=l.mark??l.letter??'a'; tot[m]=(tot[m]||0)+1; }
    for (const l of labels) {
      const m=l.mark??l.letter??'a', i=idx[m]??0; idx[m]=i+1;
      map[HexGrid.key(l.q,l.r)] = tot[m]>1 ? `${m}${i+1}` : m;
    }
    return map;
  },

  _cell(svgEl, ns, cell, cx, cy, R, label, hover, hatchId, colors) {
    const g=document.createElementNS(ns,'g');
    g.dataset.q=cell.q; g.dataset.r=cell.r; g.dataset.cx=cx.toFixed(2); g.dataset.cy=cy.toFixed(2);
    const face=document.createElementNS(ns,'path');
    face.setAttribute('d', HexLayout.hexPath(cx,cy,R,Math.max(1,R*0.09)));
    face.classList.add('cell-face'); BoardRenderer._fill(face, cell.state, hatchId, colors); g.appendChild(face);
    if (label) {
      const t=document.createElementNS(ns,'text');
      t.setAttribute('x',cx.toFixed(2)); t.setAttribute('y',cy.toFixed(2));
      t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','central');
      t.setAttribute('font-size',(R*0.52).toFixed(1)); t.setAttribute('font-family','Courier New,monospace');
      t.setAttribute('fill', cell.state===1 ? colors.labelX : colors.labelO); t.setAttribute('pointer-events','none');
      t.textContent=label; g.appendChild(t);
    } else if (R>9) {
      const d=document.createElementNS(ns,'circle');
      d.setAttribute('cx',cx.toFixed(2)); d.setAttribute('cy',cy.toFixed(2)); d.setAttribute('r',(R*0.07).toFixed(2));
      d.setAttribute('fill', colors.dot); d.setAttribute('pointer-events','none'); d.classList.add('cell-dot'); g.appendChild(d);
    }
    if (hover) {
      g.addEventListener('mouseenter',()=>{ if(!cell.state) face.setAttribute('fill', colors.hover); });
      g.addEventListener('mouseleave',()=>BoardRenderer._fill(face, cell.state, hatchId, colors));
    }
    svgEl.appendChild(g);
  },

  _fill(face, s, hatchId, colors) {
    const h = hatchId || face.closest?.('svg')?._hatchId || 'hatch-o';
    const c = colors  || face.closest?.('svg')?._colors  || BoardRenderer._colors();
    if      (!s)    { face.setAttribute('fill', c.empty);         face.setAttribute('stroke', c.stroke); face.setAttribute('stroke-width','0.9'); }
    else if (s===1) { face.setAttribute('fill', c.x);             face.setAttribute('stroke','none'); }
    else            { face.setAttribute('fill', `url(#${h})`);    face.setAttribute('stroke', c.oStroke); face.setAttribute('stroke-width','1'); }
  },

  updateCell(svgEl, q, r, state) {
    const g=svgEl.querySelector(`[data-q="${q}"][data-r="${r}"]`);
    const f=g?.querySelector('.cell-face'); if (f) BoardRenderer._fill(f, state, svgEl._hatchId, svgEl._colors);
    const c = svgEl._colors || BoardRenderer._colors();
    const t=g?.querySelector('text'); if (t) t.setAttribute('fill', state===1 ? c.labelX : c.labelO);
  },
};

const EditorViewWidget = {
  styles: `
    .editor-toolbar { position:absolute; top:44px; left:0; right:0; height:42px; display:flex; align-items:center; gap:8px; padding:0 14px; background:var(--surface); border-bottom:1px solid var(--border); }
    .toolbar-label { color:var(--dim); font-size:10px; letter-spacing:.1em; }
    .toolbar-hint  { margin-left:8px; color:var(--dim); font-size:10px; }
    #board-area { position:absolute; top:86px; left:0; right:0; bottom:28px; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:crosshair; transition:right .18s; }
    #board-svg  { display:block; user-select:none; }
    #note-panel { position:absolute; top:86px; right:0; width:260px; bottom:28px; background:var(--surface); border-left:1px solid var(--border); display:none; flex-direction:column; z-index:5; }
    #note-area  { flex:1; overflow:hidden; display:flex; flex-direction:column; padding:14px; gap:10px; }
    .note-field-label { font-size:9px; color:var(--dim); letter-spacing:.14em; text-transform:uppercase; margin-bottom:4px; }
    #title-text { width:100%; background:transparent; border:none; border-bottom:1px solid var(--border); color:var(--text); font-family:var(--font); font-size:14px; padding:4px 0; outline:none; }
    #title-text::placeholder { color:var(--dim); font-size:12px; }
    #note-text  { flex:1; width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); font-family:var(--font); font-size:12px; padding:8px; resize:none; outline:none; line-height:1.5; }
    #note-text::placeholder { color:var(--dim); }
    .editor-footer { position:absolute; bottom:0; left:0; right:0; height:28px; display:flex; align-items:center; gap:16px; padding:0 16px; background:var(--surface); border-top:1px solid var(--border); font-size:10px; color:var(--dim); overflow:hidden; }
    #footer-stones { color:var(--muted); flex-shrink:0; }
    #footer-hash   { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
    .footer-mode   { color:var(--dim); font-size:9px; flex-shrink:0; }
    #panel-toggles { position:absolute; top:100px; right:0; z-index:20; display:flex; flex-direction:column; gap:0; }
    #note-toggle-btn, #notation-toggle-btn { background:var(--surface); border:1px solid var(--border); border-right:none; color:var(--muted); font-family:var(--font); font-size:10px; letter-spacing:.1em; text-transform:uppercase; padding:5px 8px; cursor:pointer; writing-mode:vertical-lr; transform:rotate(180deg); transition:color .1s, border-color .1s; }
    #note-toggle-btn:hover, #notation-toggle-btn:hover { color:var(--text); }
    #note-toggle-btn.active, #notation-toggle-btn.active { color:var(--accent); border-color:var(--accent-dim); }
    .panel-resize { position:absolute; left:0; top:0; bottom:0; width:4px; cursor:col-resize; z-index:30; }
    .panel-resize:hover, .panel-resize:active { background:var(--accent-dim); }
    #notation-panel { position:absolute; top:86px; right:0; width:300px; bottom:28px; background:var(--surface); border-left:1px solid var(--border); display:none; flex-direction:column; overflow:hidden; }
    .notation-inner { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
    .nf-section { border-bottom:1px solid var(--border); padding:10px 12px; display:flex; flex-direction:column; gap:6px; flex-shrink:0; }
    .nf-hdr { display:flex; align-items:center; gap:6px; }
    .nf-label { font-size:10px; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; flex:1; }
    .tip { display:inline-flex; align-items:center; justify-content:center; width:13px; height:13px; border:1px solid var(--dim); border-radius:50%; color:var(--dim); font-size:9px; cursor:help; }
    .nf-copy { padding:2px 7px; font-size:9px; }
    .nf-load { padding:2px 7px; font-size:9px; margin-top:2px; align-self:flex-start; }
    .nf-out { background:var(--bg); border:1px solid var(--border); color:var(--muted); font-family:var(--font); font-size:11px; padding:6px 10px; resize:vertical; outline:none; line-height:1.6; width:100%; min-height:52px; max-height:160px; }
    .nf-out:focus { border-color:var(--accent-dim); color:var(--text); }
    .nf-footer { padding:8px 12px; font-size:9px; color:var(--dim); text-align:center; flex-shrink:0; }
    .btn.save.dirty::after { content:'·'; font-size:18px; line-height:0; vertical-align:middle; margin-left:3px; color:var(--accent); }
  `,

  _styleEl: null,
  grid: null,
  labels: [],
  note: '',
  title: '',
  history: [],
  placeMode: 'auto',
  labelMode: 'letter',
  noteOpen: false,
  notationOpen: false,
  nodeId: null,
  dirty: false,
  _drag: null,
  _container: null,

  mount(container) {
    this._container = container;
    const el = document.createElement('div');
    el.className = 'editor-view';
    el.style.cssText = 'position:absolute;inset:0;';
    el.innerHTML = `
      <div class="editor-toolbar">
        <span class="toolbar-label">place</span>
        <button class="btn" id="btn-mode-x">X</button>
        <button class="btn" id="btn-mode-o">O</button>
        <button class="btn active" id="btn-mode-auto">auto</button>
        <span class="sep" style="margin:0 6px">—</span>
        <span class="toolbar-label">label</span>
        <button class="btn" id="btn-label-mode">a</button>
        <span class="toolbar-hint">left-drag stones · right-drag labels · ctrl clears</span>
        <span class="sep" style="margin:0 6px">—</span>
        <button class="btn" id="btn-rotate-ccw">↺</button>
        <button class="btn" id="btn-rotate-cw">↻</button>
        <button class="btn" id="btn-mirror">⇔</button>
      </div>
      <div id="board-area"><svg id="board-svg"></svg></div>
      <div id="note-panel">
        <div class="panel-resize" id="note-resize"></div>
        <div id="note-area">
          <div>
            <div class="note-field-label">Title</div>
            <input type="text" id="title-text" placeholder="position title…">
          </div>
          <div style="flex:1;display:flex;flex-direction:column;min-height:0">
            <div class="note-field-label">Note</div>
            <textarea id="note-text" placeholder="notes for this position…"></textarea>
          </div>
        </div>
      </div>
      <div id="notation-panel">
        <div class="panel-resize" id="notation-resize"></div>
        <div class="notation-inner">
          <div class="nf-section">
            <div class="nf-hdr"><span class="nf-label">BKE</span><span class="tip" data-tip="Boat-Kaitlyn-Epic — ring/offset, rotation-independent">?</span><button class="btn nf-copy" id="nf-copy-bke">⎘</button></div>
            <textarea class="nf-out" id="nf-bke" readonly></textarea>
            <button class="btn nf-load" id="nf-load-bke">↑ load</button>
          </div>
          <div class="nf-section">
            <div class="nf-hdr"><span class="nf-label">HTN</span><span class="tip" data-tip="Hexagonal Tic Tac Toe Notation">?</span><button class="btn nf-copy" id="nf-copy-htn">⎘</button></div>
            <textarea class="nf-out" id="nf-htn" readonly></textarea>
            <button class="btn nf-load" id="nf-load-htn">↑ load</button>
          </div>
          <div class="nf-section">
            <div class="nf-hdr"><span class="nf-label">Axial</span><span class="tip" data-tip="Axial (q,r) coordinates">?</span><button class="btn nf-copy" id="nf-copy-axial">⎘</button></div>
            <textarea class="nf-out" id="nf-axial" readonly></textarea>
            <button class="btn nf-load" id="nf-load-axial">↑ load</button>
          </div>
          <div class="nf-footer">to import, use the Convert tab</div>
        </div>
      </div>
      <div id="panel-toggles">
        <button id="note-toggle-btn">note</button>
        <button id="notation-toggle-btn">notation</button>
      </div>
      <div class="editor-footer">
        <span id="footer-stones">X: 0  O: 0  total: 0</span>
        <span id="editor-mode" class="footer-mode">new</span>
        <span id="footer-hash"></span>
        <button class="btn" id="btn-copy-board">⎘ share</button>
        <button class="btn" id="btn-copy-image">⎘ image</button>
      </div>
    `;
    container.appendChild(el);
    this._injectStyles();
    this._bindEvents();
    this._bindPointer();
    this._bindResizeHandles();
    this._initTooltips();
  },

  _injectStyles() {
    if (this._styleEl) return;
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = this.styles;
    document.head.appendChild(this._styleEl);
  },

  _bindEvents() {
    const si = document.getElementById('input-size');
    if (si) {
      const applySize = () => {
        const s = parseInt(si.value, 10); if (s < 2 || s > 32) return;
        const prev = this.grid;
        const next = HexGrid.create(s);
        const max = s - 1;
        const dist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
        if (prev) {
          for (const c of prev.cells.values())
            if (c.state && dist(c.q, c.r) <= max) HexGrid.setState(next, c.q, c.r, c.state);
          this.labels = this.labels.filter(l => dist(l.q, l.r) <= max);
        }
        this.grid = next; this.history = [];
        this._buildBoard(); this._syncFooter(); this._syncMode();
      };
      document.getElementById('btn-apply-size')?.addEventListener('click', applySize);
      si.addEventListener('keydown', e => { if (e.key === 'Enter') applySize(); });
    }

    document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-clear')?.addEventListener('click', () => { if (confirm('Clear the board?')) this.clear(); });

    document.getElementById('note-toggle-btn')?.addEventListener('click', () => {
      this.noteOpen = !this.noteOpen; this._syncPanels(); this._buildBoard();
    });
    document.getElementById('note-text')?.addEventListener('input', e => { this.note = e.target.value; this._setDirty(true); });
    document.getElementById('title-text')?.addEventListener('input', e => { this.title = e.target.value; this._setDirty(true); });

    document.getElementById('notation-toggle-btn')?.addEventListener('click', () => {
      this.notationOpen = !this.notationOpen; this._syncPanels(); this._buildBoard();
    });

    document.getElementById('btn-rotate-ccw')?.addEventListener('click', () => this.rotate(-1));
    document.getElementById('btn-rotate-cw')?.addEventListener('click', () => this.rotate(1));
    document.getElementById('btn-mirror')?.addEventListener('click', () => this.mirror());

    document.getElementById('nf-load-bke')?.addEventListener('click', () => {
      this._importNotation(document.getElementById('nf-bke').value, 'bke');
    });
    document.getElementById('nf-load-htn')?.addEventListener('click', () => {
      this._importNotation(document.getElementById('nf-htn').value, 'htn');
    });
    document.getElementById('nf-load-axial')?.addEventListener('click', () => {
      this._importNotation(document.getElementById('nf-axial').value, 'axial');
    });

    document.getElementById('nf-copy-bke')?.addEventListener('click', () => this._copy(document.getElementById('nf-bke').value));
    document.getElementById('nf-copy-htn')?.addEventListener('click', () => this._copy(document.getElementById('nf-htn').value));
    document.getElementById('nf-copy-axial')?.addEventListener('click', () => this._copy(document.getElementById('nf-axial').value));

    const modes = { 'btn-mode-x':'x', 'btn-mode-o':'o', 'btn-mode-auto':'auto' };
    for (const [id, mode] of Object.entries(modes)) {
      document.getElementById(id)?.addEventListener('click', () => {
        this.placeMode = mode;
        for (const bid of Object.keys(modes)) document.getElementById(bid)?.classList.toggle('active', bid === id);
      });
    }

    document.getElementById('btn-label-mode')?.addEventListener('click', () => {
      this.labelMode = this.labelMode === 'letter' ? 'number' : 'letter';
      const btn = document.getElementById('btn-label-mode');
      btn.textContent = this.labelMode === 'letter' ? 'a' : '1';
      btn.classList.toggle('active', this.labelMode === 'number');
    });

    document.getElementById('btn-copy-board')?.addEventListener('click', () => {
      const enc = URLCodec.encodeFull(this.grid, this.labels);
      navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${enc}`).then(() => this._toast('link copied'));
    });

    document.getElementById('btn-copy-image')?.addEventListener('click', () => this._copyImage());

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
    });
  },

  _bindPointer() {
    const area = document.getElementById('board-area');
    if (!area) return;
    const cellAt = (x, y) => { const g = document.elementFromPoint(x,y)?.closest?.('[data-q]'); return g ? { q:+g.dataset.q, r:+g.dataset.r } : null; };

    area.addEventListener('contextmenu', e => e.preventDefault());
    area.addEventListener('pointerdown', e => {
      if (e.target.closest('#note-panel') || e.target.closest('#notation-panel')) return;
      e.preventDefault();
      const pos = cellAt(e.clientX, e.clientY); if (!pos) return;
      area.setPointerCapture(e.pointerId);
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.button === 0) {
        const action = this._computeAction(HexGrid.cell(this.grid, pos.q, pos.r), ctrl);
        this._drag = { type: 'stone', action, visited: new Set() };
        this._applyStone(pos.q, pos.r, action);
        this._drag.visited.add(HexGrid.key(pos.q, pos.r));
      } else if (e.button === 2) {
        this._drag = { type: 'label', ctrl, visited: new Set() };
        this._applyLabel(pos.q, pos.r, ctrl);
        this._drag.visited.add(HexGrid.key(pos.q, pos.r));
      }
    });
    area.addEventListener('pointermove', e => {
      const d = this._drag; if (!d) return;
      const pos = cellAt(e.clientX, e.clientY); if (!pos) return;
      const key = HexGrid.key(pos.q, pos.r); if (d.visited.has(key)) return;
      d.visited.add(key);
      if (d.type === 'stone') this._applyStone(pos.q, pos.r, d.action);
      else this._applyLabel(pos.q, pos.r, d.ctrl);
    });
    area.addEventListener('pointerup',     () => { this._drag = null; this._syncFooter(); });
    area.addEventListener('pointercancel', () => { this._drag = null; });
  },

  _bindResizeHandles() {
    this._makeResizable(document.getElementById('note-resize'), e => { this._applyPanelResize('note', window.innerWidth - e.clientX); });
    this._makeResizable(document.getElementById('notation-resize'), e => { this._applyPanelResize('notation', window.innerWidth - (this.noteOpen ? Layout.NOTE_W : 0) - e.clientX); });
  },

  _makeResizable(handle, onMove) {
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const up = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', up);
    });
  },

  _initTooltips() {
    const tip = document.getElementById('tooltip');
    if (!tip) return;
    const show = target => {
      tip.textContent = target.dataset.tip;
      tip.hidden = false;
      const r = target.getBoundingClientRect();
      const below = r.top < 80;
      tip.style.top = below ? (r.bottom + 6) + 'px' : (r.top - tip.offsetHeight - 6) + 'px';
      tip.style.left = Math.max(4, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 4)) + 'px';
    };
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-tip]');
      if (t) show(t); else tip.hidden = true;
    });
    document.addEventListener('mouseout', e => {
      if (!e.relatedTarget?.closest('[data-tip]')) tip.hidden = true;
    });
  },

  _computeAction(cell, ctrl) {
    if (ctrl) return 0;
    if (this.placeMode === 'x') return cell.state === 1 ? 0 : 1;
    if (this.placeMode === 'o') return cell.state === 2 ? 0 : 2;
    return (cell.state + 1) % 3;
  },

  _applyStone(q, r, state) {
    const cell = HexGrid.cell(this.grid, q, r); if (!cell || cell.state === state) return;
    this.history.push({ q, r, prev: cell.state });
    HexGrid.setState(this.grid, q, r, state);
    BoardRenderer.updateCell(document.getElementById('board-svg'), q, r, state);
    this._setDirty(true);
  },

  _applyLabel(q, r, clear) {
    this.labels = this.labels.filter(l => !(l.q === q && l.r === r));
    if (!clear) this.labels.push({ q, r, mark: this._nextMark() });
    this._buildBoard();
    this._setDirty(true);
  },

  _nextMark() {
    if (this.labelMode === 'number') {
      const used = new Set(this.labels.map(l => Number(l.mark)).filter(n => !isNaN(n)));
      for (let i = 1; ; i++) if (!used.has(i)) return String(i);
    }
    const counts = {};
    for (const l of this.labels) counts[l.mark] = (counts[l.mark] || 0) + 1;
    for (let i = 0; ; i++) {
      const base = String.fromCharCode(97 + (i % 26)), round = Math.floor(i / 26);
      if ((counts[base] || 0) <= round) return base;
    }
  },

  undo() {
    const last = this.history.pop(); if (!last) return;
    HexGrid.setState(this.grid, last.q, last.r, last.prev);
    BoardRenderer.updateCell(document.getElementById('board-svg'), last.q, last.r, last.prev);
    this._syncFooter();
    this._setDirty(true);
  },

  clear() {
    for (const c of this.grid.cells.values()) c.state = 0;
    this.history = []; this.labels = []; this.nodeId = null;
    this._buildBoard(); this._syncFooter(); this._syncMode();
    this._setDirty(false);
  },

  rotate(dir) {
    const fn = dir > 0 ? (q, r) => ({ q: -r, r: q + r }) : (q, r) => ({ q: q + r, r: -q });
    this._transformBoard(fn);
  },

  mirror() {
    this._transformBoard((q, r) => ({ q: -q - r, r }));
  },

  _transformBoard(fn) {
    const stones = [], labels = [];
    for (const c of this.grid.cells.values())
      if (c.state) stones.push({ ...fn(c.q, c.r), state: c.state });
    for (const l of this.labels)
      labels.push({ ...fn(l.q, l.r), mark: l.mark });
    for (const c of this.grid.cells.values()) c.state = 0;
    for (const s of stones) HexGrid.setState(this.grid, s.q, s.r, s.state);
    this.labels = labels;
    this.history = [];
    this._buildBoard(); this._syncFooter(); this._setDirty(true);
  },

  _buildBoard() {
    const svg = document.getElementById('board-svg');
    if (!svg || !this.grid) return;
    BoardRenderer.build(svg, this.grid, this.labels,
      { w: Layout.boardW(this.noteOpen, this.notationOpen), h: Layout.boardH() });
  },

  _syncFooter() {
    const { x, o, total } = HexGrid.countStones(this.grid);
    const stonesEl = document.getElementById('footer-stones');
    if (stonesEl) stonesEl.textContent = `X: ${x}  O: ${o}  total: ${total}`;
    const hashEl = document.getElementById('footer-hash');
    if (hashEl) hashEl.textContent = URLCodec.encode(this.grid) || '(empty)';
    if (this.notationOpen) this._syncNotationPanel();
  },

  _syncNotationPanel() {
    if (!this.grid || !this.notationOpen) return;
    const bke = document.getElementById('nf-bke');
    const htn = document.getElementById('nf-htn');
    const axial = document.getElementById('nf-axial');
    if (bke) bke.value = Notation.gridToBKE(this.grid);
    if (htn) htn.value = Notation.gridToHTN(this.grid);
    if (axial) axial.value = Notation.gridToAxial(this.grid);
  },

  _syncMode() {
    const el = document.getElementById('editor-mode'); if (el) el.textContent = this.nodeId ? 'saved' : 'new';
    const btn = document.getElementById('btn-save'); if (btn) btn.textContent = this.nodeId ? '★ update' : '★ save';
    this._setDirty(this.dirty);
  },

  _syncPanels() {
    const noteW = this.noteOpen ? Layout.NOTE_W : 0;
    const notationW = this.notationOpen ? Layout.NOTATION_W : 0;

    const notePanel = document.getElementById('note-panel');
    if (notePanel) { notePanel.style.display = this.noteOpen ? 'flex' : 'none'; notePanel.style.width = noteW + 'px'; }
    const nt = document.getElementById('note-text'); if (nt) nt.value = this.note;
    const tt = document.getElementById('title-text'); if (tt) tt.value = this.title;

    const notationPanel = document.getElementById('notation-panel');
    if (notationPanel) { notationPanel.style.display = this.notationOpen ? 'flex' : 'none'; notationPanel.style.right = noteW + 'px'; notationPanel.style.width = notationW + 'px'; }

    const ba = document.getElementById('board-area');
    if (ba) ba.style.right = (noteW + notationW) + 'px';

    document.getElementById('note-toggle-btn')?.classList.toggle('active', this.noteOpen);
    const toggles = document.getElementById('panel-toggles');
    if (toggles) toggles.style.right = (noteW + notationW) + 'px';
    document.getElementById('notation-toggle-btn')?.classList.toggle('active', this.notationOpen);

    if (this.notationOpen) this._syncNotationPanel();
  },

  _applyPanelResize(which, newW) {
    const clamped = Math.max(180, Math.min(520, newW));
    if (which === 'note') Layout.NOTE_W = clamped;
    if (which === 'notation') Layout.NOTATION_W = clamped;
    this._syncPanels();
    this._buildBoard();
  },

  _setDirty(v) {
    this.dirty = v;
    document.getElementById('btn-save')?.classList.toggle('dirty', v);
  },

  _importNotation(text, fmt) {
    const grid = Notation.gridFromFmt(text, fmt);
    if (!grid) { this._toast('parse error'); return; }
    this.grid = grid; this.labels = []; this.history = []; this.nodeId = null;
    document.getElementById('input-size').value = grid.s;
    this._buildBoard(); this._syncFooter(); this._syncMode();
    this._toast('loaded');
  },

  _copy(text) {
    if (!text) { this._toast('nothing to copy'); return; }
    navigator.clipboard?.writeText(text).then(() => this._toast('copied'));
  },

  _copyImage() {
    const svg = document.getElementById('board-svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = (svg.width.baseVal.value || img.naturalWidth) * scale;
      canvas.height = (svg.height.baseVal.value || img.naturalHeight) * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
          .then(() => this._toast('image copied'))
          .catch(() => this._toast('not supported in this browser'));
      });
    };
    img.src = url;
  },

  _toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  },

  loadNode(node) {
    const grid = node ? URLCodec.decode(node.board) : null;
    this.grid = grid || HexGrid.create(parseInt(document.getElementById('input-size')?.value, 10) || 5);
    this.labels = (node?.labels || []).map(l => Array.isArray(l) ? { q: l[0], r: l[1], mark: l[2] } : { ...l, mark: l.mark ?? l.letter ?? 'a' });
    this.note = node?.note || '';
    this.title = node?.title || '';
    this.nodeId = node?.id || null;
    this.history = [];
    if (grid) document.getElementById('input-size').value = grid.s;
    this.noteOpen = this.note.trim().length > 0 || this.title.trim().length > 0;
    this._setDirty(false);
    this._syncPanels();
    this._syncFooter();
    this._syncMode();
  },

  render(data) {
    if (data?.action === 'save') {
      this.note = document.getElementById('note-text')?.value ?? this.note;
      this.title = document.getElementById('title-text')?.value ?? this.title;
    }
    if (data?.grid) {
      this.grid = data.grid;
      this.labels = data.labels || [];
      this.history = [];
      this.nodeId = data.nodeId || null;
      document.getElementById('input-size').value = this.grid.s;
      this._buildBoard();
      this._syncFooter();
      this._syncMode();
    }
  },

  destroy() {
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { EditorViewWidget };
