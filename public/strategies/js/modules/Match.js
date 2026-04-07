/**
 * Match — interactive game-tree explorer.
 *
 * New in this version:
 *   • Collapsible child-of-fork subtrees — double-click to toggle; shows (N…)
 *   • Area selection — toggle select mode, drag to define axial rectangle,
 *     then extract occupied cells to Editor via onExtract callback
 *   • Branch labels — per-node labels (preset or custom) shown as badges;
 *     click badge to open the label picker
 *
 * External API:
 *   Match.init()                — one-time setup
 *   Match.undo / clear
 *   Match.loadFromGrid(grid)    — set root board from Editor
 *   Match.currentBoardAsGrid()  — export current node as bounded HexGrid
 *   Match.toggleSelectMode()    — enter/exit area-selection mode
 *   Match.extractSelection()    — send selected occupied cells via onExtract
 *   Match.clearSelection()
 *   Match.onExtract             — callback(grid) set by App
 */
import { HexGrid }        from './HexGrid.js';
import { BoardView }      from './BoardView.js';
import { HexLayout }      from './HexLayout.js';
import { UI }             from './UI.js';
import { Store }          from './Store.js';
import { Layout }         from './Layout.js';
import { Bot }            from './Bot.js';
import { Eval }           from './Eval.js';
import { MoveAnnotator }  from './MoveAnnotator.js';
import { WinDetector }    from './WinDetector.js';

// ── node factory ──────────────────────────────────────────────────────────────

let _nodeId = 0;
const MatchNode = {
  resetId() { _nodeId = 0; },
  /** After deserializing a tree with pre-existing IDs, sync _nodeId to the max so new nodes don't collide. */
  syncId(tree) {
    const walk = n => { if (n.id > _nodeId) _nodeId = n.id; n.children.forEach(walk); };
    walk(tree);
  },
  create(opts = {}) {
    return {
      id:       opts.id       ?? ++_nodeId,
      parent:   opts.parent   || null,
      turn:     opts.turn     || 0,
      grid:     opts.grid     || { cells: new Map() },
      lastMove: opts.lastMove || null,
      label:    opts.label    || null,  // { type, icon, text } or null
      isWin:    opts.isWin    || false, // true when this move completed a 6-in-a-row
      winRun:   opts.winRun   || null,  // Set<"q,r"> of the winning cells
      children: [],
    };
  },
};

// ── label presets ─────────────────────────────────────────────────────────────

const LABEL_PRESETS = [
  { type: 'forced-win',  icon: '★',  text: 'Forced win'   },
  { type: 'forced-loss', icon: '✗',  text: 'Forced loss'  },
  { type: 'interesting', icon: '!?', text: 'Interesting'  },
  { type: 'mistake',     icon: '?',  text: 'Mistake'       },
  { type: 'blunder',     icon: '??', text: 'Blunder'       },
  { type: 'key',         icon: '◈',  text: 'Key position' },
];

// ── main module ───────────────────────────────────────────────────────────────

