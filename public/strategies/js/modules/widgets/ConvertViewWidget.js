import { Notation } from '../utils/Notation.js';

const ConvertViewWidget = {
  styles: `
    .cv-body { position:absolute; top:44px; left:0; right:0; bottom:0; display:flex; overflow:hidden; }
    .cv-side { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .cv-hdr { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid var(--border); border-right:1px solid var(--border); flex-shrink:0; background:var(--surface); }
    .cv-side:last-child .cv-hdr { border-right:none; }
    .cv-lbl { font-size:10px; color:var(--dim); letter-spacing:.06em; }
    .cv-batch { font-size:10px; color:var(--muted); display:flex; align-items:center; gap:4px; margin-left:8px; }
    .conv-select { background:var(--bg); border:1px solid var(--border); color:var(--text); font-family:var(--font); font-size:10px; padding:2px 4px; outline:none; cursor:pointer; }
    .conv-select:focus { border-color:var(--accent-dim); }
    #conv-input  { flex:1; background:var(--bg); border:none; border-right:1px solid var(--border); color:var(--muted); font-family:var(--font); font-size:11px; padding:12px 14px; resize:none; outline:none; line-height:1.6; }
    #conv-output { flex:1; background:var(--bg); border:none; color:var(--dim); font-family:var(--font); font-size:11px; padding:12px 14px; resize:none; outline:none; line-height:1.6; }
    .cv-mid { display:flex; align-items:center; justify-content:center; padding:0 10px; border-right:1px solid var(--border); flex-shrink:0; background:var(--surface); }
  `,

  _styleEl: null,
  _container: null,
  _getEditorGrid: null,
  _onLoadGrid: null,
  _onToast: null,

  mount(container) {
    this._container = container;
    const el = document.createElement('div');
    el.className = 'cv-body';
    el.innerHTML = `
      <div class="cv-side">
        <div class="cv-hdr">
          <label class="cv-lbl">from</label>
          <select id="conv-from" class="conv-select"><option value="htn">HTN</option><option value="bke">BKE</option><option value="axial">Axial</option></select>
          <button class="btn" id="btn-conv-from-editor">← editor</button>
          <label class="cv-batch"><input type="checkbox" id="conv-batch"> batch<span class="tip" style="display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border:1px solid var(--dim);border-radius:50%;color:var(--dim);font-size:9px;cursor:help;">?</span></label>
        </div>
        <textarea id="conv-input" placeholder="paste notation here…"></textarea>
      </div>
      <div class="cv-mid"><button class="btn" id="btn-convert">→</button></div>
      <div class="cv-side">
        <div class="cv-hdr">
          <label class="cv-lbl">to</label>
          <select id="conv-to" class="conv-select"><option value="bke">BKE</option><option value="axial">Axial</option><option value="htn">HTN</option></select>
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="btn" id="btn-conv-copy">⎘ copy</button>
            <button class="btn" id="btn-conv-load">↑ editor</button>
          </div>
        </div>
        <textarea id="conv-output" readonly placeholder="result…"></textarea>
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

  setEditorGridGetter(fn) { this._getEditorGrid = fn; },
  setLoadGrid(fn) { this._onLoadGrid = fn; },
  setToast(fn) { this._onToast = fn; },

  _toast(msg) {
    if (this._onToast) this._onToast(msg);
    else {
      const el = document.getElementById('toast');
      if (el) { el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
    }
  },

  _bindEvents() {
    document.getElementById('btn-convert')?.addEventListener('click', () => {
      const fromFmt = document.getElementById('conv-from').value;
      const toFmt = document.getElementById('conv-to').value;
      const batch = document.getElementById('conv-batch').checked;
      const input = document.getElementById('conv-input').value.trim();
      const entries = batch ? Notation.parseMulti(input) : [input];
      const results = Notation.convertBatch(entries, fromFmt, toFmt);
      document.getElementById('conv-output').value = batch ? JSON.stringify(results, null, 2) : (results[0] || '(parse error)');
    });

    document.getElementById('btn-conv-copy')?.addEventListener('click', () => {
      const text = document.getElementById('conv-output').value;
      if (!text) { this._toast('nothing to copy'); return; }
      navigator.clipboard?.writeText(text).then(() => this._toast('copied'));
    });

    document.getElementById('btn-conv-load')?.addEventListener('click', () => {
      const fmt = document.getElementById('conv-to').value;
      const grid = Notation.gridFromFmt(document.getElementById('conv-output').value.trim(), fmt);
      if (this._onLoadGrid) this._onLoadGrid(grid);
      else this._toast('no editor handler');
    });

    document.getElementById('btn-conv-from-editor')?.addEventListener('click', () => {
      if (!this._getEditorGrid) { this._toast('no editor grid available'); return; }
      const fmt = document.getElementById('conv-from').value;
      const grid = this._getEditorGrid();
      if (!grid) { this._toast('editor board is empty'); return; }
      document.getElementById('conv-input').value = Notation.gridToFmt(grid, fmt);
    });
  },

  destroy() {
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
  },
};

export { ConvertViewWidget };
