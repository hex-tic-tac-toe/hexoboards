import { HTN } from '../utils/HTN.js';

const HTNWidget = {
  styles: `
    .htn-panel { position:absolute; top:44px; left:0; right:0; bottom:28px; display:flex; flex-direction:column; }
    .htn-toolbar { display:flex; align-items:center; gap:8px; padding:8px 16px; background:var(--surface); border-bottom:1px solid var(--border); flex-shrink:0; }
    .htn-toolbar label { font-size:10px; color:var(--dim); }
    .htn-toolbar input[type="number"] { width:60px; }
    #htn-text { flex:1; background:var(--bg); border:none; color:var(--muted); font-family:var(--font); font-size:11px; padding:12px 16px; resize:none; outline:none; line-height:1.5; }
    #htn-text::placeholder { color:var(--dim); }
  `,

  _styleEl: null,
  _onLoadHtn: null,
  _onToast: null,

  mount(container) {
    const el = document.createElement('div');
    el.className = 'htn-panel';
    el.innerHTML = `
      <div class="htn-toolbar">
        <button class="btn" id="btn-htn-load">Load HTN</button>
        <label>turns</label>
        <input type="number" id="htn-turn" value="" min="1" placeholder="all">
      </div>
      <textarea id="htn-text" placeholder="paste HTN notation here…"></textarea>
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

  setLoadHtn(fn) { this._onLoadHtn = fn; },
  setToast(fn) { this._onToast = fn; },

  _toast(msg) {
    if (this._onToast) this._onToast(msg);
  },

  _bindEvents() {
    document.getElementById('btn-htn-load')?.addEventListener('click', () => this._loadHtn());
    document.getElementById('htn-text')?.addEventListener('keydown', e => {
      if ((e.ctrlKey||e.metaKey) && e.key==='Enter') this._loadHtn();
    });
  },

  _loadHtn() {
    const src = document.getElementById('htn-text')?.value.trim();
    if (!src) { this._toast('paste HTN first'); return; }
    const turn = parseInt(document.getElementById('htn-turn')?.value, 10) || Infinity;
    try {
      const { metadata, turns } = HTN.parse(src);
      const v = HTN.validate(turns);
      if (!v.ok) { this._toast(`invalid turn ${v.turn}: ${v.reason}`); return; }
      const grid = HTN.buildGrid(turns, turn);
      if (this._onLoadHtn) {
        this._onLoadHtn({ grid, metadata });
      }
      this._toast('loaded from HTN');
    } catch (err) { this._toast('parse error: ' + err.message); }
  },

  destroy() {
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { HTNWidget };
