import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';
import {getVisibleWorkspaceAnnotations} from '../../../services/consistency/workspaceAnnotations';
import type {
  WorkspaceAnnotationSource,
  WorkspaceReviewInlineMode
} from '../../../services/consistency/workspaceAnnotations';
import type {GuardrailIssueCode} from '../../../services/consistency/types';

export interface ConsistencyHighlightIssue {
  id: string;
  surface: string;
  message: string;
  severity: 'blocking' | 'warning';
  issueCode?: GuardrailIssueCode;
  source?: WorkspaceAnnotationSource;
  confidence?: number;
  inlineMode?: WorkspaceReviewInlineMode;
}

export interface KnownHighlightSurface {
  id: string;
  surface: string;
}

const consistencyHighlightsKey = new PluginKey('consistency-highlights');
type HighlightSource<T> = T[] | (() => T[]);

const resolveHighlightSource = <T,>(source: HighlightSource<T>): T[] =>
  typeof source === 'function' ? source() : source;

export const createConsistencyHighlightsExtension = (
  issues: HighlightSource<ConsistencyHighlightIssue>,
  knownSurfaces: HighlightSource<KnownHighlightSurface> = []
) =>
  Extension.create({
    name: 'consistencyHighlights',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: consistencyHighlightsKey,
          props: {
            decorations(state: EditorState) {
              const currentIssues = resolveHighlightSource(issues);
              if (currentIssues.length === 0) {
                return DecorationSet.empty;
              }
              const currentKnownSurfaces = resolveHighlightSource(knownSurfaces);

              const decorations: Decoration[] = [];

              state.doc.descendants((
                node: {isText: boolean; text?: string | null},
                pos: number
              ) => {
                if (!node.isText || !node.text) {
                  return;
                }

                getVisibleWorkspaceAnnotations({
                  text: node.text,
                  knownSurfaces: currentKnownSurfaces.map((entry) => ({
                    id: entry.id,
                    surface: entry.surface
                  })),
                  reviewSurfaces: currentIssues.map((issue) => ({
                    id: issue.id,
                    surface: issue.surface,
                    message: issue.message,
                    severity: issue.severity,
                    issueCode: issue.issueCode,
                    source: issue.source,
                    confidence: issue.confidence,
                    inlineMode: issue.inlineMode,
                    metadata: issue
                  }))
                })
                  .filter((annotation) => annotation.kind === 'review-candidate')
                  .forEach((annotation) => {
                    const issue = annotation.data as
                      | ConsistencyHighlightIssue
                      | undefined;
                    if (!issue) return;
                    decorations.push(
                      Decoration.inline(pos + annotation.from, pos + annotation.to, {
                        class:
                          issue.severity === 'blocking'
                            ? 'consistency-highlight consistency-highlight-blocking'
                            : 'consistency-highlight consistency-highlight-warning',
                        'data-consistency-id': issue.id,
                        title: issue.message
                      })
                    );
                  });
              });

              return DecorationSet.create(state.doc, decorations);
            }
          }
        })
      ];
    }
  });
