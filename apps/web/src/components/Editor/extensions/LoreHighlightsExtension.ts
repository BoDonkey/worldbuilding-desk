/*
 * The lore highlight entry type. Lore highlights are drawn by
 * WorkspaceAnnotationsExtension; the old standalone extension here had no
 * caller and was removed (slice 3.51).
 */

export interface LoreHighlightEntry {
  id: string;
  surface: string;
  type: 'character' | 'entity';
}
