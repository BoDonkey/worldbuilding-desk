import type { EntityCategory } from './entityTypes';
import { openDb, CATEGORY_STORE_NAME } from './db';

export async function getCategoriesByProject(projectId: string): Promise<EntityCategory[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE_NAME, 'readonly');
    const request = tx.objectStore(CATEGORY_STORE_NAME).getAll();
    
    request.onsuccess = () => {
      const all = request.result as EntityCategory[];
      resolve(all.filter(c => c.projectId === projectId));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveCategory(category: EntityCategory): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE_NAME, 'readwrite');
    const request = tx.objectStore(CATEGORY_STORE_NAME).put(category);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CATEGORY_STORE_NAME, 'readwrite');
    const request = tx.objectStore(CATEGORY_STORE_NAME).delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Initialize default categories for a new project
export async function initializeDefaultCategories(projectId: string): Promise<void> {
  const defaults: Omit<EntityCategory, 'id' | 'createdAt'>[] = [
    {
      projectId,
      name: 'Characters',
      slug: 'characters',
      fieldSchema: [
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'age', label: 'Age', type: 'text' },
        { key: 'role', label: 'Role', type: 'text' }
      ]
    },
    {
      projectId,
      name: 'Locations',
      slug: 'locations',
      fieldSchema: [
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'climate', label: 'Climate', type: 'text' },
        { key: 'population', label: 'Population', type: 'text' }
      ]
    },
    {
      projectId,
      name: 'Items',
      slug: 'items',
      fieldSchema: [
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'rarity', label: 'Rarity', type: 'select', options: ['Common', 'Uncommon', 'Rare', 'Legendary'] }
      ]
    },
    {
      projectId,
      name: 'Rules',
      slug: 'rules',
      fieldSchema: [
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'mechanics', label: 'Mechanics', type: 'textarea' }
      ]
    }
  ];

  const now = Date.now();
  for (const def of defaults) {
    await saveCategory({
      id: crypto.randomUUID(),
      ...def,
      createdAt: now
    });
  }
}