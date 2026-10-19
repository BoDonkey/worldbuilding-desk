import type {StateMutationEvent, WritingDocument} from '../../entityTypes';
import {
  resolveStateMutationAnchor,
  textSnapshotFromPlainText,
  type EditorTextSnapshot
} from '../state/stateMutationAnchor';
const scenePlainText = (html: string): string => {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  }
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
};
export function resolveRosterAnchors({
  stateMutationEvents,
  documents,
  selectedDocument,
  sceneCursorSnapshot
}: {
  stateMutationEvents: StateMutationEvent[];
  documents: WritingDocument[];
  selectedDocument: WritingDocument | null;
  sceneCursorSnapshot: EditorTextSnapshot;
}) {
  const resolutions = new Map<string, ReturnType<typeof resolveStateMutationAnchor> | null>();
  stateMutationEvents.forEach((event) => {
    if (!event.sceneAnchor || event.scenePosition === undefined) {
      resolutions.set(event.id, null);
      return;
    }
    const document = documents.find((entry) => entry.id === event.sceneId);
    if (!document) {
      resolutions.set(event.id, {status: 'unresolved'});
      return;
    }
    const snapshot = selectedDocument?.id === event.sceneId && sceneCursorSnapshot.spans.length > 0
      ? sceneCursorSnapshot
      : textSnapshotFromPlainText(scenePlainText(document.content));
    resolutions.set(event.id, resolveStateMutationAnchor({
      snapshot,
      anchor: event.sceneAnchor,
      originalPosition: event.scenePosition
    }));
  });
  return resolutions;
}
