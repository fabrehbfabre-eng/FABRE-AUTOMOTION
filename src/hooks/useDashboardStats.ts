/**
 * FABRE AUTOMATION - Dashboard Stats Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { DashboardStats } from '../types';
import { storageService } from '../services';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storageService.getStats();
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
