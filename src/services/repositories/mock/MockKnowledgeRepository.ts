/**
 * FABRE AUTOMATION - Mock Knowledge Repository
 * Release 2: Supabase Persistence Foundation
 */

import { KnowledgeItem } from '../../../types';
import { IKnowledgeRepository } from '../IKnowledgeRepository';
import { INITIAL_KNOWLEDGE_ITEMS, storageService } from '../../StorageService';

export class MockKnowledgeRepository implements IKnowledgeRepository {
  async getKnowledgeItems(category?: string): Promise<KnowledgeItem[]> {
    const stored = await storageService.getItem<KnowledgeItem[]>('knowledge_items');
    const items = stored || INITIAL_KNOWLEDGE_ITEMS;

    if (category && category !== 'all') {
      return items.filter(item => item.category === category);
    }
    return items;
  }

  async getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
    const items = await this.getKnowledgeItems();
    return items.find(k => k.id === id) || null;
  }

  async createKnowledgeItem(data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    const current = await this.getKnowledgeItems();
    const now = new Date().toISOString();
    const newItem: KnowledgeItem = {
      ...data,
      id: `kb_local_${Date.now()}`,
      isOfficial: true, // Items created manually by user in the UI are marked official
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newItem, ...current];
    await storageService.setItem('knowledge_items', updated);
    return newItem;
  }

  async updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    const current = await this.getKnowledgeItems();
    let updatedItem: KnowledgeItem | null = null;

    const updated = current.map(item => {
      if (item.id === id) {
        updatedItem = {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return item;
    });

    if (!updatedItem) {
      throw new Error(`Knowledge item not found: ${id}`);
    }

    await storageService.setItem('knowledge_items', updated);
    return updatedItem;
  }

  async deleteKnowledgeItem(id: string): Promise<boolean> {
    const current = await this.getKnowledgeItems();
    const filtered = current.filter(k => k.id !== id);
    await storageService.setItem('knowledge_items', filtered);
    return true;
  }

  async searchKnowledge(query: string): Promise<KnowledgeItem[]> {
    const items = await this.getKnowledgeItems();
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return items;

    return items.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.content.toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
}
