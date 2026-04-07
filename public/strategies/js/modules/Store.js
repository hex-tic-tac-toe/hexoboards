/**
 * Store — persists libraries, position docs, and cached remote docs.
 *
 * Storage key registry (single source of truth — never hardcode these):
 *   hexoboards-libs   → library metadata
 *   hexoboards-docs   → local position documents
 *   hexoboards-match  → match tree (written by Match module)
 *   hexoboards-compact → browser compact-view preference
 */
import { Doc } from './Doc.js';

const Store = {
  LOCAL:       'local',
  DEFAULT_URL: '/strategies/data/default.json',

  // All localStorage keys in one place
  STORAGE_KEYS: {
    libs:    'hexoboards-libs',
    docs:    'hexoboards-docs',
    compact: 'hexoboards-compact',
    match:   'hexoboards-match',
    editor:  'hexoboards-editor',
  },

  libs:  {},
  docs:  {},
  cache: {},

  load() {
    Store._migrateKeys();
    const get = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
    Store.libs = get(Store.STORAGE_KEYS.libs);
    Store.docs = get(Store.STORAGE_KEYS.docs);
    if (!Store.libs[Store.LOCAL]) {
      Store.libs[Store.LOCAL] = { name: 'My Positions', active: true, local: true };
      Store._saveLibs();
    }
    if (!Store.docs[Store.LOCAL]) {
      Store.docs[Store.LOCAL] = { version: 1, doc: [] };
      Store._saveDocs();
    }
    Store._migratePositions();
  },

  // ── migrations ────────────────────────────────────────────────────────────

  /** Silently move old hexstrat-* keys to hexoboards-* on first run. */
  _migrateKeys() {
    const renames = [
      ['hexstrat-libs',     Store.STORAGE_KEYS.libs],
      ['hexstrat-docs',     Store.STORAGE_KEYS.docs],
      ['hexstrat-analyzer', Store.STORAGE_KEYS.match],
      ['hexstrat-compact',  Store.STORAGE_KEYS.compact],
    ];
    for (const [oldKey, newKey] of renames) {
      const raw = localStorage.getItem(oldKey);
      if (raw && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, raw);
      }
      if (raw) localStorage.removeItem(oldKey);
    }
  },

  /** Migrate legacy flat position format (hexstrat-local / hexstrat-order) into docs. */
  _migratePositions() {
    const raw = localStorage.getItem('hexstrat-local');
    if (!raw) return;
    try {
      const entries = JSON.parse(raw);
      const order   = JSON.parse(localStorage.getItem('hexstrat-order') || '[]');
      const keys    = [...new Set([...order, ...Object.keys(entries)])];
      for (const k of keys) {
        const e = entries[k]; if (!e?.board) continue;
        const labels = (e.l || []).map(l => Array.isArray(l) ? l : [l.q, l.r, l.letter || l.mark || 'a']);
        Store.docs[Store.LOCAL].doc.push(Doc.pos(e.board, e.t || '', e.n || '', labels, e.h || ''));
      }
      Store._saveDocs();
    } catch {}
    localStorage.removeItem('hexstrat-local');
    localStorage.removeItem('hexstrat-order');
  },

  // ── remote libraries ──────────────────────────────────────────────────────

  async fetchDefaults() {
    try {
      const data = await (await fetch(Store.DEFAULT_URL)).json();
      let changed = false;
      for (const lib of (data.libraries || [])) {
        if (!lib.url || !lib.name) continue;
        if (!Object.values(Store.libs).some(l => l.url === lib.url)) {
          Store.addLibrary(lib.name, lib.url, false);
          changed = true;
        }
      }
      if (changed) Store._saveLibs();
    } catch {}
  },

  async fetchLibrary(id) {
    const lib = Store.libs[id]; if (!lib?.url) return;
    try {
      const data = await (await fetch(lib.url)).json();
      Store.cache[id] = data.version === 1 && Array.isArray(data.doc)
        ? data
        : { version: 1, doc: Doc.fromV0(data.positions || {}) };
    } catch {}
  },

  async fetchAllActive() {
    await Promise.all(
      Object.entries(Store.libs)
        .filter(([, l]) => l.active && l.url)
        .map(([id]) => Store.fetchLibrary(id))
    );
  },

  // ── library management ────────────────────────────────────────────────────

  addLibrary(name, url, persist = true) {
    const id = 'lib_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    Store.libs[id] = { name, url, active: true };
    if (persist) Store._saveLibs();
    return id;
  },

  openAsWorkspace(libId) {
    const src = Store.cache[libId]; if (!src) return null;
    const id  = 'ws_' + Date.now().toString(36);
    Store.libs[id] = { name: `${Store.libs[libId]?.name || 'Remote'} (workspace)`, active: true, local: true };
    Store.docs[id] = JSON.parse(JSON.stringify(src));
    Store._saveLibs(); Store._saveDocs();
    return id;
  },

  removeLibrary(id) {
    if (id === Store.LOCAL) return;
    delete Store.libs[id]; delete Store.cache[id];
    if (Store.docs[id]) { delete Store.docs[id]; Store._saveDocs(); }
    Store._saveLibs();
  },

  renameLibrary(id, name) { if (Store.libs[id]) { Store.libs[id].name = name; Store._saveLibs(); } },
  toggleLibrary(id)       { if (Store.libs[id]) { Store.libs[id].active = !Store.libs[id].active; Store._saveLibs(); } },
  isLocal(id)             { return !!Store.libs[id]?.local; },

  getDoc(id)        { return (Store.isLocal(id) ? Store.docs : Store.cache)[id] || null; },
  saveDoc(id, tree) {
    if (!Store.isLocal(id)) return;
    if (!Store.docs[id]) Store.docs[id] = { version: 1, doc: [] };
    Store.docs[id].doc = tree;
    Store._saveDocs();
  },

  exportDoc(id) {
    const d = Store.getDoc(id); if (!d) return '{}';
    return JSON.stringify({ version: 1, doc: d.doc }, null, 2);
  },

  resetDoc(id) {
    if (!Store.isLocal(id)) return;
    Store.docs[id] = { version: 1, doc: [] };
    Store._saveDocs();
  },

  clearAll() {
    Object.values(Store.STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    // Also clean up any old keys that might remain
    ['hexstrat-libs','hexstrat-docs','hexstrat-local','hexstrat-order','hexstrat-analyzer','hexstrat-compact']
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  },

  _saveLibs() { localStorage.setItem(Store.STORAGE_KEYS.libs, JSON.stringify(Store.libs)); },
  _saveDocs()  { localStorage.setItem(Store.STORAGE_KEYS.docs, JSON.stringify(Store.docs)); },
};

export { Store };
