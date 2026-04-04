import { Doc } from '../utils/Doc.js';
import { Markdown } from '../utils/Markdown.js';
import { URLCodec } from '../utils/URLCodec.js';
import { HexGrid } from '../utils/HexGrid.js';
import { HexLayout } from '../utils/HexLayout.js';
import { Layout } from '../utils/Layout.js';

const _BoardRenderer = {
  _colors() {
    const s = getComputedStyle(document.documentElement);
    const v = k => s.getPropertyValue(k).trim();
    return {
      empty: v('--hex-empty')||'#1c1c1c', stroke: v('--hex-stroke')||'#2e2e2e',
      x: v('--hex-x')||'#c8c8c8', oStroke: v('--hex-o-stroke')||'#888',
      oBg: v('--hex-o-bg')||'#111', oStripe: v('--hex-o-stripe')||'#555',
      dot: v('--hex-dot')||'#3a3a3a', labelX: v('--hex-label-x')||'#1a1a1a',
      labelO: v('--hex-label-o')||'#a0a0a0', hover: v('--hex-hover')||'#262626',
    };
  },
  build(svgEl, grid, labels, opts={}) {
    svgEl.innerHTML = '';
    const ns='http://www.w3.org/2000/svg';
    const w=opts.w??220, h=opts.h??180;
    const R=HexLayout.fitRadius(grid.s,w,h,opts.margin??8);
    const hatchId='ho'+Math.random().toString(36).slice(2,7);
    const colors=_BoardRenderer._colors();
    svgEl._hatchId=hatchId; svgEl._colors=colors;
    _BoardRenderer._defs(svgEl,ns,R,hatchId,colors);
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for (const c of grid.cells.values()) {
      const {x,y}=HexLayout.axialToPixel(c.q,c.r,R), hw=R*Math.sqrt(3)/2;
      if (x-hw<minX) minX=x-hw; if (x+hw>maxX) maxX=x+hw;
      if (y-R<minY) minY=y-R; if (y+R>maxY) maxY=y+R;
    }
    const pad=R*0.28, vw=maxX-minX+pad*2, vh=maxY-minY+pad*2, ox=-minX+pad, oy=-minY+pad;
    svgEl.setAttribute('viewBox',`0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}`);
    svgEl.setAttribute('width','100%'); svgEl.setAttribute('height','100%');
    const lmap=_BoardRenderer._labelMap(labels);
    for (const c of grid.cells.values()) {
      const {x,y}=HexLayout.axialToPixel(c.q,c.r,R);
      _BoardRenderer._cell(svgEl,ns,c,x+ox,y+oy,R,lmap[HexGrid.key(c.q,c.r)]??null,false,hatchId,colors);
    }
  },
  _defs(svgEl,ns,R,hatchId,colors) {
    const defs=document.createElementNS(ns,'defs'),sz=Math.max(3,R*0.22),lw=Math.max(1,sz*0.5);
    const pat=document.createElementNS(ns,'pattern');
    pat.setAttribute('id',hatchId); pat.setAttribute('patternUnits','userSpaceOnUse');
    pat.setAttribute('width',sz.toFixed(1)); pat.setAttribute('height',sz.toFixed(1));
    pat.setAttribute('patternTransform','rotate(45)');
    const bg=document.createElementNS(ns,'rect');
    bg.setAttribute('width',sz.toFixed(1)); bg.setAttribute('height',sz.toFixed(1)); bg.setAttribute('fill',colors.oBg);
    pat.appendChild(bg);
    const ln=document.createElementNS(ns,'line');
    ln.setAttribute('x1','0'); ln.setAttribute('y1','0'); ln.setAttribute('x2','0'); ln.setAttribute('y2',sz.toFixed(1));
    ln.setAttribute('stroke',colors.oStripe); ln.setAttribute('stroke-width',lw.toFixed(1));
    pat.appendChild(ln); defs.appendChild(pat); svgEl.appendChild(defs);
  },
  _labelMap(labels) {
    const tot={},idx={},map={};
    for (const l of labels) { const m=l.mark??l.letter??'a'; tot[m]=(tot[m]||0)+1; }
    for (const l of labels) {
      const m=l.mark??l.letter??'a',i=idx[m]??0; idx[m]=i+1;
      map[HexGrid.key(l.q,l.r)]=tot[m]>1?`${m}${i+1}`:m;
    }
    return map;
  },
  _cell(svgEl,ns,cell,cx,cy,R,label,hover,hatchId,colors) {
    const g=document.createElementNS(ns,'g');
    g.dataset.q=cell.q; g.dataset.r=cell.r;
    const face=document.createElementNS(ns,'path');
    face.setAttribute('d',HexLayout.hexPath(cx,cy,R,Math.max(1,R*0.09)));
    face.classList.add('cell-face'); _BoardRenderer._fill(face,cell.state,hatchId,colors); g.appendChild(face);
    if (label) {
      const t=document.createElementNS(ns,'text');
      t.setAttribute('x',cx.toFixed(2)); t.setAttribute('y',cy.toFixed(2));
      t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','central');
      t.setAttribute('font-size',(R*0.52).toFixed(1)); t.setAttribute('font-family','Courier New,monospace');
      t.setAttribute('fill',cell.state===1?colors.labelX:colors.labelO); t.setAttribute('pointer-events','none');
      t.textContent=label; g.appendChild(t);
    } else if (R>9) {
      const d=document.createElementNS(ns,'circle');
      d.setAttribute('cx',cx.toFixed(2)); d.setAttribute('cy',cy.toFixed(2)); d.setAttribute('r',(R*0.07).toFixed(2));
      d.setAttribute('fill',colors.dot); d.setAttribute('pointer-events','none'); d.classList.add('cell-dot'); g.appendChild(d);
    }
    svgEl.appendChild(g);
  },
  _fill(face,s,hatchId,colors) {
    const h=hatchId||'hatch-o', c=colors||_BoardRenderer._colors();
    if (!s) { face.setAttribute('fill',c.empty); face.setAttribute('stroke',c.stroke); face.setAttribute('stroke-width','0.9'); }
    else if (s===1) { face.setAttribute('fill',c.x); face.setAttribute('stroke','none'); }
    else { face.setAttribute('fill',`url(#${h})`); face.setAttribute('stroke',c.oStroke); face.setAttribute('stroke-width','1'); }
  },
};

