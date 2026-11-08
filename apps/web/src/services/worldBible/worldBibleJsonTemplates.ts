import type {EntityCategory} from '../../entityTypes';
import {triggerJsonDownload} from '../../utils/downloadJson';
import {getWorldBibleFieldTemplateValue} from './worldBibleEntityHelpers';

/** Downloads an empty one-row JSON import template for the category. */
export function downloadWorldBibleJsonTemplate(category: EntityCategory) {
  const row: Record<string, unknown> = {
    name: `${category.name.slice(0, -1) || 'Entry'} Name`
  };
  category.fieldSchema.forEach((field) => {
    row[field.key] = getWorldBibleFieldTemplateValue(field);
  });
  triggerJsonDownload(
    `${category.slug || 'worldbible'}-template.json`,
    {
      entries: [row],
      notes: {
        description:
          'Use this template for World Bible JSON import. Keep "name" populated for each row.'
      }
    }
  );
}

/** Downloads a three-row filled-in JSON import sample for the category. */
export function downloadWorldBibleJsonSample(category: EntityCategory) {
  const baseName = category.name.slice(0, -1) || 'Entry';
  const makeRow = (index: number): Record<string, unknown> => {
    const row: Record<string, unknown> = {
      name: `${baseName} ${index}`
    };
    category.fieldSchema.forEach((field) => {
      const value = getWorldBibleFieldTemplateValue(field);
      if (typeof value === 'string' && value.length > 0) {
        row[field.key] = `${value} ${index}`.trim();
      } else {
        row[field.key] = value;
      }
    });
    return row;
  };
  triggerJsonDownload(
    `${category.slug || 'worldbible'}-sample.json`,
    {
      entries: [makeRow(1), makeRow(2), makeRow(3)]
    }
  );
}
