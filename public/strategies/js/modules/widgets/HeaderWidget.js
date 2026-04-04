const HeaderWidget = {
  styles: `
    .app-header { position:fixed; top:0; left:0; right:0; height:var(--header-h,44px); display:flex; align-items:center; gap:10px; padding:0 16px; background:var(--surface); border-bottom:1px solid var(--border); z-index:10; }
    .hdr-dim { color:var(--dim); font-size:10px; }
  `,

  _styleEl: null,

  mount(container) {
    const el = document.createElement('div');
    el.className = 'app-header';
    el.innerHTML = `
      <span class="title">Hexoboards</span>
      <span class="sep">—</span>
      <span class="hdr-dim" data-tip="Board size (2–32)">s</span>
      <button class="btn size-btn" id="btn-size-dec">-</button>
      <input type="number" id="input-size" value="5" min="2" max="32">
      <button class="btn size-btn" id="btn-size-inc">+</button>
      <button class="btn" id="btn-apply-size">↵</button>
      <span class="sep" style="margin-left:4px">—</span>
      <button class="btn" id="btn-undo" data-tip="Undo (Ctrl+Z)">↩ undo</button>
      <button class="btn" id="btn-clear">✕ clear</button>
      <button class="btn save" id="btn-save" data-tip="Save (Ctrl+S)">★ save</button>
      <div id="header-tab-slot"></div>
    `;
    container.appendChild(el);
    this._injectStyles();
  },

  _injectStyles() {
    if (this._styleEl) return;
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = this.styles;
    document.head.appendChild(this._styleEl);
  },

  destroy() {
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { HeaderWidget };
