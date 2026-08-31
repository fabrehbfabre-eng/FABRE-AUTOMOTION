/**
 * FABRE AUTOMATION - Empty State Component
 */

import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  badge?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 rounded-xl border border-neutral-800/80 bg-neutral-900/30 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-neutral-800/60 border border-neutral-700/50 flex items-center justify-center text-neutral-400 mb-4 shadow-inner">
        <Icon size={24} className="text-cyan-400/80" />
      </div>

      {badge && (
        <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2.5 py-0.5 rounded-full mb-2">
          {badge}
        </span>
      )}

      <h3 className="text-base font-semibold text-neutral-200 mb-1 font-display">{title}</h3>
      <p className="text-sm text-neutral-400 max-w-md mb-5 leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors shadow-sm cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
