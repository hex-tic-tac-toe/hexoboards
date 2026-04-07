/**
 * GameImport — fetch and import games from hexo.did.science
 *
 * Integrated into the match import modal.
 */

const GameImport = {
  currentPage: 1,
  pageSize: 10,
  games: [],
  loading: false,
  error: null,

  onImport: null,

  init() {},

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

  async fetchGameMoves(gameId) {
    try {
      const res = await fetch(`/api/hexo/games?id=${encodeURIComponent(gameId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const moves = GameImport.parseMovesFromHtml(text);
      if (moves.length === 0) {
        throw new Error('No moves found in game page');
      }
      return moves;
    } catch (e) {
      GameImport.error = e.message;
      return null;
    }
  },

  parseMovesFromHtml(html) {
    const moves = [];
    
    // Try JSON data in script tags (React apps often embed state this way)
    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (scriptMatch) {
      try {
        const data = JSON.parse(scriptMatch[1]);
        const props = data.props?.pageProps || data.props || {};
        const gameData = props.game || props.initialGameState || props.gameState;
        if (gameData?.moves) {
          for (const m of gameData.moves) {
            moves.push({ q: m.q ?? m.x ?? m.column, r: m.r ?? m.y ?? m.row });
          }
        }
        if (gameData?.history) {
          for (const m of gameData.history) {
            moves.push({ q: m.q ?? m.x, r: m.r ?? m.y });
          }
        }
        if (moves.length > 0) return moves;
      } catch (e) { console.log('JSON parse failed', e.message); }
    }
    
    // Try window.__GAME_DATA__ or similar
    const windowMatch = html.match(/window\.__([A-Z_]+)\s*=\s*({.*?});/);
    if (windowMatch) {
      try {
        const data = JSON.parse(windowMatch[2]);
        if (data.moves) {
          for (const m of data.moves) {
            moves.push({ q: m.q ?? m.x, r: m.r ?? m.y });
          }
        }
        if (moves.length > 0) return moves;
      } catch (e) {}
    }
    
    // Try embedded JSON in page props
    const propsMatch = html.match(/"moves"\s*:\s*\[(.*?)\]/);
    if (propsMatch) {
      try {
        const movesArr = JSON.parse('[' + propsMatch[1] + ']');
        for (const m of movesArr) {
          moves.push({ q: m.q ?? m.x, r: m.r ?? m.y });
        }
        if (moves.length > 0) return moves;
      } catch (e) {}
    }
    
    // Last resort: look for "placed at" pattern (may not work on minified HTML)
    const regex = /placed at \(([-\d]+),\s*([-\d]+)\)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const q = parseInt(match[1], 10);
      const r = parseInt(match[2], 10);
      moves.push({ q, r });
    }
    
    return moves;
  },

  movesToHextic(moves) {
    if (!moves || moves.length === 0) return '';
    const result = [];
    for (const move of moves) {
      // Output [q,r] axial format
      result.push([move.q, move.r]);
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
      // Skip duplicates (same position appears twice in HTML - once in timeline, once in current step)
      const uniqueMoves = [];
      for (const m of moves) {
        const key = `${m.q},${m.r}`;
        if (!uniqueMoves.some(u => `${u.q},${u.r}` === key)) {
          uniqueMoves.push(m);
        }
      }
      const hextic = GameImport.movesToHextic(uniqueMoves);
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

  formatDuration(ms) {
    if (!ms) return '-';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  },

  async refresh() {
    await GameImport.fetchRecentGames(GameImport.currentPage);
    GameImport._renderRecentGames();
  },

  async prevPage() {
    if (GameImport.currentPage > 1) {
      GameImport.currentPage--;
      await GameImport.refresh();
    }
  },

  async nextPage() {
    GameImport.currentPage++;
    await GameImport.refresh();
  },

  _renderRecentGames() {
    const list = document.getElementById('hexo-recent-list');
    const pageEl = document.getElementById('hexo-page');
    if (!list) return;

    list.innerHTML = '';

    if (GameImport.loading) {
      list.innerHTML = '<div style="padding:10px;color:var(--dim);font-size:10px;">Loading…</div>';
      return;
    }

    if (GameImport.error) {
      list.innerHTML = `<div style="padding:10px;color:#c55;font-size:10px;">Error: ${GameImport.error}</div>`;
      return;
    }

    for (const game of GameImport.games) {
      const item = document.createElement('div');
      item.className = 'hexo-game-item';
      item.dataset.gameId = game.id;

      const winner = game.players.find(p => p.playerId === game.gameResult?.winningPlayerId);
      const loser = game.players.find(p => p.playerId !== game.gameResult?.winningPlayerId);

      item.innerHTML = `
        <div class="hexo-game-players">
          <span class="${winner ? 'winner' : ''}">${winner?.displayName || '?'}</span>
          <span class="vs">vs</span>
          <span>${loser?.displayName || '?'}</span>
        </div>
        <div class="hexo-game-meta">
          <span>${game.moveCount || 0} moves</span>
          <span>${GameImport.formatDuration(game.gameResult?.durationMs)}</span>
        </div>
      `;

      item.addEventListener('click', async () => {
        const status = document.getElementById('match-import-status');
        if (status) status.textContent = 'Importing…';
        await GameImport.importGame(game.id);
      });

      list.appendChild(item);
    }

    if (pageEl) {
      pageEl.textContent = `page ${GameImport.currentPage}`;
    }
  },
};

export { GameImport };
