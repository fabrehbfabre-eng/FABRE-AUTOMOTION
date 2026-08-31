/**
 * FABRE AUTOMATION - Knowledge Base Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { KnowledgeItem, KnowledgeCategory } from '../types';
import { knowledgeService } from '../services';

export function useKnowledge() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    try {
      const data = await knowledgeService.getKnowledgeItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load knowledge items', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  const createItem = async (data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await knowledgeService.createKnowledgeItem(data);
      setItems(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to create knowledge item', err);
      throw err;
    }
  };

  const updateItem = async (id: string, updates: Partial<KnowledgeItem>) => {
    try {
      const updated = await knowledgeService.updateKnowledgeItem(id, updates);
      setItems(prev => prev.map(item => item.id === id ? updated : item));
      return updated;
    } catch (err) {
      console.error('Failed to update knowledge item', err);
      throw err;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await knowledgeService.deleteKnowledgeItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete knowledge item', err);
      return false;
    }
  };

  const filteredItems = items.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      const matchTags = item.tags.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }
    return true;
  });

  return {
    items: filteredItems,
    allItems: items,
    loading,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    createItem,
    updateItem,
    deleteItem,
    refresh: loadKnowledge,
  };
}
