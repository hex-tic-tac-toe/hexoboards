/**
 * App — central initialisation and event wiring.
 *
 * Hash routing:
 *   (empty / board code)   → Editor
 *   #m  (legacy #a)        → Match
 *   #b/<libId>/<secId>     → Browser
 *   #d                     → Libraries
 *   #c                     → Convert
 *   #remote/cf/ID/tab      → fetch from Hexoboards Cloud and reconstruct
 *   #remote/gist/ID/tab    → fetch from GitHub Gist and reconstruct
 *   #remote/jsonbin/ID/tab → fetch from legacy JSONBin.io and reconstruct
 */

import { HexGrid }    from './HexGrid.js';
import { Store }      from './Store.js';
import { Doc }        from './Doc.js';
import { Editor }     from './Editor.js';
import { Match, MatchNode } from './Match.js';
import { Browser }    from './Browser.js';
import { LibManager } from './LibManager.js';
import { URLCodec }   from './URLCodec.js';
import { Notation }   from './Notation.js';
import { Source }     from './Source.js';
import { Share }      from './Share.js';
import { UI }         from './UI.js';
import { Layout }     from './Layout.js';


const App = {

  async init() {
    Store.load();
    App._initTheme();

    // Build dynamic tab strips
    UI.init({
      editor:  () => UI.showEditor(()  => Editor._buildBoard()),
      match:   () => UI.showMatch(() => {
        if (!Match._boardActive) Match._showStartModal();
        Match._buildBoard();
      }),
      browser: () => UI.showBrowser(() => Browser.render(Browser.activeLibId || Store.LOCAL)),
      data:    () => UI.showData(()    => LibManager.render()),
      convert: () => UI.showConvert(() => {}),
    });

    // Format selects from Notation.FORMATS registry
    App._initFormatSelects();

    Browser.init(
      // open in editor
      node => { Editor.loadNode(node || null); UI.showEditor(() => Editor._buildBoard()); },
      // open in match (entry with hextic notation)
      node => {
        const notation = node.notation || node.htn;
        if (!notation) return;
        Match.title      = node.title || '';
        Match.note       = node.note  || '';
        Match.createdAt  = node.createdAt || 0;
        Match._libNodeId = node.id;
        if (Match.fromHextic(notation)) {
          UI.showMatch(() => { Match._renderPlayPanel(); Match._renderNotePanel(); Match._renderTree(); Match._buildBoard(); });
        } else { App._toast('could not load match'); }
      }
    );
    LibManager.init(App._toast);

    Editor.init();
    Editor.onBoardSync = App._updateNotationPanel;
    Editor.bindPointer();

    // Match → Editor bridge
    Match.onExtract = grid => {
      Editor.loadGrid(grid);
      UI.showEditor(() => Editor._buildBoard());
      App._toast('selection → editor');
    };

    // Match → Library save
    Match._onSaveToLibrary = () => App._matchSaveToLibrary();

    // Resolve startup hash
    const hash = window.location.hash.slice(1);
    let _shareTab = null;

    Match._load();
    Match.init();

    const shareMatch = location.pathname.match(/^\/share\/(editor|match|library)\/([A-Za-z0-9_-]+)\/?$/);
    if (shareMatch) {
      _shareTab = shareMatch[1];
      localStorage.removeItem(Store._K.editor);
      const tab = _shareTab;
      const id = shareMatch[2];
      App._toast('loading…');
      try {
        const text = await Share.fetchRemote('cf', id);
        App._loadImportedData(tab, JSON.parse(text));
        history.replaceState(null, '', location.pathname);
      } catch (e) { App._toast('failed: ' + e.message); }
    } else if (hash.startsWith('remote/')) {
      try {
        await App._handleRemoteHash(hash);
        history.replaceState(null, '', location.pathname);
      } catch (e) { App._toast('failed: ' + e.message); }
    }

    // Board hash or empty → restore from localStorage or URL
    const isBoardHash = hash && !hash.startsWith('b/') && !hash.startsWith('remote/')
      && hash !== 'd' && hash !== 'c' && hash !== 'm' && hash !== 'a';
    if (isBoardHash) {
      const decoded = URLCodec.decodeFull(hash);
      if (decoded) {
        Editor.grid   = decoded.grid;
        Editor.labels = decoded.labels.map(l => ({ ...l, mark: l.mark ?? l.letter ?? 'a' }));
        document.getElementById('input-size').value = decoded.grid.s;
        Editor.noteOpen = decoded.labels.length > 0;
        Editor._syncPanels();
        Editor._syncMode();
      } else { Editor.loadNode(null); }
    } else if (!Editor._loadState()) {
      // No URL board, no saved state → fresh board
      Editor.loadNode(null);
    } else {
      // State loaded; sync UI panels
      Editor._syncPanels();
      Editor._syncFooter();
      Editor._syncMode();
    }

    App._bindEvents();
    App._bindResizeHandles();
    App._initTooltips();
    App._initCompact();

    await Store.fetchDefaults();
    await Store.fetchAllActive();
    Browser._renderNav();

    // Route to view
    if (_shareTab) {
      if (_shareTab === 'editor') UI.showEditor(() => Editor._buildBoard());
      else if (_shareTab === 'match') UI.showMatch(() => { if (!Match._boardActive) Match._showStartModal(); Match._buildBoard(); });
      else if (_shareTab === 'library') UI.showBrowser(() => Browser.render(Store.LOCAL));
    } else if (hash.startsWith('b/')) {
      const parts = hash.slice(2).split('/');
      const libId = parts[0] || Store.LOCAL;
      const secId = parts[1] || null;
      UI.showBrowser(() => {
        Browser.render(Store.libs[libId] ? libId : Store.LOCAL, true);
        if (secId) setTimeout(() => Browser.scrollToSection(secId), 150);
      });
    } else if (hash === 'd') { UI.showData(() => LibManager.render()); }
    else if (hash === 'c')   { UI.showConvert(() => {}); }
    else if (hash === 'm' || hash === 'a') { UI.showMatch(() => {
      if (!Match._boardActive) Match._showStartModal();
      Match._buildBoard();
    }); }
    else { UI.showEditor(() => Editor._buildBoard()); }
  },

  // ── remote hash: fetch from paste service and reconstruct ──────────────────

  async _handleRemoteHash(hash) {
    const remote = Share.parseRemoteHash(hash);
    if (!remote) { App._toast('invalid link'); return; }
    App._toast('loading…');
    try {
      const text = await Share.fetchRemote(remote.service, remote.id);
      App._loadImportedData(remote.tab, JSON.parse(text));
    } catch (e) { App._toast('failed: ' + e.message); }
  },

  /** Load fetched data into the appropriate tab. Used by remote hash and share modal import. */
  _loadImportedData(tab, data) {
    if (tab === 'library' && data.type === 'hexoboards-library') {
      Store.saveDoc(Store.LOCAL, data.doc || []);
      UI.showBrowser(() => Browser.render(Store.LOCAL));
      App._toast('library loaded');
    } else if (tab === 'editor' && (data.type === 'hexoboards-board' || data.board)) {
      const grid = URLCodec.decode(data.board);
      if (grid) {
        Editor.loadGrid(grid);
        if (data.labels) {
          Editor.labels = data.labels.map(l => ({ q: l[0], r: l[1], mark: l[2] }));
          Editor.noteOpen = Editor.labels.length > 0;
        }
        if (data.title) Editor.title = data.title;
        if (data.note) Editor.note = data.note;
        Editor._syncPanels();
        UI.showEditor(() => Editor._buildBoard());
        App._toast('board loaded');
      }
    } else if (tab === 'match') {
      let loaded = false;
      // Compact format (hextic notation wrapped in JSON)
      if ((data.type === 'hexoboards-match-compact' || data.notation) && data.notation) {
        Match.title   = data.title || '';
        Match.note    = data.note  || '';
        loaded = Match.fromHextic(data.notation);
      }
      // Legacy full-tree format
      if (!loaded && data.type === 'hexoboards-match' && data.tree) {
        MatchNode.resetId();
        Match.tree        = Match._deserialize(data.tree);
        MatchNode.syncId(Match.tree);
        Match.currentNode = Match.tree;
        Match._collapsedChildren.clear();
        Match._boardActive = true;
        Match._save();
        loaded = true;
      }
      if (loaded) {
        UI.showMatch(() => { Match._renderPlayPanel(); Match._renderNotePanel(); Match._renderTree(); Match._buildBoard(); });
        App._toast('match loaded');
      } else { App._toast('unrecognised format'); }
    } else { App._toast('unrecognised format'); }
  },

  /** Load an imported library. */
  _loadImportedLibrary(data) {
    if (data.type === 'hexoboards-library' && Array.isArray(data.doc)) {
      Store.saveDoc(Store.LOCAL, data.doc);
      UI.showBrowser(() => Browser.render(Store.LOCAL));
      App._toast('library imported');
    } else { App._toast('unrecognised library format'); }
  },

  // ── notation panel ────────────────────────────────────────────────────────

  _updateNotationPanel(grid) {
    if (!grid || !Editor.notationOpen) return;
    for (const [id, fmt] of Object.entries(Notation.FORMATS)) {
      const el = document.getElementById('nf-' + id);
      if (el) el.value = fmt.encode(grid);
    }
  },

  // ── import pipeline ───────────────────────────────────────────────────────

  _importSingle(grid) {
    if (!grid) { App._toast('parse error'); return; }
    Editor.loadGrid(grid);
    UI.showEditor(() => Editor._buildBoard());
    App._toast('loaded');
  },


  // ── save ──────────────────────────────────────────────────────────────────

  /** Save the current match as a Doc.match() entry in the active library. */
  _matchSaveToLibrary() {
    const libId  = (Browser.activeLibId && Store.isLocal(Browser.activeLibId))
      ? Browser.activeLibId : Store.LOCAL;
    const docObj = Store.getDoc(libId);
    const tree   = docObj?.doc || [];
    const notation = Match.toHextic();

    if (Match._libNodeId) {
      const found = Doc.find(tree, Match._libNodeId);
      if (found) {
        Object.assign(found[0], {
          notation, title: Match.title, note: Match.note, savedAt: Date.now(),
        });
        Store.saveDoc(libId, tree);
        if (UI.activeView === 'browser') Browser.render(libId);
        App._toast('match updated');
        return;
      }
    }
    // Create new entry using Doc.match type
    const node       = Doc.match(notation, Match.title, Match.note, Match.createdAt || Date.now());
    Match._libNodeId  = node.id;
    tree.push(node);
    Store.saveDoc(libId, tree);
    Match._save();
    if (UI.activeView === 'browser') Browser.render(libId);
    App._toast('match saved');
  },

  _save() {
    Editor.note  = document.getElementById('note-text').value;
    Editor.title = document.getElementById('title-text').value;
    const libId  = (Browser.activeLibId && Store.isLocal(Browser.activeLibId)) ? Browser.activeLibId : Store.LOCAL;
    const docObj = Store.getDoc(libId);
    const tree   = docObj?.doc || [];
    const board  = URLCodec.encode(Editor.grid);
    const labels = Editor.labels.map(l => [l.q, l.r, l.mark]);

    if (Editor.nodeId) {
      const found = Doc.find(tree, Editor.nodeId);
      if (found) {
        Object.assign(found[0], { board, title: Editor.title, note: Editor.note, labels, htn: found[0].htn || '' });
        Store.saveDoc(libId, tree); Editor._syncMode(); Editor._setDirty(false);
        if (UI.activeView === 'browser') Browser.render(libId);
        App._toast('updated'); return;
      }
    }
    const node    = Doc.pos(board, Editor.title, Editor.note, labels);
    Editor.nodeId = node.id;
    if (Browser.insertContext) {
      const { list, idx } = Browser.insertContext; list.splice(idx, 0, node); Browser.insertContext = null;
    } else { tree.push(node); }
    Store.saveDoc(libId, tree); Editor._syncMode(); Editor._setDirty(false);
    if (UI.activeView === 'browser') Browser.render(libId);
    App._toast('saved');
  },

  // ── format selects ────────────────────────────────────────────────────────

  _initFormatSelects() {
    const fromSel = document.getElementById('conv-from');
    const toSel   = document.getElementById('conv-to');
    for (const [id, { label }] of Object.entries(Notation.FORMATS)) {
      fromSel.appendChild(Object.assign(document.createElement('option'), { value: id, textContent: label }));
      toSel.appendChild(  Object.assign(document.createElement('option'), { value: id, textContent: label }));
    }
    fromSel.value = 'htn'; toSel.value = 'bke';
  },

  // ── event binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    // Size controls
    const si = document.getElementById('input-size');
    const applySize = () => {
      const s = parseInt(si.value, 10); if (s < 2 || s > 32) return;
      const prev = Editor.grid, next = HexGrid.create(s), max = s - 1;
      const dist = (q, r) => (Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2;
      if (prev) {
        for (const c of prev.cells.values()) if (c.state && dist(c.q,c.r)<=max) HexGrid.setState(next,c.q,c.r,c.state);
        Editor.labels = Editor.labels.filter(l => dist(l.q,l.r)<=max);
      }
      Editor.grid=next; Editor.history=[];
      Editor._buildBoard(); Editor._syncFooter(); Editor._syncMode();
    };
    document.getElementById('btn-apply-size').addEventListener('click', applySize);
    si.addEventListener('keydown', e => { if (e.key==='Enter') applySize(); });
    document.getElementById('btn-size-dec').addEventListener('click', () => { si.value=Math.max(2,parseInt(si.value,10)-1); applySize(); });
    document.getElementById('btn-size-inc').addEventListener('click', () => { si.value=Math.min(32,parseInt(si.value,10)+1); applySize(); });

    // Editor controls
    document.getElementById('btn-clear').addEventListener('click',  () => { if (!confirm('Clear the board?')) return; Editor.clear(); });
    document.getElementById('btn-save').addEventListener('click',   () => App._save());
    document.getElementById('btn-rotate-ccw')?.addEventListener('click', () => Editor.rotate(-1));
    document.getElementById('btn-rotate-cw')?.addEventListener('click',  () => Editor.rotate(1));
    document.getElementById('btn-mirror')?.addEventListener('click',     () => Editor.mirror());

    // Place mode
    const modes = { 'btn-mode-x':'x', 'btn-mode-o':'o', 'btn-mode-auto':'auto' };
    for (const [id, mode] of Object.entries(modes))
      document.getElementById(id).addEventListener('click', () => {
        Editor.placeMode = mode;
        for (const bid of Object.keys(modes)) document.getElementById(bid).classList.toggle('active', bid===id);
      });

    // Label mode
    document.getElementById('btn-label-mode').addEventListener('click', () => {
      Editor.labelMode = Editor.labelMode==='letter' ? 'number' : 'letter';
      const btn = document.getElementById('btn-label-mode');
      btn.textContent = Editor.labelMode==='letter' ? 'a' : '1';
      btn.classList.toggle('active', Editor.labelMode==='number');
    });

    // Copy image / board link
    document.getElementById('btn-copy-image').addEventListener('click', () => {
      const svg=document.getElementById('board-svg');
      const xml=new XMLSerializer().serializeToString(svg);
      const url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));
      const img=new Image();
      img.onload=()=>{
        const scale=2, canvas=document.createElement('canvas');
        canvas.width=(svg.width.baseVal.value||img.naturalWidth)*scale;
        canvas.height=(svg.height.baseVal.value||img.naturalHeight)*scale;
        const ctx=canvas.getContext('2d'); ctx.scale(scale,scale); ctx.drawImage(img,0,0);
        URL.revokeObjectURL(url);
        canvas.toBlob(b=>navigator.clipboard.write([new ClipboardItem({'image/png':b})])
          .then(()=>App._toast('image copied')).catch(()=>App._toast('not supported')));
      };
      img.src=url;
    });
    document.getElementById('btn-copy-board').addEventListener('click', () => {
      const enc=URLCodec.encodeFull(Editor.grid,Editor.labels);
      navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${enc}`).then(()=>App._toast('link copied'));
    });

    // Export buttons — tab-contextual, each exports only its own content
    document.getElementById('btn-share-editor')?.addEventListener('click', () => {
      Share.showModal(
        'editor',
        () => JSON.stringify({ type:'hexoboards-board', board: URLCodec.encode(Editor.grid),
          labels: Editor.labels.map(l=>[l.q,l.r,l.mark]), title: Editor.title, note: Editor.note }, null, 2),
        'Editor Board',
        App._toast,
        (tab, data) => App._loadImportedData(tab, data)
      );
    });
    document.getElementById('btn-share-match')?.addEventListener('click', () => {
      Share.showModal(
        'match',
        () => JSON.stringify({ type:'hexoboards-match-compact', notation: Match.toHextic(),
          title: Match.title, note: Match.note }, null, 2),
        'Match',
        App._toast,
        (tab, data) => App._loadImportedData(tab, data)
      );
    });
    document.getElementById('btn-share-library')?.addEventListener('click', () => {
      const libId = Browser.activeLibId || Store.LOCAL;
      const docObj = Store.getDoc(libId);
      Share.showModal(
        'library',
        () => JSON.stringify({ type:'hexoboards-library', doc: docObj?.doc || [] }, null, 2),
        'Library',
        App._toast,
        (tab, data) => App._loadImportedLibrary(data)
      );
    });

    // Note / notation panels
    document.getElementById('note-toggle-btn').addEventListener('click', () => { Editor.noteOpen=!Editor.noteOpen; Editor._syncPanels(); Editor._buildBoard(); });
    document.getElementById('notation-toggle-btn').addEventListener('click', () => { Editor.notationOpen=!Editor.notationOpen; Editor._syncPanels(); Editor._buildBoard(); });
    document.getElementById('note-text').addEventListener('input',  e => { Editor.note=e.target.value;  Editor._setDirty(true); });
    document.getElementById('title-text').addEventListener('input', e => { Editor.title=e.target.value; Editor._setDirty(true); });

    // Notation panel load/copy (driven by Notation.FORMATS)
    for (const [id] of Object.entries(Notation.FORMATS)) {
      document.getElementById(`nf-load-${id}`)?.addEventListener('click', async () => {
        const text = document.getElementById(`nf-${id}`)?.value || '';
        App._importSingle(await Notation.loadFromSource(Source.fromString(text, id)));
      });
      document.getElementById(`nf-copy-${id}`)?.addEventListener('click', () =>
        App._copy(document.getElementById(`nf-${id}`)?.value || ''));
    }

    // Match toolbar buttons
    document.getElementById('btn-match-new').addEventListener('click', () => Match._showStartModal());

    document.getElementById('btn-match-import').addEventListener('click', () => {
      const modal = document.getElementById('match-import-modal');
      if (modal) { modal.hidden = !modal.hidden; if (!modal.hidden) document.getElementById('match-import-ta')?.focus(); }
    });
    document.getElementById('btn-match-import-close').addEventListener('click', () => {
      document.getElementById('match-import-modal').hidden = true;
    });
    document.getElementById('btn-match-import-load').addEventListener('click', () => {
      const text = document.getElementById('match-import-ta')?.value.trim();
      if (!text) return;
      if (Match.fromHextic(text)) {
        document.getElementById('match-import-modal').hidden = true;
        App._toast('loaded');
      } else { App._toast('invalid notation'); }
    });
    document.getElementById('btn-match-import-url').addEventListener('click', async () => {
      const input = document.getElementById('match-import-ta')?.value.trim();
      if (!input) return;
      const statusEl = document.getElementById('match-import-status');
      if (statusEl) statusEl.textContent = 'fetching…';
      try {
        const remote = Share.parseRemoteFromAnyUrl(input, 'match');
        if (!remote) { if (statusEl) statusEl.textContent = 'unrecognised URL'; return; }
        const text = await Share.fetchRemote(remote.service, remote.id);
        App._loadImportedData(remote.tab, JSON.parse(text));
        document.getElementById('match-import-modal').hidden = true;
        App._toast('loaded');
      } catch (e) { if (statusEl) statusEl.textContent = 'failed: ' + e.message; }
    });

    // Match panel toggle buttons
    document.getElementById('match-play-toggle').addEventListener('click', () => {
      Match.playOpen = !Match.playOpen; Match._syncMatchPanels(); Match._buildBoard();
    });
    document.getElementById('match-note-toggle').addEventListener('click', () => {
      Match.noteOpen = !Match.noteOpen; Match._syncMatchPanels(); Match._renderNotePanel(); Match._buildBoard();
    });
    document.getElementById('match-tree-toggle').addEventListener('click', () => {
      Match.treeOpen = !Match.treeOpen; Match._syncMatchPanels(); Match._buildBoard();
    });

    document.getElementById('btn-match-snapshot').addEventListener('click', () => {
      const grid = Match.currentBoardAsGrid();
      Editor.loadGrid(grid);
      UI.showEditor(() => Editor._buildBoard());
      App._toast('board → editor');
    });

    // Convert tab
    document.getElementById('btn-convert').addEventListener('click', () => {
      const fromFmt=document.getElementById('conv-from').value, toFmt=document.getElementById('conv-to').value;
      const batch=document.getElementById('conv-batch').checked, input=document.getElementById('conv-input').value.trim();
      const entries=batch?Notation.parseMulti(input):[input], results=Notation.convertBatch(entries,fromFmt,toFmt);
      document.getElementById('conv-output').value=batch?JSON.stringify(results,null,2):(results[0]||'(parse error)');
    });
    document.getElementById('btn-conv-copy').addEventListener('click', () => App._copy(document.getElementById('conv-output').value));
    document.getElementById('btn-conv-load').addEventListener('click', () => {
      App._importSingle(Notation.gridFromFmt(document.getElementById('conv-output').value.trim(), document.getElementById('conv-to').value));
    });
    document.getElementById('btn-conv-from-editor').addEventListener('click', () => {
      document.getElementById('conv-input').value=Notation.gridToFmt(Editor.grid, document.getElementById('conv-from').value);
    });

    // Library management
    document.getElementById('btn-lib-add').addEventListener('click', async () => {
      const name=document.getElementById('lib-add-name').value.trim(), url=document.getElementById('lib-add-url').value.trim();
      if (!name||!url) { App._toast('name and URL required'); return; }
      const id=Store.addLibrary(name,url);
      document.getElementById('lib-add-name').value=document.getElementById('lib-add-url').value='';
      App._toast('loading…'); await Store.fetchLibrary(id); LibManager.render(); App._toast('library added');
    });
    document.getElementById('lib-add-url').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-lib-add').click(); });

    // Browser toolbar
    document.getElementById('btn-search-clear')?.addEventListener('click', () => { const s=document.getElementById('browser-search'); if(s){s.value='';Browser._applySearch('');s.focus();} });
    document.getElementById('browser-search')?.addEventListener('input', e => Browser._applySearch(e.target.value));
    document.getElementById('btn-collapse-all')?.addEventListener('click', () => Browser.setAllCollapsed(true));
    document.getElementById('btn-expand-all')?.addEventListener('click',   () => Browser.setAllCollapsed(false));
    document.getElementById('btn-compact')?.addEventListener('click',      () => App._toggleCompact());
    document.getElementById('btn-back-to-top')?.addEventListener('click',  () => document.getElementById('browser-main').scrollTo({top:0,behavior:'smooth'}));
    document.getElementById('browser-main')?.addEventListener('scroll', e => { const btn=document.getElementById('btn-back-to-top'); if(btn) btn.hidden=e.target.scrollTop<300; });

    document.querySelectorAll('.btn-theme').forEach(b => b.addEventListener('click', () => App._toast('dark only')));

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey||e.metaKey)&&e.key==='s') { e.preventDefault(); App._save(); }
      if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault(); if(UI.activeView==='match') Match.undo(); else Editor.undo(); }
      if ((e.ctrlKey||e.metaKey)&&e.key==='f') {
        e.preventDefault();
        if (UI.activeView!=='browser') UI.showBrowser(()=>Browser.render(Browser.activeLibId||Store.LOCAL));
        setTimeout(()=>{ const s=document.getElementById('browser-search'); s?.focus(); s?.select(); },50);
      }
    });

    window.addEventListener('hashchange', () => {
      const h=window.location.hash.slice(1);
      if (!h||h.startsWith('b/')||h==='d'||h==='c'||h==='m'||h==='a'||h.startsWith('remote/')) return;
      const d=URLCodec.decodeFull(h); if(!d) return;
      Editor.grid=d.grid; Editor.labels=d.labels; Editor.history=[]; Editor.nodeId=null;
      document.getElementById('input-size').value=d.grid.s;
      Editor.noteOpen=d.labels.length>0;
      Editor._syncPanels(); Editor._buildBoard(); Editor._syncFooter(); Editor._syncMode();
    });
  },

  // ── resize handles ────────────────────────────────────────────────────────

  _bindResizeHandles() {
    // ── Editor panels (right side) ──────────────────────────────────────────
    App._makeResizable(document.getElementById('note-resize'),
      e => Editor._applyPanelResize('note', window.innerWidth - e.clientX));
    App._makeResizable(document.getElementById('notation-resize'),
      e => Editor._applyPanelResize('notation', window.innerWidth - (Editor.noteOpen ? Layout.NOTE_W : 0) - e.clientX));

    // ── Browser sidebar ─────────────────────────────────────────────────────
    App._makeResizable(document.getElementById('sidebar-resize'), e => {
      const w = Math.max(120, Math.min(360, e.clientX));
      document.getElementById('lib-sidebar').style.width = w+'px';
      document.getElementById('browser-main').style.left = w+'px';
      const tb = document.getElementById('browser-toolbar'); if (tb) tb.style.left = w+'px';
      document.documentElement.style.setProperty('--lib-side-w', w+'px');
    });

    // ── Match panels ────────────────────────────────────────────────────────
    // Play panel: handle is on the RIGHT edge, dragging right shrinks it
    App._makeResizable(document.getElementById('match-play-resize'),
      e => Match._applyMatchPanelResize('play', e.clientX));

    // Note panel: handle is on the LEFT edge, dragging left widens it
    App._makeResizable(document.getElementById('match-note-resize'),
      e => Match._applyMatchPanelResize('note',
        window.innerWidth - e.clientX - (Match.treeOpen ? Layout.MATCH_TREE_W : 0)));

    // Tree panel: handle is on the LEFT edge
    App._makeResizable(document.getElementById('match-tree-resize'),
      e => Match._applyMatchPanelResize('tree', window.innerWidth - e.clientX));
  },

  _makeResizable(handle, onMove) {
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const up=()=>{ document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',up); };
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',up);
    });
  },

  // ── tooltips ─────────────────────────────────────────────────────────────

  _initTooltips() {
    const tip=document.getElementById('tooltip');
    const show=t=>{ tip.textContent=t.dataset.tip; tip.hidden=false; const r=t.getBoundingClientRect(), below=r.top<80; tip.style.top=(below?(r.bottom+6):(r.top-tip.offsetHeight-6))+'px'; tip.style.left=Math.max(4,Math.min(r.left+r.width/2-tip.offsetWidth/2,window.innerWidth-tip.offsetWidth-4))+'px'; };
    document.addEventListener('mouseover', e=>{ const t=e.target.closest('[data-tip]'); if(t) show(t); else tip.hidden=true; });
    document.addEventListener('mouseout',  e=>{ if(!e.relatedTarget?.closest('[data-tip]')) tip.hidden=true; });
  },

  // ── compact / theme ───────────────────────────────────────────────────────

  _initTheme()   { document.documentElement.classList.remove('light'); document.querySelectorAll('.btn-theme').forEach(b=>b.textContent='☾'); },
  _initCompact() { const c=localStorage.getItem(Store._K.compact)==='1'; document.getElementById('browser-main')?.classList.toggle('browser-compact',c); document.getElementById('btn-compact')?.classList.toggle('active',c); },
  _toggleCompact() { const m=document.getElementById('browser-main'), a=m.classList.toggle('browser-compact'); localStorage.setItem(Store._K.compact,a?'1':''); document.getElementById('btn-compact').classList.toggle('active',a); },

  // ── helpers ───────────────────────────────────────────────────────────────

  _copy(text) { if(!text){App._toast('nothing to copy');return;} navigator.clipboard?.writeText(text).then(()=>App._toast('copied')); },

  _toast(msg) { const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); },
};

export { App };
