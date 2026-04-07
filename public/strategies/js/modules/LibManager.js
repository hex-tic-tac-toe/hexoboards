import { Store }   from './Store.js';
import { Browser } from './Browser.js';
import { Doc }     from './Doc.js';
import { UI }      from './UI.js';

const LibManager = {
  _toast: null,
  init(toast) { LibManager._toast = toast; },

  render() {
    const list = document.getElementById('lib-mgmt-list');
    list.innerHTML = '';
    LibManager.renderFooter();
    const entries = [
      [Store.LOCAL, Store.libs[Store.LOCAL]],
      ...Object.entries(Store.libs).filter(([id]) => id !== Store.LOCAL),
    ];
    for (const [id, lib] of entries) {
      if (!lib) continue;
      list.appendChild(LibManager._row(id, lib));
    }
  },

  _row(id, lib) {
    const isLocal = Store.isLocal(id);
    const row = document.createElement('div'); row.className = 'lib-mgmt-row';

    if (!isLocal) {
      const tog = document.createElement('button');
      tog.className   = 'lib-toggle-btn' + (lib.active ? ' active' : '');
      tog.textContent = lib.active ? '●' : '○';
      tog.title       = lib.active ? 'Disable' : 'Enable';
      tog.addEventListener('click', () => { Store.toggleLibrary(id); LibManager.render(); });
      row.appendChild(tog);
    }

    const name = document.createElement('div'); name.className = 'lib-mgmt-name'; name.textContent = lib.name;
    if (!isLocal) {
      name.contentEditable = 'true';
      name.addEventListener('blur',    () => Store.renameLibrary(id, name.textContent.trim() || lib.name));
      name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
    }
    row.appendChild(name);

    if (lib.url) {
      const u = document.createElement('div'); u.className = 'lib-mgmt-url'; u.textContent = lib.url; u.title = lib.url;
      row.appendChild(u);
    }

    const cnt = LibManager._countPos((isLocal ? Store.docs[id] : Store.cache[id])?.doc || []);
    const c = document.createElement('span'); c.className = 'lib-mgmt-count'; c.textContent = cnt + ' pos';
    row.appendChild(c);

    const act = document.createElement('div'); act.className = 'lib-mgmt-actions';

    if (isLocal) {
      LibManager._addBtn(act, '⬇ export', () => {
        const a = Object.assign(document.createElement('a'), {
          href:     URL.createObjectURL(new Blob([Store.exportDoc(id)], { type: 'application/json' })),
          download: lib.name.replace(/\s+/g,'_') + '.json',
        });
        a.click(); URL.revokeObjectURL(a.href);
      });
      LibManager._addBtn(act, '⎘ copy', () => {
        navigator.clipboard?.writeText(Store.exportDoc(id)).then(() => LibManager._toast('copied'));
      });
      if (id === Store.LOCAL) {
        LibManager._addBtn(act, '↺ reset', () => {
          if (!confirm('Reset "My Positions" — delete all saved positions?')) return;
          Store.resetDoc(id); LibManager.render();
          if (UI.activeView === 'browser') Browser.render(id);
          LibManager._toast('reset');
        });
      } else {
        LibManager._addBtn(act, '✕', () => {
          if (!confirm(`Delete workspace "${lib.name}"?`)) return;
          Store.removeLibrary(id); LibManager.render();
          if (UI.activeView === 'browser') Browser.render(Store.LOCAL);
          LibManager._toast('deleted');
        });
      }
    } else {
      LibManager._addBtn(act, '↺ reload', async () => {
        await Store.fetchLibrary(id); LibManager.render();
        if (UI.activeView === 'browser') Browser.render(Browser.activeLibId);
        LibManager._toast('reloaded');
      });
      LibManager._addBtn(act, '⎘ workspace', () => {
        const wsId = Store.openAsWorkspace(id); LibManager.render();
        Browser.render(wsId); UI.showBrowser(() => {}); LibManager._toast('opened as workspace');
      });
      LibManager._addBtn(act, '✕', () => {
        if (!confirm(`Remove "${lib.name}"?`)) return;
        Store.removeLibrary(id); LibManager.render();
        if (UI.activeView === 'browser') Browser.render(Store.LOCAL);
      });
    }

    row.appendChild(act);
    return row;
  },

  renderFooter() {
    const foot = document.getElementById('lib-mgmt-footer');
    if (!foot) return;
    foot.innerHTML = '';
    const btn = document.createElement('button');
    btn.className   = 'btn';
    btn.textContent = '✕ clear all data';
    btn.style.color = 'var(--dim)';
    btn.addEventListener('click', () => {
      if (!confirm('Delete ALL local data? This cannot be undone.')) return;
      Store.clearAll();
    });
    foot.appendChild(btn);
  },

  _addBtn(container, label, fn) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = label;
    b.addEventListener('click', fn);
    container.appendChild(b);
    return b;
  },

  _countPos(tree) {
    let n = 0;
    const walk = nodes => nodes.forEach(node => { if (node.type === 'p') n++; if (node.children) walk(node.children); });
    walk(tree);
    return n;
  },
};

export { LibManager };
