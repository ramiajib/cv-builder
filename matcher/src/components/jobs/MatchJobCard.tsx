/**
 * MatchJobCard — like JobCard but designed for job-seekers arriving from the
 * CV builder. Links out to the job's external application URL instead of the
 * internal recruiter detail page.
 */
import type { MatchTier } from '@/lib/matching/types';
import type { JobProfile, MatchResultDB } from '@/lib/supabase/types';
import { MatchScoreRing } from '../match/MatchScoreRing';

interface Props {
  job: JobProfile;
  match: MatchResultDB;
  isNew?: boolean;
}

function RemotePill({ policy }: { policy: string }) {
  if (policy === 'remote')
    return <span className="bg-green-50 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded-full">Remote</span>;
  if (policy === 'hybrid')
    return <span className="bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full">Hybrid</span>;
  return null;
}

function TrustDots({ score }: { score: number }) {
  const tier   = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  const color  = tier === 'high' ? 'bg-green-500' : tier === 'medium' ? 'bg-amber-400' : 'bg-gray-300';
  const filled = tier === 'high' ? 4 : tier === 'medium' ? 2 : 1;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= filled ? color : 'bg-gray-200'}`} />
      ))}
      <span className="text-[10px] text-gray-400 ml-0.5">Trust {score}%</span>
    </div>
  );
}

export function MatchJobCard({ job, match, isNew = false }: Props) {
  const tier: MatchTier =
    match.match_score >= 85 ? 'excellent'
    : match.match_score >= 70 ? 'strong'
    : match.match_score >= 55 ? 'moderate'
    : 'weak';

  const topStrengths = (match.strengths as Array<{ label: string; detail: string }>).slice(0, 2);
  const topGaps = (match.gaps as Array<{ item: string; importance: string }>)
    .filter(g => g.importance === 'required')
    .slice(0, 1);

  const externalUrl = job.application_url || job.source_url || null;

  const postedDaysAgo = Math.floor(
    (Date.now() - new Date(job.posted_date).getTime()) / (1000 * 60 * 60 * 24),
  );

  const card = (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-300
                    hover:shadow-md transition-all duration-200 relative overflow-hidden">

      {isNew && (
        <span className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold
                         px-2 py-0.5 rounded-full">NEW</span>
      )}

      <div className="flex items-start gap-4">
        {/* Score ring */}
        <div className="shrink-0">
          <MatchScoreRing score={match.match_score} tier={tier} size="sm" showLabel />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + company */}
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.company?.name ?? 'Unknown Company'}
            {job.location_country && ` · ${job.location_city ?? job.location_country}`}
          </p>

          {/* Salary + remote + age */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {job.salary_disclosed && job.salary_min_usd && (
              <span className="text-xs text-gray-600 font-medium">
                ${job.salary_min_usd.toLocaleString()}
                {job.salary_max_usd && ` – $${job.salary_max_usd.toLocaleString()}`}
              </span>
            )}
            <RemotePill policy={job.remote_policy} />
            <span className="text-xs text-gray-400">
              {postedDaysAgo === 0 ? 'Today' : postedDaysAgo === 1 ? '1d ago' : `${postedDaysAgo}d ago`}
            </span>
          </div>

          {/* Strengths / gaps pills */}
          {topStrengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {topStrengths.map((s, i) => (
                <span key={i} className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  ✓ {s.label}
                </span>
              ))}
              {topGaps.map((g, i) => (
                <span key={i} className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  ✗ {g.item}
                </span>
              ))}
            </div>
          )}

          {/* Trust + apply row */}
          <div className="mt-3 flex items-center justify-between">
            <TrustDots score={job.trust_score} />
            {externalUrl && (
              <span className="text-xs font-medium text-blue-600 group-hover:underline">
                Apply →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (externalUrl) {
    return (
      <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="block group">
        {card}
      </a>
    );
  }

  return <div className="group">{card}</div>;
}
