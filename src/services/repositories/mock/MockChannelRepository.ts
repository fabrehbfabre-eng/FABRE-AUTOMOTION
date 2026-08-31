/**
 * FABRE AUTOMATION - Mock Channel Repository
 * Release 2: Supabase Persistence Foundation
 */

import { ChannelConnection, IntegrationCardConfig } from '../../../types';
import { IChannelRepository } from '../IChannelRepository';
import { INITIAL_CONNECTIONS, INITIAL_INTEGRATIONS, storageService } from '../../StorageService';

export class MockChannelRepository implements IChannelRepository {
  async getConnections(): Promise<Record<'instagram' | 'messenger' | 'whatsapp', ChannelConnection>> {
    const stored = await storageService.getItem<Record<'instagram' | 'messenger' | 'whatsapp', ChannelConnection>>('connections');
    return stored || INITIAL_CONNECTIONS;
  }

  async getIntegrations(): Promise<IntegrationCardConfig[]> {
    return INITIAL_INTEGRATIONS;
  }

  async updateConnectionStatus(
    channel: 'instagram' | 'messenger' | 'whatsapp',
    status: ChannelConnection['status'],
    message?: string
  ): Promise<ChannelConnection> {
    const current = await this.getConnections();
    const updatedTarget: ChannelConnection = {
      ...current[channel],
      status,
      statusMessage: message || current[channel].statusMessage,
      connectedAt: status === 'connected' ? new Date().toISOString() : undefined,
    };

    const updated = {
      ...current,
      [channel]: updatedTarget,
    };

    await storageService.setItem('connections', updated);
    return updatedTarget;
  }
}
