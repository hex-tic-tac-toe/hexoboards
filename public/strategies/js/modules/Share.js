/**
 * Share — tab-contextual export, dpaste upload, and import from link.
 *
 * showModal(tab, getContent, label, toast, onLoad) — main entry point.
 *   tab        'editor' | 'match'
 *   getContent () → JSON string
 *   label      human label for the modal title
 *   toast      App._toast
 *   onLoad     (tab, parsedData) → void  — called when import succeeds
 *
 * Upload flow:
 *   content → dpaste.com → paste ID → app URL (#remote/dpaste/ID/tab) copied
 *   dpaste URL is shown in the modal for reference.
 *
 * Import flow:
 *   Accepts: dpaste.com/XXXXX  |  hexoboards.com/#remote/dpaste/XXXXX/tab
 *   Fetches raw text, parses JSON, calls onLoad(tab, data).
 */

const Share = {
  EXPIRY: [
    { label: '1 day',   days: 1   },
    { label: '7 days',  days: 7   },
    { label: '1 month', days: 30  },
    { label: '1 year',  days: 365 },
  ],

  // ── upload ────────────────────────────────────────────────────────────────

  async upload(content, title, days, tab) {
    const form = new FormData();
    form.append('content',     content);
    form.append('title',       title);
    form.append('syntax',      'text');
    form.append('expiry_days', String(days));
    const r = await fetch('https://dpaste.com/api/v2/', { method: 'POST', body: form });
    if (!r.ok) throw new Error(`dpaste HTTP ${r.status}`);
    const pasteUrl = (await r.text()).trim();
    if (!pasteUrl.startsWith('http')) throw new Error('unexpected dpaste response');
    const id     = pasteUrl.split('/').filter(Boolean).pop();
    const appUrl = `${location.origin}${location.pathname}#remote/dpaste/${id}/${tab}`;
    return { pasteUrl, appUrl };
  },

  // ── remote fetch ──────────────────────────────────────────────────────────

  async fetchRemote(service, id) {
    if (service !== 'dpaste') throw new Error('unknown service: ' + service);
    const r = await fetch(`https://dpaste.com/${id}.txt`);
    if (!r.ok) throw new Error(`dpaste fetch HTTP ${r.status}`);
    return r.text();
  },

  /** Parse #remote/SERVICE/ID/TAB hash fragment. Returns object or null. */
  parseRemoteHash(hash) {
    if (!hash.startsWith('remote/')) return null;
    const [service, id, tab] = hash.slice(7).split('/');
    return (service && id && tab) ? { service, id, tab } : null;
  },

  /**
   * Parse any user-pasted link into { service, id, tab }.
   * Accepts: dpaste URL, full app URL with #remote/..., or bare #remote/... hash.
   * defaultTab is used when the URL has no tab component (raw dpaste link).
   */
  parseRemoteFromAnyUrl(url, defaultTab) {
    // App URL with hash:  ...#remote/dpaste/XXXXX/match
    const hashIdx = url.indexOf('#remote/');
    if (hashIdx >= 0) return Share.parseRemoteHash(url.slice(hashIdx + 1));

    // Raw dpaste URL: https://dpaste.com/XXXXX  or  dpaste.com/XXXXX.txt
    if (url.includes('dpaste.com/')) {
      const id = url.split('/').filter(Boolean).pop().replace('.txt', '').split('?')[0];
      if (id) return { service: 'dpaste', id, tab: defaultTab };
    }
    return null;
  },

  // ── local ─────────────────────────────────────────────────────────────────

  download(content, filename) {
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([content], { type: 'application/json' })),
      download: filename,
    });
    a.click(); URL.revokeObjectURL(a.href);
  },

  async copy(text) { await navigator.clipboard.writeText(text); },

  // ── modal ─────────────────────────────────────────────────────────────────

  showModal(tab, getContent, label, toast, onLoad) {
    document.getElementById('share-modal')?.remove();
    document.getElementById('share-backdrop')?.remove();

    let selectedDays = 30;

    const backdrop = Object.assign(document.createElement('div'),
      { id: 'share-backdrop', className: 'modal-backdrop' });
    const modal = Object.assign(document.createElement('div'),
      { id: 'share-modal', className: 'share-modal' });

    function close() { modal.remove(); backdrop.remove(); }
    backdrop.addEventListener('click', close);

    // Status element (shared between upload and import sections)
    const statusEl = document.createElement('div'); statusEl.className = 'share-status';
    const setStatus = (msg, err = false) => {
      statusEl.textContent = msg;
      statusEl.className = 'share-status' + (err ? ' err' : ' ok');
    };

    // Header
    const hdr = document.createElement('div'); hdr.className = 'share-hdr';
    const ttl = document.createElement('span'); ttl.className = 'share-ttl';
    ttl.textContent = `EXPORT — ${label}`;
    const cls = document.createElement('button'); cls.className = 'btn'; cls.textContent = '\xd7';
    cls.addEventListener('click', close);
    hdr.append(ttl, cls); modal.appendChild(hdr);

    // ── Expiry ──────────────────────────────────────────────────────────────
    const expSec = document.createElement('div'); expSec.className = 'share-section';
    const expLbl = document.createElement('div'); expLbl.className = 'share-section-label';
    expLbl.textContent = 'Link expires after';
    const expRow = document.createElement('div'); expRow.className = 'share-expiry-row';
    Share.EXPIRY.forEach(({ label: el, days }) => {
      const b = document.createElement('button');
      b.className = 'btn share-expiry-btn' + (days === selectedDays ? ' active' : '');
      b.textContent = el;
      b.addEventListener('click', () => {
        selectedDays = days;
        expRow.querySelectorAll('.share-expiry-btn').forEach(x => x.classList.toggle('active', x === b));
      });
      expRow.appendChild(b);
    });
    expSec.append(expLbl, expRow); modal.appendChild(expSec);

    // ── Upload ──────────────────────────────────────────────────────────────
    const upSec = document.createElement('div'); upSec.className = 'share-section';

    const pasteRow = document.createElement('div'); pasteRow.className = 'share-paste-result'; pasteRow.hidden = true;
    const pasteLbl = document.createElement('div'); pasteLbl.className = 'share-paste-url-label'; pasteLbl.textContent = 'dpaste URL (for reference):';
    const pasteLink = document.createElement('a'); pasteLink.className = 'share-paste-link'; pasteLink.target = '_blank'; pasteLink.rel = 'noopener';
    pasteRow.append(pasteLbl, pasteLink);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn share-upload-btn';
    uploadBtn.textContent = 'upload & copy link';
    uploadBtn.addEventListener('click', async () => {
      uploadBtn.disabled = true;
      setStatus('uploading…'); pasteRow.hidden = true;
      try {
        const { pasteUrl, appUrl } = await Share.upload(getContent(), label, selectedDays, tab);
        await Share.copy(appUrl);
        setStatus('app link copied to clipboard');
        pasteLink.textContent = pasteUrl; pasteLink.href = pasteUrl;
        pasteRow.hidden = false;
      } catch (e) { setStatus(e.message, true); }
      uploadBtn.disabled = false;
    });

    upSec.append(uploadBtn, pasteRow, statusEl); modal.appendChild(upSec);

    // ── Local (no upload) ───────────────────────────────────────────────────
    const localSec = document.createElement('div'); localSec.className = 'share-section share-local';
    const localLbl = document.createElement('div'); localLbl.className = 'share-section-label'; localLbl.textContent = 'No upload';
    const localRow = document.createElement('div'); localRow.className = 'share-local-row';

    const dlBtn = document.createElement('button'); dlBtn.className = 'btn'; dlBtn.textContent = 'download .json';
    dlBtn.addEventListener('click', () =>
      Share.download(getContent(), `hexoboards-${tab}-${new Date().toISOString().slice(0,10)}.json`));
    const cpBtn = document.createElement('button'); cpBtn.className = 'btn'; cpBtn.textContent = 'copy JSON';
    cpBtn.addEventListener('click', async () => { await Share.copy(getContent()); toast?.('JSON copied'); });

    localRow.append(dlBtn, cpBtn); localSec.append(localLbl, localRow); modal.appendChild(localSec);

    // ── Import from link ────────────────────────────────────────────────────
    if (onLoad) {
      const impSec = document.createElement('div'); impSec.className = 'share-section share-import-sec';
      const impLbl = document.createElement('div'); impLbl.className = 'share-section-label'; impLbl.textContent = 'Import from link';
      const impRow = document.createElement('div'); impRow.className = 'share-import-row';

      const impInput = document.createElement('input'); impInput.type = 'text';
      impInput.className = 'share-import-input'; impInput.placeholder = 'dpaste.com/XXXXX or app link…';

      const impBtn = document.createElement('button'); impBtn.className = 'btn'; impBtn.textContent = 'load';

      const doImport = async () => {
        const url = impInput.value.trim(); if (!url) return;
        impBtn.disabled = true;
        setStatus('fetching…');
        try {
          const remote = Share.parseRemoteFromAnyUrl(url, tab);
          if (!remote) { setStatus('unrecognised link format', true); return; }
          const text = await Share.fetchRemote(remote.service, remote.id);
          onLoad(remote.tab, JSON.parse(text));
          setStatus('loaded');
          close();
        } catch (e) { setStatus('failed: ' + e.message, true); }
        impBtn.disabled = false;
      };

      impBtn.addEventListener('click', doImport);
      impInput.addEventListener('keydown', e => { if (e.key === 'Enter') doImport(); });

      impRow.append(impInput, impBtn); impSec.append(impLbl, impRow); modal.appendChild(impSec);
    }

    document.body.append(backdrop, modal);
  },
};

export { Share };
