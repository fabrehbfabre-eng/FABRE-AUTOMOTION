/**
 * FABRE AUTOMATION - Automations Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { Automation, ChannelType } from '../types';
import { automationService } from '../services';

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<ChannelType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await automationService.getAutomations();
      setAutomations(data);
    } catch (err) {
      console.error('Failed to load automations', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  const toggleAutomation = async (id: string, enabled: boolean) => {
    try {
      const updated = await automationService.toggleAutomation(id, enabled);
      setAutomations(prev => prev.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error('Failed to toggle automation', err);
    }
  };

  const createAutomation = async (data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>) => {
    try {
      const created = await automationService.createAutomation(data);
      setAutomations(prev => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Failed to create automation', err);
      throw err;
    }
  };

  const updateAutomation = async (id: string, updates: Partial<Automation>) => {
    try {
      const updated = await automationService.updateAutomation(id, updates);
      setAutomations(prev => prev.map(a => a.id === id ? updated : a));
      return updated;
    } catch (err) {
      console.error('Failed to update automation', err);
      throw err;
    }
  };

  const deleteAutomation = async (id: string) => {
    try {
      await automationService.deleteAutomation(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete automation', err);
      return false;
    }
  };

  const filteredAutomations = automations.filter(a => {
    if (channelFilter !== 'all' && a.channel !== channelFilter && a.channel !== 'all') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchDesc = a.description.toLowerCase().includes(q);
      const matchKeywords = a.trigger.config.keywords?.some(k => k.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchKeywords) return false;
    }
    return true;
  });

  return {
    automations: filteredAutomations,
    allAutomations: automations,
    loading,
    channelFilter,
    setChannelFilter,
    searchQuery,
    setSearchQuery,
    toggleAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    refresh: loadAutomations,
  };
}
