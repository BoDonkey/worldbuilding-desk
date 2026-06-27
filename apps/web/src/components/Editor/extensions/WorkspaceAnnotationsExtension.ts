import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from 'prosemirror-state';
import {Decoration, DecorationSet} from 'prosemirror-view';
import type {EditorState} from 'prosemirror-state';
import {getVisibleWorkspaceAnnotations} from '../../../services/consistency/workspaceAnnotations';
import type {ConsistencyHighlightIssue} from './ConsistencyHighlightsExtension';
import type {LoreHighlightEntry} from './LoreHighlightsExtension';

const workspaceAnnotationsKey = new PluginKey('workspace-annotations');

type AnnotationSource<T> = T[] | (() => T[]);

const resolveAnnotationSource = <T,>(source: AnnotationSource<T>): T[] =>
  typeof source === 'function' ? source() : source;

interface WorkspaceAnnotationDecorationSpec {
  from: number;
  to: number;
  attrs: Record<string, string>;
}

export const buildWorkspaceAnnotationDecorationSpecs = (params: {
  text: string;
  knownSurfaces: LoreHighlightEntry[];
  reviewSurfaces: ConsistencyHighlightIssue[];
}): WorkspaceAnnotationDecorationSpec[] =>
  getVisibleWorkspaceAnnotations({
    text: params.text,
    knownSurfaces: params.knownSurfaces.map((entry) => ({
      id: entry.id,
      surface: entry.surface,
      metadata: entry
    })),
    reviewSurfaces: params.reviewSurfaces.map((issue) => ({
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
  }).flatMap<WorkspaceAnnotationDecorationSpec>((annotation) => {
    if (annotation.kind === 'known-canon') {
      const entry = annotation.data as LoreHighlightEntry | undefined;
      if (!entry) return [];
      return [
        {
          from: annotation.from,
          to: annotation.to,
          attrs: {
            class: 'lore-highlight',
            'data-lore-id': entry.id,
            'data-lore-type': entry.type,
            title: `Open lore for ${entry.surface}`
          }
        }
      ];
    }

    const issue = annotation.data as ConsistencyHighlightIssue | undefined;
    if (!issue) return [];
    return [
      {
        from: annotation.from,
        to: annotation.to,
        attrs: {
          class:
            issue.severity === 'blocking'
              ? 'consistency-highlight consistency-highlight-blocking'
              : 'consistency-highlight consistency-highlight-warning',
          'data-consistency-id': issue.id,
          title: issue.message
        }
      }
    ];
  });

export const createWorkspaceAnnotationsExtension = (
  knownSurfaces: AnnotationSource<LoreHighlightEntry>,
  reviewSurfaces: AnnotationSource<ConsistencyHighlightIssue>
) =>
  Extension.create({
    name: 'workspaceAnnotations',

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: workspaceAnnotationsKey,
          props: {
            decorations(state: EditorState) {
              const currentKnownSurfaces = resolveAnnotationSource(knownSurfaces);
              const currentReviewSurfaces = resolveAnnotationSource(reviewSurfaces);

              if (
                currentKnownSurfaces.length === 0 &&
                currentReviewSurfaces.length === 0
              ) {
                return DecorationSet.empty;
              }

              const decorations: Decoration[] = [];

              state.doc.descendants((
                node: {isText: boolean; text?: string | null},
                pos: number
              ) => {
                if (!node.isText || !node.text) {
                  return;
                }

                buildWorkspaceAnnotationDecorationSpecs({
                  text: node.text,
                  knownSurfaces: currentKnownSurfaces,
                  reviewSurfaces: currentReviewSurfaces
                }).forEach((spec) => {
                  decorations.push(
                    Decoration.inline(pos + spec.from, pos + spec.to, spec.attrs)
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
