const Layout = {
  HEADER_H:    44,
  TOOLBAR_H:   42,
  FOOTER_H:    28,
  NOTE_W:      260,
  NOTATION_W:  300,
  LIB_SIDE_W:  180,

  // Match panel widths (mutable, like NOTE_W / NOTATION_W)
  MATCH_PLAY_W: 220,
  MATCH_NOTE_W: 200,
  MATCH_TREE_W: 280,

  boardW: (noteOpen, notationOpen) =>
    window.innerWidth - (noteOpen ? Layout.NOTE_W : 0) - (notationOpen ? Layout.NOTATION_W : 0),
  boardH: () => window.innerHeight - Layout.HEADER_H - Layout.TOOLBAR_H - Layout.FOOTER_H,
};

export { Layout };