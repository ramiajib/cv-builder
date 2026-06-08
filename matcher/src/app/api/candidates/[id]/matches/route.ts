import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching/engine';
import { buildJobTrustInputs, computeJobTrustScore } from '@/lib/trust/calculator';
import { generateMatchExplanation } from '@/lib/ai/explain-match';
import type { CandidateProfile, JobProfile, MatchResultDB } from '@/lib/supabase/types';

// GET /api/candidates/:id/matches
// Returns top matches for a candidate, computing and caching any that are stale.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceClient();
  const candidateId = params.id;
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20);
  const minScore = Number(req.nextUrl.searchParams.get('min_score') ?? 60);

  // ── 1. Load candidate profile ──────────────────────────────
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select(`
      *,
      skills(*),
      experiences(*),
      education(*),
      certifications(*),
      languages(*),
      preferences:candidate_preferences(*)
    `)
    .eq('id', candidateId)
    .single();

  if (candErr || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  const candidateProfile = candidate as unknown as CandidateProfile;
  // Supabase returns single preference as array — unwrap it
  (candidateProfile as any).preferences = Array.isArray((candidateProfile as any).preferences)
    ? (candidateProfile as any).preferences[0] ?? null
    : (candidateProfile as any).preferences;

  // ── 2. Check existing fresh cache ─────────────────────────
  const { data: cached } = await supabase
    .from('match_results')
    .select(`
      *,
      job:jobs(*, company:companies(*), recruiter:recruiters(*), job_skills(*))
    `)
    .eq('candidate_id', candidateId)
    .eq('is_stale', false)
    .gte('match_score', minScore)
    .gt('expires_at', new Date().toISOString())
    .order('match_score', { ascending: false })
    .limit(limit);

  if (cached && cached.length >= Math.min(limit, 5)) {
    return NextResponse.json({ matches: cached, source: 'cache' });
  }

  // ── 3. No/stale cache — compute against all active jobs ───
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`*, company:companies(*), recruiter:recruiters(*), job_skills(*)`)
    .eq('status', 'active')
    .limit(500);

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ matches: [], source: 'computed' });
  }

  const results: Array<MatchResultDB & { job: JobProfile; trust_score: number }> = [];

  for (const jobRow of jobs) {
    const job = jobRow as unknown as JobProfile;

    const matchResult = computeMatchScore(candidateProfile, job);
    if (matchResult.match_score < minScore) continue;

    const trustResult = computeJobTrustScore(buildJobTrustInputs(job));

    // Cache the computed match
    const { data: saved } = await supabase
      .from('match_results')
      .upsert(
        {
          candidate_id:       candidateId,
          job_id:             job.id,
          match_score:        matchResult.match_score,
          skills_score:       matchResult.skills,
          experience_score:   matchResult.experience,
          seniority_score:    matchResult.seniority,
          education_score:    matchResult.education,
          location_score:     matchResult.location,
          language_score:     matchResult.language,
          certification_score: matchResult.certification,
          semantic_score:     matchResult.semantic,
          strengths:          matchResult.strengths,
          gaps:               matchResult.gaps,
          is_stale:           false,
          computed_at:        new Date().toISOString(),
          expires_at:         new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'candidate_id,job_id' },
      )
      .select()
      .single();

    if (saved) {
      results.push({ ...(saved as MatchResultDB), job, trust_score: trustResult.score });
    }
  }

  results.sort((a, b) => b.match_score - a.match_score);
  const top = results.slice(0, limit);

  return NextResponse.json({ matches: top, source: 'computed' });
}