const Match = {
  tree:        null,
  currentNode: null,
  viewOffset:  { x: 0, y: 0 },
  viewZoom:    1,
  MIN_ZOOM:    0.3,
  MAX_ZOOM:    3,

  _view:              null,
  _lastBoardEmpty:    true,
  _collapsedChildren: null,   // Set<nodeId>

  // Area selection state
  selectionMode:  false,
  selectedCells:  null,       // Set<"q,r"> or null
  _selAnchor:     null,
  _selRadius:     0,
  _selCache:      null,       // visible cells cached during drag
  _selRafId:      null,

  onExtract:        null,   // callback(grid) — set by App
  _onSaveToLibrary: null,  // callback() — set by App, saves match to library

  // Play panel state
  botX:       null,   // bot id for player X, or null (human)
  botO:       null,   // bot id for player O, or null (human)
  _botRunning:    false, // prevent re-entrant bot placement
  _currentBotId:  null,  // bot currently placing (null = human)

  // Panel visibility — mirrors Editor.noteOpen / notationOpen pattern
  playOpen: true,
  noteOpen: false,
  treeOpen: true,

  // Win state
  winCells: null,     // Set<"q,r"> currently highlighted on the board (mirrors currentNode.winRun)

  // Whether board is active (gated by start modal)
  _boardActive: false,

  // Note / library metadata
  title:      '',
  note:       '',
  createdAt:  0,      // timestamp when this game was started
  _libNodeId: null,   // Doc node ID if this match has been saved to a library

  // ── init ─────────────────────────────────────────────────────────────────

  init() {
    Match._view              = BoardView.create('match-board-svg');
    Match._collapsedChildren = new Set();
    Match._bindEvents();
    Match._syncMatchPanels();
    Match._renderPlayPanel();

    // If a tree was restored from localStorage, activate the board directly
    const hasTree = Match.tree?.children.length > 0;
    if (hasTree) {
      Match._boardActive = true;
    } else {
      Match.tree        = MatchNode.create({ turn: 0 });
      Match.currentNode = Match.tree;
    }
    Match._renderNotePanel();
    Match._renderTree();
    Match._buildBoard();
    // Modal is shown by App when the tab is entered — not here (avoids spurious
    // modals when other tabs reload, e.g. after clearAll in the library tab).
  },

  // ── public actions ────────────────────────────────────────────────────────

  undo() {
    if (!Match.currentNode.parent && Match.currentNode.turn === 0) return;
    if (Match.currentNode.parent) {
      Match.currentNode = Match.currentNode.parent;
    } else {
      const arr = Match._nodeToArray(Match.tree);
      const idx = arr.indexOf(Match.currentNode);
      if (idx > 0) Match.currentNode = arr[idx - 1];
    }
    Match.winCells = Match.currentNode.isWin ? Match.currentNode.winRun : null;
    Match._renderTree(); Match._buildBoard();
  },

  clear() {
    Match.tree            = MatchNode.create({ turn: 0 });
    Match.currentNode     = Match.tree;
    Match._lastBoardEmpty = true;
    Match._collapsedChildren.clear();
    Match.viewOffset   = { x: 0, y: 0 };
    Match.viewZoom     = 1;
    Match.winCells     = null;
    Match._boardActive = false;
    Match.title        = '';
    Match.note         = '';
    Match.createdAt    = 0;
    Match._libNodeId   = null;
    Match.clearSelection();
    Match._save(); Match._renderTree(); Match._buildBoard();
    Match._showStartModal();
  },

  loadFromGrid(grid) {
    const cells = new Map();
    for (const cell of grid.cells.values())
      if (cell.state) cells.set(HexGrid.key(cell.q, cell.r), { q: cell.q, r: cell.r, state: cell.state, legal: false });
    let turn = 0;
    for (const c of cells.values()) if (c.state) turn++;
    Match.tree            = MatchNode.create({ turn, grid: { cells } });
    Match.currentNode     = Match.tree;
    Match._lastBoardEmpty = cells.size === 0;
    Match._collapsedChildren.clear();
    Match.viewOffset = { x: 0, y: 0 }; Match.viewZoom = 1;
    Match._boardActive = true;
    Match.title = ''; Match.note = ''; Match._libNodeId = null;
    Match.clearSelection();
    Match._save(); Match._renderTree(); Match._buildBoard();
  },

  currentBoardAsGrid() { return HexGrid.fromCellMap(Match.currentNode.grid.cells); },

  // ── area selection ────────────────────────────────────────────────────────

  toggleSelectMode() {
    Match.selectionMode = !Match.selectionMode;
    Match.clearSelection();
    document.getElementById('btn-match-select')?.classList.toggle('active', Match.selectionMode);
    Match._buildBoard();
  },

  clearSelection() {
    Match.selectedCells = null;
    Match._selAnchor    = null;
    Match._selCache     = null;
    const info = document.getElementById('match-sel-info');
    if (info) { info.textContent = ''; info.hidden = true; }
    if (Match._view) Match._buildBoard();
  },

  /**
   * Extract occupied cells inside the selection and send to the Editor.
   * Coordinates are translated so the selection anchor lands at (0,0) —
   * this centres the extracted region at the board origin.
   */
  extractSelection() {
    if (!Match.selectedCells?.size || !Match._selAnchor) return;
    const { q: cq, r: cr } = Match._selAnchor;
    const cells = Match.currentNode.grid.cells;
    const occupied = new Map();
    for (const key of Match.selectedCells) {
      const c = cells.get(key);
      if (!c?.state) continue;
      // Translate so the anchor hex becomes the origin
      const q = c.q - cq, r = c.r - cr;
      occupied.set(HexGrid.key(q, r), { q, r, state: c.state });
    }
    if (!occupied.size) return;
    Match.onExtract?.(HexGrid.fromCellMap(occupied));
  },

  /**
   * Selection shape is a hexagonal region centred on the drag anchor.
   * Radius = hex-distance from anchor to the current drag position.
   * All visible cells within that radius are highlighted.
   */
  _updateSelection(endQ, endR) {
    if (!Match._selAnchor || !Match._selCache) return;
    const { q: cq, r: cr } = Match._selAnchor;
    const radius = Math.round(
      (Math.abs(endQ - cq) + Math.abs(endR - cr) + Math.abs(endQ + endR - cq - cr)) / 2
    );
    Match._selRadius   = radius;
    Match.selectedCells = new Set();
    const cells = Match.currentNode.grid.cells;
    let stones = 0;
    for (const [key, cell] of Match._selCache) {
      const d = (Math.abs(cell.q - cq) + Math.abs(cell.r - cr) + Math.abs(cell.q + cell.r - cq - cr)) / 2;
      if (d <= radius) {
        Match.selectedCells.add(key);
        if (cells.get(key)?.state) stones++;
      }
    }
    const has = Match.selectedCells.size > 0;
    // Show selection info in toolbar
    const info = document.getElementById('match-sel-info');
    if (info) {
      info.textContent = has ? `r=${radius}  ${stones} stone${stones !== 1 ? 's' : ''}` : '';
      info.hidden = !has;
    }
  },

  // ── turn helpers ──────────────────────────────────────────────────────────

  _getTurn()      { return Match.currentNode.turn; },
  _getPlayer()    { const i = Match._getTurn() % 4; return (i===0||i===3) ? 1 : 2; },
  _getNextState() { return Match._getPlayer(); },

  // ── visible cell map ──────────────────────────────────────────────────────

  _computeVisibleCells(cells) {
    const HALO = 8;
    const visible = new Map();
    if (!cells.size) { visible.set('0,0', {q:0,r:0,state:0,legal:true}); return visible; }
    for (const key of cells.keys()) {
      const [cq, cr] = key.split(',').map(Number);
      visible.set(key, { ...cells.get(key) });
      for (let dq=-HALO; dq<=HALO; dq++) for (let dr=-HALO; dr<=HALO; dr++) {
        if ((Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2 > HALO) continue;
        const k = `${cq+dq},${cr+dr}`;
        if (!visible.has(k)) visible.set(k, {q:cq+dq,r:cr+dr,state:0,legal:true});
      }
    }
    return visible;
  },

  _isLegalMove(q, r, cells) {
    const key = HexGrid.key(q, r);
    if (cells.has(key)) return cells.get(key).state === 0;
    if (!cells.size) return q===0 && r===0;
    const HALO = 8;
    for (const k of cells.keys()) {
      const [cq,cr] = k.split(',').map(Number);
      if ((Math.abs(q-cq)+Math.abs(r-cr)+Math.abs(q+r-cq-cr))/2 <= HALO) return true;
    }
    return false;
  },

  // ── move application ──────────────────────────────────────────────────────

  /**
   * Place a stone (called by the user via board click).
   * After placement, hands off to the bot loop if the next player has a bot.
   */
  async _applyStone(q, r) {
    if (Match._botRunning) return; // don't interrupt mid-bot sequence
    await Match._placeStone(q, r);
    Match._maybeTriggerBot();
  },

  /**
   * Raw stone placement — no bot trigger.
   * Used both by human (_applyStone) and by the bot loop (_maybeTriggerBot).
   * Returns true if the stone was placed, false if illegal or won.
   * `skipRender` batches tree renders during bot sequences.
   */
  async _placeStone(q, r, skipRender = false) {
    const cells = Match.currentNode.grid.cells;
    if (!Match._isLegalMove(q, r, cells)) return false;

    const state    = Match._getNextState();
    const turn     = Match._getTurn();
    const newCells = new Map(Array.from(cells, ([k,c]) => [k, {...c}]));
    newCells.set(HexGrid.key(q, r), { q, r, state, legal: false });

    const newNode = MatchNode.create({
      parent:   Match.currentNode,
      turn:     turn + 1,
      grid:     { cells: newCells },
      lastMove: { q, r, state, turn, botId: Match._currentBotId || null },
    });
    Match.currentNode.children.push(newNode);
    Match.currentNode = newNode;

    // Win detection — only fires for the exact move that completes 6-in-a-row
    const win = WinDetector.check(q, r, state, newCells);
    if (win) {
      const winSet = new Set(win.map(c => HexGrid.key(c.q, c.r)));
      newNode.isWin  = true;
      newNode.winRun = winSet;   // stored on the node permanently
      Match.winCells = winSet;   // for board highlight right now
      Match._save(); Match._renderTree(); Match._buildBoard();
      Match._showWinPopup(state, win.length);
      return false; // signal: stop placing
    }
    Match.winCells = null;

    // Async annotation (non-blocking — does not block placement)
    MoveAnnotator.annotate(q, r, state, newCells).then(label => {
      if (label && !newNode.label) {
        newNode.label = label;
        if (!skipRender) { Match._save(); Match._renderTree(); }
      }
    });

    Match._save();
    if (!skipRender) {
      Match._renderTree();
      Match._buildBoard();
      // Eval bar update
      Eval.evaluate(newCells, turn + 1).then(score => Match._renderEvalBar(score));
    } else {
      // Lightweight board-only refresh during bot runs (no tree rebuild)
      Match._buildBoard();
    }

    return true;
  },

  /**
   * Bot move loop. Plays the full consecutive pair (or single first move) for
   * the current player, then hands back to the human (or the opposing bot).
   * Uses 100ms delay between moves so the UI stays responsive.
   *
   * Hextic turn structure: X plays 1 (first move only), then pairs of 2.
   * _getPlayer() already encodes this — just keep playing while the same bot
   * is still the active player.
   */
  async _maybeTriggerBot() {
    if (Match._botRunning) return;
    if (Match.winCells)    return;

    const player = Match._getPlayer();
    const botId  = player === 1 ? Match.botX : Match.botO;
    if (!botId) return;

    Match._botRunning = true;
    // Show a subtle "thinking" indicator in the turn label
    const turnEl = document.getElementById('match-turn');
    const origText = turnEl?.textContent || '';

    try {
      while (!Match.winCells) {
        const nowPlayer = Match._getPlayer();
        const nowBotId  = nowPlayer === 1 ? Match.botX : Match.botO;
        // Stop if the active player changed to a human (or different bot)
        if (!nowBotId) break;

        if (turnEl) turnEl.textContent = (nowPlayer === 1 ? 'X' : 'O') + ' thinking…';

        await new Promise(r => setTimeout(r, 100));

        const vis  = Match._computeVisibleCells(Match.currentNode.grid.cells);
        const move = await Bot.computeMove(nowBotId, vis, Match._getTurn());
        if (!move || !Match._isLegalMove(move.q, move.r, Match.currentNode.grid.cells)) break;

        Match._currentBotId = nowBotId;
        const cont = await Match._placeStone(move.q, move.r, false);
        Match._currentBotId = null;
        if (!cont) break;
      }
    } finally {
      Match._botRunning   = false;
      Match._currentBotId = null;
      // Restore turn indicator
      if (turnEl && !Match.winCells) {
        const p = Match._getPlayer();
        turnEl.textContent = (p === 1 ? 'X' : 'O') + "'s turn";
      }
      // Final render pass to sync tree
      Match._renderTree();
    }
  },

  _goTo(node) {
    Match.currentNode = node;
    // Always sync winCells from the node being navigated to
    Match.winCells = node.isWin ? node.winRun : null;
    Match._renderTree(); Match._buildBoard();
  },

  _goToById(id) {
    const find = n => { if (n.id===id) return n; for (const c of n.children){const f=find(c);if(f)return f;} return null; };
    const node = find(Match.tree); if (node) Match._goTo(node);
  },

  _tryMoveOrNavigate(q, r) {
    const ex = Match.currentNode.children.find(c => c.lastMove?.q===q && c.lastMove?.r===r);
    if (ex) { Match._goTo(ex); return; }
    if (Match._isLegalMove(q,r,Match.currentNode.grid.cells)) Match._applyStone(q,r);
  },

  // ── board rendering ───────────────────────────────────────────────────────

  _buildBoard() {
    const area = document.getElementById('match-board-area');
    const rect = area.getBoundingClientRect();
    const w = Math.max(rect.width  || 0, 100) || 800;
    const h = Math.max(rect.height || 0, 100) || 600;
    const vis = Match._computeVisibleCells(Match.currentNode.grid.cells);
    let maxD = 0;
    for (const c of vis.values()) maxD = Math.max(maxD, (Math.abs(c.q)+Math.abs(c.r)+Math.abs(c.q+c.r))/2);
    const nowEmpty = Match.currentNode.grid.cells.size === 0;
    Match._lastBoardEmpty = nowEmpty;
    Match._view.build(
      { s: Math.max(5, maxD+2), baseR: HexLayout.fitRadius(11,w,h,80), cells: vis },
      [],
      { w, h, margin: 80,
        zoom:     nowEmpty ? 1 : Match.viewZoom,
        offset:   nowEmpty ? {x:0,y:0} : Match.viewOffset,
        selected: Match.selectedCells || Match.winCells || undefined,
        selColor: Match.winCells ? 'win' : undefined,
      }
    );
    const turnEl2 = document.getElementById('match-turn'); if(turnEl2 && !Match._botRunning) turnEl2.textContent = `${Match._getPlayer()===1?'X':'O'}'s turn`;
    document.getElementById('match-move-count')?.textContent && (document.getElementById('match-move-count').textContent = `move ${Match._getTurn()}`);
  },

  // ── tree rendering ────────────────────────────────────────────────────────

  _renderTree() {
    const container = document.getElementById('match-tree-content');
    if (!container) return;
    container.innerHTML = ''; container.tabIndex = 0;
    const currentId = Match.currentNode?.id;

    const renderNode = (node, isChildOfFork = false) => {
      const isCurrent   = node.id === currentId;
      const isFork      = node.children.length >= 2;
      const isCollapsed = isChildOfFork && Match._collapsedChildren.has(node.id);

      // ── main row (original flat layout) ────────────────────────────────
      const line = document.createElement('div');
      line.className = ['tree-node', isCurrent&&'current', isFork&&'fork',
        isChildOfFork&&'child-of-fork', node.isWin&&'win-node']
        .filter(Boolean).join(' ');
      line.dataset.nodeId = node.id;
      if (isChildOfFork) line.title = 'Double-click to collapse / expand';

      const content = document.createElement('span');
      content.className   = 'tree-node-content';
      content.textContent = node.lastMove
        ? `${node.lastMove.state === 1 ? 'X' : 'O'} ${node.turn}` : 'start';
      line.appendChild(content);

      if (node.lastMove) {
        const coords = document.createElement('span');
        coords.className   = 'tree-node-coords';
        coords.textContent = `${node.lastMove.q},${node.lastMove.r}`;
        line.appendChild(coords);
        if (node.lastMove.botId) {
          const botBadge = document.createElement('span');
          botBadge.className   = 'tree-bot-badge';
          botBadge.textContent = node.lastMove.botId;
          line.appendChild(botBadge);
        }
      }

      if (isChildOfFork && isCollapsed) {
        const stub = document.createElement('span');
        stub.className   = 'tree-collapsed-stub';
        stub.textContent = `(${Match._countDescendants(node)}\u2026)`;
        line.appendChild(stub);
      }

      // hover-only "label" text (only when no label set)
      if (!node.label) {
        const tagBtn = document.createElement('span');
        tagBtn.className   = 'tree-label-btn';
        tagBtn.textContent = 'label';
        tagBtn.addEventListener('click', e => { e.stopPropagation(); Match._showLabelPicker(node, tagBtn); });
        line.appendChild(tagBtn);
      }

      // hover-only delete
      const del = document.createElement('span');
      del.className   = 'tree-delete';
      del.textContent = '\xd7';
      del.addEventListener('click', e => {
        e.stopPropagation();
        if (node === Match.tree) { if (confirm('Clear match tree?')) Match.clear(); }
        else if (confirm('Delete node and children?')) Match._deleteNode(node);
      });
      line.appendChild(del);

      line.addEventListener('click', () => Match._goTo(node));
      if (isChildOfFork) {
        line.addEventListener('dblclick', e => {
          e.stopPropagation();
          if (Match._collapsedChildren.has(node.id)) Match._collapsedChildren.delete(node.id);
          else Match._collapsedChildren.add(node.id);
          Match._save(); Match._renderTree();
        });
      }

      // ── wrapper: row + optional label second line ───────────────────────
      const wrapper = document.createElement('div');
      wrapper.className = 'tree-node-wrapper';
      wrapper.appendChild(line);

      if (node.label) {
        const lbl = document.createElement('div');
        lbl.className   = 'tree-node-label';
        lbl.textContent = node.label.icon
          ? `${node.label.icon}  ${node.label.text}` : node.label.text;
        lbl.title = 'Click to edit label';
        lbl.addEventListener('click', e => { e.stopPropagation(); Match._showLabelPicker(node, lbl); });
        wrapper.appendChild(lbl);
      }

      if (!node.children.length || (isChildOfFork && isCollapsed)) return wrapper;

      const group = document.createElement('div'); group.className = 'tree-group';
      group.appendChild(wrapper);
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children' + (isFork ? ' is-fork' : '');
      node.children.forEach((child, i) => {
        if (isFork && i > 0) {
          const sep = document.createElement('div'); sep.className = 'tree-branch-line';
          childWrap.appendChild(sep);
        }
        childWrap.appendChild(renderNode(child, isFork));
      });
      group.appendChild(childWrap);
      return group;
    };

    container.appendChild(renderNode(Match.tree, false));

    container.onkeydown = e => {
      const nodes  = Array.from(container.querySelectorAll('.tree-node'));
      const curIdx = nodes.findIndex(n => n.classList.contains('current'));
      if (e.key==='ArrowDown'||e.key==='j') { e.preventDefault(); Match._goToById(+nodes[Math.min(curIdx+1,nodes.length-1)]?.dataset.nodeId); }
      if (e.key==='ArrowUp'  ||e.key==='k') { e.preventDefault(); Match._goToById(+nodes[Math.max(curIdx-1,0)]?.dataset.nodeId); }
    };

    requestAnimationFrame(() => {
      container.querySelector('.tree-node.current')?.scrollIntoView({block:'nearest'});
    });
  },

  // ── start modal ──────────────────────────────────────────────────────────

  /** Shown when Match tab is opened with an empty tree. */
  _showStartModal() {
    document.getElementById('match-start-modal')?.remove();
    document.getElementById('match-start-backdrop')?.remove();

    const backdrop = Object.assign(document.createElement('div'),
      { id: 'match-start-backdrop', className: 'modal-backdrop' });
    const modal = Object.assign(document.createElement('div'),
      { id: 'match-start-modal', className: 'start-modal' });

    const ttl = document.createElement('div'); ttl.className = 'start-modal-title';
    ttl.textContent = 'MATCH'; modal.appendChild(ttl);

    const body = document.createElement('div'); body.className = 'start-modal-body';

    const makeBtn = (label, fn) => {
      const b = document.createElement('button'); b.className = 'btn start-modal-btn';
      b.textContent = label;
      b.addEventListener('click', () => { backdrop.remove(); modal.remove(); fn(); });
      return b;
    };

    body.appendChild(makeBtn('new game', () => {
      // Reset without calling clear() to avoid re-triggering modal
      Match.tree            = MatchNode.create({ turn: 0 });
      Match.currentNode     = Match.tree;
      Match._lastBoardEmpty = true;
      Match._collapsedChildren.clear();
      Match.viewOffset  = { x: 0, y: 0 };
      Match.viewZoom    = 1;
      Match.winCells    = null;
      Match._boardActive = true;
      Match.title        = '';
      Match.note         = '';
      Match.createdAt    = Date.now();
      Match._libNodeId   = null;
      Match.clearSelection();
      Match._save(); Match._renderTree(); Match._buildBoard();
    }));

    if (Match.tree?.children.length > 0) {
      body.appendChild(makeBtn('resume saved game', () => {
        Match._boardActive = true;
        Match._syncMatchPanels();
        Match._renderTree(); Match._buildBoard();
      }));
    }

    const pasteRow = document.createElement('div'); pasteRow.className = 'start-paste-row';
    const pasteIn  = document.createElement('input'); pasteIn.type = 'text';
    pasteIn.className = 'start-paste-input'; pasteIn.placeholder = 'paste hextic notation…';
    const pasteBtn = document.createElement('button'); pasteBtn.className = 'btn';
    pasteBtn.textContent = 'load notation';
    pasteBtn.addEventListener('click', () => {
      if (!Match.fromHextic(pasteIn.value.trim())) return;
      Match._boardActive = true;
      backdrop.remove(); modal.remove();
    });
    pasteIn.addEventListener('keydown', e => { if (e.key === 'Enter') pasteBtn.click(); });
    pasteRow.append(pasteIn, pasteBtn);

    const fromClipBtn = document.createElement('button');
    fromClipBtn.className = 'btn start-modal-btn';
    fromClipBtn.textContent = 'load from clipboard';
    fromClipBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!Match.fromHextic(text.trim())) { pasteIn.value = text; pasteIn.focus(); return; }
        Match._boardActive = true;
        backdrop.remove(); modal.remove();
      } catch { pasteIn.focus(); }
    });

    body.append(pasteRow, fromClipBtn);
    modal.appendChild(body);
    // Clicking backdrop = cancel (no state change)
    backdrop.addEventListener('click', () => { backdrop.remove(); modal.remove(); });
    document.body.append(backdrop, modal);
  },

  // ── win popup ─────────────────────────────────────────────────────────────

  /** Show win popup. `runLength` is the integer length of the winning run. */
  _showWinPopup(state, runLength) {
    document.getElementById('match-win-popup-backdrop')?.remove();
    document.getElementById('match-win-popup')?.remove();

    const playerName = state === 1 ? 'X' : 'O';

    // Count stones at the winning position
    let xCount = 0, oCount = 0;
    for (const c of Match.currentNode.grid.cells.values()) {
      if (c.state === 1) xCount++; else if (c.state === 2) oCount++;
    }
    const totalMoves = Match._getTurn();

    const backdrop = Object.assign(document.createElement('div'), {
      id: 'match-win-popup-backdrop', className: 'win-popup-backdrop',
    });
    const popup = Object.assign(document.createElement('div'),
      { id: 'match-win-popup', className: 'win-popup' });

    popup.innerHTML = `
      <div class="win-popup-player">${playerName} wins!</div>
      <div class="win-popup-stats">
        <span>X  ${xCount}</span><span>O  ${oCount}</span>
        <span>${totalMoves} moves</span>
        <span>${runLength}-in-a-row</span>
      </div>
      <div class="win-popup-actions"></div>`;

    const close = () => { backdrop.remove(); popup.remove(); };

    const acts = popup.querySelector('.win-popup-actions');
    const btn  = (lbl, fn) => {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = lbl;
      b.addEventListener('click', fn); acts.appendChild(b);
    };
    btn('continue', () => {
      close();
      // Restore turn indicator (might still say "thinking…" from bot)
      const turnEl = document.getElementById('match-turn');
      if (turnEl) turnEl.textContent = 'X\'s turn';  // match continues; X always plays next (new branch)
    });
    btn('new game', () => { close(); Match.clear(); });

    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    document.body.append(backdrop, popup);
  },

  // ── play panel ────────────────────────────────────────────────────────────

  /** Build / rebuild the play panel inside #match-tree-panel. */
  _renderPlayPanel() {
    let panel = document.getElementById('match-play-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'match-play-panel'; panel.className = 'match-play-panel';
      const playArea = document.getElementById('match-play-area');
      if (playArea) playArea.appendChild(panel);
    }
    panel.innerHTML = '';

    const bots = Bot.list();
    const makePlayerRow = (label, stateKey, botKey) => {
      const row = document.createElement('div'); row.className = 'play-row';
      const lbl = document.createElement('span'); lbl.className = 'play-row-label'; lbl.textContent = label;
      row.appendChild(lbl);

      // Bot selector
      const sel = document.createElement('select'); sel.className = 'play-bot-select';
      const humanOpt = Object.assign(document.createElement('option'), { value: '', textContent: 'human' });
      sel.appendChild(humanOpt);
      bots.forEach(bot => sel.appendChild(Object.assign(document.createElement('option'), { value: bot.id, textContent: bot.name })));
      sel.value = Match[botKey] || '';
      sel.addEventListener('change', () => { Match[botKey] = sel.value || null; });
      row.appendChild(sel);

      // Single move trigger
      const trigger = document.createElement('button'); trigger.className = 'btn play-trigger';
      trigger.textContent = '▶'; trigger.title = `Place one ${label} stone`;
      trigger.addEventListener('click', async () => {
        if (Match._botRunning) return;
        const botId = sel.value || bots[0]?.id;
        if (!botId) return;
        Match._botRunning = true;
        try {
          await new Promise(r => setTimeout(r, 100));
          const vis  = Match._computeVisibleCells(Match.currentNode.grid.cells);
          const move = await Bot.computeMove(botId, vis, Match._getTurn());
          if (move) await Match._placeStone(move.q, move.r);
        } finally { Match._botRunning = false; }
      });
      row.appendChild(trigger);
      return row;
    };

    // ── Play / bot section ─────────────────────────────────────────────────
    const hdr = document.createElement('div'); hdr.className = 'play-panel-hdr'; hdr.textContent = 'Play';
    panel.appendChild(hdr);
    panel.appendChild(makePlayerRow('X', 'botX', 'botX'));
    panel.appendChild(makePlayerRow('O', 'botO', 'botO'));

    // Eval bar rendered in dedicated toolbar-level element (between panels)
    Match._renderEvalBar(0.5);
  },

  _renderNotePanel() {
    // Render into #match-note-content so the resize handle (#match-note-resize)
    // is never destroyed by innerHTML = ''
    const panel   = document.getElementById('match-note-panel');
    const content = document.getElementById('match-note-content');
    if (!panel || !content) return;
    content.innerHTML = '';

    const hdr = document.createElement('div'); hdr.className = 'play-panel-hdr'; hdr.textContent = 'Note';
    content.appendChild(hdr);

    const titleWrap = document.createElement('div'); titleWrap.className = 'play-note-wrap';
    const titleIn   = document.createElement('input'); titleIn.type = 'text';
    titleIn.className   = 'play-title-input'; titleIn.placeholder = 'match title…';
    titleIn.value = Match.title;
    titleIn.addEventListener('input', () => { Match.title = titleIn.value; });
    titleWrap.appendChild(titleIn);

    const noteWrap = document.createElement('div'); noteWrap.className = 'play-note-wrap';
    const noteTa   = document.createElement('textarea');
    noteTa.className = 'play-note-ta'; noteTa.placeholder = 'notes…';
    noteTa.value = Match.note;
    noteTa.addEventListener('input', () => { Match.note = noteTa.value; });
    noteWrap.appendChild(noteTa);

    const saveLibBtn = document.createElement('button');
    saveLibBtn.id        = 'btn-match-save-lib';
    saveLibBtn.className = 'btn play-save-lib-btn';
    saveLibBtn.textContent = Match._libNodeId ? '★ update' : '★ save to library';
    saveLibBtn.addEventListener('click', () => {
      if (Match._onSaveToLibrary) {
        Match._onSaveToLibrary();
        saveLibBtn.textContent = '★ update';
      }
    });

    content.appendChild(titleWrap);
    content.appendChild(noteWrap);
    content.appendChild(saveLibBtn);
  },

  _renderEvalBar(score = 0.5) {
    const bar = document.getElementById('match-eval-bar');
    if (bar) Eval.render(bar, score);
  },

    // ── label picker ──────────────────────────────────────────────────────────

  _showLabelPicker(node, anchor) {
    document.getElementById('label-picker')?.remove();
    const picker = document.createElement('div');
    picker.id = 'label-picker'; picker.className = 'label-picker';

    LABEL_PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.className   = 'btn label-preset' + (node.label?.type===preset.type?' active':'');
      btn.textContent = `${preset.icon} ${preset.text}`;
      btn.addEventListener('click', () => { node.label={...preset}; Match._save(); Match._renderTree(); picker.remove(); });
      picker.appendChild(btn);
    });

    const sep = document.createElement('div'); sep.className='label-sep'; picker.appendChild(sep);

    const customRow = document.createElement('div'); customRow.className='label-custom-row';
    const iconIn = document.createElement('input'); iconIn.type='text'; iconIn.placeholder='icon'; iconIn.className='label-icon-in'; iconIn.maxLength=3;
    iconIn.value = node.label?.type==='custom' ? (node.label.icon||'') : '';
    const textIn = document.createElement('input'); textIn.type='text'; textIn.placeholder='custom label…'; textIn.className='label-text-in';
    textIn.value = node.label?.type==='custom' ? (node.label.text||''): '';
    const saveBtn = document.createElement('button'); saveBtn.className='btn'; saveBtn.textContent='set';
    const apply = () => { const t=textIn.value.trim(); if(!t) return; node.label={type:'custom',icon:iconIn.value.trim(),text:t}; Match._save(); Match._renderTree(); picker.remove(); };
    saveBtn.addEventListener('click', apply);
    textIn.addEventListener('keydown', e => { if(e.key==='Enter') apply(); if(e.key==='Escape') picker.remove(); });
    customRow.append(iconIn, textIn, saveBtn); picker.appendChild(customRow);

    if (node.label) {
      const clr = document.createElement('button'); clr.className='btn label-clear'; clr.textContent='✕ clear';
      clr.addEventListener('click', () => { node.label=null; Match._save(); Match._renderTree(); picker.remove(); });
      picker.appendChild(clr);
    }

    document.body.appendChild(picker);
    requestAnimationFrame(() => {
      const ar=anchor.getBoundingClientRect(), pt=picker.getBoundingClientRect();
      picker.style.top  = Math.min(ar.bottom+4, window.innerHeight-pt.height-8)+'px';
      picker.style.left = Math.max(8, Math.min(ar.left, window.innerWidth-pt.width-8))+'px';
    });

    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click',h); }
    }), 0);
  },

  // ── node helpers ──────────────────────────────────────────────────────────

  _nodeToArray(node, arr=[]) { arr.push(node); for(const c of node.children) Match._nodeToArray(c,arr); return arr; },

  _countDescendants(node) {
    let n=0; const walk=x=>{ n++; x.children.forEach(walk); }; node.children.forEach(walk); return n;
  },

  _deleteNode(node) {
    if (!node.parent) return;
    node.parent.children = node.parent.children.filter(c=>c!==node);
    if (Match.currentNode===node||Match._isDescendant(Match.currentNode,node)) Match.currentNode=node.parent;
    Match._save(); Match._renderTree(); Match._buildBoard();
    requestAnimationFrame(()=>{ const cur=document.querySelector('.tree-node.current'); (cur||document.getElementById('match-tree-content')).focus?.(); });
  },

  _isDescendant(node, ancestor) { let cur=node.parent; while(cur){if(cur===ancestor)return true; cur=cur.parent;} return false; },

  // ── persistence ───────────────────────────────────────────────────────────

  _save() {
    try {
      localStorage.setItem(Store.STORAGE_KEYS.match, JSON.stringify({
        tree:      Match._serialize(Match.tree),
        viewOffset:Match.viewOffset, viewZoom:Match.viewZoom,
        collapsed: Array.from(Match._collapsedChildren),
        title:     Match.title,
        note:      Match.note,
        libNodeId:  Match._libNodeId,
        createdAt:  Match.createdAt,
      }));
    } catch {}
  },

  _load() {
    try {
      const raw = localStorage.getItem(Store.STORAGE_KEYS.match);
      if (raw) {
        const data = JSON.parse(raw);
        MatchNode.resetId();
        Match.tree               = Match._deserialize(data.tree);
        MatchNode.syncId(Match.tree);  // sync _nodeId to max restored ID to avoid future collisions
        Match.currentNode        = Match.tree;
        Match.viewOffset         = {x:0,y:0}; Match.viewZoom=1;
        Match._collapsedChildren = new Set(data.collapsed||[]);
        Match.title              = data.title     || '';
        Match.note               = data.note      || '';
        Match._libNodeId         = data.libNodeId || null;
        Match.createdAt          = data.createdAt  || 0;
        return;
      }
    } catch {}
    Match.tree=MatchNode.create({turn:0}); Match.currentNode=Match.tree;
    Match._collapsedChildren = new Set();
    Match.viewOffset = {x:0,y:0}; Match.viewZoom=1;
  },

  _serialize(node) {
    return { id:node.id, turn:node.turn, lastMove:node.lastMove, label:node.label,
      isWin: node.isWin || false,
      winRun: node.winRun ? Array.from(node.winRun) : null,
      grid:{cells:Array.from(node.grid.cells.entries())},
      children:node.children.map(c=>Match._serialize(c)) };
  },

  _deserialize(data) {
    const node = MatchNode.create({id:data.id,turn:data.turn,lastMove:data.lastMove,label:data.label,
      isWin:  data.isWin  || false,
      winRun: data.winRun ? new Set(data.winRun) : null,
    });
    node.grid.cells = new Map(data.grid.cells);
    node.children   = data.children.map(c=>{const ch=Match._deserialize(c); ch.parent=node; return ch;});
    return node;
  },


  // ── Hextic notation (import / export) ────────────────────────────────────

  /**
   * Serialize the full match tree to hextic clipboard format.
   * Numbers are Cantor-paired (q,r) coordinates; sub-arrays are branches.
   * Appends `;focusIndex` so the current node is restored on load.
   */
  toHextic() {
    if (!Match.tree?.children.length) return '';

    function serializeNode(node) {
      const coord = _hexToNat(node.lastMove.q, node.lastMove.r);
      const result = [coord];
      if (node.children.length === 1) {
        const child = serializeNode(node.children[0]);
        if (child) result.push(...child);
      } else {
        for (const child of node.children) {
          const s = serializeNode(child);
          if (s) result.push(s);
        }
      }
      return result;
    }

    const roots = Match.tree.children;
    const serialized = roots.length === 1
      ? serializeNode(roots[0])
      : roots.map(c => serializeNode(c));

    // DFS index of the current node
    const positions = Match._nodeToArray(Match.tree);
    const focusIndex = positions.indexOf(Match.currentNode);

    let out = JSON.stringify(serialized);
    if (focusIndex > 0) out += ';' + focusIndex;
    return out;
  },

  /**
   * Deserialize a hextic clipboard string and replace the current tree.
   * Returns true on success, false if the format is unrecognised.
   */
  fromHextic(text) {
    if (!text?.trim()) return false;

    let treeText = text, focusIndex = -1;
    const semi = text.indexOf(';');
    if (semi > 0) {
      treeText   = text.slice(0, semi);
      focusIndex = parseInt(text.slice(semi + 1), 10);
    }

    let data;
    try { data = JSON.parse(treeText.trim()); }
    catch { return false; }
    if (!Array.isArray(data)) return false;

    // Rebuild tree using the same algorithm as hextic's processSerializedArray
    MatchNode.resetId();
    Match.tree = MatchNode.create({ turn: 0 });
    Match._collapsedChildren.clear();
    const cursor = { node: Match.tree };

    function processArray(arr) {
      for (const item of arr) {
        if (typeof item === 'number') {
          const { q, r } = _natToHex(item);
          const t     = cursor.node.turn;
          const state = (t % 4 === 0 || t % 4 === 3) ? 1 : 2;
          const cells = new Map(Array.from(cursor.node.grid.cells, ([k, c]) => [k, { ...c }]));
          cells.set(HexGrid.key(q, r), { q, r, state, legal: false });
          const newNode = MatchNode.create({
            parent:   cursor.node,
            turn:     t + 1,
            grid:     { cells },
            lastMove: { q, r, state, turn: t },
          });
          cursor.node.children.push(newNode);
          cursor.node = newNode;
        } else if (Array.isArray(item)) {
          const saved = cursor.node;
          processArray(item);
          cursor.node = saved;
        }
      }
    }

    processArray(data);
    MatchNode.syncId(Match.tree);  // ensure _nodeId > max ID used in loaded tree

    // Restore focus
    const positions = Match._nodeToArray(Match.tree);
    Match.currentNode = (focusIndex >= 0 && focusIndex < positions.length)
      ? positions[focusIndex]
      : Match.tree;

    Match._boardActive = true;
    if (!Match.createdAt) Match.createdAt = Date.now();
    Match._syncMatchPanels();
    Match._save();
    Match._renderTree();
    Match._buildBoard();
    return true;
  },



  // ── panel layout ──────────────────────────────────────────────────────────

  _syncMatchPanels() {
    const playW  = Match.playOpen ? Layout.MATCH_PLAY_W : 0;
    const noteW  = Match.noteOpen ? Layout.MATCH_NOTE_W : 0;
    const treeW  = Match.treeOpen ? Layout.MATCH_TREE_W : 0;
    const rightW = noteW + treeW;

    const playPanel = document.getElementById('match-play-area');
    const notePanel = document.getElementById('match-note-panel');
    const treePanel = document.getElementById('match-tree-panel');
    const boardArea = document.getElementById('match-board-area');
    const evalBar   = document.getElementById('match-eval-bar');
    const toggles   = document.getElementById('match-panel-toggles');

    // Mirror editor: show/hide via display:flex (not hidden attribute)
    if (playPanel) {
      playPanel.style.display = Match.playOpen ? 'flex' : 'none';
      playPanel.style.width   = Layout.MATCH_PLAY_W + 'px'; // keep width so resize works
    }
    if (notePanel) {
      notePanel.style.display = Match.noteOpen ? 'flex' : 'none';
      notePanel.style.width   = Layout.MATCH_NOTE_W + 'px';
      notePanel.style.right   = treeW + 'px';
    }
    if (treePanel) {
      treePanel.style.display = Match.treeOpen ? 'flex' : 'none';
      treePanel.style.width   = Layout.MATCH_TREE_W + 'px';
    }
    if (boardArea) { boardArea.style.left = playW + 'px'; boardArea.style.right = rightW + 'px'; }
    if (evalBar)   { evalBar.style.left   = playW + 'px'; evalBar.style.right   = rightW + 'px'; }
    if (toggles)   { toggles.style.right  = rightW + 'px'; }

    document.getElementById('match-play-toggle')?.classList.toggle('active', Match.playOpen);
    document.getElementById('match-note-toggle')?.classList.toggle('active', Match.noteOpen);
    document.getElementById('match-tree-toggle')?.classList.toggle('active', Match.treeOpen);
  },

  /** Resize a match panel width (clamp between min/max). */
  _applyMatchPanelResize(which, newW) {
    const clamped = Math.max(150, Math.min(520, newW));
    if (which === 'play') Layout.MATCH_PLAY_W = clamped;
    if (which === 'note') Layout.MATCH_NOTE_W = clamped;
    if (which === 'tree') Layout.MATCH_TREE_W = clamped;
    Match._syncMatchPanels();
    Match._buildBoard();
  },

  /** Guard: show start modal if board isn't active yet. Returns true if ok to proceed. */
  _requireActive() {
    if (Match._boardActive) return true;
    Match._showStartModal();
    return false;
  },

    // ── events ────────────────────────────────────────────────────────────────

  _bindEvents() {
    const svg=Match._view.el, area=document.getElementById('match-board-area');
    let isPanning=false, dragged=false, panStart={}, startOffset={}, rafId=null;

    const updateTransform=()=>{
      const g=svg.querySelector('g'); if(!g) return;
      g.setAttribute('transform',`translate(${svg._w/2+Match.viewOffset.x},${svg._h/2+Match.viewOffset.y}) scale(${Match.viewZoom})`);
    };

    const canPanZoom=()=>{ for(const c of Match.currentNode.grid.cells.values()) if(c.state) return true; return false; };
    const cellAt=(x,y)=>{ const el=document.elementFromPoint(x,y)?.closest('[data-q]'); return el?{q:+el.dataset.q,r:+el.dataset.r}:null; };

    area.addEventListener('mousedown', e=>{
      if (e.button!==0) return; e.preventDefault();
      if (Match.selectionMode) {
        const pos=cellAt(e.clientX,e.clientY);
        if (pos) { Match._selAnchor=pos; Match._selCache=Match._computeVisibleCells(Match.currentNode.grid.cells); Match._updateSelection(pos.q,pos.r); Match._buildBoard(); }
        return;
      }
      if (canPanZoom()) { isPanning=true; dragged=false; panStart={x:e.clientX,y:e.clientY}; startOffset={...Match.viewOffset}; area.style.cursor='grabbing'; }
      else { isPanning=false; dragged=false; }
    });

    document.addEventListener('mousemove', e=>{
      if (Match.selectionMode&&Match._selAnchor) {
        const pos=cellAt(e.clientX,e.clientY);
        if (pos) { if(Match._selRafId) cancelAnimationFrame(Match._selRafId); Match._selRafId=requestAnimationFrame(()=>{ Match._updateSelection(pos.q,pos.r); Match._buildBoard(); Match._selRafId=null; }); }
        return;
      }
      if (!isPanning||!canPanZoom()) return;
      const dx=e.clientX-panStart.x, dy=e.clientY-panStart.y;
      if(Math.abs(dx)>3||Math.abs(dy)>3) dragged=true;
      Match.viewOffset.x=startOffset.x+dx; Match.viewOffset.y=startOffset.y+dy;
      if(rafId) cancelAnimationFrame(rafId); rafId=requestAnimationFrame(updateTransform);
    });

    document.addEventListener('mouseup', e=>{
      if (Match.selectionMode) {
        if (Match._selAnchor) {
          const pos = cellAt(e.clientX, e.clientY);
          if (pos) Match._updateSelection(pos.q, pos.r);
          Match._selCache = null;
          // Auto-extract on release — the whole point of the tool
          Match.extractSelection();
        }
        // Always exit selection mode after release
        Match.selectionMode = false;
        document.getElementById('btn-match-select')?.classList.remove('active');
        Match.clearSelection(); // hides info, rebuilds board
        return;
      }
      if (isPanning) {
        isPanning=false; area.style.cursor='crosshair';
        if (!dragged&&e.button===0) { const g=e.target.closest('[data-q]'); if(g) Match._tryMoveOrNavigate(+g.dataset.q,+g.dataset.r); }
        if(rafId){cancelAnimationFrame(rafId);rafId=null;}
      } else if (!canPanZoom()&&e.button===0) {
        const g=e.target.closest('[data-q]'); if(g) Match._tryMoveOrNavigate(+g.dataset.q,+g.dataset.r);
      }
    });

    document.addEventListener('contextmenu', e=>{ if(!document.getElementById('view-match')?.hidden) e.preventDefault(); });

    document.addEventListener('wheel', e=>{
      if (document.getElementById('view-match').hidden||!canPanZoom()) return;
      if (e.target.closest('#match-tree-content')) return;
      e.preventDefault();
      const oldZ=Match.viewZoom, rect=area.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top, cx=rect.width/2, cy=rect.height/2;
      const bx=(mx-(cx+Match.viewOffset.x))/oldZ, by=(my-(cy+Match.viewOffset.y))/oldZ;
      const nz=Math.max(Match.MIN_ZOOM,Math.min(Match.MAX_ZOOM,oldZ*(e.deltaY>0?0.9:1.1)));
      if(nz!==oldZ){Match.viewOffset.x=mx-cx-bx*nz; Match.viewOffset.y=my-cy-by*nz; Match.viewZoom=nz; if(rafId)cancelAnimationFrame(rafId); rafId=requestAnimationFrame(updateTransform);}
    },{passive:false});

    document.getElementById('btn-match-undo')?.addEventListener('click',       ()=>Match.undo());
    document.getElementById('btn-match-clear')?.addEventListener('click',      ()=>{if(confirm('Clear match tree?'))Match.clear();});
    document.getElementById('btn-match-reset-view')?.addEventListener('click', ()=>{ if(canPanZoom()){Match.viewOffset={x:0,y:0};Match.viewZoom=1;Match._buildBoard();} });
    document.getElementById('btn-match-select')?.addEventListener('click',    ()=>Match.toggleSelectMode());

    document.getElementById('btn-match-save')?.addEventListener('click', () => {
      if (Match._onSaveToLibrary) Match._onSaveToLibrary();
    });
    // Resize handles wired by App._bindResizeHandles()

    window.addEventListener('resize',()=>{ if(UI.activeView==='match') Match._buildBoard(); });
  },
};

