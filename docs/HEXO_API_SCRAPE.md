# Hexo.did.science API Data

This document contains scraped data from the Hexo (Infinity Hexagonal Tic-Tac-Toe) API.

## Quick Summary

**Website:** https://hexo.did.science  
**Total Games Archive:** 67,771 games  
**Total Moves:** 3,045,191

### Working Public APIs

| Endpoint | Description |
|----------|-------------|
| `/api/leaderboard` | Top 10 players with Elo, games played/won |
| `/api/sessions` | Currently active/live matches |
| `/api/finished-games?page=N` | Paginated archive of finished games |

### Game Result Reasons
- `six-in-a-row` - Most common (alignment victory)
- `timeout` - Won on time
- `surrender` - Opponent resigned
- `disconnect` - Opponent disconnected

### Time Control Modes
- `match` - Standard chess-style (main time + increment)
- `turn` - Per-turn time limit
- `unlimited` - No time limit

---

## Leaderboard

**API Endpoint:** `https://hexo.did.science/api/leaderboard`

**Last Updated:** 2026-01-07 (scraped via API)

### Top 10 Players

| Rank | Display Name | Elo | Games Played | Games Won | Win % |
|------|--------------|-----|--------------|-----------|-------|
| 1 | alfaozz | 1439 | 335 | 283 | 84.5% |
| 2 | z3ist | 1422 | 208 | 183 | 88.0% |
| 3 | pavif | 1410 | 135 | 127 | 94.1% |
| 4 | gametabs | 1400 | 268 | 221 | 82.5% |
| 5 | chessinator | 1389 | 222 | 189 | 85.1% |
| 6 | chaoticish | 1379 | 152 | 127 | 83.6% |
| 7 | arfeniumdragon | 1371 | 308 | 245 | 79.5% |
| 8 | jorisj_39400 | 1363 | 773 | 600 | 77.6% |
| 9 | irgendwer_anderes | 1342 | 263 | 201 | 76.4% |
| 10 | alosza1 | 1319 | 531 | 361 | 68.0% |

---

## Active Sessions

**API Endpoint:** `https://hexo.did.science/api/sessions`

### Currently Available/Live Games

| Game ID | Player 1 | Player 1 Elo | Player 2 | Player 2 Elo | Time Control | Rated | Status |
|---------|----------|--------------|-----------|--------------|--------------|-------|--------|
| 5y3tsu | crandivas_51156 | 1151 | (waiting) | - | 5m +0s | Yes | Waiting for players |
| c0vt3o | Guest 2138 | 0 | novachr13 | 1240 | 5m +5s | No | In progress |
| ee7yz1 | .thatscrispy | 1282 | yellow_warning | 1177 | 3m +2s | Yes | In progress |
| 2udc67 | darktigr | 1253 | finneon7 | 1255 | 10m +0s | No | In progress |

### Session Details

#### Game: 5y3tsu (Lobby)
- **Type:** Lobby (waiting for players)
- **Rated:** Yes
- **Time Control:** 5 minutes, 0 second increment
- **Created:** 2026-01-07T17:37:43Z
- **Host:** crandivas_51156 (Elo: 1151)

#### Game: c0vt3o
- **Type:** Active Match
- **Rated:** No
- **Time Control:** 5 minutes, 5 second increment
- **Started:** 2026-01-07T17:39:39Z
- **Players:** Guest 2138 (guest) vs novachr13 (Elo: 1240)

#### Game: ee7yz1
- **Type:** Active Match (Rated)
- **Rated:** Yes
- **Time Control:** 3 minutes, 2 second increment
- **Started:** 2026-01-07T17:39:22Z
- **Players:** .thatscrispy (Elo: 1282) vs yellow_warning (Elo: 1177)

#### Game: 2udc67
- **Type:** Active Match
- **Rated:** No
- **Time Control:** 10 minutes, 0 second increment
- **Started:** 2026-01-07T17:39:05Z
- **Players:** darktigr (Elo: 1253) vs finneon7 (Elo: 1255)

---

## Site Information

**Website:** https://hexo.did.science

**Description:** Infinity Hexagonal Tic-Tac-Toe - Play online, host a lobby, join live matches, and review finished games move by move.

**Features:**
- Infinite hexagonal board
- Two-player matches
- Sandbox mode for practice
- Match history
- Leaderboard with Elo ratings
- Time controls (match duration + increment)
- Rated and unrated games

**Technology:**
- Built with React (single page app)
- Discord authentication
- Cloudflare-hosted

**Version:** f04495f

**Links:**
- Website: https://hexo.did.science
- Rules: https://hexo.did.science/rules
- Sandbox: https://hexo.did.science/sandbox
- Match History: https://hexo.did.science/games
- Leaderboard: https://hexo.did.science/leaderboard
- Discord: https://discord.gg/mBAmFyFE6z
- GitHub: https://github.com/WolverinDEV/infhex-tic-tac-toe

---

## Finished Games Archive

**Page:** https://hexo.did.science/games

### Archive Statistics
- **Total Games:** 67,770
- **Total Moves:** 3,045,156
- **Average Moves per Game:** ~45

