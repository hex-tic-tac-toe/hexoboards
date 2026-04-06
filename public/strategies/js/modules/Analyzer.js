import { HexGrid }       from './HexGrid.js';
import { BoardRenderer } from './BoardRenderer.js';
import { UI }            from './UI.js';
import { HexLayout }     from './HexLayout.js';

const Analyzer = {
  tree: null,
  currentNode: null,
  viewOffset: { x: 0, y: 0 },
  viewZoom: 1,
  MIN_ZOOM: 0.3,
  MAX_ZOOM: 3,
  _lastBoardEmpty: true,
  _expandedNodes: null,

  init() {
    Analyzer.tree = AnalyzerNode.create({ turn: 0 });
    Analyzer.currentNode = Analyzer.tree;
    Analyzer._lastBoardEmpty = true;
    Analyzer.viewOffset = { x: 0, y: 0 };
    Analyzer.viewZoom = 1.5;
    Analyzer._expandedNodes = null;
    Analyzer._renderTree();
    Analyzer._bindEvents();
    Analyzer._buildBoard();
  },

  getTurn() {
    return Analyzer.currentNode.turn;
  },

  getTurnPlayer() {
    const turn = Analyzer.getTurn();
    const idx = turn % 4;
    return (idx === 0 || idx === 3) ? 1 : 2;
  },

  _computeVisibleCells(cells) {
    const visible = new Map();
    const maxDist = 8;
    
    if (cells.size === 0) {
      visible.set('0,0', { q: 0, r: 0, state: 0, legal: true });
      return visible;
    }

    const occupied = new Set([...cells.keys()]);
    
    for (const key of occupied) {
      const [cq, cr] = key.split(',').map(Number);
      const cell = cells.get(key);
      visible.set(key, { q: cq, r: cr, state: cell.state, legal: false });
      
      for (let dq = -maxDist; dq <= maxDist; dq++) {
        for (let dr = -maxDist; dr <= maxDist; dr++) {
          const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
          if (dist > maxDist) continue;
          
          const q = cq + dq;
          const r = cr + dr;
          const k = `${q},${r}`;
          
          if (!visible.has(k)) {
            visible.set(k, { q, r, state: 0, legal: true });
          }
        }
      }
    }
    
    return visible;
  },

  _isLegalMove(q, r, cells) {
    const key = `${q},${r}`;
    
    if (cells.has(key)) {
      const cell = cells.get(key);
      if (cell.state !== 0) return false;
      return cell.legal === true;
    }
    
    if (cells.size === 0) {
      return q === 0 && r === 0;
    }

    const maxDist = 8;
    for (const k of cells.keys()) {
      const [cq, cr] = k.split(',').map(Number);
      const dist = (Math.abs(q - cq) + Math.abs(r - cr) + Math.abs(q + r - cq - cr)) / 2;
      if (dist <= maxDist) return true;
    }
    return false;
  },

  _getExpectedState() {
    const turn = Analyzer.getTurn();
    const idx = turn % 4;
    return (idx === 0 || idx === 3) ? 1 : 2;
  },

  _applyStone(q, r) {
    const cells = Analyzer.currentNode.grid.cells;
    
    if (!Analyzer._isLegalMove(q, r, cells)) {
      return;
    }

    const state = Analyzer._getExpectedState();
    const turn = Analyzer.currentNode.turn;
    const turnNum = Math.floor(turn / 2) + 1;
    const moveInTurn = turn % 2 === 0 ? 'X' : 'O';
    
    const newGrid = {
      cells: new Map()
    };
    for (const [key, cell] of cells) {
      newGrid.cells.set(key, { ...cell });
    }
    
    newGrid.cells.set(`${q},${r}`, { q, r, state, legal: false });
    
    const newNode = AnalyzerNode.create({
      parent: Analyzer.currentNode,
      turn: turn,
      grid: newGrid,
      lastMove: { q, r, state, turnNum, moveInTurn }
    });
    newNode.turn = turn + 1;
    
    Analyzer.currentNode.children.push(newNode);
    Analyzer.currentNode = newNode;
    
    Analyzer._save();
    Analyzer._renderTree();
    Analyzer._buildBoard();
  },

  _commitMovePair() {
  },

  _fork(q, r) {
    const cells = Analyzer.currentNode.grid.cells;
    
    if (!Analyzer._isLegalMove(q, r, cells)) {
      return;
    }

    const state = Analyzer._getExpectedState();
    const turn = Analyzer.currentNode.turn;
    const turnNum = Math.floor(turn / 2) + 1;
    const moveInTurn = turn % 2 === 0 ? 'X' : 'O';
    
    const newGrid = {
      cells: new Map()
    };
    for (const [key, cell] of cells) {
      newGrid.cells.set(key, { ...cell });
    }
    
    newGrid.cells.set(`${q},${r}`, { q, r, state, legal: false });
    
    const newNode = AnalyzerNode.create({
      parent: Analyzer.currentNode,
      turn: turn,
      grid: newGrid,
      lastMove: { q, r, state, turnNum, moveInTurn }
    });
    newNode.turn = turn + 1;
    
    Analyzer.currentNode.children.push(newNode);
    Analyzer.currentNode = newNode;
    
    Analyzer._save();
    Analyzer._renderTree();
    Analyzer._buildBoard();
  },

  _goTo(node) {
    Analyzer.currentNode = node;
    Analyzer._renderTree();
    Analyzer._buildBoard();
  },

  undo() {
    if (!Analyzer.currentNode.parent && Analyzer.currentNode.turn === 0) return;
    if (Analyzer.currentNode.parent) {
      Analyzer.currentNode = Analyzer.currentNode.parent;
    } else {
      const arr = Analyzer._nodeToArray(Analyzer.tree);
      const idx = arr.findIndex(n => n === Analyzer.currentNode);
      if (idx > 0) {
        Analyzer.currentNode = arr[idx - 1];
      }
    }
    Analyzer._renderTree();
    Analyzer._buildBoard();
  },

  clear() {
    Analyzer.tree = AnalyzerNode.create({ turn: 0 });
    Analyzer.currentNode = Analyzer.tree;
    Analyzer.viewOffset = { x: 0, y: 0 };
    Analyzer.viewZoom = 1;
    Analyzer._save();
    Analyzer._renderTree();
    Analyzer._buildBoard();
  },

  _nodeToArray(node, arr = []) {
    arr.push(node);
    for (const child of node.children) {
      Analyzer._nodeToArray(child, arr);
    }
    return arr;
  },

  _buildBoard() {
    const svg = document.getElementById('analyze-board-svg');
    const area = document.getElementById('analyze-board-area');
    const rect = area.getBoundingClientRect();
    let w = rect.width || 600;
    let h = rect.height || 400;
    if (w < 100 || h < 100) { w = 800; h = 600; }
    
    const visibleCells = Analyzer._computeVisibleCells(Analyzer.currentNode.grid.cells);
    
    let maxCoord = 0;
    for (const cell of visibleCells.values()) {
      const dist = (Math.abs(cell.q) + Math.abs(cell.r) + Math.abs(cell.q + cell.r)) / 2;
      maxCoord = Math.max(maxCoord, dist);
    }
    const gridSize = Math.max(5, maxCoord + 2);
    
    const margin = 80;
    const baseR = HexLayout.fitRadius(11, w, h, margin);
    const grid = { s: gridSize, baseR, cells: visibleCells };
    
    const wasEmpty = Analyzer._lastBoardEmpty;
    const nowEmpty = Analyzer.currentNode.grid.cells.size === 0;
    Analyzer._lastBoardEmpty = nowEmpty;
    
    let offset, zoom;
    if (nowEmpty) {
      offset = { x: 0, y: 0 };
      zoom = 1;
    } else {
      offset = Analyzer.viewOffset;
      zoom = Analyzer.viewZoom;
    }
    
    BoardRenderer.build(svg, grid, [], { w, h, margin, zoom, offset });
    
    const turn = Analyzer.getTurn();
    const player = Analyzer.getTurnPlayer();
    document.getElementById('analyze-turn').textContent = `${player === 1 ? 'X' : 'O'}'s turn`;
    document.getElementById('analyze-move-count').textContent = `move ${turn}`;
  },

  _renderTree() {
    const container = document.getElementById('analyze-tree-content');
    if (!container) return;
    container.innerHTML = '';
    container.tabIndex = 0;
    
    const currentId = Analyzer.currentNode?.id;
    
    const formatNode = (node) => {
      if (node.lastMove) {
        const player = node.lastMove.state === 1 ? 'X' : 'O';
        return `${player} ${node.turn}`;
      }
      return 'start';
    };
    
    const renderNode = (node, isChildOfFork = false) => {
      const isCurrent = node.id === currentId;
      const branchCount = node.children.length;
      const isFork = branchCount >= 2;
      
      const lineEl = document.createElement('div');
      lineEl.className = 'tree-node' + (isCurrent ? ' current' : '') + (isFork ? ' fork' : '') + (isChildOfFork ? ' child-of-fork' : '');
      lineEl.dataset.nodeId = node.id;
      
      const contentEl = document.createElement('span');
      contentEl.className = 'tree-node-content';
      contentEl.textContent = formatNode(node);
      lineEl.appendChild(contentEl);
      
      const coordsEl = document.createElement('span');
      coordsEl.className = 'tree-node-coords';
      if (node.lastMove) {
        coordsEl.textContent = `${node.lastMove.q},${node.lastMove.r}`;
      }
      lineEl.appendChild(coordsEl);
      
      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'tree-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete this node and children';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (node === Analyzer.tree) {
          if (confirm('Clear entire match tree?')) Analyzer.clear();
        } else if (confirm('Delete this node and all its children?')) {
          Analyzer._deleteNode(node);
        }
      });
      lineEl.appendChild(deleteBtn);
      
      lineEl.addEventListener('click', () => Analyzer._goTo(node));
      
      if (isFork) {
        const group = document.createElement('div');
        group.className = 'tree-group';
        group.appendChild(lineEl);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children is-fork';
        
        node.children.forEach((child, i) => {
          if (i > 0) {
            const branchLine = document.createElement('div');
            branchLine.className = 'tree-branch-line';
            branchLine.style.top = '14px';
            childrenContainer.appendChild(branchLine);
          }
          childrenContainer.appendChild(renderNode(child, true));
        });
        
        group.appendChild(childrenContainer);
        return group;
      }
      
      if (branchCount > 0) {
        const group = document.createElement('div');
        group.className = 'tree-group';
        group.appendChild(lineEl);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        
        node.children.forEach((child) => {
          childrenContainer.appendChild(renderNode(child, false));
        });
        
        group.appendChild(childrenContainer);
        return group;
      }
      
      return lineEl;
    };
    
    container.appendChild(renderNode(Analyzer.tree, false));
    
    container.onkeydown = (e) => {
      const visible = Array.from(container.querySelectorAll('.tree-node'));
      const currentIdx = visible.findIndex(el => el.classList.contains('current'));
      
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = Math.min(currentIdx + 1, visible.length - 1);
        const nextNodeId = visible[nextIdx].dataset.nodeId;
        Analyzer._goToById(+nextNodeId);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = Math.max(currentIdx - 1, 0);
        const prevNodeId = visible[prevIdx].dataset.nodeId;
        Analyzer._goToById(+prevNodeId);
      }
    };
  },
  
  _deleteNode(node) {
    if (!node.parent) return;
    const parent = node.parent;
    parent.children = parent.children.filter(c => c !== node);
    if (Analyzer.currentNode === node || Analyzer._isDescendant(Analyzer.currentNode, node)) {
      Analyzer.currentNode = parent;
    }
    Analyzer._save();
    Analyzer._renderTree();
    Analyzer._buildBoard();
    
    requestAnimationFrame(() => {
      const currentEl = document.querySelector('.tree-node.current');
      if (currentEl) currentEl.focus();
      else document.getElementById('analyze-tree-content').focus();
    });
  },
  
  _isDescendant(ancestor, descendant) {
    let current = descendant.parent;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  },
  
  _goToById(nodeId) {
    const findNode = (node) => {
      if (node.id === nodeId) return node;
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };
    const node = findNode(Analyzer.tree);
    if (node) Analyzer._goTo(node);
  },

  _canPanZoom() {
    if (!Analyzer.currentNode) return false;
    const cells = Analyzer.currentNode.grid.cells;
    let count = 0;
    for (const cell of cells.values()) {
      if (cell.state !== 0) count++;
    }
    return count >= 1;
  },

  _bindEvents() {
    const svg = document.getElementById('analyze-board-svg');
    const area = document.getElementById('analyze-board-area');
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let startOffset = { x: 0, y: 0 };
    let dragged = false;
    let rafId = null;

    const updateTransform = () => {
      const g = svg.querySelector('g');
      if (g) {
        const centerX = svg._w / 2;
        const centerY = svg._h / 2;
        g.setAttribute('transform', `translate(${centerX + Analyzer.viewOffset.x}, ${centerY + Analyzer.viewOffset.y}) scale(${Analyzer.viewZoom})`);
      }
    };

    area.addEventListener('mousedown', e => {
      if (e.button === 0) {
        if (Analyzer._canPanZoom()) {
          isPanning = true;
          dragged = false;
          panStart = { x: e.clientX, y: e.clientY };
          startOffset = { ...Analyzer.viewOffset };
          area.style.cursor = 'grabbing';
        } else {
          isPanning = false;
          dragged = false;
        }
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', e => {
      if (isPanning && Analyzer._canPanZoom()) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          dragged = true;
        }
        Analyzer.viewOffset.x = startOffset.x + dx;
        Analyzer.viewOffset.y = startOffset.y + dy;
        
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateTransform);
      }
    });

    document.addEventListener('mouseup', e => {
      if (isPanning) {
        isPanning = false;
        area.style.cursor = 'crosshair';
        
        if (!dragged && e.button === 0) {
          const g = e.target.closest('[data-q]');
          if (g) {
            const q = +g.dataset.q;
            const r = +g.dataset.r;
            Analyzer._tryMoveOrNavigate(q, r);
          }
        }
        
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!Analyzer._canPanZoom() && e.button === 0) {
        const g = e.target.closest('[data-q]');
        if (g) {
          const q = +g.dataset.q;
          const r = +g.dataset.r;
          Analyzer._tryMoveOrNavigate(q, r);
        }
      }
    });

    document.addEventListener('contextmenu', e => {
      if (document.getElementById('view-analyze')?.hidden === false) {
        e.preventDefault();
      }
    });

    document.addEventListener('wheel', e => {
      if (document.getElementById('view-analyze').hidden || !Analyzer._canPanZoom()) return;
      if (e.target.closest('#analyze-tree-content')) return;
      e.preventDefault();
      
      const oldZoom = Analyzer.viewZoom;
      const rect = area.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const boardX = (mouseX - (centerX + Analyzer.viewOffset.x)) / oldZoom;
      const boardY = (mouseY - (centerY + Analyzer.viewOffset.y)) / oldZoom;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(Analyzer.MIN_ZOOM, Math.min(Analyzer.MAX_ZOOM, oldZoom * delta));
      
      if (newZoom !== oldZoom) {
        Analyzer.viewOffset.x = mouseX - centerX - boardX * newZoom;
        Analyzer.viewOffset.y = mouseY - centerY - boardY * newZoom;
        Analyzer.viewZoom = newZoom;
        
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateTransform);
      }
    }, { passive: false });

    document.getElementById('btn-analyze-undo').addEventListener('click', () => Analyzer.undo());
    document.getElementById('btn-analyze-clear').addEventListener('click', () => {
      if (confirm('Clear match tree?')) Analyzer.clear();
    });
    document.getElementById('btn-analyze-reset-view').addEventListener('click', () => {
      if (Analyzer._canPanZoom()) {
        Analyzer.viewOffset = { x: 0, y: 0 };
        Analyzer.viewZoom = 1;
        Analyzer._buildBoard();
      }
    });
    
    const treePanel = document.getElementById('analyze-tree-panel');
    const resizeHandle = document.getElementById('analyze-tree-resize');
    let isResizing = false;
    
    const onResize = e => {
      if (!isResizing) return;
      const newWidth = Math.max(150, Math.min(500, window.innerWidth - e.clientX));
      treePanel.style.width = `${newWidth}px`;
      Analyzer._buildBoard();
    };
    
    const stopResize = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onResize);
      }
    };
    
    resizeHandle.addEventListener('mousedown', e => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', stopResize);
      e.preventDefault();
    });

    window.addEventListener('resize', () => {
      if (UI.activeView === 'analyze') Analyzer._buildBoard();
    });
  },

  _tryMoveOrNavigate(q, r) {
    const key = `${q},${r}`;
    const cells = Analyzer.currentNode.grid.cells;
    const cell = cells.get(key);
    
    if (cell && cell.state !== 0 && Analyzer.currentNode.children.length > 0) {
      Analyzer._fork(q, r);
      return;
    }
    
    const existingChild = Analyzer.currentNode.children.find(child => 
      child.lastMove && child.lastMove.q === q && child.lastMove.r === r
    );
    if (existingChild) {
      Analyzer._goTo(existingChild);
    } else if (Analyzer._isLegalMove(q, r, cells)) {
      Analyzer._applyStone(q, r);
    }
  },

  _save() {
    try {
      localStorage.setItem('hexstrat-analyzer', JSON.stringify({
        tree: Analyzer._serialize(Analyzer.tree),
        viewOffset: Analyzer.viewOffset,
        viewZoom: Analyzer.viewZoom
      }));
    } catch {}
  },

  _load() {
    try {
      const data = localStorage.getItem('hexstrat-analyzer');
      if (data) {
        const parsed = JSON.parse(data);
        AnalyzerNode.resetId();
        Analyzer.tree = Analyzer._deserialize(parsed.tree);
        Analyzer.currentNode = Analyzer.tree;
        Analyzer.viewOffset = { x: 0, y: 0 };
        Analyzer.viewZoom = 1;
        Analyzer._expandedNodes = null;
      }
    } catch {
      Analyzer.tree = AnalyzerNode.create({ turn: 0 });
      Analyzer.currentNode = Analyzer.tree;
      Analyzer._expandedNodes = null;
    }
  },

  _serialize(node) {
    return {
      id: node.id,
      turn: node.turn,
      lastMove: node.lastMove,
      grid: { cells: Array.from(node.grid.cells.entries()) },
      children: node.children.map(c => Analyzer._serialize(c))
    };
  },

  _deserialize(data) {
    const node = AnalyzerNode.create({ id: data.id, turn: data.turn, lastMove: data.lastMove });
    node.grid.cells = new Map(data.grid.cells);
    node.children = data.children.map(c => Analyzer._deserialize(c));
    return node;
  },
};

let _nodeId = 0;
const AnalyzerNode = {
  resetId() { _nodeId = 0; },
  create(opts = {}) {
    return {
      id: opts.id ?? ++_nodeId,
      parent: opts.parent || null,
      turn: opts.turn || 0,
      grid: opts.grid || { cells: new Map() },
      lastMove: opts.lastMove || null,
      children: []
    };
  }
};

export { Analyzer, AnalyzerNode };