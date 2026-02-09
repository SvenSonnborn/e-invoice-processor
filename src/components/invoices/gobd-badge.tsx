'use client';
import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
type Status = 'compliant' | 'non-compliant' | 'warning';
interface Props { status: Status; violations?: Array<{ message: string }>; warnings?: Array<{ message: string }>; showDetails?: boolean; className?: string; size?: 'sm' | 'md' | 'lg'; }
const config: Record<Status, { icon: typeof ShieldCheck; label: string; shortLabel: string; bg: string; text: string; border: string; iconColor: string }> = {
  compliant: { icon: ShieldCheck, label: 'GoBD-konform', shortLabel: 'Konform', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', iconColor: 'text-green-600' },
  'non-compliant': { icon: ShieldX, label: 'Nicht konform', shortLabel: 'Fehler', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', iconColor: 'text-red-600' },
  warning: { icon: ShieldAlert, label: 'Mit Hinweisen', shortLabel: 'Hinweise', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', iconColor: 'text-yellow-600' },
};
export function GoBDBadge({ status, violations = [], warnings = [], showDetails = true, className, size = 'md' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const c = config[status]; const Icon = c.icon; const total = violations.length + warnings.length;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-4 py-1.5 text-base' : 'px-3 py-1 text-sm';
  return (
    <div className={cn('relative inline-block', className)}>
      <button onClick={() => total && setExpanded(!expanded)} className={cn('inline-flex items-center gap-1.5 rounded-full border font-medium', sizeClasses, c.bg, c.text, c.border, total && 'cursor-pointer')}>
        <Icon className={cn('h-4 w-4', c.iconColor)} />
        <span className="hidden sm:inline">{c.label}</span>
        <span className="sm:hidden">{c.shortLabel}</span>
        {total > 0 && <span className={cn('ml-1 rounded-full px-1.5 py-0 text-xs font-bold', status === 'non-compliant' ? 'bg-red-200' : 'bg-yellow-200')}>{total}</span>}
        {total > 0 && (expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
      {expanded && total > 0 && (
        <div className={cn('absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border bg-white p-3 shadow-lg', c.border)}>
          {violations.length > 0 && <div className="mb-2"><h4 className="mb-1 font-semibold text-red-700 text-sm">Fehler ({violations.length})</h4><ul className="space-y-1 text-sm text-red-700">{violations.map((v, i) => <li key={i}>{v.message}</li>)}</ul></div>}
          {warnings.length > 0 && <div><h4 className="mb-1 font-semibold text-yellow-700 text-sm">Hinweise ({warnings.length})</h4><ul className="space-y-1 text-sm text-yellow-700">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}
export default GoBDBadge;
