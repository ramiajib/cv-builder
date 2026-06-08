'use client';

import type { TrustResult, TrustSignal } from '@/lib/matching/types';

interface Props {
  trust: TrustResult;
  expanded?: boolean;
}

const TIER_STYLES = {
  high:   { bar: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', label: 'High Trust' },
  medium: { bar: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', label: 'Verified' },
  low:    { bar: 'bg-gray-300',   bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200',  label: 'Unverified' },
};

function SignalRow({ signal }: { signal: TrustSignal }) {
  return (
    <li className="flex items-center gap-2">
      {signal.positive ? (
        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 14 14">
          <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : signal.icon === 'warning' ? (
        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 14 14">
          <path d="M7 5v3M7 10v.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          <path d="M6.1 1.9L1.1 10.5A1 1 0 002 12h10a1 1 0 00.9-1.5L7.9 1.9a1 1 0 00-1.8 0z" stroke="currentColor" strokeWidth={1.5} />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 14 14">
          <circle cx={7} cy={7} r={5.5} stroke="currentColor" strokeWidth={1.5} />
          <path d="M7 6v4M7 4v.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      )}
      <span className={`text-xs ${signal.positive ? 'text-gray-700' : 'text-gray-500'}`}>
        {signal.label}
      </span>
    </li>
  );
}

export function TrustBadge({ trust, expanded = false }: Props) {
  const s = TIER_STYLES[trust.tier];

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-3`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${s.text} uppercase tracking-wide`}>
            Trust Score
          </span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${s.bg} ${s.text} border ${s.border}`}>
            {s.label}
          </span>
        </div>
        <span className={`text-lg font-bold ${s.text}`}>{trust.score}%</span>
      </div>

      {/* Score bar */}
      <div className="bg-white/60 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${s.bar} transition-all duration-700`}
          style={{ width: `${trust.score}%` }}
        />
      </div>

      {/* Signals */}
      {trust.signals.length > 0 && (
        <ul className="space-y-1.5">
          {(expanded ? trust.signals : trust.signals.slice(0, 4)).map((sig, i) => (
            <SignalRow key={i} signal={sig} />
          ))}
          {!expanded && trust.signals.length > 4 && (
            <li className="text-xs text-gray-400">+{trust.signals.length - 4} more signals</li>
          )}
        </ul>
      )}

      {expanded && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200/80 leading-relaxed">
          {trust.explanation}
        </p>
      )}
    </div>
  );
}
