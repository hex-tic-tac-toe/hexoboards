const ShellWidget = {
  styles: `
    .app-shell { position:fixed; inset:0; display:flex; flex-direction:column; }
    .app-header { display:flex; align-items:center; gap:10px; padding:0 16px; background:var(--surface); border-bottom:1px solid var(--border); flex-shrink:0; height:44px; }
    .app-header .title { font-size:13px; font-weight:bold; letter-spacing:.16em; color:var(--accent); }
    .app-header .sep { color:var(--border-hi); }
    .app-header .view-label { color:var(--muted); font-size:10px; }
    .app-header .hdr-controls { display:flex; align-items:center; gap:6px; margin-left:8px; flex:1; }
    .tab-strip { margin-left:auto; display:flex; gap:4px; flex-shrink:0; }
    .tab-strip .btn { padding:5px 10px; }
    .tab-strip .btn.active { border-color:var(--accent-dim); color:var(--accent); background:rgba(140,140,140,.07); }
    .app-body { flex:1; position:relative; overflow:hidden; }
    .app-view { position:absolute; inset:0; }
    .app-view[hidden] { display:none; }
    .btn-theme { padding:5px 9px; font-size:13px; border:none; }
    .size-btn { padding:5px 8px; }
    .hdr-dim { color:var(--dim); font-size:10px; }
  `,

  _styleEl: null,
  _views: {},
  _activeView: null,
  _viewContainer: null,

  mount(container) {
    const el = document.createElement('div');
    el.className = 'app-shell';
    el.innerHTML = `
      <div class="app-header">
        <span class="title">Hexoboards</span>
        <span class="sep">—</span>
        <span class="view-label" id="shell-view-label"></span>
        <div class="hdr-controls" id="shell-hdr-controls"></div>
        <nav class="tab-strip" id="shell-tabs"></nav>
      </div>
      <div class="app-body" id="shell-body"></div>
    `;
    container.appendChild(el);
    this._viewContainer = el.querySelector('#shell-body');
    this._injectStyles();
  },

  _injectStyles() {
    if (this._styleEl) return;
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = this.styles;
    document.head.appendChild(this._styleEl);
  },

  registerView(id, label, widget) {
    const viewEl = document.createElement('div');
    viewEl.className = 'app-view';
    viewEl.id = 'view-' + id;
    viewEl.hidden = true;
    this._viewContainer.appendChild(viewEl);
    widget.mount(viewEl);
    this._views[id] = { el: viewEl, label, widget };
  },

  setHeaderControls(html) {
    const ctrl = document.getElementById('shell-hdr-controls');
    if (ctrl) ctrl.innerHTML = html;
  },

  setTabs(tabs, activeId, onTabClick) {
    const strip = document.getElementById('shell-tabs');
    strip.innerHTML = '';
    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (tab.id === activeId ? ' active' : '');
      btn.textContent = tab.label;
      btn.dataset.tab = tab.id;
      if (tab.isTheme) btn.classList.add('btn-theme');
      btn.addEventListener('click', () => onTabClick(tab.id));
      strip.appendChild(btn);
    }
  },

  showView(id) {
    for (const [vid, v] of Object.entries(this._views)) {
      v.el.hidden = vid !== id;
    }
    const view = this._views[id];
    if (view) {
      this._activeView = id;
      document.getElementById('shell-view-label').textContent = view.label;
      for (const btn of document.querySelectorAll('#shell-tabs .btn')) {
        btn.classList.toggle('active', btn.dataset.tab === id);
      }
    }
  },

  getActiveView() {
    return this._activeView;
  },

  destroy() {
    for (const v of Object.values(this._views)) {
      v.widget.destroy?.();
    }
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { ShellWidget };
