/**
 * FABRE AUTOMATION - Dashboard Stats Hook
 * Release: UI Synchronization with Repositories & Real Data
 */

import { useState, useEffect, useCallback } from 'react';
import { DashboardStats } from '../types';
import { repositoryManager } from '../services/repositories';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [convStats, conversations, channelConnections, automations] = await Promise.all([
        repositoryManager.conversation.getStats(),
        repositoryManager.conversation.getConversations(),
        repositoryManager.channel.getConnections(),
        repositoryManager.automation.getAutomations(),
      ]);

      const activeAutomationsCount = automations.filter(a => a.enabled).length;

      const data: DashboardStats = {
        totalConversations: convStats.totalConversations,
        messagesAutomated: convStats.automatedMessages,
        activeAutomations: activeAutomationsCount,
        humanHandoffs: convStats.humanHandoffs,
        channelConnections,
        recentConversations: conversations.slice(0, 5),
      };

      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, refresh: loadStats };
}