const BrowserViewWidget = {
  styles: `
    .browser-toolbar { position:absolute; top:44px; left:180px; right:0; height:38px; display:flex; align-items:center; gap:8px; padding:0 14px; background:var(--surface); border-bottom:1px solid var(--border); z-index:5; }
    .browser-toolbar-right { margin-left:auto; display:flex; gap:4px; }
    .search-wrap { display:flex; align-items:center; gap:6px; background:var(--bg); border:1px solid var(--border); padding:0 8px; flex:1; max-width:360px; }
    .search-icon { color:var(--dim); font-size:14px; }
    #browser-search { background:transparent; border:none; outline:none; color:var(--text); font-family:var(--font); font-size:12px; width:100%; padding:4px 0; }
    #browser-search::placeholder { color:var(--dim); }
    #btn-search-clear { background:transparent; border:none; color:var(--dim); cursor:pointer; padding:0 2px; font-size:12px; }
    #btn-search-clear:hover { color:var(--text); }
    .lib-sidebar { position:absolute; top:82px; left:0; width:180px; bottom:0; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; }
    .sidebar-head { padding:10px 12px; font-size:10px; color:var(--muted); letter-spacing:.12em; text-transform:uppercase; border-bottom:1px solid var(--border); flex-shrink:0; }
    .lib-nav-item { padding:8px 12px; font-size:12px; color:var(--muted); cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lib-nav-item:hover { color:var(--text); background:rgba(255,255,255,.02); }
    .lib-nav-item.active { color:var(--text); background:rgba(255,255,255,.04); }
    .lib-nav-item.dim { color:var(--dim); }
    .lib-nav-sec { padding:5px 12px; font-size:11px; color:var(--dim); cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lib-nav-sec:hover { color:var(--muted); }
    .lib-nav-sec.active { color:var(--accent); }
    .browser-crumb { padding:6px 12px 2px; font-size:11px; color:var(--accent); font-family:var(--prose-font); border-bottom:1px solid var(--border); letter-spacing:.01em; }
    .sidebar-resize { position:absolute; right:0; top:0; bottom:0; width:4px; cursor:col-resize; z-index:30; }
    .sidebar-resize:hover, .sidebar-resize:active { background:var(--accent-dim); }
    .browser-main { position:absolute; top:82px; left:180px; right:0; bottom:0; overflow-y:auto; }
    #browser-doc { padding:32px 48px; max-width:1600px; }
    .browser-empty { color:var(--dim); font-size:11px; padding:24px 0; }
    .doc-node { position:relative; margin-bottom:4px; }
    .doc-node.dragging { opacity:.3; }
    .doc-node.drag-over { outline:1px solid var(--accent); }
    .doc-s { border:1px solid transparent; margin-bottom:12px; transition:border-color .15s; }
    .browser-editable .doc-s:hover { border-color:var(--border); }
    .doc-sec-hdr { display:flex; align-items:center; gap:8px; padding:8px 12px; background:transparent; border-bottom:1px solid transparent; cursor:pointer; transition:background .15s, border-color .15s; }
    .browser-editable .doc-s:hover .doc-sec-hdr { background:rgba(255,255,255,.02); border-bottom-color:var(--border); }
    .doc-sec-hdr .collapse-btn { cursor:pointer; color:var(--muted); font-size:12px; flex-shrink:0; }
    .doc-sec-hdr .collapse-btn:hover { color:var(--text); }
    .sec-title { font-size:13px; color:var(--text); font-weight:bold; letter-spacing:.06em; flex:1; outline:none; }
    .sec-title[contenteditable="true"]:hover { background:rgba(255,255,255,.03); }
    .sec-actions { display:flex; gap:4px; margin-left:auto; }
    .sec-actions .btn { padding:2px 7px; font-size:9px; opacity:0; }
    .doc-sec-hdr:hover .sec-actions .btn { opacity:1; }
    .doc-sec-body { padding:8px 16px 8px 20px; margin-left:14px; border-left:1px solid var(--border-hi); }
    .drag-handle { color:var(--dim); cursor:grab; font-size:14px; flex-shrink:0; }
    .drag-handle:hover { color:var(--muted); }
    .doc-t { position:relative; padding-left:18px; }
    .doc-t .drag-handle { position:absolute; left:0; top:8px; opacity:0; transition:opacity .15s; }
    .doc-t:hover .drag-handle { opacity:1; }
    .md-body { padding:10px 16px 10px 0; color:var(--text); font-size:17px; line-height:1.9; cursor:text; min-height:32px; font-family:var(--prose-font); letter-spacing:.01em; }
    .md-body:hover { background:rgba(255,255,255,.01); }
    .md-placeholder { color:var(--dim); font-style:italic; }
    .md-body h1 { font-size:20px; color:var(--text); margin-bottom:10px; letter-spacing:.01em; font-weight:700; }
    .md-body h2 { font-size:16px; color:var(--text); margin-bottom:8px; letter-spacing:.01em; border-bottom:1px solid var(--border); padding-bottom:5px; font-weight:600; }
    .md-body h3 { font-size:14px; color:var(--accent); margin-bottom:4px; letter-spacing:.01em; font-weight:600; }
    .md-body p { margin-bottom:10px; color:var(--muted); }
    .md-body strong { color:var(--text); font-weight:bold; }
    .md-body em { color:var(--muted); font-style:italic; }
    .md-body code { background:#1a1a1a; color:var(--accent); padding:1px 5px; font-size:11px; }
    .md-body ul { padding-left:16px; margin-bottom:8px; }
    .md-body ul ul { padding-left:18px; margin-top:4px; margin-bottom:4px; }
    .md-body li { color:var(--muted); margin-bottom:2px; }
    .md-body a { color:var(--accent); text-decoration:underline; text-underline-offset:2px; }
    .md-body a:hover { color:var(--text); }
    .doc-text-ta { width:100%; min-height:80px; background:var(--bg); border:1px solid var(--accent-dim); color:var(--text); font-family:var(--prose-font); font-size:14px; padding:10px; resize:none; outline:none; line-height:1.75; overflow-wrap:break-word; overflow:hidden; }
    .node-del-btn { position:absolute; top:4px; right:0; opacity:0; padding:2px 7px; font-size:9px; }
    .doc-t:hover .node-del-btn { opacity:1; }
    .doc-p { display:flex; gap:0; border:1px solid transparent; transition:border-color .1s; cursor:pointer; }
    .browser-editable .doc-p { border-color:var(--border); }
    .doc-p:hover { border-color:var(--border-hi) !important; }
    .doc-p .drag-handle { display:flex; align-items:center; padding:0 6px; opacity:0; transition:opacity .15s; cursor:grab; flex-shrink:0; }
    .doc-p:hover .drag-handle { opacity:1; }
    .doc-p .card-board { width:220px; height:180px; flex-shrink:0; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--board-bg); }
    .doc-p .card-board svg { display:block; }
    .doc-p .card-meta { padding:14px 16px; display:flex; flex-direction:column; gap:5px; flex:1; font-family:var(--prose-font); }
    .doc-p .card-title { font-size:15px; color:var(--text); font-weight:bold; letter-spacing:.01em; }
    .doc-p .card-note { font-size:13px; color:var(--muted); line-height:1.6; }
    .doc-p .card-stats { font-size:10px; color:var(--dim); letter-spacing:.06em; margin-top:auto; font-family:var(--font); }
    .doc-p .card-actions { display:flex; margin-top:4px; }
    .doc-p .card-actions .btn { font-size:9px; padding:2px 7px; opacity:0; }
    .doc-p:hover .card-actions .btn { opacity:1; }
    .doc-add-bar { display:flex; gap:6px; padding:2px 0; opacity:0; transition:opacity .2s; min-height:16px; }
    .doc-add-bar:hover, .doc-add-bar.always-visible { opacity:1; }
    .doc-add-bar .btn { padding:1px 7px; font-size:9px; }
    .mono-toggle { position:absolute; top:6px; right:20px; background:transparent; border:1px solid transparent; color:var(--dim); font-family:var(--font); font-size:9px; padding:1px 5px; cursor:pointer; opacity:0; transition:opacity .15s; letter-spacing:.06em; }
    .doc-t:hover .mono-toggle { opacity:1; }
    .mono-toggle:hover { border-color:var(--border); color:var(--muted); }
    .mono-toggle.active { color:var(--accent); border-color:var(--accent-dim); opacity:1; }
    .md-raw { font-family:var(--font); font-size:12px; color:var(--muted); line-height:1.65; padding:10px 16px 10px 0; white-space:pre-wrap; word-break:break-word; cursor:text; }
    .sec-link-btn { background:transparent; border:none; color:var(--dim); font-size:11px; cursor:pointer; padding:0 4px; opacity:0; transition:opacity .15s; margin-left:4px; }
    .doc-sec-hdr:hover .sec-link-btn { opacity:1; }
    .sec-link-btn:hover { color:var(--text); }
    .browser-compact .doc-sec-body:not([hidden]),
    .browser-compact #browser-doc { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; align-items:start; padding:20px 28px; }
    .browser-compact #browser-doc { padding:20px 28px; }
    .browser-compact .doc-sec-body:not([hidden]) { padding:8px 12px; }
    .browser-compact .doc-sec-body > .doc-s,
    .browser-compact .doc-sec-body > .doc-t,
    .browser-compact .doc-sec-body > .doc-add-bar,
    .browser-compact #browser-doc > .doc-s,
    .browser-compact #browser-doc > .doc-t,
    .browser-compact #browser-doc > .doc-add-bar { grid-column:1 / -1; }
    .browser-compact .doc-p { flex-direction:column; width:100%; }
    .browser-compact .doc-p .card-board { width:100%; height:140px; }
    .browser-compact .doc-p .card-note { display:none; }
    .browser-compact .doc-p .drag-handle { display:none; }
    #btn-back-to-top { position:fixed; bottom:24px; right:24px; z-index:50; background:var(--surface); border:1px solid var(--border-hi); color:var(--muted); font-family:var(--font); font-size:14px; width:36px; height:36px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:color .1s, border-color .1s; }
    #btn-back-to-top:hover { color:var(--text); border-color:var(--accent-dim); }
  `,

  _styleEl: null,
  activeLibId: null,
  _doc: null,
  _editable: false,
  _onOpen: null,
  insertContext: null,
  _activeSec: null,
  _compact: false,
  _container: null,
  _store: null,

  mount(container) {
    this._container = container;
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;';
    el.innerHTML = `
      <div class="browser-toolbar">
        <span class="search-wrap">
          <span class="search-icon">⌕</span>
          <input type="text" id="browser-search" placeholder="search…">
          <button id="btn-search-clear" hidden>✕</button>
        </span>
        <div class="browser-toolbar-right">
          <button class="btn" id="btn-compact">⊞</button>
          <button class="btn" id="btn-collapse-all">▸▸</button>
          <button class="btn" id="btn-expand-all">▾▾</button>
        </div>
      </div>
      <aside class="lib-sidebar">
        <div class="sidebar-head">Libraries</div>
        <div id="browser-crumb" class="browser-crumb" hidden></div>
        <div id="lib-nav"></div>
        <div class="sidebar-resize"></div>
      </aside>
      <div class="browser-main">
        <div id="browser-doc"></div>
      </div>
      <button id="btn-back-to-top" hidden>↑</button>
    `;
    container.appendChild(el);
    this._injectStyles();
    this._bindEvents();
    this._bindResizeHandle();
  },

  _injectStyles() {
    if (this._styleEl) return;
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = this.styles;
    document.head.appendChild(this._styleEl);
  },

  setStore(store) {
    this._store = store;
  },

  setOpenHandler(fn) {
    this._onOpen = fn;
  },

  _bindEvents() {
    document.getElementById('btn-search-clear')?.addEventListener('click', () => {
      const s = document.getElementById('browser-search');
      if (s) { s.value = ''; this._applySearch(''); s.focus(); }
    });
    document.getElementById('browser-search')?.addEventListener('input', e => this._applySearch(e.target.value));
    document.getElementById('btn-collapse-all')?.addEventListener('click', () => this.setAllCollapsed(true));
    document.getElementById('btn-expand-all')?.addEventListener('click', () => this.setAllCollapsed(false));
    document.getElementById('btn-compact')?.addEventListener('click', () => this._toggleCompact());
    document.getElementById('btn-back-to-top')?.addEventListener('click', () => {
      document.querySelector('.browser-main')?.scrollTo({ top:0, behavior:'smooth' });
    });
    document.querySelector('.browser-main')?.addEventListener('scroll', e => {
      const btn = document.getElementById('btn-back-to-top');
      if (btn) btn.hidden = e.target.scrollTop < 300;
    });
  },

  _bindResizeHandle() {
    const handle = document.querySelector('.sidebar-resize');
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const onMove = ev => {
        const w = Math.max(120, Math.min(360, ev.clientX));
        document.querySelector('.lib-sidebar').style.width = w + 'px';
        document.querySelector('.browser-main').style.left = w + 'px';
        document.querySelector('.browser-toolbar').style.left = w + 'px';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  _toggleCompact() {
    this._compact = !this._compact;
    document.querySelector('.browser-main')?.classList.toggle('browser-compact', this._compact);
    document.getElementById('btn-compact')?.classList.toggle('active', this._compact);
  },

  render(libId) {
    if (!this._store) return;
    this.activeLibId = libId;
    const libData = this._store.getDoc(libId);
    this._doc = libData?.doc || [];
    this._editable = this._store.isLocal(libId);
    this._renderNav();
    this._renderDoc();
  },

  _renderNav() {
    const nav = document.getElementById('lib-nav');
    const crumb = document.getElementById('browser-crumb');
    if (!nav) return;
    nav.innerHTML = '';
    if (!this._store) return;
    const entries = [[this._store.LOCAL, this._store.libs[this._store.LOCAL]], ...Object.entries(this._store.libs).filter(([id]) => id !== this._store.LOCAL)];
    for (const [id, lib] of entries) {
      if (!lib) continue;
      const el = document.createElement('div');
      el.className = 'lib-nav-item' + (this.activeLibId===id?' active':'') + (!lib.active&&!lib.local?' dim':'');
      el.textContent = lib.name;
      el.addEventListener('click', () => this.render(id));
      nav.appendChild(el);
      if (this.activeLibId === id) this._navSections(nav, this._doc, 1);
    }
    if (crumb) {
      const sec = this._activeSec ? Doc.find(this._doc, this._activeSec)?.[0] : null;
      crumb.textContent = sec?.title || '';
      crumb.hidden = !sec;
    }
  },

  _navSections(nav, nodes, depth) {
    for (const n of nodes) {
      if (n.type !== 's') continue;
      const el = document.createElement('div');
      el.className = 'lib-nav-sec' + (this._activeSec === n.id ? ' active' : '');
      el.style.paddingLeft = (8 + depth * 12) + 'px';
      el.dataset.id = n.id;
      el.textContent = n.title;
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._activeSec = n.id;
        this._renderNav();
        this.scrollToSection(n.id);
      });
      nav.appendChild(el);
      if (!n.collapsed && n.children) this._navSections(nav, n.children, depth + 1);
    }
  },

  scrollToSection(secId) {
    const el = document.getElementById('dn-' + secId);
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'start' }); history.replaceState(null, '', '#b/' + this.activeLibId + '/' + secId); }
  },

  setAllCollapsed(collapsed) {
    const walk = nodes => nodes.forEach(n => { if (n.type === 's') { n.collapsed = collapsed; walk(n.children || []); } });
    walk(this._doc);
    if (this._editable) this._save();
    this._renderDoc(); this._renderNav();
  },

  _renderDoc() {
    const main = document.getElementById('browser-doc');
    if (!main) return;
    main.innerHTML = '';
    main.classList.toggle('browser-editable', this._editable);
    if (!this.activeLibId || !this._doc.length) {
      const msg = document.createElement('div');
      msg.className = 'browser-empty';
      msg.textContent = this.activeLibId ? (this._editable ? 'Empty — use + buttons to add content.' : 'Empty library.') : 'Select a library.';
      main.appendChild(msg);
      if (this._editable && this.activeLibId) { const bar = this._addBar(this._doc, 0); bar.classList.add('always-visible'); main.appendChild(bar); }
      return;
    }
    this._renderNodes(main, this._doc);
    this._applySearch(document.getElementById('browser-search')?.value || '');
  },

  _renderNodes(container, nodes) {
    if (this._editable) container.appendChild(this._addBar(nodes, 0));
    for (let i = 0; i < nodes.length; i++) {
      container.appendChild(this._renderNode(nodes[i]));
      if (this._editable) container.appendChild(this._addBar(nodes, i + 1));
    }
  },

  _renderNode(node) {
    const el = document.createElement('div');
    el.className = 'doc-node doc-' + node.type;
    el.id = 'dn-' + node.id;
    if (node.type === 's') this._buildSection(el, node);
    else if (node.type === 't') this._buildText(el, node);
    else if (node.type === 'p') this._buildPos(el, node);
    if (this._editable) this._attachDrag(el, node);
    return el;
  },

  _buildSection(el, node) {
    const hdr = document.createElement('div');
    hdr.className = 'doc-sec-hdr';
    if (this._editable) { const h = this._el('span','drag-handle','⠿'); h.draggable = false; hdr.appendChild(h); }
    const btn = this._el('span', 'collapse-btn', node.collapsed ? '▸' : '▾');
    const ttl = this._el('span', 'sec-title', node.title);
    if (this._editable) {
      ttl.contentEditable = 'true';
      ttl.addEventListener('blur', () => { node.title = ttl.textContent.trim() || node.title; this._save(); });
      ttl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ttl.blur(); } });
    }
    hdr.appendChild(btn); hdr.appendChild(ttl);

    const linkBtn = document.createElement('button'); linkBtn.className = 'sec-link-btn'; linkBtn.textContent = '🔗'; linkBtn.title = 'Copy link to section';
    linkBtn.addEventListener('click', e => {
      e.stopPropagation();
      const url = location.origin + location.pathname + '#b/' + this.activeLibId + '/' + node.id;
      navigator.clipboard?.writeText(url);
      this._activeSec = node.id; this._renderNav();
      history.replaceState(null, '', '#b/' + this.activeLibId + '/' + node.id);
    });
    hdr.appendChild(linkBtn);

    if (this._editable) {
      const act = document.createElement('div'); act.className = 'sec-actions';
      act.appendChild(this._btn('+section', () => { node.children.push(Doc.section()); this._save(); this._renderDoc(); this._renderNav(); }));
      act.appendChild(this._btn('+text', () => { node.children.push(Doc.text()); this._save(); this._renderDoc(); }));
      act.appendChild(this._btn('+pos', () => { this.insertContext = { list: node.children, idx: node.children.length }; this._onOpen?.(null); }));
      const del = this._btn('✕', () => { if (!confirm('Delete section and contents?')) return; Doc.remove(this._doc, node.id); this._save(); this._renderDoc(); this._renderNav(); });
      del.style.marginLeft = 'auto';
      act.appendChild(del); hdr.appendChild(act);
    }
    el.appendChild(hdr);
    const body = document.createElement('div');
    body.className = 'doc-sec-body';
    body.hidden = !!node.collapsed;
    node.children = node.children || [];
    this._renderNodes(body, node.children);
    el.appendChild(body);
    const toggleCollapse = () => {
      node.collapsed = !node.collapsed; btn.textContent = node.collapsed ? '▸' : '▾'; body.hidden = !!node.collapsed;
      if (this._editable) this._save();
      this._renderNav();
    };
    btn.addEventListener('click', e => { e.stopPropagation(); toggleCollapse(); });
    hdr.addEventListener('click', e => {
      if (e.target.closest('.sec-actions') || e.target.closest('.drag-handle') || e.target.closest('.sec-link-btn')) return;
      if (e.target === ttl && ttl.isContentEditable) return;
      toggleCollapse();
    });
  },

  _buildText(el, node) {
    if (this._editable) { const h = this._el('span','drag-handle','⠿'); el.appendChild(h); }
    let monoActive = !!node.mono;
    const view = document.createElement('div'); view.className = 'md-body';
    view.innerHTML = Markdown.render(node.md || '') || '<span class="md-placeholder">Click to edit…</span>';
    const raw = document.createElement('pre'); raw.className = 'md-raw'; raw.hidden = true;
    raw.textContent = node.md || '';
    if (monoActive) { view.hidden = true; raw.hidden = false; }
    const monoBtn = document.createElement('button'); monoBtn.className = 'mono-toggle'; monoBtn.textContent = '{ }'; monoBtn.title = 'Toggle monospace view';
    monoBtn.classList.toggle('active', monoActive);
    monoBtn.addEventListener('click', e => {
      e.stopPropagation(); monoActive = !monoActive; node.mono = monoActive;
      monoBtn.classList.toggle('active', monoActive);
      view.hidden = monoActive; raw.hidden = !monoActive;
      raw.textContent = node.md || '';
      this._save();
    });
    el.appendChild(monoBtn); el.appendChild(view); el.appendChild(raw);
    if (this._editable) {
      const ta = document.createElement('textarea'); ta.className = 'doc-text-ta'; ta.value = node.md || ''; ta.hidden = true; ta.placeholder = 'Markdown…';
      const autosize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
      const openEdit = () => { view.hidden = true; raw.hidden = true; ta.hidden = false; autosize(); ta.focus({ preventScroll: true }); };
      view.addEventListener('click', openEdit);
      raw.addEventListener('click', openEdit);
      ta.addEventListener('input', autosize);
      ta.addEventListener('blur', () => {
        node.md = ta.value;
        view.innerHTML = Markdown.render(node.md) || '<span class="md-placeholder">Click to edit…</span>';
        raw.textContent = node.md;
        view.hidden = monoActive; raw.hidden = !monoActive; ta.hidden = true;
        this._save();
      });
      ta.addEventListener('keydown', e => { if (e.key === 'Escape') ta.blur(); });
      const del = this._btn('✕', () => { Doc.remove(this._doc, node.id); this._save(); this._renderDoc(); });
      del.className += ' node-del-btn';
      el.appendChild(ta); el.appendChild(del);
    }
  },

  _buildPos(el, node) {
    const grid = URLCodec.decode(node.board); if (!grid) return;
    if (this._editable) { const h = this._el('span','drag-handle','⠿'); el.appendChild(h); }
    el.tabIndex = 0;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { this._onOpen?.(node); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); this._focusNextCard(el, 1); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); this._focusNextCard(el, -1); }
    });
    const board = document.createElement('div'); board.className = 'card-board';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); board.appendChild(svg);
    const labels = (node.labels || []).map(l => Array.isArray(l) ? { q:l[0], r:l[1], mark:l[2] } : { ...l, mark: l.mark??l.letter??'a' });
    _BoardRenderer.build(svg, grid, labels, { w:220, h:180, margin:8, mini:true, hover:false });
    const meta = document.createElement('div'); meta.className = 'card-meta';
    if (node.title) meta.appendChild(this._el('div','card-title',node.title));
    if (node.note) meta.appendChild(this._el('div','card-note',node.note.split('\n')[0]));
    const { x, o } = HexGrid.countStones(grid);
    meta.appendChild(this._el('div', 'card-stats', `X ${x}  O ${o}  s${grid.s}`));
    if (this._editable) {
      const act = document.createElement('div'); act.className = 'card-actions';
      act.appendChild(this._btn('✕ delete', () => { if (!confirm(`Delete "${node.title||node.board}"?`)) return; Doc.remove(this._doc,node.id); this._save(); this._renderDoc(); }));
      meta.appendChild(act);
    }
    el.appendChild(board); el.appendChild(meta);
    board.addEventListener('click', () => this._onOpen?.(node));
  },

  _focusNextCard(current, dir) {
    const cards = [...document.querySelectorAll('.doc-p[tabindex="0"]')];
    const idx = cards.indexOf(current);
    const next = cards[idx + dir];
    if (next) next.focus({ preventScroll: false });
  },

  _applySearch(q) {
    const query = q.toLowerCase().trim();
    const btn = document.getElementById('btn-search-clear');
    if (btn) btn.hidden = !q;
    if (!query) {
      document.querySelectorAll('#browser-doc .doc-node').forEach(el => el.hidden = false);
      return;
    }
    const nodeMatches = node => {
      if (node.type === 't') return (node.md||'').toLowerCase().includes(query);
      if (node.type === 'p') return ((node.title||'') + ' ' + (node.note||'')).toLowerCase().includes(query);
      if (node.type === 's') return (node.title||'').toLowerCase().includes(query) || (node.children||[]).some(c => nodeMatches(c));
      return false;
    };
    const applyNode = (node, parentTitleMatch) => {
      const el = document.getElementById('dn-' + node.id);
      if (!el) return;
      if (node.type === 's') {
        const titleMatch = (node.title||'').toLowerCase().includes(query);
        const anyMatch = nodeMatches(node);
        el.hidden = !anyMatch;
        if (anyMatch) (node.children||[]).forEach(c => applyNode(c, titleMatch || parentTitleMatch));
      } else {
        el.hidden = parentTitleMatch ? false : !nodeMatches(node);
      }
    };
    this._doc.forEach(node => applyNode(node, false));
  },

  _addBar(list, insertIdx) {
    const bar = document.createElement('div'); bar.className = 'doc-add-bar';
    bar.appendChild(this._btn('+ section', () => { list.splice(insertIdx, 0, Doc.section()); this._save(); this._renderDoc(); this._renderNav(); }));
    bar.appendChild(this._btn('+ text', () => { list.splice(insertIdx, 0, Doc.text()); this._save(); this._renderDoc(); }));
    return bar;
  },

  _attachDrag(el, node) {
    const handle = el.querySelector('.drag-handle');
    if (handle) {
      handle.draggable = true;
      handle.addEventListener('dragstart', e => { e.stopPropagation(); e.dataTransfer.setData('text/plain', node.id); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => el.classList.add('dragging'), 0); });
    }
    el.addEventListener('dragend', () => el.classList.remove('dragging', 'drag-over'));
    el.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); });
    el.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      el.classList.remove('drag-over');
      const fromId = e.dataTransfer.getData('text/plain'); if (fromId === node.id) return;
      const before = e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2;
      Doc.move(this._doc, fromId, node.id, before);
      this._save(); this._renderDoc();
    });
  },

  _save() {
    if (this._store) this._store.saveDoc(this.activeLibId, this._doc);
  },

  _el(tag, cls, text) { const e = document.createElement(tag); e.className = cls; e.textContent = text; return e; },
  _btn(text, onClick) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = text;
    b.addEventListener('click', e => { e.stopPropagation(); onClick(); }); return b;
  },

  destroy() {
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { BrowserViewWidget };
