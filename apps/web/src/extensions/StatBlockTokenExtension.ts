import {Node} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {
  getDefaultStatBlockTokenPresentation,
  renderStatBlockTokenChipHtml
} from '../utils/statBlockTemplates';

const STAT_BLOCK_TOKEN_REGEX =
  /\{\{STAT_BLOCK:(character|item):([^}:]+):(full|buffs|compact)(?::([^}]+))?\}\}/g;

function findTokenReplacements(doc: {
  descendants: (
    callback: (node: {isText?: boolean; text?: string | null}, pos: number) => void
  ) => void;
}) {
  const replacements: Array<{
    from: number;
    to: number;
    rawToken: string;
  }> = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }
    STAT_BLOCK_TOKEN_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = null;
    while ((match = STAT_BLOCK_TOKEN_REGEX.exec(node.text)) !== null) {
      replacements.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        rawToken: match[0]
      });
    }
  });

  return replacements;
}

export const StatBlockTokenExtension = Node.create({
  name: 'statBlockToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      rawToken: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-stat-block-token') ?? ''
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-stat-block-label') ?? ''
      },
      status: {
        default: 'resolved',
        parseHTML: (element) => element.getAttribute('data-stat-block-status') ?? 'resolved'
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('title') ?? ''
      }
    };
  },

  parseHTML() {
    return [{tag: 'span[data-stat-block-token]'}];
  },

  renderHTML({HTMLAttributes}) {
    const rawToken = typeof HTMLAttributes.rawToken === 'string' ? HTMLAttributes.rawToken : '';
    const fallback = getDefaultStatBlockTokenPresentation(rawToken);
    const container = document.createElement('div');
    container.innerHTML = renderStatBlockTokenChipHtml(rawToken, {
      rawToken,
      label:
        typeof HTMLAttributes.label === 'string' && HTMLAttributes.label
          ? HTMLAttributes.label
          : fallback.label,
      status:
        HTMLAttributes.status === 'ambiguous' || HTMLAttributes.status === 'missing'
          ? HTMLAttributes.status
          : 'resolved',
      title:
        typeof HTMLAttributes.title === 'string' && HTMLAttributes.title
          ? HTMLAttributes.title
          : fallback.title
    });
    const element = container.firstElementChild as HTMLElement | null;
    return [
      'span',
      {
        'data-stat-block-token': element?.getAttribute('data-stat-block-token') ?? rawToken,
        'data-stat-block-label': element?.getAttribute('data-stat-block-label') ?? fallback.label,
        'data-stat-block-status':
          element?.getAttribute('data-stat-block-status') ?? fallback.status,
        class: element?.getAttribute('class') ?? 'stat-block-token-chip',
        contenteditable: 'false',
        title: element?.getAttribute('title') ?? fallback.title
      },
      element?.textContent ?? 'Stat Block'
    ];
  },

  renderText({node}) {
    return node.attrs.rawToken || '';
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('statBlockTokenNormalizer'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const replacements = findTokenReplacements(newState.doc);
          if (replacements.length === 0) {
            return null;
          }

          const nodeType = newState.schema.nodes.statBlockToken;
          if (!nodeType) {
            return null;
          }

          const transaction = newState.tr;
          replacements
            .slice()
            .reverse()
            .forEach((replacement) => {
              transaction.replaceWith(
                replacement.from,
                replacement.to,
                nodeType.create({
                  rawToken: replacement.rawToken,
                  label: getDefaultStatBlockTokenPresentation(replacement.rawToken).label,
                  status: 'resolved',
                  title: replacement.rawToken
                })
              );
            });

          return transaction.docChanged ? transaction : null;
        }
      })
    ];
  }
});
