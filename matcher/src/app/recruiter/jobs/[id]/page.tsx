import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching/engine';
import type { CandidateProfile, JobProfile } from '@/lib/supabase/types';

interface PageProps {
  params: { id: string };
}

const TIER_COLOR: Record<string, string> = {
  excellent: 'text-green-700 bg-green-50 border-green-200',
  strong:    'text-blue-700  bg-blue-50  border-blue-200',
  moderate:  'text-amber-700 bg-amber-50 border-amber-200',
  weak:      'text-gray-500  bg-gray-50  border-gray-200',
};
const RING_COLOR: Record<string, string> = {
  excellent: '#16a34a',
  strong:    '#2563eb',
  moderate:  '#d97706',
  weak:      '#9ca3af',
};

function ScoreRing({ score, tier }: { score: number; tier: string }) {
  const r = 20, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none"
        stroke={RING_COLOR[tier] ?? '#9ca3af'}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="700"
        fill={RING_COLOR[tier] ?? '#6b7280'}>{score}</text>
    </svg>
  );
}

export default async function RecruiterJobPage({ params }: PageProps) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://your-project.supabase.co') {
    redirect('/setup');
  }

  const supabase = createServiceClient();

  // Load job
  const { data: jobData } = await supabase
    .from('jobs')
    .select('*, company:companies(*), recruiter:recruiters(*), job_skills(*)')
    .eq('id', params.id)
    .single();

  if (!jobData) redirect('/recruiter');
  const job = jobData as unknown as JobProfile;

  // Load all candidates with relations
  const { data: candidatesData } = await supabase
    .from('candidates')
    .select('*, skills(*), experiences(*), education(*), certifications(*), languages(*), preferences:candidate_preferences(*)')
    .eq('is_active', true)
    .order('profile_completeness', { ascending: false })
    .limit(100);

  const candidates = (candidatesData ?? []).map(c => {
    const p = c as unknown as CandidateProfile;
    (p as any).preferences = Array.isArray((p as any).preferences)
      ? (p as any).preferences[0] ?? null
      : (p as any).preferences;
    return p;
  });

  // Score all candidates
  const ranked = candidates
    .map(c => ({ candidate: c, match: computeMatchScore(c, job) }))
    .sort((a, b) => b.match.match_score - a.match.match_score);

  const tierCounts = {
    excellent: ranked.filter(r => r.match.match_score >= 85).length,
    strong:    ranked.filter(r => r.match.match_score >= 70 && r.match.match_score < 85).length,
    moderate:  ranked.filter(r => r.match.match_score >= 55 && r.match.match_score < 70).length,
    weak:      ranked.filter(r => r.match.match_score < 55).length,
  };

  const requiredSkills = (job as any).job_skills?.filter((s: any) => s.is_required).map((s: any) => s.normalized_name as string) ?? [];

  return (
    <div className="space-y-6">
      {/* Back */}
      <a href="/recruiter" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        ← Back to jobs
      </a>

      {/* Job header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-gray-500 mt-1">
              {(job as any).company?.name} · {job.location_city}, {job.location_country}
            </p>
            {job.salary_disclosed && job.salary_min_usd && (
              <p className="text-sm text-gray-600 mt-1">
                ${job.salary_min_usd.toLocaleString()} – ${(job.salary_max_usd ?? 0).toLocaleString()} / mo
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{ranked.length}</div>
            <div className="text-xs text-gray-500">candidates ranked</div>
          </div>
        </div>

        {/* Required skills */}
        {(job as any).job_skills?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(job as any).job_skills.map((s: any) => (
              <span key={s.id}
                className={`text-xs px-2.5 py-1 rounded-full border
                  ${s.is_required
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {s.skill_name}
                {s.is_required ? '' : ' (preferred)'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tier summary */}
      <div className="grid grid-cols-4 gap-3">
        {(['excellent','strong','moderate','weak'] as const).map(t => (
          <div key={t} className={`rounded-xl border p-3 ${TIER_COLOR[t]}`}>
            <div className="text-2xl font-bold">{tierCounts[t]}</div>
            <div className="text-xs capitalize mt-0.5 opacity-75">{t}</div>
          </div>
        ))}
      </div>

      {/* Candidate list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Ranked candidates
        </h2>
        {ranked.map(({ candidate: c, match }, idx) => {
          const candidateSkillNames = (c.skills ?? []).map((s: any) => s.normalized_name as string);
          const hasRequired = requiredSkills.filter(rs => candidateSkillNames.some(cs => cs.includes(rs) || rs.includes(cs)));
          const missingRequired = requiredSkills.filter(rs => !candidateSkillNames.some(cs => cs.includes(rs) || rs.includes(cs)));

          return (
            <div key={c.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4
                         hover:border-gray-300 transition-colors">
              {/* Rank */}
              <div className="text-sm font-bold text-gray-400 w-6 shrink-0 pt-1">
                {idx + 1}
              </div>

              {/* Score ring */}
              <ScoreRing score={match.match_score} tier={match.tier} />

              {/* Candidate info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{c.full_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${TIER_COLOR[match.tier]}`}>
                    {match.tier} match
                  </span>
                  {c.location_country_code && ['SA','AE','QA','KW','BH','OM'].includes(c.location_country_code) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      GCC
                    </span>
                  )}
                  {c.willing_to_relocate && !['SA','AE','QA','KW','BH','OM'].includes(c.location_country_code ?? '') && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                      Open to relocate
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {c.headline} · {c.location_city ?? 'Location unknown'}
                  {c.years_of_experience ? ` · ${c.years_of_experience}y exp` : ''}
                </div>

                {/* Skill match chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {hasRequired.slice(0, 4).map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                      ✓ {s}
                    </span>
                  ))}
                  {missingRequired.slice(0, 2).map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      ✗ {s}
                    </span>
                  ))}
                </div>

                {/* Score breakdown mini */}
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  <span>Skills {match.skills}%</span>
                  <span>Exp {match.experience}%</span>
                  <span>Seniority {match.seniority}%</span>
                  {c.languages?.some((l: any) => ['ara','arabic'].includes((l.language ?? '').toLowerCase())) && (
                    <span className="text-blue-500">Arabic ✓</span>
                  )}
                </div>
              </div>

              {/* Expected salary */}
              <div className="text-right shrink-0">
                {c.expected_salary_min_usd ? (
                  <div className="text-sm text-gray-600">
                    ${(c.expected_salary_min_usd / 1000).toFixed(0)}–{((c.expected_salary_max_usd ?? 0) / 1000).toFixed(0)}k
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Salary n/a</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {c.profile_completeness}% profile
                </div>
                <a
                  href={`/dashboard?candidate_id=${c.id}`}
                  className="text-xs text-blue-500 hover:text-blue-700 mt-1.5 block"
                >
                  Full profile →
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
