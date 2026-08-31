/**
 * FABRE AUTOMATION - Channels & Integrations Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { ChannelConnection, IntegrationCardConfig } from '../types';
import { channelService } from '../services';

export function useChannels() {
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationCardConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [conns, integs] = await Promise.all([
        channelService.getConnections(),
        channelService.getIntegrationConfigs(),
      ]);
      setConnections(conns);
      setIntegrations(integs);
    } catch (err) {
      console.error('Failed to load channel integrations', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    connections,
    integrations,
    loading,
    refresh: loadData,
  };
}
