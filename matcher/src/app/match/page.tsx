/**
 * /match?submission_id=<uuid>
 *
 * Entry point for CV-builder users arriving after downloading their CV.
 * Reads the submission from Supabase, converts the payload to a CandidateProfile
 * entirely in-memory, runs the match engine, and shows personalised job matches.
 * Nothing is written to the database — this is a read-only, stateless page.
 */

import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching/engine';
import { buildJobTrustInputs, computeJobTrustScore } from '@/lib/trust/calculator';
import { submissionToProfile } from '@/lib/matching/submission-to-profile';
import { MatchJobCard } from '@/components/jobs/MatchJobCard';
import type { CandidateProfile, JobProfile, MatchResultDB } from '@/lib/supabase/types';

interface PageProps {
  searchParams: { submission_id?: string };
}

function isNew(postedDate: string): boolean {
  return (Date.now() - new Date(postedDate).getTime()) / (1000 * 60 * 60 * 24) <= 2;
}

async function getTopMatches(candidate: CandidateProfile, limit = 20) {
  const supabase = createServiceClient();

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, company:companies(*), recruiter:recruiters(*), job_skills(*)')
    .eq('status', 'active')
    .limit(1000);

  if (!jobs || jobs.length === 0) return [];

  return jobs
    .map(j => {
      const job  = j as unknown as JobProfile;
      const match = computeMatchScore(candidate, job);
      const trust = computeJobTrustScore(buildJobTrustInputs(job));
      return { match, job, trust };
    })
    .filter(r => r.match.match_score >= 45)
    .sort((a, b) => b.match.match_score - a.match.match_score)
    .slice(0, limit)
    .map(r => ({
      match: {
        ...r.match,
        id: '',
        candidate_id: candidate.id,
        job_id: r.job.id,
      } as unknown as MatchResultDB,
      job: r.job,
      trust: r.trust,
    }));
}

export default async function MatchPage({ searchParams }: PageProps) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://your-project.supabase.co'
  ) {
    redirect('/setup');
  }

  const submissionId = searchParams.submission_id;
  if (!submissionId) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg font-medium">No submission ID provided.</p>
        <p className="text-sm mt-2">
          Build your CV at{' '}
          <a
            href="https://carmyne-cv-builder.netlify.app"
            className="text-blue-500 underline"
          >
            carmyne-cv-builder.netlify.app
          </a>{' '}
          and download it to discover your matches.
        </p>
      </div>
    );
  }

  // ── Fetch the submission ───────────────────────────────────────────────────
  const supabase = createServiceClient();
  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (error || !submission) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg font-medium">Submission not found.</p>
        <p className="text-sm mt-2">The link may have expired or the ID is invalid.</p>
      </div>
    );
  }

  // ── Build in-memory candidate profile ─────────────────────────────────────
  const payload   = (submission as any).payload ?? submission;
  const candidate = submissionToProfile(payload, submissionId);

  // ── Run match engine ───────────────────────────────────────────────────────
  const topMatches = await getTopMatches(candidate);
  const newMatches = topMatches.filter(m => isNew(m.job.posted_date));
  const allMatches = topMatches.filter(m => !isNew(m.job.posted_date));

  const tierCounts = {
    excellent: topMatches.filter(m => m.match.match_score >= 85).length,
    strong:    topMatches.filter(m => m.match.match_score >= 70 && m.match.match_score < 85).length,
    moderate:  topMatches.filter(m => m.match.match_score >= 55 && m.match.match_score < 70).length,
  };

  const firstName = candidate.full_name.split(' ')[0];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <a
            href="https://carmyne-cv-builder.netlify.app"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Back to CV Builder
          </a>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hi {firstName}, here are your top job matches
        </h1>
        <p className="text-gray-500 mt-1">
          {topMatches.length} matches found based on your CV
          {candidate.location_city && ` · ${candidate.location_city}`}
          {newMatches.length > 0 && ` · ${newMatches.length} new in the last 48h`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Excellent (85%+)', value: tierCounts.excellent, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Strong (70–84%)',  value: tierCounts.strong,    color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Moderate (55–69%)', value: tierCounts.moderate, color: 'text-amber-600 bg-amber-50 border-amber-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border ${s.color} p-4`}>
            <div className={`text-3xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Profile summary chip */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
        {candidate.headline && (
          <span className="bg-gray-100 px-3 py-1 rounded-full">{candidate.headline}</span>
        )}
        {candidate.years_of_experience !== null && candidate.years_of_experience > 0 && (
          <span className="bg-gray-100 px-3 py-1 rounded-full">
            {candidate.years_of_experience} yrs exp
          </span>
        )}
        {candidate.skills.slice(0, 5).map(s => (
          <span key={s.id} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">{s.name}</span>
        ))}
        {candidate.willing_to_relocate && (
          <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full">✈ Open to relocation</span>
        )}
      </div>

      {/* New jobs */}
      {newMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            🆕 New in last 48h
          </h2>
          <div className="space-y-3">
            {newMatches.map(({ match, job }) => (
              <MatchJobCard key={job.id} job={job} match={match} isNew />
            ))}
          </div>
        </section>
      )}

      {/* All matches */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Top matches
        </h2>
        {topMatches.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <p className="font-medium">No strong matches yet.</p>
            <p className="text-sm mt-1">Try editing your CV to add more skills, or check back as new jobs are added.</p>
          </div>
        ) : allMatches.length > 0 ? (
          <div className="space-y-3">
            {allMatches.map(({ match, job }) => (
              <MatchJobCard key={job.id} job={job} match={match} />
            ))}
          </div>
        ) : null}
      </section>

    </div>
  );
}