### Win Conditions Observed
1. **Won by six in a row** - Most common (alignment of 6 hexes)
2. **Won on time** - Timeout victory
3. **Won by surrender** - Player resigned
4. **Won by disconnect** - Opponent disconnected

### Sample Recent Games (Page 1)

| Session ID | Result | Rated | Moves | Player 1 | Player 2 | Duration | Date |
|------------|--------|-------|-------|----------|----------|----------|------|
| nqdp05 | Won by six in a row | No | 37 | chaoticish | Guest C0F2 | 3m 7s | 7 Apr 2026, 20:46 |
| 8s53d3 | Won by six in a row | No | 19 | Guest 8080 | Guest F92B | 42s | 7 Apr 2026, 20:45 |
| bk6q9u | Won by six in a row | No | 11 | Guest BD9F | Guest 2AD2 | 33s | 7 Apr 2026, 20:45 |
| m32hhu | Won on time | Yes | 80 | novachr13 | crandivas_51156 | 10m 12s | 7 Apr 2026, 20:43 |
| a4spw2 | Won by six in a row | Yes | 55 | kiwitou | .thatscrispy | 7m 55s | 7 Apr 2026, 20:41 |
| d27lsw | Won by six in a row | No | 103 | Guest BC60 | buildoro | 10m 15s | 7 Apr 2026, 20:38 |
| mcggnz | Won by six in a row | No | 97 | finneon7 | yellow_warning | 19m 48s | 7 Apr 2026, 20:36 |
| dzeb7q | Won by six in a row | No | 147 | Guest 9026 | Guest 87BF | 14m 47s | 7 Apr 2026, 20:28 |
| le6zl1 | Won by disconnect | No | 47 | Guest 8D73 | Guest 8BC7 | 11m 31s | 7 Apr 2026, 20:16 |
| g6mlfi | Won by six in a row | No | 99 | kirojoy | ketari | 4m 29s | 7 Apr 2026, 20:05 |
| 5flpbs | Won by surrender | No | 0 | noobnoobastico | saphsicles | 5s | 7 Apr 2026, 20:05 |

### Notable Players in Recent Games

**Registered Players:**
- chaoticish (appears multiple times)
- novachr13
- crandivas_51156
- kiwitou
- .thatscrispy
- finneon7
- yellow_warning
- buildoro
- schmillen
- kirojoy
- ketari

**Guest Players:**
- Guest C0F2, Guest 8080, Guest F92B, Guest BD9F, Guest 2AD2, Guest 71EE, Guest BC60, Guest 9026, Guest 87BF, Guest 8D73, Guest 8BC7

### Time Controls Used
- Quick: 3m +2s (rated), 5m +5s (unrated)
- Standard: 5m +0s, 10m +0s
- Long: 10m +0s, 13m +6s

### Observations

1. **Most games are unrated** - Only a small portion are rated
2. **Quick games common** - Many games end in under 2 minutes
3. **Guest players abundant** - Many players play as guests without signing in
4. **Repeat matchups** - Some session IDs appear multiple times (indicates rematches)
5. **Six in a row is dominant** - Vast majority of games end by alignment victory

---

## API Endpoints Discovered

| Endpoint | Description | Status |
|----------|-------------|--------|
| `/api/leaderboard` | Top players by Elo | Working |
| `/api/sessions` | Active/live sessions | Working |
| `/api/finished-games` | Archive of finished games (paginated) | Working |
| `/api/profiles/{id}` | Player profiles | Requires auth? |
| `/api/account` | User account info | Requires auth |
| `/api/admin` | Admin endpoints | Requires auth |

### `/api/finished-games` Endpoint

**Usage:** `GET /api/finished-games?page=1&pageSize=20`

**Query Parameters:**
- `page` - Page number (starts at 1)
- `pageSize` - Number of games per page (default 20)
- `playerId` - Filter by player (requires auth)
- `profileId` - Filter by profile (requires auth)

**Response:**
```json
{
  "games": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalGames": 67771,
    "totalMoves": 3045191,
    "totalPages": 3389,
    "baseTimestamp": 1775595053298
  }
}
```

**Game Object Structure:**
```json
{
  "id": "uuid",
  "sessionId": "abc123",
  "startedAt": 1775594964473,
  "finishedAt": 1775595050011,
  "players": [
    {
      "playerId": "uuid",
      "displayName": "player1",
      "profileId": "profile-uuid",
      "elo": 1151,
      "eloChange": 4
    }
  ],
  "playerTiles": {
    "playerId": { "color": "#fbbf24" }
  },
  "gameOptions": {
    "visibility": "public",
    "timeControl": {
      "mode": "match",
      "mainTimeMs": 300000,
      "incrementMs": 0
    },
    "rated": true,
    "firstPlayer": "random"
  },
  "moveCount": 35,
  "gameResult": {
    "winningPlayerId": "uuid",
    "durationMs": 85527,
    "reason": "six-in-a-row"  // or "timeout", "surrender", "disconnect"
  }
}
```