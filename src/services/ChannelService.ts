/**
 * FABRE AUTOMATION - Channel & Integrations Service
 * Release: UI Synchronization with Repositories & Real Data
 */

import { ChannelConnection, ChannelType, IntegrationCardConfig } from '../types';
import { IChannelService } from './types';
import { repositoryManager } from './repositories';

export class ChannelService implements IChannelService {
  async getConnections(): Promise<ChannelConnection[]> {
    const connectionsMap = await repositoryManager.channel.getConnections();
    return Object.values(connectionsMap);
  }

  async getConnection(channel: ChannelType): Promise<ChannelConnection> {
    return repositoryManager.channel.getConnection(channel);
  }

  async getIntegrationConfigs(): Promise<IntegrationCardConfig[]> {
    return repositoryManager.channel.getIntegrations();
  }
}

export const channelService = new ChannelService();

