/**
 * FABRE AUTOMATION - Channel Icon Component
 */

import React from 'react';
import { Instagram, MessageCircle, MessageSquare, Bot, Database, Sparkles } from 'lucide-react';
import { ChannelType } from '../../types';

interface ChannelIconProps {
  channel?: ChannelType | 'all' | 'ai' | 'database';
  size?: number;
  className?: string;
  withBg?: boolean;
}

export const ChannelIcon: React.FC<ChannelIconProps> = ({
  channel = 'instagram',
  size = 18,
  className = '',
  withBg = false,
}) => {
  let Icon = MessageSquare;
  let colorClasses = 'text-neutral-400';
  let bgClasses = 'bg-neutral-800/80 border-neutral-700/60';

  if (channel === 'instagram') {
    Icon = Instagram;
    colorClasses = 'text-rose-400';
    bgClasses = 'bg-rose-500/10 border-rose-500/20';
  } else if (channel === 'messenger') {
    Icon = MessageCircle;
    colorClasses = 'text-blue-400';
    bgClasses = 'bg-blue-500/10 border-blue-500/20';
  } else if (channel === 'whatsapp') {
    Icon = MessageSquare;
    colorClasses = 'text-emerald-400';
    bgClasses = 'bg-emerald-500/10 border-emerald-500/20';
  } else if (channel === 'ai') {
    Icon = Sparkles;
    colorClasses = 'text-purple-400';
    bgClasses = 'bg-purple-500/10 border-purple-500/20';
  } else if (channel === 'database') {
    Icon = Database;
    colorClasses = 'text-emerald-400';
    bgClasses = 'bg-emerald-500/10 border-emerald-500/20';
  } else if (channel === 'all') {
    Icon = Bot;
    colorClasses = 'text-cyan-400';
    bgClasses = 'bg-cyan-500/10 border-cyan-500/20';
  }

  if (withBg) {
    return (
      <div className={`flex items-center justify-center rounded-lg border p-2 ${bgClasses} ${className}`}>
        <Icon size={size} className={colorClasses} />
      </div>
    );
  }

  return <Icon size={size} className={`${colorClasses} ${className}`} />;
};
