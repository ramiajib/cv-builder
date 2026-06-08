import type { CandidateProfile } from '@/lib/supabase/types';

interface Props {
  candidate: CandidateProfile;
}

function CompletenessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : 'bg-amber-400';
  const label = score >= 80 ? 'Strong profile' : score >= 60 ? 'Good start' : 'Profile incomplete';
  const missing: string[] = [];
  if (!score) missing.push('basic info');

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-500">Profile completeness</span>
        <span className="text-xs font-semibold text-gray-700">{score}%</span>
      </div>
      <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <p className={`text-xs mt-1 ${score >= 80 ? 'text-green-600' : 'text-gray-400'}`}>{label}</p>
    </div>
  );
}

export function ProfileCard({ candidate }: Props) {
  const primarySkills = candidate.skills.filter(s => s.is_primary).slice(0, 6);
  const allSkills = primarySkills.length > 0 ? primarySkills : candidate.skills.slice(0, 6);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700
                        flex items-center justify-center text-white font-bold text-xl shrink-0">
          {candidate.full_name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900 text-lg truncate">{candidate.full_name}</h2>
            {candidate.is_open_to_work && (
              <span className="shrink-0 text-[10px] font-semibold text-green-700 bg-green-50
                               border border-green-200 px-2 py-0.5 rounded-full">
                Open to work
              </span>
            )}
          </div>
          {candidate.headline && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{candidate.headline}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {candidate.location_city && (
              <span className="text-xs text-gray-400">
                📍 {candidate.location_city}, {candidate.location_country}
              </span>
            )}
            {candidate.years_of_experience && (
              <span className="text-xs text-gray-400">
                · {candidate.years_of_experience}y exp
              </span>
            )}
            {candidate.seniority_level && (
              <span className="capitalize text-xs text-gray-400">
                · {candidate.seniority_level}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* Completeness */}
        <CompletenessBar score={candidate.profile_completeness} />

        {/* Skills chips */}
        {allSkills.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Top skills</p>
            <div className="flex flex-wrap gap-1.5">
              {allSkills.map(s => (
                <span key={s.id}
                  className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {candidate.languages.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Languages:</span>
            {candidate.languages.map(l => (
              <span key={l.id} className="text-xs text-gray-600 font-medium">
                {l.language} ({l.proficiency})
              </span>
            ))}
          </div>
        )}

        {/* Salary expectation */}
        {candidate.expected_salary_min_usd && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-gray-400">Expected salary</span>
            <span className="text-sm font-semibold text-gray-700">
              ${candidate.expected_salary_min_usd.toLocaleString()}
              {candidate.expected_salary_max_usd &&
                ` – $${candidate.expected_salary_max_usd.toLocaleString()}`}
              <span className="font-normal text-gray-400"> / mo</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
