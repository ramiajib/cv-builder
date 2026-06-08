import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching/engine';
import { buildJobTrustInputs, computeJobTrustScore } from '@/lib/trust/calculator';
import { generateMatchExplanation } from '@/lib/ai/explain-match';
import type { CandidateProfile, JobProfile } from '@/lib/supabase/types';

// GET /api/jobs/:id/match?candidate_id=xxx
// Returns full match breakdown + AI explanation + trust score for one job/candidate pair.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceClient();
  const jobId = params.id;
  const candidateId = req.nextUrl.searchParams.get('candidate_id');
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true';

  if (!candidateId) {
    return NextResponse.json({ error: 'candidate_id required' }, { status: 400 });
  }

  // ── 1. Load job ────────────────────────────────────────────
  const { data: jobRow, error: jobErr } = await supabase
    .from('jobs')
    .select(`*, company:companies(*), recruiter:recruiters(*), job_skills(*)`)
    .eq('id', jobId)
    .single();

  if (jobErr || !jobRow) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }
  const job = jobRow as unknown as JobProfile;

  // ── 2. Load candidate ──────────────────────────────────────
  const { data: candidateRow, error: candErr } = await supabase
    .from('candidates')
    .select(`
      *,
      skills(*), experiences(*), education(*),
      certifications(*), languages(*),
      preferences:candidate_preferences(*)
    `)
    .eq('id', candidateId)
    .single();

  if (candErr || !candidateRow) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  const candidate = candidateRow as unknown as CandidateProfile;
  (candidate as any).preferences = Array.isArray((candidate as any).preferences)
    ? (candidate as any).preferences[0] ?? null
    : (candidate as any).preferences;

  // ── 3. Check cache ─────────────────────────────────────────
  if (!refresh) {
    const { data: cached } = await supabase
      .from('match_results')
      .select('*')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .eq('is_stale', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.ai_explanation) {
      const trustResult = computeJobTrustScore(buildJobTrustInputs(job));
      return NextResponse.json({ match: cached, trust: trustResult, job, source: 'cache' });
    }
  }

  // ── 4. Compute match ───────────────────────────────────────
  const matchResult = computeMatchScore(candidate, job);
  const trustResult = computeJobTrustScore(buildJobTrustInputs(job));

  // ── 5. Generate AI explanation ─────────────────────────────
  const aiExplanation = await generateMatchExplanation(candidate, job, matchResult);

  const summary = aiExplanation.summary;

  // ── 6. Cache result ────────────────────────────────────────
  const { data: saved } = await supabase
    .from('match_results')
    .upsert(
      {
        candidate_id:        candidateId,
        job_id:              jobId,
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
        explanation_summary: summary,
        ai_explanation:      aiExplanation,
        is_stale:            false,
        computed_at:         new Date().toISOString(),
        expires_at:          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'candidate_id,job_id' },
    )
    .select()
    .single();

  return NextResponse.json({
    match: saved ?? { ...matchResult, ai_explanation: aiExplanation },
    trust: trustResult,
    job,
    source: 'computed',
  });
}
