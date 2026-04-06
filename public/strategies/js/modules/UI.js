import { Layout } from './Layout.js';

const UI = {
  activeView: 'editor',

  init(onResize) {
    window.addEventListener('resize', () => { if (UI.activeView === 'editor') onResize(); });
  },

  showEditor(onEnter)   { UI._show('editor',  onEnter, 'tab-editor',   'tab-editor-b',   'tab-editor-d',   'tab-editor-c',   'tab-editor-a'); },
  showAnalyze(onEnter) { UI._show('analyze', onEnter, 'tab-analyze',  'tab-analyze-b',  'tab-analyze-d',  'tab-analyze-c',  'tab-analyze-a'); },
  showBrowser(onEnter) { UI._show('browser', onEnter, 'tab-browser',  'tab-browser-b',  'tab-browser-d',  'tab-browser-c',  'tab-browser-a'); },
  showData(onEnter)    { UI._show('data',    onEnter, 'tab-data',     'tab-data-b',     'tab-data-d',     'tab-data-c',     'tab-data-a'); },
  showConvert(onEnter) { UI._show('convert', onEnter, 'tab-convert',  'tab-convert-b',  'tab-convert-d',  'tab-convert-c',  'tab-convert-a'); },

  _show(view, onEnter, ...activeIds) {
    UI.activeView = view;
    for (const v of ['editor', 'analyze', 'browser', 'data', 'convert'])
      document.getElementById('view-' + v).hidden = v !== view;
    const all = [
      'tab-editor','tab-editor-b','tab-editor-d','tab-editor-c','tab-editor-a',
      'tab-analyze','tab-analyze-b','tab-analyze-d','tab-analyze-c','tab-analyze-a',
      'tab-browser','tab-browser-b','tab-browser-d','tab-browser-c','tab-browser-a',
      'tab-data','tab-data-b','tab-data-d','tab-data-c','tab-data-a',
      'tab-convert','tab-convert-b','tab-convert-d','tab-convert-c','tab-convert-a',
    ];
    for (const id of all) document.getElementById(id)?.classList.toggle('active', activeIds.includes(id));
    const hashMap = { browser: null, data: 'd', convert: 'c', analyze: 'a' };
    if (view in hashMap) {
      if (hashMap[view]) history.replaceState(null, '', '#' + hashMap[view]);
    } else {
      history.replaceState(null, '', location.pathname + location.search);
    }
    onEnter();
  },
};

export { UI };