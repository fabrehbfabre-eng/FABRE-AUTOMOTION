/**
 * FABRE AUTOMATION - Common Badge Component
 */

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'outline' | 'channel';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  const variantClasses = {
    default: 'bg-neutral-800/80 text-neutral-300 border border-neutral-700/60',
    primary: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    info: 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
    purple: 'bg-purple-500/10 text-purple-300 border border-purple-500/30',
    outline: 'bg-transparent text-neutral-400 border border-neutral-700',
    channel: 'bg-neutral-900/90 text-neutral-200 border border-neutral-700/80',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full whitespace-nowrap tracking-wide ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
