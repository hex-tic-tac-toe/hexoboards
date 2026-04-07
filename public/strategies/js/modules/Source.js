/**
 * Source — describes where a notation string originates.
 *
 * A source is a plain object: { type, format, …payload }.
 * Callers create sources with the factory functions and pass them to
 * Notation.loadFromSource(), which resolves the text and decodes it.
 *
 * Supported types
 *   'string'  — direct text input (the only type currently active)
 *   'url'     — remote fetch (stub; will be activated in a future update)
 */
const Source = {
  /** Direct string input. `format` = 'bke' | 'htn' | 'axial' | … */
  fromString: (value, format) => ({ type: 'string', value, format }),

  /** Remote URL (not yet implemented — placeholder for the extension point). */
  fromURL: (url, format) => ({ type: 'url', url, format }),

  /**
   * Resolve a source to its raw text string.
   * Returns null when the source cannot be resolved.
   */
  async resolve(source) {
    if (source.type === 'string') return source.value || null;
    if (source.type === 'url') {
      try { return await (await fetch(source.url)).text(); }
      catch { return null; }
    }
    return null;
  },
};

export { Source };
