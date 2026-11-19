import {useCallback, useMemo, useState} from 'react';
import type {LoreInspectorRecord} from '../services/workspace/workspaceConsultation';
import type {StatBlockPreviewData} from './useWorkspaceStatBlocks';
import type {SelectionQuickSnippetLookup} from './useEditorSelectionMenu';

type AnchorRect = {left: number; top: number; bottom: number};

export interface StatBlockPopoverState {
  preview: StatBlockPreviewData;
  left: number;
  top: number;
}

/**
 * The editor's two click popovers: the lore peek for a highlighted record and
 * the stat-block preview for a stat-block token. Both also open from the
 * selection menu.
 */
export function useEditorContextPopovers(params: {
  quickSnippets?: SelectionQuickSnippetLookup;
  getStatBlockPreviewData?: (rawToken: string) => StatBlockPreviewData;
  onRebindStatBlockToken?: (rawToken: string) => void;
}) {
  const {quickSnippets, getStatBlockPreviewData, onRebindStatBlockToken} = params;
  const [loreRecord, setLoreRecord] = useState<LoreInspectorRecord | null>(null);
  const [loreAnchor, setLoreAnchor] = useState<{left: number; top: number} | null>(null);
  const [statBlockPopover, setStatBlockPopover] = useState<StatBlockPopoverState | null>(null);

  const loreRecordById = useMemo(() => {
    const records = [
      ...Object.values(quickSnippets?.characters ?? {}),
      ...Object.values(quickSnippets?.entities ?? {})
    ];
    return new Map(records.map((entry) => [entry.lore.id, entry.lore]));
  }, [quickSnippets]);

  const closeLorePopover = useCallback(() => {
    setLoreAnchor(null);
    setLoreRecord(null);
  }, []);

  const closeContextPopovers = useCallback(() => {
    setLoreAnchor(null);
    setLoreRecord(null);
    setStatBlockPopover(null);
  }, []);

  /** Opens the lore peek at `anchor`; a null record leaves only the anchor set. */
  const showLoreRecord = useCallback(
    (record: LoreInspectorRecord | null, anchor: {left: number; top: number}) => {
      setLoreRecord(record);
      setLoreAnchor(anchor);
    },
    []
  );

  /** Opens the lore peek below a clicked lore highlight. */
  const openLoreHighlight = useCallback(
    (loreId: string, anchorRect: AnchorRect) => {
      const record = loreRecordById.get(loreId);
      if (!record) {
        return;
      }
      setLoreRecord(record);
      setLoreAnchor({
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    [loreRecordById]
  );

  /** Opens the preview below a clicked token, or asks to rebind one with no preview. */
  const handleStatBlockTokenClick = useCallback(
    (rawToken: string, anchorRect: AnchorRect) => {
      const preview = getStatBlockPreviewData?.(rawToken);
      if (!preview) {
        onRebindStatBlockToken?.(rawToken);
        return;
      }
      setStatBlockPopover({
        preview,
        left: anchorRect.left,
        top: anchorRect.bottom + 8
      });
    },
    [getStatBlockPreviewData, onRebindStatBlockToken]
  );

  return {
    loreRecord,
    loreAnchor,
    statBlockPopover,
    setStatBlockPopover,
    showLoreRecord,
    closeLorePopover,
    closeContextPopovers,
    openLoreHighlight,
    handleStatBlockTokenClick
  };
}

export type EditorContextPopoverControls = ReturnType<typeof useEditorContextPopovers>;
