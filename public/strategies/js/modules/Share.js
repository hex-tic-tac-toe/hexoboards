/**
 * Share — tab-contextual export via remote services (GitHub Gist, JSONBin.io), and import from link.
 *
 * showModal(tab, getContent, label, toast, onLoad)
 *   tab        'editor' | 'match'
 *   getContent () → JSON string
 *   label      human-readable title shown in the modal header
 *   toast      App._toast
 *   onLoad     optional (tab, parsedData) → void — called on successful import
 *
 * Supported services: gist, jsonbin
 * Service is identified in #remote/SERVICE/ID/TAB hash fragment.
 */

const Share = {
  _services: {},
  _activeService: null,

  register(service) {
    this._services[service.name] = service;
  },

  active() {
    return this._services[this._activeService];
  },

  // ── service: GitHub Gist ────────────────────────────────────────────────────
  _gist: {
    name: 'gist',
    label: 'GitHub Gist',
    authPlaceholder: 'GitHub PAT (re-enter each time)',
    authNote: 'A GitHub personal access token with "gist" scope is required. Generate one at GitHub Settings → Developer settings → Personal access tokens. Token is not stored.',
    hasAuth: false,
    _pat: null,

    setAuth(pat) { this._pat = pat; this.hasAuth = !!pat; },
    getAuth() { return this._pat; },
    clearAuth() { this._pat = null; this.hasAuth = false; },

    _authHeaders() {
      return this._pat ? { 'Authorization': `token ${this._pat}`, 'Accept': 'application/vnd.github.v3+json' } : {};
    },

    async create(content) {
      const body = { description: 'hexoboards', public: true, files: { 'hexoboards.json': { content } } };
      const r = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const msg = r.status === 401 ? 'auth failed - check PAT scope' : `error ${r.status}`;
        throw new Error(msg);
      }
      const d = await r.json();
      return { id: d.id, url: d.html_url };
    },

    async update(id, content) {
      const r = await fetch(`https://api.github.com/gists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
        body: JSON.stringify({ files: { 'hexoboards.json': { content } } }),
      });
      if (!r.ok) {
        const msg = r.status === 401 ? 'auth failed' : `error ${r.status}`;
        throw new Error(msg);
      }
      const d = await r.json();
      return { id: d.id, url: d.html_url };
    },

    async delete(id) {
      const r = await fetch(`https://api.github.com/gists/${id}`, { method: 'DELETE', headers: this._authHeaders() });
      if (!r.ok) {
        const msg = r.status === 401 ? 'auth failed' : `error ${r.status}`;
        throw new Error(msg);
      }
    },

    async list(page = 1, perPage = 30) {
      const r = await fetch(`https://api.github.com/gists?page=${page}&per_page=${perPage}`, { headers: this._authHeaders() });
      if (!r.ok) {
        const msg = r.status === 401 ? 'auth failed - check PAT scope' : `error ${r.status}`;
        throw new Error(msg);
      }
      return r.json();
    },

    async get(id) {
      const r = await fetch(`https://api.github.com/gists/${id}`, { headers: this._authHeaders() });
      if (!r.ok) throw new Error(`error ${r.status}`);
      return r.json();
    },

    async read(id) {
      const r = await fetch(`https://api.github.com/gists/${id}`);
      if (!r.ok) throw new Error('not found');
      const d = await r.json();
      const fname = Object.keys(d.files)[0];
      return d.files[fname].content;
    },

    parseUrl(url) {
      if (url.includes('gist.github.com')) {
        // Matches gist.github.com/ID or gist.github.com/user/ID
        const m = url.match(/gist\.github\.com\/(?:[\w-]+\/)?([a-zA-Z0-9]+)/);
        return m ? m[1] : null;
      }
      // Also accept raw gist ID (32-char hex string)
      if (/^[a-f0-9]{20,}$/i.test(url)) return url;
      return null;
    },

    formatInfo(g) {
      const desc = g.description || 'hexoboards';
      const date = new Date(g.updated_at).toLocaleDateString();
      return `${desc} (${date})`;
    },
  },

  // ── service: JSONBin.io ──────────────────────────────────────────────────────────
  _jsonbin: {
    name: 'jsonbin',
    label: 'JSONBin.io',
    authPlaceholder: 'JSONBin API key (re-enter each time)',
    authNote: 'JSONBin.io free tier: 100 writes/day. Token is not stored.',
    hasAuth: false,
    _key: null,

    setAuth(key) { this._key = key; this.hasAuth = !!key; },
    getAuth() { return this._key; },
    clearAuth() { this._key = null; this.hasAuth = false; },

    _authHeaders() {
      return this._key ? { 'X-Master-Key': this._key } : {};
    },

    async create(content) {
      const r = await fetch('https://api.jsonbin.io/v3/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
        body: content,
      });
      if (!r.ok) {
        const text = await r.text();
        if (r.status === 403 && text.includes('limit')) throw new Error('daily limit exceeded (100/day)');
        if (r.status === 401) throw new Error('invalid API key');
        throw new Error(`error ${r.status}`);
      }
      const d = await r.json();
      return { id: d.metadata.id, url: d.metadata.url };
    },

    async update(id, content) {
      const r = await fetch(`https://api.jsonbin.io/v3/bins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
        body: content,
      });
      if (!r.ok) {
        const text = await r.text();
        if (r.status === 403 && text.includes('limit')) throw new Error('daily limit exceeded (100/day)');
        if (r.status === 401) throw new Error('invalid key or bin');
        throw new Error(`error ${r.status}`);
      }
      const d = await r.json();
      return { id: d.metadata.id, url: d.metadata.url };
    },

    async delete(id) {
      const r = await fetch(`https://api.jsonbin.io/v3/bins/${id}`, { method: 'DELETE', headers: this._authHeaders() });
      if (!r.ok) {
        if (r.status === 401) throw new Error('invalid key or bin');
        throw new Error(`error ${r.status}`);
      }
    },

    async list() {
      throw new Error('use URL to load');
    },

    async get(id) {
      const r = await fetch(`https://api.jsonbin.io/v3/bins/${id}`, { headers: this._authHeaders() });
      if (!r.ok) {
        if (r.status === 401) throw new Error('invalid key or bin');
        throw new Error(`error ${r.status}`);
      }
      return r.json();
    },

    async read(id) {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${id}`);
      if (!r.ok) throw new Error('not found');
      return r.text();
    },

    parseUrl(url) {
      if (url.includes('jsonbin.io')) {
        const m = url.match(/jsonbin\.io\/.*b\/([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
      }
      return null;
    },

    formatInfo(d) {
      const name = d.metadata?.name || 'unnamed';
      const date = new Date(d.metadata?.createdAt).toLocaleDateString();
      return `${name} (${date})`;
    },
  },

  // ── init ────────────────────────────────────────────────────────────────
  init() {
    this.register(this._gist);
    this.register(this._jsonbin);
    this._activeService = 'gist';
  },

  // ── parse hash ──────────────────────────────────────────────────────────
  parseRemoteHash(hash) {
    if (!hash) return null;
    // Strip leading # if present
    if (hash.startsWith('#')) hash = hash.slice(1);
    if (!hash.startsWith('remote/')) return null;
    const [service, id, tab] = hash.slice(7).split('/');
    return (service && id && tab) ? { service, id, tab } : null;
  },

  parseRemoteFromAnyUrl(url, defaultTab) {
    if (!url || typeof url !== 'string') return null;
    url = url.trim();
    if (!url) return null;
    
    // Check for #remote/... in the URL
    if (url.includes('#remote/')) {
      const hashIdx = url.indexOf('#remote/');
      const result = this.parseRemoteHash(url.slice(hashIdx + 1));
      if (result) return result;
    }

    // Check each service for a URL match
    for (const svc of Object.values(this._services)) {
      const id = svc.parseUrl(url);
      if (id) return { service: svc.name, id, tab: defaultTab };
    }
    
    // Check if the whole thing looks like an ID (hex string 20+ chars for gist)
    if (/^[a-f0-9]{20,}$/i.test(url)) {
      return { service: 'gist', id: url, tab: defaultTab };
    }
    
    return null;
  },

  // ── remote fetch (public) ─────────────────────────────────────────────
  async fetchRemote(service, id) {
    const svc = this._services[service];
    if (!svc) throw new Error('unknown service: ' + service);
    return svc.read(id);
  },

  // ── local ────────────────────────────────────────────────────────
  download(content, filename) {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([content], { type: 'application/json' })),
      download: filename,
    });
    a.click(); URL.revokeObjectURL(a.href);
  },

  async copy(text) { await navigator.clipboard.writeText(text); },

  // ── modal ──────────────────────────────────────────────────────────
  showModal(tab, getContent, label, toast, onLoad) {
    document.getElementById('share-modal')?.remove();
    document.getElementById('share-backdrop')?.remove();

    const backdrop = Object.assign(document.createElement('div'),
      { id: 'share-backdrop', className: 'modal-backdrop' });
    const modal = Object.assign(document.createElement('div'),
      { id: 'share-modal', className: 'share-modal' });

    function close() { modal.remove(); backdrop.remove(); }
    backdrop.addEventListener('click', close);

    const statusEl = document.createElement('div');
    statusEl.className = 'share-status';
    const setStatus = (msg, err = false) => {
      statusEl.textContent = msg;
      statusEl.className = 'share-status' + (err ? ' err' : (msg ? ' ok' : ''));
    };

    const hdr = document.createElement('div'); hdr.className = 'share-hdr';
    const ttl = document.createElement('span'); ttl.className = 'share-ttl';
    ttl.textContent = 'EXPORT — ' + label;
    const cls = document.createElement('button'); cls.className = 'btn'; cls.textContent = '×';
    cls.addEventListener('click', close);
    hdr.append(ttl, cls); modal.appendChild(hdr);

    // Service tabs
    const svcTabs = document.createElement('div'); svcTabs.className = 'share-svc-tabs';
    for (const svc of Object.values(this._services)) {
      const btn = document.createElement('button'); btn.className = 'btn share-svc-tab';
      btn.textContent = svc.label;
      if (svc.name === this._activeService) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this._activeService = svc.name;
        svcTabs.querySelectorAll('.share-svc-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rebuildAuth();
        rebuildItems();
      });
      svcTabs.appendChild(btn);
    }
    modal.appendChild(svcTabs);

    let authSec, newSec, itemsSec, itemsList, loadMoreBtn;
    let currentPage = 1;
    const svc = () => this._services[this._activeService];

    const rebuildAuth = () => {
      authSec?.remove();
      authSec = document.createElement('div'); authSec.className = 'share-section';
      const authLbl = document.createElement('div'); authLbl.className = 'share-section-label';
      const authRow = document.createElement('div'); authRow.className = 'share-auth-row';
      const authInput = document.createElement('input'); authInput.type = 'password';
      authInput.className = 'share-auth-input';
      authInput.placeholder = svc().authPlaceholder;
      const authBtn = document.createElement('button'); authBtn.className = 'btn';
      authBtn.textContent = svc().hasAuth ? '✓ loaded' : 'authenticate';
      authRow.append(authInput, authBtn); authSec.append(authLbl, authRow); modal.insertBefore(authSec, newSec);
      const authNote = document.createElement('div'); authNote.className = 'share-auth-note';
      authNote.textContent = svc().authNote;
      authSec.append(authNote);
      authLbl.textContent = svc().label + ' authentication';

      authBtn.addEventListener('click', async () => {
        const key = authInput.value.trim();
        if (!key) { setStatus('enter ' + (svc().name === 'gist' ? 'PAT' : 'key'), true); return; }
        svc().setAuth(key);
        authBtn.textContent = '✓ loaded';
        authInput.disabled = true;
        setStatus('authenticated');
        currentPage = 1;
        rebuildItems();
      });
    };

    const rebuildItems = () => {
      itemsSec?.remove();
      if (!svc().hasAuth) return;

      itemsSec = document.createElement('div'); itemsSec.className = 'share-section share-gists';
      const itemsLbl = document.createElement('div'); itemsLbl.className = 'share-section-label';
      itemsLbl.textContent = 'My ' + svc().label;
      itemsList = document.createElement('div'); itemsList.className = 'share-gist-list';
      const refreshBtn = document.createElement('button'); refreshBtn.className = 'btn btn-sm';
      refreshBtn.textContent = 'refresh';
      loadMoreBtn = document.createElement('button'); loadMoreBtn.className = 'btn btn-sm';
      loadMoreBtn.textContent = 'load more';
      loadMoreBtn.hidden = true;
      itemsSec.append(itemsLbl, refreshBtn, loadMoreBtn, itemsList); modal.insertBefore(itemsSec, newSec);

      const loadItems = async (append = false) => {
        if (!append) {
          currentPage = 1;
          itemsList.innerHTML = '';
        }
        setStatus('loading…');
        try {
          if (!svc().hasAuth) { setStatus('auth required', true); return; }
          const items = svc().name === 'gist'
            ? await svc().list(currentPage, 20)
            : await svc().list();
          
          if (!items || (Array.isArray(items) && !items.length) || items.length === 0) {
            if (currentPage === 1) itemsList.textContent = 'no items';
            setStatus('');
            loadMoreBtn.hidden = true;
            return;
          }
          
          // Filter for gist: only show hexoboards gists
          const filtered = svc().name === 'gist' 
            ? items.filter(g => g.description?.includes('hexoboards'))
            : items;
          
          if (filtered.length === 0 && currentPage === 1) {
            itemsList.textContent = 'no hexoboards items';
            setStatus('');
            loadMoreBtn.hidden = true;
            return;
          }

          for (const item of filtered) {
            const row = document.createElement('div'); row.className = 'share-gist-item';
            const info = document.createElement('div'); info.className = 'share-gist-info';
            info.textContent = svc().formatInfo(item);
            const acts = document.createElement('div'); acts.className = 'share-gist-actions';
            const loadBtn = document.createElement('button'); loadBtn.className = 'btn btn-sm'; loadBtn.textContent = 'load';
            loadBtn.addEventListener('click', async () => {
              loadBtn.disabled = true;
              try {
                const d = await svc().get(item.id);
                let content;
                if (svc().name === 'jsonbin') {
                  content = JSON.stringify(d.record);
                } else {
                  const key = Object.keys(d.files)[0];
                  content = d.files[key]?.content || '';
                }
                onLoad(tab, JSON.parse(content));
                setStatus('loaded'); close();
              } catch (e) { setStatus(e.message, true); }
              loadBtn.disabled = false;
            });
            const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-sm'; saveBtn.textContent = 'save';
            saveBtn.addEventListener('click', async () => {
              saveBtn.disabled = true; setStatus('saving…');
              try {
                const content = getContent();
                console.log('Saving to gist', item.id, ':', content);
                await svc().update(item.id, content);
                setStatus('saved'); toast?.('saved');
              } catch (e) { 
                console.error('Save failed:', e);
                setStatus(e.message, true); 
              }
              saveBtn.disabled = false;
            });
            const delBtn = document.createElement('button'); delBtn.className = 'btn btn-sm btn-danger'; delBtn.textContent = 'del';
            delBtn.addEventListener('click', async () => {
              if (!confirm('delete?')) return;
              delBtn.disabled = true; setStatus('deleting…');
              try {
                await svc().delete(item.id);
                setStatus('deleted'); row.remove(); toast?.('deleted');
              } catch (e) { setStatus(e.message, true); }
              delBtn.disabled = false;
            });
            acts.append(loadBtn, saveBtn, delBtn); row.append(info, acts); itemsList.appendChild(row);
          }
          
          setStatus('');
          // Show load more for gist if we got results
          loadMoreBtn.hidden = svc().name !== 'gist' || filtered.length < 20;
        } catch (e) { 
          setStatus(e.message, true); 
          loadMoreBtn.hidden = true;
        }
      };
      
      refreshBtn.addEventListener('click', () => loadItems(false));
      loadMoreBtn.addEventListener('click', () => { currentPage++; loadItems(true); });
      loadItems(false);
    };

    // Create section
    newSec = document.createElement('div'); newSec.className = 'share-section';
    const newLbl = document.createElement('div'); newLbl.className = 'share-section-label';
    newLbl.textContent = 'Create new (public)';
    const newRow = document.createElement('div'); newRow.className = 'share-action-row';
    const newBtn = document.createElement('button'); newBtn.className = 'btn';
    newBtn.textContent = 'create & copy link';
    newBtn.addEventListener('click', async () => {
      newBtn.disabled = true; setStatus('creating…');
      try {
        if (!svc().hasAuth) throw new Error('authenticate first');
        const { id } = await svc().create(getContent());
        const appUrl = `${location.origin}${location.pathname}#remote/${svc().name}/${id}/${tab}`;
        await this.copy(appUrl);
        setStatus('link copied'); toast?.('created');
      } catch (e) { setStatus(e.message, true); }
      newBtn.disabled = false;
    });
    newRow.append(newBtn); newSec.append(newLbl, newRow); modal.appendChild(newSec);

    rebuildAuth();
    rebuildItems();

    // Local only
    const localSec = document.createElement('div'); localSec.className = 'share-section share-local';
    const localLbl = document.createElement('div'); localLbl.className = 'share-section-label';
    localLbl.textContent = 'Local only';
    const localRow = document.createElement('div'); localRow.className = 'share-local-row';
    const dlBtn = document.createElement('button'); dlBtn.className = 'btn'; dlBtn.textContent = 'download .json';
    dlBtn.addEventListener('click', () => this.download(getContent(), `hexoboards-${tab}-${new Date().toISOString().slice(0,10)}.json`));
    const cpBtn = document.createElement('button'); cpBtn.className = 'btn'; cpBtn.textContent = 'copy JSON';
    cpBtn.addEventListener('click', async () => { await this.copy(getContent()); toast?.('JSON copied'); });
    localRow.append(dlBtn, cpBtn); localSec.append(localLbl, localRow); modal.appendChild(localSec);

    // Import
    if (onLoad) {
      const impSec = document.createElement('div'); impSec.className = 'share-section share-import-sec';
      const impLbl = document.createElement('div'); impLbl.className = 'share-section-label';
      impLbl.textContent = 'Import from link';
      const impRow = document.createElement('div'); impRow.className = 'share-import-row';
      const impInput = document.createElement('input'); impInput.type = 'text';
      impInput.className = 'share-import-input';
      impInput.placeholder = 'gist/jsonbin URL or app link…';
      const impBtn = document.createElement('button'); impBtn.className = 'btn'; impBtn.textContent = 'load';

      const doImport = async () => {
        const url = impInput.value.trim();
        if (!url) return;
        impBtn.disabled = true; setStatus('fetching…');
        try {
          const remote = this.parseRemoteFromAnyUrl(url, tab);
          if (!remote) { setStatus('unrecognised', true); return; }
          const text = await this.fetchRemote(remote.service, remote.id);
          onLoad(remote.tab, JSON.parse(text));
          setStatus('loaded'); close();
        } catch (e) { setStatus('failed: ' + e.message, true); }
        impBtn.disabled = false;
      };
      impBtn.addEventListener('click', doImport);
      impInput.addEventListener('keydown', e => { if (e.key === 'Enter') doImport(); });
      impRow.append(impInput, impBtn); impSec.append(impLbl, impRow); modal.appendChild(impSec);
    }

    const statusSec = document.createElement('div'); statusSec.className = 'share-section share-status-sec';
    statusSec.appendChild(statusEl); modal.appendChild(statusSec);

    document.body.append(backdrop, modal);
  },
};

Share.init();

export { Share };