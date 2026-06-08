import type { CandidateProfile, JobProfile } from '../supabase/types';
import type { AIExplanation, MatchResult } from '../matching/types';
import { openai } from './client';

export async function generateMatchExplanation(
  candidate: CandidateProfile,
  job: JobProfile,
  matchResult: MatchResult,
): Promise<AIExplanation> {
  const topSkills = candidate.skills
    .filter(s => s.is_primary || s.proficiency_level === 'expert' || s.proficiency_level === 'advanced')
    .slice(0, 8)
    .map(s => s.name)
    .join(', ');

  const requiredSkills = job.job_skills
    .filter(s => s.is_required)
    .map(s => s.skill_name)
    .join(', ');

  const niceToHave = job.job_skills
    .filter(s => !s.is_required)
    .map(s => s.skill_name)
    .join(', ');

  const prompt = `You are a senior career coach giving honest, specific feedback to a job candidate.

CANDIDATE:
- Name: ${candidate.full_name}
- Headline: ${candidate.headline ?? 'Not specified'}
- Experience: ${candidate.years_of_experience ?? 0} years total
- Top skills: ${topSkills || 'None listed'}
- Location: ${candidate.location_city ?? ''}, ${candidate.location_country ?? ''}
- Languages: ${candidate.languages.map(l => `${l.language} (${l.proficiency})`).join(', ') || 'Not specified'}
- Education: ${candidate.education.map(e => `${e.degree_level} in ${e.field_of_study} from ${e.institution}`).join('; ') || 'Not specified'}
- Certifications: ${candidate.certifications.filter(c => c.is_active).map(c => c.name).join(', ') || 'None'}
- GCC experience: ${candidate.experiences.some(e => e.is_gcc_experience) ? 'Yes' : 'No'}

JOB:
- Title: ${job.title} at ${job.company?.name ?? 'Unknown Company'}
- Seniority: ${job.seniority_level ?? 'Not specified'}
- Industry: ${job.industry ?? 'Not specified'}
- Location: ${job.location_city ?? ''}, ${job.location_country ?? ''} ${job.is_remote ? '(Remote OK)' : ''}
- Required skills: ${requiredSkills || 'Not specified'}
- Nice-to-have skills: ${niceToHave || 'None'}
- Min experience: ${job.ai_min_years_exp ?? 0} years
- Required degree: ${job.ai_required_degree ?? 'Not specified'}
- Required certifications: ${job.required_certifications.join(', ') || 'None'}

MATCH SCORES:
- Overall: ${matchResult.match_score}% (${matchResult.tier})
- Skills: ${matchResult.skills}%
- Experience: ${matchResult.experience}%
- Location fit: ${matchResult.location}%
- Language: ${matchResult.language}%
- Education: ${matchResult.education}%

Write a concise, honest assessment. Be specific — reference actual skills, years, and requirements. Do not be generic.
If the match is weak, say so constructively.

Return only valid JSON — no markdown, no explanation:
{
  "summary": "2-3 sentence honest assessment referencing specific details",
  "strengths": ["specific strength with detail", "specific strength with detail", "specific strength with detail"],
  "gaps": ["specific gap with context", "specific gap with context"],
  "recommendation": "1 clear action sentence"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(content) as Partial<AIExplanation>;

    return {
      summary: parsed.summary ?? fallbackSummary(matchResult),
      strengths: parsed.strengths ?? matchResult.strengths.map(s => s.label),
      gaps: parsed.gaps ?? matchResult.gaps.map(g => g.item),
      recommendation: parsed.recommendation ?? fallbackRecommendation(matchResult),
    };
  } catch {
    // Graceful fallback — matching still works without AI
    return {
      summary: fallbackSummary(matchResult),
      strengths: matchResult.strengths.map(s => `${s.label}: ${s.detail}`),
      gaps: matchResult.gaps.map(g => g.item),
      recommendation: fallbackRecommendation(matchResult),
    };
  }
}

function fallbackSummary(result: MatchResult): string {
  return `This is a ${result.tier} match with an overall score of ${result.match_score}%. ` +
    (result.match_score >= 70
      ? `Your profile aligns well with the key requirements.`
      : `There are some gaps to address before applying.`);
}

function fallbackRecommendation(result: MatchResult): string {
  if (result.match_score >= 85) return 'Apply now — this is an excellent fit for your profile.';
  if (result.match_score >= 70) return 'Strong candidate — apply and address any gaps in your cover note.';
  if (result.match_score >= 55) return 'Consider applying while clearly addressing the identified gaps.';
  return 'This role may be a stretch — focus on closing the key gaps before applying.';
}
