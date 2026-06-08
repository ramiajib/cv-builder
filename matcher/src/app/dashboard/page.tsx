import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching/engine';
import { buildJobTrustInputs, computeJobTrustScore } from '@/lib/trust/calculator';
import { ProfileCard } from '@/components/candidates/ProfileCard';
import { JobCard } from '@/components/jobs/JobCard';
import { CandidatePicker } from '@/components/dashboard/CandidatePicker';
import type { CandidateProfile, JobProfile, MatchResultDB } from '@/lib/supabase/types';

interface PageProps {
  searchParams: { candidate_id?: string };
}

async function getCandidateProfile(id: string): Promise<CandidateProfile | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('candidates')
    .select(`
      *,
      skills(*), experiences(*), education(*),
      certifications(*), languages(*),
      preferences:candidate_preferences(*)
    `)
    .eq('id', id)
    .single();

  if (!data) return null;
  const profile = data as unknown as CandidateProfile;
  (profile as any).preferences = Array.isArray((profile as any).preferences)
    ? (profile as any).preferences[0] ?? null
    : (profile as any).preferences;
  return profile;
}

async function getTopMatches(candidate: CandidateProfile, limit = 20) {
  const supabase = createServiceClient();

  // Try cached matches first
  const { data: cached } = await supabase
    .from('match_results')
    .select(`*, job:jobs(*, company:companies(*), recruiter:recruiters(*), job_skills(*))`)
    .eq('candidate_id', candidate.id)
    .eq('is_stale', false)
    .gt('expires_at', new Date().toISOString())
    .gte('match_score', 50)
    .order('match_score', { ascending: false })
    .limit(limit);

  if (cached && cached.length >= 3) {
    return cached.map(row => ({
      match: row as unknown as MatchResultDB,
      job: (row as any).job as JobProfile,
      trust: computeJobTrustScore(buildJobTrustInputs((row as any).job as JobProfile)),
    }));
  }

  // Compute fresh — fetch up to 1000 active jobs (Supabase default page limit)
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`*, company:companies(*), recruiter:recruiters(*), job_skills(*)`)
    .eq('status', 'active')
    .limit(1000);

  if (!jobs) return [];

  const results = jobs
    .map(j => {
      const job = j as unknown as JobProfile;
      const match = computeMatchScore(candidate, job);
      const trust = computeJobTrustScore(buildJobTrustInputs(job));
      return { match, job, trust };
    })
    .filter(r => r.match.match_score >= 50)
    .sort((a, b) => b.match.match_score - a.match.match_score)
    .slice(0, limit);

  // Persist computed scores (fire-and-forget, no await)
  const upsertRows = results.map(r => ({
    candidate_id:        candidate.id,
    job_id:              r.job.id,
    match_score:         r.match.match_score,
    skills_score:        r.match.skills,
    experience_score:    r.match.experience,
    seniority_score:     r.match.seniority,
    education_score:     r.match.education,
    location_score:      r.match.location,
    language_score:      r.match.language,
    certification_score: r.match.certification,
    semantic_score:      r.match.semantic,
    strengths:           r.match.strengths,
    gaps:                r.match.gaps,
    is_stale:            false,
    expires_at:          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }));
  supabase.from('match_results').upsert(upsertRows, { onConflict: 'candidate_id,job_id' });

  return results.map(r => ({
    match: { ...r.match, id: '', candidate_id: candidate.id, job_id: r.job.id } as unknown as MatchResultDB,
    job: r.job,
    trust: r.trust,
  }));
}

function isNew(postedDate: string): boolean {
  const days = (Date.now() - new Date(postedDate).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 2;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://your-project.supabase.co') {
    redirect('/setup');
  }

  const supabase = createServiceClient();
  const candidateId = searchParams.candidate_id;

  if (!candidateId) {
    // Show candidate picker
    const { data: candidates } = await supabase
      .from('candidates')
      .select('id, full_name, headline, location_city, location_country, profile_completeness, skills(name)')
      .order('profile_completeness', { ascending: false });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidate Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Select a candidate to see their top job matches
          </p>
        </div>
        <CandidatePicker candidates={(candidates ?? []) as any} />
      </div>
    );
  }

  const candidate = await getCandidateProfile(candidateId);

  if (!candidate) {
    return (
      <div className="text-center py-20 text-gray-400">
        Candidate not found.
      </div>
    );
  }

  const topMatches = await getTopMatches(candidate);
  const newMatches = topMatches.filter(m => isNew(m.job.posted_date));
  const allMatches = topMatches.filter(m => !isNew(m.job.posted_date));

  const tierCounts = {
    excellent: topMatches.filter(m => m.match.match_score >= 85).length,
    strong:    topMatches.filter(m => m.match.match_score >= 70 && m.match.match_score < 85).length,
    moderate:  topMatches.filter(m => m.match.match_score >= 55 && m.match.match_score < 70).length,
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {candidate.full_name.split(' ')[0]}
        </h1>
        <p className="text-gray-500 mt-1">
          {topMatches.length} matches found · {newMatches.length} new in the last 48h
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Excellent (85%+)', value: tierCounts.excellent, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Strong (70–84%)',  value: tierCounts.strong,    color: 'text-blue-600 bg-blue-50 border-blue-200'   },
          { label: 'Moderate (55–69%)',value: tierCounts.moderate,  color: 'text-amber-600 bg-amber-50 border-amber-200'},
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.color} p-4`}>
            <div className={`text-3xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: profile */}
        <div className="lg:col-span-1">
          <ProfileCard candidate={candidate} />
        </div>

        {/* Right: matches */}
        <div className="lg:col-span-2 space-y-6">

          {/* New jobs */}
          {newMatches.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                🆕 New in last 48h
              </h2>
              <div className="space-y-3">
                {newMatches.map(({ match, job }) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    match={match}
                    candidateId={candidateId}
                    isNew
                  />
                ))}
              </div>
            </section>
          )}

          {/* All matches */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Top matches
            </h2>
            {allMatches.length > 0 ? (
              <div className="space-y-3">
                {allMatches.map(({ match, job }) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    match={match}
                    candidateId={candidateId}
                  />
                ))}
              </div>
            ) : (
              topMatches.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
                  <p>No matches yet. Make sure jobs are active in the database.</p>
                </div>
              ) : null
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
