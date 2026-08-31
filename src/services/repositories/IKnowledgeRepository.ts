/**
 * FABRE AUTOMATION - Knowledge Repository Interface
 * Release 2: Supabase Persistence Foundation
 */

import { KnowledgeItem } from '../../types';

export interface IKnowledgeRepository {
  getKnowledgeItems(category?: string): Promise<KnowledgeItem[]>;
  getKnowledgeItemById(id: string): Promise<KnowledgeItem | null>;
  createKnowledgeItem(data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem>;
  updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem>;
  deleteKnowledgeItem(id: string): Promise<boolean>;
  searchKnowledge(query: string): Promise<KnowledgeItem[]>;
}
