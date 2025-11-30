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

export interface ProjectSettings {
  id: string;
  projectId: string;
  characterStyles: CharacterStyle[];
  createdAt: number;
  updatedAt: number;
}

// apps/web/src/entityTypes.ts - ADD Character interface
export interface Character {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  characterStyleId?: string; // Link to their dialogue style
  fields: {
    age?: string;
    role?: string;
    notes?: string;
    [key: string]: unknown;
  };
  createdAt: number;
  updatedAt: number;
}

export interface CharacterStyle {
  id: string;
  name: string;
  markName: string; // e.g., 'characterDialogue', 'systemMessage'
  styles: {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
  };
}