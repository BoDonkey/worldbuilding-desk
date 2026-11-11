import {useCallback, useState} from 'react';
import type {ManualWorldCapture} from '../components/Workspace/WorkspaceManualWorldCapturePopover';

/**
 * **Add to World** from an editor selection: the open capture popover (the
 * selected text, the name being drafted, and where the popover sits) and the
 * existing record picked to link it to.
 */
export function useWorkspaceManualWorldCapture() {
  const [capture, setCapture] = useState<ManualWorldCapture | null>(null);
  const [existingTargetId, setExistingTargetId] = useState('');

  /** Opens the popover just below the selection. */
  const open = useCallback(
    (draftText: string, anchorRect: {left: number; top: number; bottom: number}) => {
      setExistingTargetId('');
      setCapture({
        sourceText: draftText,
        draftText,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    []
  );

  const reset = useCallback(() => {
    setCapture(null);
    setExistingTargetId('');
  }, []);

  return {capture, setCapture, existingTargetId, setExistingTargetId, open, reset};
}
