import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching/engine';
import { buildJobTrustInputs, computeJobTrustScore } from '@/lib/trust/calculator';
import { generateMatchExplanation } from '@/lib/ai/explain-match';
import { MatchScoreRing } from '@/components/match/MatchScoreRing';
import { MatchBreakdown } from '@/components/match/MatchBreakdown';
import { WhyThisMatches } from '@/components/match/WhyThisMatches';
import { TrustBadge } from '@/components/jobs/TrustBadge';
import type { CandidateProfile, JobProfile, MatchResult } from '@/lib/supabase/types';
import type { MatchResult as MatchResultType, MatchTier, TrustResult } from '@/lib/matching/types';

interface PageProps {
  params: { id: string };
  searchParams: { candidate_id?: string };
}

function SalaryTag({ min, max }: { min?: number | null; max?: number | null }) {
  if (!min && !max) return null;
  return (
    <span className="text-sm font-medium text-gray-700">
      ${min?.toLocaleString()}{max && ` – $${max.toLocaleString()}`} / mo
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">{children}</span>
  );
}

export default async function JobPage({ params, searchParams }: PageProps) {
  const supabase = createServiceClient();
  const { id } = params;
  const candidateId = searchParams.candidate_id;

  // ── Load job ───────────────────────────────────────────────
  const { data: jobRow } = await supabase
    .from('jobs')
    .select(`*, company:companies(*), recruiter:recruiters(*), job_skills(*)`)
    .eq('id', id)
    .single();

  if (!jobRow) notFound();
  const job = jobRow as unknown as JobProfile;

  // ── Trust score ────────────────────────────────────────────
  const trustInputs = buildJobTrustInputs(job);
  const trustResult: TrustResult = computeJobTrustScore(trustInputs);

  // ── Match score (only if candidate_id provided) ────────────
  let matchResult: MatchResultType | null = null;
  let aiExplanation = null;

  if (candidateId) {
    const { data: candidateRow } = await supabase
      .from('candidates')
      .select(`*, skills(*), experiences(*), education(*), certifications(*), languages(*), preferences:candidate_preferences(*)`)
      .eq('id', candidateId)
      .single();

    if (candidateRow) {
      const candidate = candidateRow as unknown as CandidateProfile;
      (candidate as any).preferences = Array.isArray((candidate as any).preferences)
        ? (candidate as any).preferences[0] ?? null
        : (candidate as any).preferences;

      // Check cache first
      const { data: cached } = await supabase
        .from('match_results')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('job_id', id)
        .eq('is_stale', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached?.ai_explanation) {
        matchResult = cached as unknown as MatchResultType;
        aiExplanation = (cached as any).ai_explanation;
      } else {
        matchResult = computeMatchScore(candidate, job);
        aiExplanation = await generateMatchExplanation(candidate, job, matchResult);

        // Cache
        supabase.from('match_results').upsert({
          candidate_id:        candidateId,
          job_id:              id,
          match_score:         matchResult.match_score,
          skills_score:        matchResult.skills,
          experience_score:    matchResult.experience,
          seniority_score:     matchResult.seniority,
          education_score:     matchResult.education,
          location_score:      matchResult.location,
          language_score:      matchResult.language,
          certification_score: matchResult.certification,
          semantic_score:      matchResult.semantic,
          strengths:           matchResult.strengths,
          gaps:                matchResult.gaps,
          explanation_summary: aiExplanation?.summary,
          ai_explanation:      aiExplanation,
          is_stale:            false,
          expires_at:          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'candidate_id,job_id' });
      }
    }
  }

  const tier = !matchResult ? 'moderate'
    : matchResult.match_score >= 85 ? 'excellent'
    : matchResult.match_score >= 70 ? 'strong'
    : matchResult.match_score >= 55 ? 'moderate'
    : 'weak' as MatchTier;

  const postedDaysAgo = Math.floor(
    (Date.now() - new Date(job.posted_date).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="space-y-6">

      {/* Back link */}
      {candidateId && (
        <a href={`/dashboard?candidate_id=${candidateId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to dashboard
        </a>
      )}

      {/* Hero card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start gap-5">

          {/* Match ring (only if we have a score) */}
          {matchResult && (
            <div className="shrink-0">
              <MatchScoreRing score={matchResult.match_score} tier={tier} size="lg" showLabel />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-gray-500 mt-1">
              {job.company?.name ?? 'Unknown'}
              {job.location_city && ` · ${job.location_city}`}
              {job.location_country && `, ${job.location_country}`}
            </p>

            {/* Tags row */}
            <div className="flex flex-wrap gap-2 mt-3">
              {job.is_remote && <Tag>🌍 Remote</Tag>}
              {!job.is_remote && job.remote_policy === 'hybrid' && <Tag>Hybrid</Tag>}
              <Tag>{job.employment_type.replace('_', ' ')}</Tag>
              {job.seniority_level && <Tag className="capitalize">{job.seniority_level}</Tag>}
              {job.industry && <Tag>{job.industry}</Tag>}
              <Tag>{postedDaysAgo === 0 ? 'Posted today' : `Posted ${postedDaysAgo}d ago`}</Tag>
            </div>

            {/* Salary */}
            {job.salary_disclosed && (
              <div className="mt-4">
                <SalaryTag min={job.salary_min_usd} max={job.salary_max_usd} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Left column — trust + score breakdown */}
        <div className="space-y-4">
          <TrustBadge trust={trustResult} expanded />

          {matchResult && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <MatchBreakdown
                skills={matchResult.skills}
                experience={matchResult.experience}
                seniority={matchResult.seniority}
                education={matchResult.education}
                location={matchResult.location}
                language={matchResult.language}
                certification={matchResult.certification}
              />
            </div>
          )}
        </div>

        {/* Right column — why this matches + job details */}
        <div className="lg:col-span-2 space-y-5">

          {/* Why this matches */}
          {matchResult && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Why this matches your profile</h2>
              <WhyThisMatches
                strengths={matchResult.strengths}
                gaps={matchResult.gaps}
                aiExplanation={aiExplanation}
                matchScore={matchResult.match_score}
              />
            </div>
          )}

          {/* Required skills */}
          {job.job_skills.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Skills required</h2>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {job.job_skills.filter(s => s.is_required).map(s => (
                    <span key={s.id}
                      className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                      {s.skill_name}
                    </span>
                  ))}
                </div>
                {job.job_skills.filter(s => !s.is_required).length > 0 && (
                  <>
                    <p className="text-xs text-gray-400 mt-2">Nice to have</p>
                    <div className="flex flex-wrap gap-2">
                      {job.job_skills.filter(s => !s.is_required).map(s => (
                        <span key={s.id}
                          className="text-sm bg-gray-50 text-gray-600 px-3 py-1 rounded-full border border-gray-200">
                          {s.skill_name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Job description */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">About the role</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Apply CTA */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold">Ready to apply?</p>
              <p className="text-blue-200 text-sm mt-0.5">
                {matchResult
                  ? matchResult.match_score >= 70
                    ? "You're a strong candidate for this role."
                    : "Review the gaps above before applying."
                  : "Review the role details above."}
              </p>
            </div>
            {job.application_url ? (
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 bg-white text-blue-700 font-semibold px-5 py-2.5 rounded-xl
                           hover:bg-blue-50 transition-colors text-sm"
              >
                Apply Now →
              </a>
            ) : (
              <span className="shrink-0 bg-white/20 text-white/70 px-5 py-2.5 rounded-xl text-sm cursor-not-allowed">
                No apply link
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
