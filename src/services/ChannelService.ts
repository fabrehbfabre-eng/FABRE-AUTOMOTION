/**
 * FABRE AUTOMATION - Channel & Integrations Service
 * Release 1: Foundation & Architecture
 */

import { ChannelConnection, ChannelType, IntegrationCardConfig } from '../types';
import { IChannelService } from './types';
import { INITIAL_INTEGRATIONS, storageService } from './StorageService';

export class ChannelService implements IChannelService {
  async getConnections(): Promise<ChannelConnection[]> {
    const stats = await storageService.getStats();
    return Object.values(stats.channelConnections);
  }

  async getConnection(channel: ChannelType): Promise<ChannelConnection> {
    const stats = await storageService.getStats();
    return stats.channelConnections[channel];
  }

  async getIntegrationConfigs(): Promise<IntegrationCardConfig[]> {
    const stored = await storageService.getItem<IntegrationCardConfig[]>('integration_configs');
    return stored || INITIAL_INTEGRATIONS;
  }
}

export const channelService = new ChannelService();
