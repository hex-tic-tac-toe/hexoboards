/**
 * UI — view switching and tab strip management.
 *
 * VIEWS is the single source of truth for all tabs.
 * init() builds every .tab-strip element in the DOM from this config,
 * eliminating the N×M matrix of hand-written tab button IDs.
 *
 * Hash mapping:  editor='' | match='m' | browser=(libId) | data='d' | convert='c'
 * Backward compat: hash '#a' is treated as '#m' (old analyze link).
 */
import { Layout } from './Layout.js';

// Tab configuration — label and URL hash fragment for each view.
// Adding a new view means adding one entry here plus a matching #view-* element.
const VIEWS = [
  { id: 'match',   label: 'Match',     hash: 'm'  },
  { id: 'editor',  label: 'Editor',    hash: ''   },
  { id: 'browser', label: 'Browser',   hash: null },  // hash managed separately (includes libId)
  { id: 'data',    label: 'Libraries', hash: 'd'  },
  { id: 'convert', label: 'Convert',   hash: 'c'  },
];

const UI = {
  activeView: 'editor',
  VIEWS,

  /**
   * Build all tab strips and wire up resize handler.
   * callbacks: { editor, match, browser, data, convert } → functions called on tab click
   */
  init(callbacks) {
    document.querySelectorAll('.tab-strip').forEach(strip => {
      VIEWS.forEach(({ id, label }) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.dataset.tabView = id;
        btn.textContent = label;
        btn.addEventListener('click', () => callbacks[id]?.());
        strip.appendChild(btn);
      });
      const theme = document.createElement('button');
      theme.className = 'btn btn-theme';
      theme.dataset.tip = 'Toggle theme (dark only)';
      theme.textContent = '☾';
      strip.appendChild(theme);
    });

    window.addEventListener('resize', () => {
      if (UI.activeView === 'editor') callbacks.editor?.();
    });
  },

  showEditor(onEnter)  { console.log('UI.showEditor called'); UI._show('editor',  onEnter, ''); },
  showMatch(onEnter)   { console.log('UI.showMatch called'); UI._show('match',   onEnter, 'm'); },
  showBrowser(onEnter) { UI._show('browser', onEnter, null); },   // caller updates hash
  showData(onEnter)    { UI._show('data',    onEnter, 'd'); },
  showConvert(onEnter) { UI._show('convert', onEnter, 'c'); },

  _show(view, onEnter, hash) {
    UI.activeView = view;

    // Toggle visibility of each full-page view div
    VIEWS.forEach(({ id }) => {
      document.getElementById('view-' + id).hidden = id !== view;
    });

    // Mark active tab in every strip (strips live inside each view header)
    document.querySelectorAll('[data-tab-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabView === view);
    });

    // Update the URL hash without pushing a history entry
    if (hash !== null) {
      history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
    }

    onEnter();
  },
};

export { UI };
