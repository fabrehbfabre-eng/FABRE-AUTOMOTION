/**
 * FABRE AUTOMATION - Knowledge Service
 * Release 2: Supabase Persistence Foundation
 * 
 * Delegates to repositoryManager (SupabaseProvider or MockProvider)
 */

import { KnowledgeItem } from '../types';
import { IKnowledgeService } from './types';
import { repositoryManager } from './repositories';

export class KnowledgeService implements IKnowledgeService {
  async getKnowledgeItems(category?: string): Promise<KnowledgeItem[]> {
    return repositoryManager.knowledge.getKnowledgeItems(category);
  }

  async getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
    return repositoryManager.knowledge.getKnowledgeItemById(id);
  }

  async createKnowledgeItem(data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    return repositoryManager.knowledge.createKnowledgeItem(data);
  }

  async updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    return repositoryManager.knowledge.updateKnowledgeItem(id, updates);
  }

  async deleteKnowledgeItem(id: string): Promise<boolean> {
    return repositoryManager.knowledge.deleteKnowledgeItem(id);
  }

  async searchKnowledge(query: string): Promise<KnowledgeItem[]> {
    return repositoryManager.knowledge.searchKnowledge(query);
  }
}

export const knowledgeService = new KnowledgeService();
