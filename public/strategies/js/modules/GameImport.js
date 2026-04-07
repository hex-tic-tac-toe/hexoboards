/**
 * GameImport — fetch and import games from hexo.did.science
 *
 * Features:
 *   • Browse recent finished games (paginated)
 *   • View active sessions
 *   • Import by game ID or URL
 *   • Search for games by player name
 *   • Convert hexo moves to hextic notation
 */

const GameImport = {
  panelOpen: false,
  currentPage: 1,
  pageSize: 20,
  games: [],
  sessions: [],
  loading: false,
  error: null,
  searchQuery: '',
  searchResults: [],
  activeTab: 'recent',

  onImport: null,

  init() {
    GameImport.panelOpen = false;
  },

  async fetchRecentGames(page = 1) {
    GameImport.loading = true;
    GameImport.error = null;
    try {
      const res = await fetch(`/api/hexo/finished-games?page=${page}&pageSize=${GameImport.pageSize}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      GameImport.games = data.games || [];
      GameImport.currentPage = data.pagination?.page || page;
      GameImport.loading = false;
      return data;
    } catch (e) {
      GameImport.error = e.message;
      GameImport.loading = false;
      return null;
    }
  },

  async fetchActiveSessions() {
    GameImport.loading = true;
    GameImport.error = null;
    try {
      const res = await fetch('/api/hexo/sessions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      GameImport.sessions = data || [];
      GameImport.loading = false;
      return data;
    } catch (e) {
      GameImport.error = e.message;
      GameImport.loading = false;
      return null;
    }
  },

  async fetchGameMoves(gameId) {
    try {
      const res = await fetch(`/api/hexo/games?id=${encodeURIComponent(gameId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      return GameImport.parseMovesFromHtml(html);
    } catch (e) {
      GameImport.error = e.message;
      return null;
    }
  },

  parseMovesFromHtml(html) {
    const moves = [];
    const moveRegex = /Move\s+(\d+)[\s\S]*?(?:placed at|Initial board)[^\(]*\(([-\d]+),\s*([-\d]+)\)/gi;
    let match;
    while ((match = moveRegex.exec(html)) !== null) {
      const moveNum = parseInt(match[1], 10);
      const q = parseInt(match[2], 10);
      const r = parseInt(match[3], 10);
      moves.push({ moveNum, q, r });
    }
    if (moves.length === 0) {
      const altRegex = /placed at \(([-\d]+),\s*([-\d]+)\)/gi;
      let altMatch;
      let moveNum = 0;
      while ((altMatch = altRegex.exec(html)) !== null) {
        moveNum++;
        const q = parseInt(altMatch[1], 10);
        const r = parseInt(altMatch[2], 10);
        moves.push({ moveNum, q, r });
      }
    }
    moves.sort((a, b) => a.moveNum - b.moveNum);
    return moves;
  },

  movesToHextic(moves) {
    if (!moves || moves.length === 0) return '';
    const result = [];
    for (const move of moves) {
      const nat = GameImport._hexToNat(move.q, move.r);
      result.push(nat);
    }
    return JSON.stringify(result);
  },

  _hexToNat(q, r) {
    const x = q >= 0 ? 2 * q : -2 * q - 1;
    const y = r >= 0 ? 2 * r : -2 * r - 1;
    return (x * x + 3 * x + 2 * x * y + y + y * y) / 2;
  },

  parseGameUrl(input) {
    const trimmed = input.trim();
    const uuidMatch = trimmed.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (uuidMatch) return uuidMatch[1];
    const gamesMatch = trimmed.match(/games\/([a-zA-Z0-9]+)/);
    if (gamesMatch) return gamesMatch[1];
    if (/^[a-zA-Z0-9]{6,}$/.test(trimmed)) return trimmed;
    return null;
  },

  async importGame(gameId) {
    GameImport.loading = true;
    GameImport.error = null;
    try {
      const moves = await GameImport.fetchGameMoves(gameId);
      if (!moves || moves.length === 0) {
        throw new Error('No moves found');
      }
      const hextic = GameImport.movesToHextic(moves);
      GameImport.loading = false;
      if (GameImport.onImport) {
        GameImport.onImport(hextic, gameId);
      }
      return hextic;
    } catch (e) {
      GameImport.error = e.message;
      GameImport.loading = false;
      return null;
    }
  },

  async searchGames(query, page = 1) {
    if (!query || query.length < 2) {
      GameImport.searchResults = [];
      return [];
    }
    GameImport.loading = true;
    GameImport.error = null;
    try {
      const res = await fetch(`/api/hexo/finished-games?page=${page}&pageSize=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const q = query.toLowerCase();
      const filtered = (data.games || []).filter(g => {
        for (const p of g.players || []) {
          if (p.displayName && p.displayName.toLowerCase().includes(q)) return true;
        }
        if (g.sessionId && g.sessionId.toLowerCase().includes(q)) return true;
        return false;
      });
      GameImport.searchResults = filtered;
      GameImport.loading = false;
      return filtered;
    } catch (e) {
      GameImport.error = e.message;
      GameImport.loading = false;
      return [];
    }
  },

  formatDuration(ms) {
    if (!ms) return '-';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  },

  formatTimeControl(tc) {
    if (!tc) return '-';
    const main = Math.floor((tc.mainTimeMs || 0) / 60000);
    const inc = Math.floor((tc.incrementMs || 0) / 1000);
    if (tc.mode === 'unlimited') return '∞';
    return inc > 0 ? `${main}m+${inc}s` : `${main}m`;
  },

  formatDate(ts) {
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString();
  },

  togglePanel() {
    GameImport.panelOpen = !GameImport.panelOpen;
    if (GameImport.panelOpen) {
      GameImport.refresh();
    }
  },

  async refresh() {
    if (GameImport.activeTab === 'recent') {
      await GameImport.fetchRecentGames(GameImport.currentPage);
    } else if (GameImport.activeTab === 'active') {
      await GameImport.fetchActiveSessions();
    }
    GameImport._render();
  },

  setTab(tab) {
    GameImport.activeTab = tab;
    GameImport.currentPage = 1;
    GameImport.refresh();
  },

  async prevPage() {
    if (GameImport.currentPage > 1) {
      GameImport.currentPage--;
      await GameImport.fetchRecentGames(GameImport.currentPage);
      GameImport._render();
    }
  },

  async nextPage() {
    GameImport.currentPage++;
    await GameImport.fetchRecentGames(GameImport.currentPage);
    GameImport._render();
  },

  _render() {
    const content = document.getElementById('gameimport-content');
    if (!content) return;
    content.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.className = 'gi-header';
    hdr.innerHTML = `
      <span class="gi-title">Import from Hexo</span>
      <button class="btn gi-close" id="btn-gi-close">×</button>
    `;
    content.appendChild(hdr);

    const tabs = document.createElement('div');
    tabs.className = 'gi-tabs';
    tabs.innerHTML = `
      <button class="btn gi-tab ${GameImport.activeTab === 'recent' ? 'active' : ''}" data-tab="recent">Recent</button>
      <button class="btn gi-tab ${GameImport.activeTab === 'active' ? 'active' : ''}" data-tab="active">Live</button>
      <button class="btn gi-tab ${GameImport.activeTab === 'search' ? 'active' : ''}" data-tab="search">Search</button>
      <button class="btn gi-tab ${GameImport.activeTab === 'import' ? 'active' : ''}" data-tab="import">Import ID</button>
    `;
    content.appendChild(tabs);

    const body = document.createElement('div');
    body.className = 'gi-body';

    if (GameImport.activeTab === 'recent') {
      GameImport._renderRecentTab(body);
    } else if (GameImport.activeTab === 'active') {
      GameImport._renderActiveTab(body);
    } else if (GameImport.activeTab === 'search') {
      GameImport._renderSearchTab(body);
    } else if (GameImport.activeTab === 'import') {
      GameImport._renderImportTab(body);
    }

    content.appendChild(body);

    GameImport._bindPanelEvents();
  },

  _renderRecentTab(body) {
    if (GameImport.loading) {
      body.innerHTML = '<div class="gi-loading">Loading…</div>';
      return;
    }
    if (GameImport.error) {
      body.innerHTML = `<div class="gi-error">Error: ${GameImport.error}</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'gi-game-list';

    for (const game of GameImport.games) {
      const item = document.createElement('div');
      item.className = 'gi-game-item';
      item.dataset.gameId = game.id;

      const winner = game.players.find(p => p.playerId === game.gameResult?.winningPlayerId);
      const loser = game.players.find(p => p.playerId !== game.gameResult?.winningPlayerId);

      item.innerHTML = `
        <div class="gi-game-players">
          <span class="gi-player ${winner ? 'winner' : ''}">${winner?.displayName || '?'}</span>
          <span class="gi-vs">vs</span>
          <span class="gi-player">${loser?.displayName || '?'}</span>
        </div>
        <div class="gi-game-meta">
          <span class="gi-moves">${game.moveCount || 0} moves</span>
          <span class="gi-duration">${GameImport.formatDuration(game.gameResult?.durationMs)}</span>
          <span class="gi-result">${game.gameResult?.reason || '-'}</span>
        </div>
        <div class="gi-game-date">${GameImport.formatDate(game.finishedAt)}</div>
      `;
      list.appendChild(item);
    }

    body.appendChild(list);

    const pager = document.createElement('div');
    pager.className = 'gi-pager';
    pager.innerHTML = `
      <button class="btn gi-pager-btn" id="gi-prev" ${GameImport.currentPage <= 1 ? 'disabled' : ''}>← prev</button>
      <span class="gi-page">page ${GameImport.currentPage}</span>
      <button class="btn gi-pager-btn" id="gi-next">next →</button>
    `;
    body.appendChild(pager);
  },

  _renderActiveTab(body) {
    if (GameImport.loading) {
      body.innerHTML = '<div class="gi-loading">Loading…</div>';
      return;
    }
    if (GameImport.error) {
      body.innerHTML = `<div class="gi-error">Error: ${GameImport.error}</div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'gi-session-list';

    if (GameImport.sessions.length === 0) {
      list.innerHTML = '<div class="gi-empty">No active sessions</div>';
    } else {
      for (const session of GameImport.sessions) {
        const item = document.createElement('div');
        item.className = 'gi-session-item';
        item.dataset.sessionId = session.id;

        const p1 = session.players?.[0];
        const p2 = session.players?.[1];

        item.innerHTML = `
          <div class="gi-session-players">
            <span class="gi-player">${p1?.displayName || 'Waiting…'}</span>
            <span class="gi-vs">vs</span>
            <span class="gi-player">${p2?.displayName || 'Waiting…'}</span>
          </div>
          <div class="gi-session-meta">
            <span class="gi-tc">${GameImport.formatTimeControl(session.timeControl)}</span>
            <span class="gi-rated">${session.rated ? 'rated' : 'casual'}</span>
          </div>
        `;
        list.appendChild(item);
      }
    }

    body.appendChild(list);
  },

  _renderSearchTab(body) {
    const searchBox = document.createElement('div');
    searchBox.className = 'gi-search-box';
    searchBox.innerHTML = `
      <input type="text" id="gi-search-input" placeholder="Search player name…" value="${GameImport.searchQuery}">
      <button class="btn" id="gi-search-btn">Search</button>
    `;
    body.appendChild(searchBox);

    if (GameImport.loading) {
      const loading = document.createElement('div');
      loading.className = 'gi-loading';
      loading.textContent = 'Searching…';
      body.appendChild(loading);
      return;
    }

    if (GameImport.searchResults.length > 0) {
      const list = document.createElement('div');
      list.className = 'gi-game-list';

      for (const game of GameImport.searchResults) {
        const item = document.createElement('div');
        item.className = 'gi-game-item';
        item.dataset.gameId = game.id;

        const winner = game.players.find(p => p.playerId === game.gameResult?.winningPlayerId);
        const loser = game.players.find(p => p.playerId !== game.gameResult?.winningPlayerId);

        item.innerHTML = `
          <div class="gi-game-players">
            <span class="gi-player ${winner ? 'winner' : ''}">${winner?.displayName || '?'}</span>
            <span class="gi-vs">vs</span>
            <span class="gi-player">${loser?.displayName || '?'}</span>
          </div>
          <div class="gi-game-meta">
            <span class="gi-moves">${game.moveCount || 0} moves</span>
            <span class="gi-duration">${GameImport.formatDuration(game.gameResult?.durationMs)}</span>
          </div>
        `;
        list.appendChild(item);
      }

      body.appendChild(list);
    } else if (GameImport.searchQuery) {
      const empty = document.createElement('div');
      empty.className = 'gi-empty';
      empty.textContent = 'No games found';
      body.appendChild(empty);
    }
  },

  _renderImportTab(body) {
    const importBox = document.createElement('div');
    importBox.className = 'gi-import-box';
    importBox.innerHTML = `
      <div class="gi-import-hint">Paste a game URL or ID:</div>
      <input type="text" id="gi-import-input" placeholder="https://hexo.did.science/games/xxx or game ID">
      <button class="btn gi-import-btn" id="gi-import-btn">Import Game</button>
      <div id="gi-import-status" class="gi-import-status"></div>
    `;
    body.appendChild(importBox);
  },

  _bindPanelEvents() {
    document.getElementById('btn-gi-close')?.addEventListener('click', () => {
      GameImport.panelOpen = false;
      GameImport._syncPanel();
    });

    document.querySelectorAll('.gi-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        GameImport.setTab(tab.dataset.tab);
      });
    });

    document.querySelectorAll('.gi-game-item').forEach(item => {
      item.addEventListener('click', async () => {
        const gameId = item.dataset.gameId;
        if (gameId) {
          await GameImport.importGame(gameId);
        }
      });
    });

    document.getElementById('gi-prev')?.addEventListener('click', () => GameImport.prevPage());
    document.getElementById('gi-next')?.addEventListener('click', () => GameImport.nextPage());

    document.getElementById('gi-search-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('gi-search-input');
      if (input) {
        GameImport.searchQuery = input.value.trim();
        await GameImport.searchGames(GameImport.searchQuery);
        GameImport._render();
      }
    });

    document.getElementById('gi-search-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        GameImport.searchQuery = e.target.value.trim();
        await GameImport.searchGames(GameImport.searchQuery);
        GameImport._render();
      }
    });

    document.getElementById('gi-import-btn')?.addEventListener('click', async () => {
      const input = document.getElementById('gi-import-input');
      const status = document.getElementById('gi-import-status');
      if (!input || !status) return;

      const val = input.value.trim();
      if (!val) return;

      status.textContent = 'Importing…';
      const gameId = GameImport.parseGameUrl(val);
      if (!gameId) {
        status.textContent = 'Invalid game ID or URL';
        return;
      }

      const hextic = await GameImport.importGame(gameId);
      if (hextic) {
        status.textContent = 'Imported!';
      } else {
        status.textContent = GameImport.error || 'Import failed';
      }
    });

    document.getElementById('gi-import-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        document.getElementById('gi-import-btn')?.click();
      }
    });
  },

  _syncPanel() {
    const panel = document.getElementById('gameimport-panel');
    if (panel) {
      panel.style.display = GameImport.panelOpen ? 'flex' : 'none';
    }
    if (GameImport.panelOpen) {
      GameImport._render();
    }
    document.getElementById('btn-gameimport-toggle')?.classList.toggle('active', GameImport.panelOpen);
  },
};

export { GameImport };
