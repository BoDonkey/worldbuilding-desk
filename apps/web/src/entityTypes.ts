export type EntityType = 'character' | 'location' | 'item' | 'rule';

export interface EntityFields {
  notes?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldEntity {
  id: string;
  projectId: string;
  type: EntityType;
  name: string;
  /**
   * Arbitrary key/value metadata — you can refine this later.
   */
  fields:EntityFields;
  /**
   * IDs of related entities.
   */
  links: string[];
  createdAt: number;
  updatedAt: number;
}


export interface WritingDocument {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
