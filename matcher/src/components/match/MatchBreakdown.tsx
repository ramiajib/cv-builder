'use client';

interface DimensionRow {
  label: string;
  score: number;
  weight: number;  // 0–1, used only for display ordering
}

interface Props {
  skills: number;
  experience: number;
  seniority: number;
  education: number;
  location: number;
  language: number;
  certification: number;
}

function DimensionBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 85 ? 'bg-green-500'
    : score >= 70 ? 'bg-blue-500'
    : score >= 55 ? 'bg-amber-400'
    : 'bg-red-400';

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-right text-xs text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium text-gray-700 shrink-0">{score}%</span>
    </div>
  );
}

export function MatchBreakdown(props: Props) {
  const dimensions: DimensionRow[] = [
    { label: 'Skills',       score: props.skills,       weight: 0.35 },
    { label: 'Experience',   score: props.experience,   weight: 0.20 },
    { label: 'Seniority',    score: props.seniority,    weight: 0.10 },
    { label: 'Education',    score: props.education,    weight: 0.08 },
    { label: 'Location',     score: props.location,     weight: 0.06 },
    { label: 'Language',     score: props.language,     weight: 0.04 },
    { label: 'Certs',        score: props.certification, weight: 0.02 },
  ].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-2.5">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Score breakdown</h4>
      {dimensions.map(d => (
        <DimensionBar key={d.label} label={d.label} score={d.score} />
      ))}
    </div>
  );
}
