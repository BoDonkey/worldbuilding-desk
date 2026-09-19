import type {
  EntityCategory,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';

export const SYSTEM_NEGATIVE_SPACE_RECORD_TYPE = 'system-negative-space' as const;

export const SYSTEM_NEGATIVE_SPACE_STATUSES = [
  {value: 'open', label: 'Open'},
  {value: 'worsening', label: 'Worsening'},
  {value: 'changed', label: 'Changed'},
  {value: 'resolved', label: 'Resolved'}
] as const;

export type SystemNegativeSpaceStatus =
  (typeof SYSTEM_NEGATIVE_SPACE_STATUSES)[number]['value'];

export function isSystemNegativeSpaceCategory(
  category: EntityCategory | null | undefined
): boolean {
  return category?.recordType === SYSTEM_NEGATIVE_SPACE_RECORD_TYPE;
}

export const SYSTEM_NEGATIVE_SPACE_CATEGORY_NAME = 'Problems Power Cannot Solve';

export const SYSTEM_NEGATIVE_SPACE_DESCRIPTION =
  'Track human problems your world’s power system cannot fix — grief, trust, belonging — so ' +
  'growing power does not quietly solve everything. Optional; add it only if the question is useful.';

/**
 * Opt-in: the author adds this from Manage Categories. The id is fixed per project so the
 * category can only ever exist once, however many times it is added.
 */
export const systemNegativeSpaceCategoryId = (projectId: string) =>
  `system-negative-space-${projectId}`;

export function createSystemNegativeSpaceCategory(
  projectId: string,
  now = Date.now()
): EntityCategory {
  return {
    id: systemNegativeSpaceCategoryId(projectId),
    projectId,
    kind: 'general',
    recordType: SYSTEM_NEGATIVE_SPACE_RECORD_TYPE,
    name: SYSTEM_NEGATIVE_SPACE_CATEGORY_NAME,
    slug: 'problems-power-cannot-solve',
    fieldSchema: [
      {
        key: 'description',
        label: 'Human problem',
        type: 'textarea',
        required: true
      },
      {
        key: 'power_boundary',
        label: 'Why power cannot solve it',
        type: 'textarea',
        required: true
      },
      {
        key: 'author_notes',
        label: 'Author notes',
        type: 'textarea'
      }
    ],
    createdAt: now
  };
}

export function normalizeSystemNegativeSpaceRecord(
  value: WorldEntity['systemNegativeSpace'] | undefined,
  availableSceneIds: ReadonlySet<string>
): NonNullable<WorldEntity['systemNegativeSpace']> {
  const status = SYSTEM_NEGATIVE_SPACE_STATUSES.some(
    (option) => option.value === value?.status
  )
    ? value!.status
    : 'open';
  return {
    status,
    sceneIds: [...new Set(value?.sceneIds ?? [])].filter((id) => availableSceneIds.has(id))
  };
}

export function summarizeSystemNegativeSpaceRecords(params: {
  categoryId: string;
  entities: WorldEntity[];
  documents: WritingDocument[];
}) {
  const sceneIds = new Set(params.documents.map((document) => document.id));
  const records = params.entities.filter((entity) => entity.categoryId === params.categoryId);
  const counts: Record<SystemNegativeSpaceStatus, number> = {
    open: 0,
    worsening: 0,
    changed: 0,
    resolved: 0
  };
  const linkedSceneIds = new Set<string>();
  records.forEach((record) => {
    const normalized = normalizeSystemNegativeSpaceRecord(
      record.systemNegativeSpace,
      sceneIds
    );
    counts[normalized.status] += 1;
    normalized.sceneIds.forEach((id) => linkedSceneIds.add(id));
  });
  return {
    recordCount: records.length,
    counts,
    linkedSceneIds: [...linkedSceneIds]
  };
}
