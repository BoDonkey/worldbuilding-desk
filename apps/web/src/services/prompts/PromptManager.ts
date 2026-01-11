import {openDB, type IDBPDatabase} from 'idb';

export interface PromptTemplate {
  id: string;
  name: string;
  contextType: 'document' | 'rules' | 'world-bible' | 'any';
  basePrompt: string;
  userEditable: boolean;
}

interface PromptDB {
  prompts: {
    key: string;
    value: PromptTemplate;
    indexes: {'by-context': string};
  };
}

export class PromptManager {
  private db: IDBPDatabase<PromptDB> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<PromptDB>('prompts', 1, {
      upgrade(db) {
        const store = db.createObjectStore('prompts', {keyPath: 'id'});
        store.createIndex('by-context', 'contextType');
      }
    });

    // Initialize defaults if empty
    const count = await this.db.count('prompts');
    if (count === 0) {
      await this.initializeDefaults();
    }
  }

  async getPrompt(contextType: string): Promise<string> {
    if (!this.db) await this.init();

    const template = await this.db!.get('prompts', `${contextType}-default`);
    return template?.basePrompt || this.getFallbackPrompt();
  }

  async savePrompt(template: PromptTemplate): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('prompts', template);
  }

  async getAllPrompts(): Promise<PromptTemplate[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('prompts');
  }

  renderPrompt(template: string, vars: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  }

  private async initializeDefaults(): Promise<void> {
    const defaults = await import('./defaultPrompts');
    for (const template of defaults.defaultPrompts) {
      await this.db!.put('prompts', template);
    }
  }

  private getFallbackPrompt(): string {
    return 'You are an AI assistant helping authors create LitRPG/GameLit content.';
  }
}
