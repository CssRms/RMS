import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const FindReplaceKey = new PluginKey('findReplace');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findMatches = (doc, term) => {
  const matches = [];
  if (!term) return matches;
  const re = new RegExp(escapeRegExp(term), 'gi');
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let match;
    while ((match = re.exec(node.text)) !== null) {
      matches.push({ from: pos + match.index, to: pos + match.index + match[0].length });
      if (match[0].length === 0) re.lastIndex++;
    }
  });
  return matches;
};

// Lightweight Find & Replace built directly on ProseMirror decorations — TipTap ships
// no Find & Replace out of the box, and a real document model (vs. raw contentEditable)
// is what makes tracking match positions through edits tractable at all.
export const FindReplace = Extension.create({
  name: 'findReplace',

  addStorage() {
    return { searchTerm: '', matches: [], activeIndex: 0 };
  },

  addCommands() {
    return {
      setSearchTerm: (term) => ({ editor, dispatch }) => {
        this.storage.searchTerm = term;
        this.storage.matches = findMatches(editor.state.doc, term);
        this.storage.activeIndex = 0;
        if (dispatch) editor.view.dispatch(editor.state.tr);
        return true;
      },
      goToMatch: (direction) => ({ editor, dispatch }) => {
        const { matches } = this.storage;
        if (!matches.length) return false;
        this.storage.activeIndex = ((this.storage.activeIndex + direction) % matches.length + matches.length) % matches.length;
        const m = matches[this.storage.activeIndex];
        if (dispatch) {
          editor.view.dispatch(
            editor.state.tr.setSelection(TextSelection.create(editor.state.doc, m.from, m.to)).scrollIntoView()
          );
        }
        return true;
      },
      replaceCurrentMatch: (replacement) => ({ editor, dispatch }) => {
        const { matches, activeIndex } = this.storage;
        if (!matches.length) return false;
        const m = matches[activeIndex];
        if (dispatch) editor.view.dispatch(editor.state.tr.insertText(replacement, m.from, m.to));
        this.storage.matches = findMatches(editor.state.doc, this.storage.searchTerm);
        if (this.storage.activeIndex >= this.storage.matches.length) this.storage.activeIndex = 0;
        return true;
      },
      replaceAllMatches: (replacement) => ({ editor, dispatch }) => {
        const matches = findMatches(editor.state.doc, this.storage.searchTerm);
        if (!matches.length) return false;
        if (dispatch) {
          let tr = editor.state.tr;
          // Walk backwards so earlier replacements don't shift the positions of later ones.
          for (let i = matches.length - 1; i >= 0; i--) {
            tr = tr.insertText(replacement, matches[i].from, matches[i].to);
          }
          editor.view.dispatch(tr);
        }
        this.storage.matches = [];
        this.storage.activeIndex = 0;
        return true;
      },
      clearSearch: () => ({ editor, dispatch }) => {
        this.storage.searchTerm = '';
        this.storage.matches = [];
        this.storage.activeIndex = 0;
        if (dispatch) editor.view.dispatch(editor.state.tr);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: FindReplaceKey,
        props: {
          decorations(state) {
            const { matches, activeIndex } = storage;
            if (!matches.length) return null;
            const decos = matches.map((m, i) => Decoration.inline(m.from, m.to, {
              class: i === activeIndex ? 'tiptap-search-match-active' : 'tiptap-search-match',
            }));
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
