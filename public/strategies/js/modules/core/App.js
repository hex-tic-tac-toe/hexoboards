import { EventBus } from './core/EventBus.js';
import { Channel } from './core/Channel.js';
import { Registry } from './core/Registry.js';
import { ShellWidget } from './widgets/ShellWidget.js';
import { EditorViewWidget } from './widgets/EditorViewWidget.js';
import { BrowserViewWidget } from './widgets/BrowserViewWidget.js';
import { DataViewWidget } from './widgets/DataViewWidget.js';
import { ConvertViewWidget } from './widgets/ConvertViewWidget.js';
import { HTNWidget } from './widgets/HTNWidget.js';
import { Store } from './services/Store.js';
import { URLCodec } from './utils/URLCodec.js';
import { Notation } from './utils/Notation.js';
import { HexGrid } from './utils/HexGrid.js';

const App = {
  shell: null,
  editor: null,
  browser: null,
  data: null,
  convert: null,
  htn: null,

  async init() {
    Store.load();
    App._initTheme();

    Registry.registerService('store', Store);
    Registry.registerService('notation', Notation);
    Registry.registerService('hexgrid', HexGrid);

    App.shell = ShellWidget;
    App.editor = EditorViewWidget;
    App.browser = BrowserViewWidget;
    App.data = DataViewWidget;
    App.convert = ConvertViewWidget;
    App.htn = HTNWidget;

    Registry.registerWidget('editor', App.editor);
    Registry.registerWidget('browser', App.browser);
    Registry.registerWidget('data', App.data);
    Registry.registerWidget('convert', App.convert);
    Registry.registerWidget('htn', App.htn);

    App.shell.mount(document.getElementById('app'));

    App.browser.setStore(Store);
    App.browser.setOpenHandler(node => {
      App.editor.loadNode(node || null);
      App.shell.showView('editor');
      App.editor._buildBoard();
    });

    App.data.setStore(Store);
    App.data.setToast(msg => App._toast(msg));
    App.data.setViewBrowser(id => {
      App.shell.showView('browser');
      App.browser.render(id);
    });

    App.convert.setEditorGridGetter(() => App.editor.grid);
    App.convert.setLoadGrid(grid => {
      if (!grid) { App._toast('parse error'); return; }
      App.editor.grid = grid;
      App.editor.labels = [];
      App.editor.history = [];
      App.editor.nodeId = null;
      document.getElementById('input-size').value = grid.s;
      App.editor._buildBoard();
      App.editor._syncFooter();
      App.editor._syncMode();
      App.shell.showView('editor');
      App._toast('loaded');
    });
    App.convert.setToast(msg => App._toast(msg));

    App.htn.setLoadHtn(({ grid, metadata }) => {
      App.editor.grid = grid;
      App.editor.history = [];
      App.editor.labels = [];
      App.editor.nodeId = null;
      App.editor.note = metadata.name ? `Game: ${metadata.name}` : '';
      App.editor.title = metadata.name || '';
      App.editor.noteOpen = App.editor.note.trim().length > 0;
      document.getElementById('input-size').value = grid.s;
      App.editor._syncPanels();
      App.editor._syncFooter();
      App.editor._syncMode();
    });
    App.htn.setToast(msg => App._toast(msg));

    App.shell.registerView('editor', 'editor', App.editor);
    App.shell.registerView('browser', 'browser', App.browser);
    App.shell.registerView('data', 'libraries', App.data);
    App.shell.registerView('convert', 'convert', App.convert);

    App._setupHeaderControls();

    Channel.connect('editor.save', 'store.save');
    Channel.connect('browser.open', 'editor.load');

    App._bindGlobalEvents();

    const hash = window.location.hash.slice(1);
    const boardNav = !hash.startsWith('b/') && hash !== 'd' && hash !== 'c' && hash;
    if (boardNav) {
      const decoded = URLCodec.decodeFull(boardNav);
      if (decoded) {
        App.editor.grid = decoded.grid;
        App.editor.labels = decoded.labels.map(l => ({ ...l, mark: l.mark ?? l.letter ?? 'a' }));
        document.getElementById('input-size').value = decoded.grid.s;
        App.editor.noteOpen = decoded.labels.length > 0;
      } else { App.editor.loadNode(null); }
    } else { App.editor.loadNode(null); }

    await Store.fetchDefaults();
    await Store.fetchAllActive();

    if (hash.startsWith('b/')) {
      const parts = hash.slice(2).split('/');
      const libId = parts[0] || Store.LOCAL;
      const secId = parts[1] || null;
      const validLib = Store.libs[libId] || Store.libs[Store.LOCAL];
      App.shell.showView('browser');
      App.browser.render(validLib ? libId : Store.LOCAL);
      if (secId) setTimeout(() => App.browser.scrollToSection(secId), 150);
    } else if (hash === 'd') {
      App.shell.showView('data');
      App.data.render();
    } else if (hash === 'c') {
      App.shell.showView('convert');
    } else {
      App.shell.showView('editor');
      App.editor._buildBoard();
    }

    App.browser._renderNav();
  },

  _setupHeaderControls() {
    const tabs = [
      { id: 'editor', label: 'Editor' },
      { id: 'browser', label: 'Browser' },
      { id: 'data', label: 'Libraries' },
      { id: 'convert', label: 'Convert' },
      { id: 'theme', label: '◑', isTheme: true },
    ];

    App.shell.setTabs(tabs, 'editor', id => {
      if (id === 'theme') { App._cycleTheme(); return; }
      if (id === 'editor') { App.editor._buildBoard(); }
      else if (id === 'browser') { App.browser.render(App.browser.activeLibId || Store.LOCAL); }
      else if (id === 'data') { App.data.render(); }
      App.shell.showView(id);
    });

    App.shell.setHeaderControls(`
      <span class="hdr-dim" data-tip="Board size (2–32)">s</span>
      <button class="btn size-btn" id="btn-size-dec">-</button>
      <input type="number" id="input-size" value="5" min="2" max="32">
      <button class="btn size-btn" id="btn-size-inc">+</button>
      <button class="btn" id="btn-apply-size">↵</button>
      <span class="sep" style="margin-left:4px">—</span>
      <button class="btn" id="btn-undo" data-tip="Undo (Ctrl+Z)">↩ undo</button>
      <button class="btn" id="btn-clear">✕ clear</button>
      <button class="btn save" id="btn-save" data-tip="Save (Ctrl+S)">★ save</button>
    `);

    const si = document.getElementById('input-size');
    if (si) {
      const applySize = () => {
        const s = parseInt(si.value, 10); if (s < 2 || s > 32) return;
        const prev = App.editor.grid;
        const next = HexGrid.create(s);
        const max = s - 1;
        const dist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
        if (prev) {
          for (const c of prev.cells.values())
            if (c.state && dist(c.q, c.r) <= max) HexGrid.setState(next, c.q, c.r, c.state);
          App.editor.labels = App.editor.labels.filter(l => dist(l.q, l.r) <= max);
        }
        App.editor.grid = next; App.editor.history = [];
        App.editor._buildBoard(); App.editor._syncFooter(); App.editor._syncMode();
      };
      document.getElementById('btn-apply-size')?.addEventListener('click', applySize);
      si.addEventListener('keydown', e => { if (e.key === 'Enter') applySize(); });
      document.getElementById('btn-size-dec')?.addEventListener('click', () => { si.value = Math.max(2, parseInt(si.value,10)-1); applySize(); });
      document.getElementById('btn-size-inc')?.addEventListener('click', () => { si.value = Math.min(32, parseInt(si.value,10)+1); applySize(); });
    }

    document.getElementById('btn-undo')?.addEventListener('click', () => App.editor.undo());
    document.getElementById('btn-clear')?.addEventListener('click', () => { if (confirm('Clear the board?')) App.editor.clear(); });
    document.getElementById('btn-save')?.addEventListener('click', () => App._save());
  },

  _bindGlobalEvents() {
    window.addEventListener('resize', () => {
      if (App.shell.getActiveView() === 'editor') App.editor._buildBoard();
    });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); App._save(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (App.shell.getActiveView() !== 'browser') {
          App.shell.showView('browser');
          App.browser.render(App.browser.activeLibId || Store.LOCAL);
        }
        setTimeout(() => { const s = document.getElementById('browser-search'); s?.focus(); s?.select(); }, 50);
      }
    });

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.slice(1);
      if (!h || (!h.startsWith('b/') && h !== 'd' && h !== 'c')) {
        const d = URLCodec.decodeFull(h); if (!d) return;
        App.editor.grid = d.grid; App.editor.labels = d.labels; App.editor.history = []; App.editor.nodeId = null;
        document.getElementById('input-size').value = d.grid.s;
        App.editor.noteOpen = d.labels.length > 0;
        App.editor._syncPanels(); App.editor._buildBoard(); App.editor._syncFooter(); App.editor._syncMode();
      }
    });
  },

  _save() {
    App.editor.note = document.getElementById('note-text')?.value ?? App.editor.note;
    App.editor.title = document.getElementById('title-text')?.value ?? App.editor.title;
    const libId = (App.browser.activeLibId && Store.isLocal(App.browser.activeLibId)) ? App.browser.activeLibId : Store.LOCAL;
    const docObj = Store.getDoc(libId);
    const tree = docObj?.doc || [];
    const board = URLCodec.encode(App.editor.grid);
    const labels = App.editor.labels.map(l => [l.q, l.r, l.mark]);
    if (App.editor.nodeId) {
      const found = Doc.find(tree, App.editor.nodeId);
      if (found) {
        Object.assign(found[0], { board, title: App.editor.title, note: App.editor.note, labels, htn: found[0].htn || '' });
        Store.saveDoc(libId, tree); App.editor._syncMode(); App.editor._setDirty(false);
        if (App.shell.getActiveView() === 'browser') App.browser.render(libId);
        App._toast('updated'); return;
      }
    }
    const node = Doc.pos(board, App.editor.title, App.editor.note, labels);
    App.editor.nodeId = node.id;
    if (App.browser.insertContext) {
      const { list, idx } = App.browser.insertContext; list.splice(idx, 0, node); App.browser.insertContext = null;
    } else { tree.push(node); }
    Store.saveDoc(libId, tree); App.editor._syncMode(); App.editor._setDirty(false);
    if (App.shell.getActiveView() === 'browser') App.browser.render(libId);
    App._toast('saved');
  },

  _initTheme() {
    const saved = localStorage.getItem('hexstrat-theme') || 'system';
    App._applyTheme(saved);
  },

  _cycleTheme() {
    const current = localStorage.getItem('hexstrat-theme') || 'system';
    const next = { dark: 'light', light: 'system', system: 'dark' }[current] || 'dark';
    localStorage.setItem('hexstrat-theme', next);
    App._applyTheme(next);
  },

  _applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('light', !useDark);
    const icons = { dark: '☾', light: '☀', system: '◑' };
    document.querySelectorAll('.btn-theme').forEach(b => b.textContent = icons[theme] || '◑');
    if (App.shell.getActiveView() === 'editor' && App.editor.grid) App.editor._buildBoard();
    else if (App.shell.getActiveView() === 'browser' && App.browser.activeLibId) App.browser.render(App.browser.activeLibId, true);
  },

  _toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  },
};

import { Doc } from './utils/Doc.js';

export { App };