// ── Hextic notation codec ─────────────────────────────────────────────────────
// Compatible with the hextic game's clipboard format (github.com/waffle3z/hextic).
// Uses Cantor pairing to encode axial (q,r) coordinates as natural numbers,
// and a nested JSON array to represent the full game tree with branches.

// Integer ↔ natural bijection: 0→0, 1→1, -1→2, 2→3, -2→4, 3→5, -3→6 …
// f(n) = 2n-1 for n>0,  -2n for n≤0
function _intToNat(n) { return n > 0 ? 2 * n - 1 : -2 * n; }
function _natToInt(n) { return n === 0 ? 0 : n % 2 === 1 ? (n + 1) / 2 : -n / 2; }

// Szudzik pairing (matches hextic's clipboard format exactly)
// pair(a,b) = a²+a+b if a≥b, else a+b²
function _hexToNat(q, r) {
  const a = _intToNat(q), b = _intToNat(r);
  return a >= b ? a * a + a + b : a + b * b;
}

function _natToHex(n) {
  const m = Math.floor(Math.sqrt(n));
  const a = n - m * m < m ? n - m * m : m;
  const b = n - m * m < m ? m         : n - m * m - m;
  return { q: _natToInt(a), r: _natToInt(b) };
}


export { Match, MatchNode };