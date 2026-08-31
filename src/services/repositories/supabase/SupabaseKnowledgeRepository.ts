/**
 * FABRE AUTOMATION - Supabase Knowledge Repository
 * Release 2: Supabase Persistence Foundation
 */

import { KnowledgeItem, KnowledgeCategory } from '../../../types';
import { IKnowledgeRepository } from '../IKnowledgeRepository';
import { getSupabaseClient } from '../../../lib/supabase';

export class SupabaseKnowledgeRepository implements IKnowledgeRepository {
  async getKnowledgeItems(category?: string): Promise<KnowledgeItem[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    let query = client
      .from('knowledge_items')
      .select('*')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn('[SupabaseKnowledgeRepository] getKnowledgeItems error:', error);
      return [];
    }

    return data.map(k => ({
      id: k.id,
      title: k.title,
      category: k.category as KnowledgeCategory,
      content: k.content,
      summary: k.summary || undefined,
      tags: k.tags || [],
      isActive: k.is_active,
      priority: k.priority,
      isOfficial: k.is_official ?? true,
      createdAt: k.created_at,
      updatedAt: k.updated_at,
    }));
  }

  async getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
    const list = await this.getKnowledgeItems();
    return list.find(k => k.id === id) || null;
  }

  async createKnowledgeItem(data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');

    const { data: created, error } = await client
      .from('knowledge_items')
      .insert({
        title: data.title,
        category: data.category,
        content: data.content,
        summary: data.summary || null,
        tags: data.tags,
        is_active: data.isActive,
        priority: data.priority,
        is_official: true,
      })
      .select()
      .single();

    if (error || !created) {
      throw new Error(`Erro ao criar item na base de conhecimento: ${error?.message}`);
    }

    return {
      id: created.id,
      title: created.title,
      category: created.category as KnowledgeCategory,
      content: created.content,
      summary: created.summary || undefined,
      tags: created.tags || [],
      isActive: created.is_active,
      priority: created.priority,
      isOfficial: created.is_official ?? true,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase not configured');

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.category !== undefined) updatePayload.category = updates.category;
    if (updates.content !== undefined) updatePayload.content = updates.content;
    if (updates.summary !== undefined) updatePayload.summary = updates.summary;
    if (updates.tags !== undefined) updatePayload.tags = updates.tags;
    if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;
    if (updates.priority !== undefined) updatePayload.priority = updates.priority;

    const { data: updated, error } = await (client
      .from('knowledge_items') as any)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error(`Erro ao atualizar item de conhecimento: ${error?.message}`);
    }

    return {
      id: updated.id,
      title: updated.title,
      category: updated.category as KnowledgeCategory,
      content: updated.content,
      summary: updated.summary || undefined,
      tags: updated.tags || [],
      isActive: updated.is_active,
      priority: updated.priority,
      isOfficial: updated.is_official ?? true,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  async deleteKnowledgeItem(id: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client.from('knowledge_items').delete().eq('id', id);
    return !error;
  }

  async searchKnowledge(query: string): Promise<KnowledgeItem[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const lower = query.trim();
    if (!lower) return this.getKnowledgeItems();

    const { data, error } = await client
      .from('knowledge_items')
      .select('*')
      .or(`title.ilike.%${lower}%,content.ilike.%${lower}%`)
      .order('priority', { ascending: true });

    if (error || !data) {
      return this.getKnowledgeItems();
    }

    return data.map(k => ({
      id: k.id,
      title: k.title,
      category: k.category as KnowledgeCategory,
      content: k.content,
      summary: k.summary || undefined,
      tags: k.tags || [],
      isActive: k.is_active,
      priority: k.priority,
      isOfficial: k.is_official ?? true,
      createdAt: k.created_at,
      updatedAt: k.updated_at,
    }));
  }
}
