'use client';

import type { MatchTier } from '@/lib/matching/types';

interface Props {
  score: number;
  tier: MatchTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZE = { sm: 64, md: 88, lg: 120 };
const STROKE = { sm: 5, md: 7, lg: 9 };

const TIER_COLOR: Record<MatchTier, string> = {
  excellent: '#22c55e',
  strong:    '#3b82f6',
  moderate:  '#f59e0b',
  weak:      '#ef4444',
};

const TIER_BG: Record<MatchTier, string> = {
  excellent: 'bg-green-50 text-green-700',
  strong:    'bg-blue-50 text-blue-700',
  moderate:  'bg-amber-50 text-amber-700',
  weak:      'bg-red-50 text-red-700',
};

const TIER_LABEL: Record<MatchTier, string> = {
  excellent: 'Excellent',
  strong:    'Strong',
  moderate:  'Moderate',
  weak:      'Weak',
};

export function MatchScoreRing({ score, tier, size = 'md', showLabel = false }: Props) {
  const dim = SIZE[size];
  const strokeW = STROKE[size];
  const radius = (dim - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = TIER_COLOR[tier];
  const cx = dim / 2;
  const cy = dim / 2;
  const fontSize = size === 'sm' ? 14 : size === 'md' ? 20 : 28;
  const subFontSize = size === 'sm' ? 8 : size === 'md' ? 10 : 12;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeW}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Labels — counter-rotate so text stays upright */}
        <g style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}>
          <text
            x={cx} y={cy - 2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={fontSize} fontWeight={700} fill={color}
          >
            {score}
          </text>
          <text
            x={cx} y={cy + fontSize * 0.7}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={subFontSize} fill="#9ca3af"
          >
            / 100
          </text>
        </g>
      </svg>

      {showLabel && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIER_BG[tier]}`}>
          {TIER_LABEL[tier]} Match
        </span>
      )}
    </div>
  );
}
