/**
 * FABRE AUTOMATION - Dashboard Metric Stat Card
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'emerald' | 'indigo' | 'purple' | 'amber';
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'cyan',
  badge,
}) => {
  const variantStyles = {
    cyan: {
      iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      borderGlow: 'hover:border-cyan-500/30',
    },
    emerald: {
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      borderGlow: 'hover:border-emerald-500/30',
    },
    indigo: {
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      borderGlow: 'hover:border-indigo-500/30',
    },
    purple: {
      iconBg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      borderGlow: 'hover:border-purple-500/30',
    },
    amber: {
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      borderGlow: 'hover:border-amber-500/30',
    },
  }[variant];

  return (
    <div
      className={`relative rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 transition-all shadow-sm ${variantStyles.borderGlow}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-neutral-400 tracking-wide">
          {title}
        </span>
        <div className={`p-2 rounded-xl border ${variantStyles.iconBg}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-2xl sm:text-3xl font-extrabold text-neutral-100 font-display tracking-tight">
          {value}
        </span>
        {badge && (
          <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-700">
            {badge}
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-500 leading-snug">{subtitle}</p>
    </div>
  );
};
