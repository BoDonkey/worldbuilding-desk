import type { WorldEntity, EntityCategory } from '../entityTypes';

export interface WorldBibleExport {
  categories: EntityCategory[];
  entities: WorldEntity[];
  exportedAt: number;
}

export function exportWorldBibleToJSON(
  categories: EntityCategory[],
  entities: WorldEntity[]
): string {
  const data: WorldBibleExport = {
    categories,
    entities,
    exportedAt: Date.now()
  };
  return JSON.stringify(data, null, 2);
}

export function downloadWorldBibleJSON(
  categories: EntityCategory[],
  entities: WorldEntity[],
  projectName: string
): void {
  const json = exportWorldBibleToJSON(categories, entities);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}-world-bible.json`;
  a.click();
  URL.revokeObjectURL(url);
}