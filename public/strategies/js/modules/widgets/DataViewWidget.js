const DataViewWidget = {
  styles: `
    .data-body { position:absolute; top:44px; left:0; right:0; bottom:0; display:flex; flex-direction:column; overflow:hidden; }
    .lib-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .lib-panel-head { padding:8px 16px; font-size:10px; color:var(--muted); letter-spacing:.12em; text-transform:uppercase; border-bottom:1px solid var(--border); flex-shrink:0; }
    #lib-mgmt-list { flex:1; overflow-y:auto; }
    .lib-mgmt-row { display:flex; align-items:center; gap:8px; padding:8px 16px; border-bottom:1px solid var(--border); font-size:11px; }
    .lib-toggle-btn { background:transparent; border:none; font-size:14px; cursor:pointer; color:var(--dim); padding:0 2px; line-height:1; }
    .lib-toggle-btn:hover { color:var(--muted); }
    .lib-toggle-btn.active { color:var(--accent); }
    .lib-mgmt-name { color:var(--text); flex-shrink:0; min-width:100px; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border-bottom:1px solid transparent; }
    .lib-mgmt-name[contenteditable="true"]:hover { border-bottom-color:var(--border); cursor:text; }
    .lib-mgmt-name[contenteditable="true"]:focus { outline:none; border-bottom-color:var(--accent-dim); }
    .lib-mgmt-url { flex:1; color:var(--dim); font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lib-mgmt-count { color:var(--dim); font-size:10px; flex-shrink:0; letter-spacing:.06em; }
    .lib-mgmt-actions { display:flex; gap:4px; flex-shrink:0; margin-left:auto; }
    .lib-mgmt-actions .btn { padding:3px 8px; font-size:9px; }
    .lib-add-row { display:flex; gap:6px; padding:10px 16px; border-top:1px solid var(--border); flex-shrink:0; }
    .lib-add-row input[type="text"] { font-size:11px; }
    #lib-add-name { width:110px; flex-shrink:0; }
    #lib-add-url { flex:1; }
    #lib-mgmt-footer { padding:8px 16px; border-top:1px solid var(--border); flex-shrink:0; }
    #lib-mgmt-footer .btn { color:var(--dim); border-color:transparent; font-size:9px; }
    #lib-mgmt-footer .btn:hover { color:var(--text); border-color:var(--border); }
  `,

  _styleEl: null,
  _store: null,
  _container: null,
  _onToast: null,
  _onViewBrowser: null,

  mount(container) {
    this._container = container;
    const el = document.createElement('div');
    el.className = 'data-body';
    el.innerHTML = `
      <div class="lib-panel">
        <div class="lib-panel-head">Saved libraries</div>
        <div id="lib-mgmt-list"></div>
        <div id="lib-mgmt-footer"></div>
        <div class="lib-add-row">
          <input type="text" id="lib-add-name" placeholder="name">
          <input type="text" id="lib-add-url" placeholder="pastebin raw · github raw · any JSON url">
          <button class="btn" id="btn-lib-add">+ add</button>
        </div>
      </div>
    `;
    container.appendChild(el);
    this._injectStyles();
    this._bindEvents();
  },

  _injectStyles() {
    if (this._styleEl) return;
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = this.styles;
    document.head.appendChild(this._styleEl);
  },

  setStore(store) { this._store = store; },
  setToast(fn) { this._onToast = fn; },
  setViewBrowser(fn) { this._onViewBrowser = fn; },

  _bindEvents() {
    document.getElementById('btn-lib-add')?.addEventListener('click', async () => {
      if (!this._store) return;
      const name = document.getElementById('lib-add-name').value.trim();
      const url = document.getElementById('lib-add-url').value.trim();
      if (!name || !url) { this._toast('name and URL required'); return; }
      const id = this._store.addLibrary(name, url);
      document.getElementById('lib-add-name').value = '';
      document.getElementById('lib-add-url').value = '';
      this._toast('loading…');
      await this._store.fetchLibrary(id);
      this.render();
      this._toast('library added');
    });
    document.getElementById('lib-add-url')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-lib-add')?.click();
    });
  },

  _toast(msg) {
    if (this._onToast) this._onToast(msg);
    else {
      const el = document.getElementById('toast');
      if (el) { el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
    }
  },

  render() {
    if (!this._store) return;
    const list = document.getElementById('lib-mgmt-list');
    if (list) list.innerHTML = '';
    this._renderFooter();
    const entries = [[this._store.LOCAL, this._store.libs[this._store.LOCAL]], ...Object.entries(this._store.libs).filter(([id]) => id !== this._store.LOCAL)];
    for (const [id, lib] of entries) {
      if (!lib) continue;
      if (list) list.appendChild(this._row(id, lib));
    }
  },

  _row(id, lib) {
    const isLocal = this._store.isLocal(id);
    const row = document.createElement('div'); row.className = 'lib-mgmt-row';

    if (!isLocal) {
      const tog = document.createElement('button');
      tog.className = 'lib-toggle-btn' + (lib.active ? ' active' : '');
      tog.textContent = lib.active ? '●' : '○'; tog.title = lib.active ? 'Disable' : 'Enable';
      tog.addEventListener('click', () => { this._store.toggleLibrary(id); this.render(); });
      row.appendChild(tog);
    }

    const name = document.createElement('div'); name.className = 'lib-mgmt-name'; name.textContent = lib.name;
    if (!isLocal) {
      name.contentEditable = 'true';
      name.addEventListener('blur', () => this._store.renameLibrary(id, name.textContent.trim() || lib.name));
      name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
    }
    row.appendChild(name);

    if (lib.url) { const u = document.createElement('div'); u.className = 'lib-mgmt-url'; u.textContent = lib.url; u.title = lib.url; row.appendChild(u); }

    const cnt = this._countPos((isLocal ? this._store.docs[id] : this._store.cache[id])?.doc || []);
    const c = document.createElement('span'); c.className = 'lib-mgmt-count'; c.textContent = cnt + ' pos'; row.appendChild(c);

    const act = document.createElement('div'); act.className = 'lib-mgmt-actions';
    if (isLocal) {
      this._addBtn(act, '⬇ export', () => {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([this._store.exportDoc(id)], { type: 'application/json' })), download: lib.name.replace(/\s+/g,'_') + '.json' });
        a.click(); URL.revokeObjectURL(a.href);
      });
      this._addBtn(act, '⎘ copy', () => { navigator.clipboard?.writeText(this._store.exportDoc(id)).then(() => this._toast('copied')); });
      if (id === this._store.LOCAL) {
        this._addBtn(act, '↺ reset', () => {
          if (!confirm('Reset "My Positions" — delete all saved positions?')) return;
          this._store.resetDoc(id); this.render();
          if (this._onViewBrowser) this._onViewBrowser(id);
          this._toast('reset');
        });
      } else {
        this._addBtn(act, '✕', () => {
          if (!confirm(`Delete workspace "${lib.name}"?`)) return;
          this._store.removeLibrary(id); this.render();
          if (this._onViewBrowser) this._onViewBrowser(this._store.LOCAL);
          this._toast('deleted');
        });
      }
    } else {
      this._addBtn(act, '↺ reload', async () => { await this._store.fetchLibrary(id); this.render(); this._toast('reloaded'); });
      this._addBtn(act, '⎘ workspace', () => { const wsId = this._store.openAsWorkspace(id); this.render(); if (this._onViewBrowser) this._onViewBrowser(wsId); this._toast('opened as workspace'); });
      this._addBtn(act, '✕', () => { if (!confirm(`Remove "${lib.name}"?`)) return; this._store.removeLibrary(id); this.render(); if (this._onViewBrowser) this._onViewBrowser(this._store.LOCAL); });
    }
    row.appendChild(act);
    return row;
  },

  _renderFooter() {
    const foot = document.getElementById('lib-mgmt-footer');
    if (!foot) return;
    foot.innerHTML = '';
    this._addBtn(foot, '✕ clear all browser data', () => {
      if (!confirm('Delete all data stored by this page (libraries, positions, settings) and reload?')) return;
      this._store.clearAll();
    });
  },

  _countPos(nodes) {
    let n = 0;
    for (const node of nodes) { if (node.type === 'p') n++; if (node.children) n += this._countPos(node.children); }
    return n;
  },

  _addBtn(parent, text, onClick) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = text;
    b.addEventListener('click', onClick); parent.appendChild(b);
  },

  destroy() {
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { DataViewWidget };
