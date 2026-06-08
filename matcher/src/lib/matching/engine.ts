import type { CandidateProfile, JobProfile, Skill, JobSkill, Language, Education, Certification } from '../supabase/types';
import type { DimensionScores, Gap, MatchResult, Strength } from './types';
import { DEGREE_RANK, GCC_COUNTRIES, SENIORITY_RANK, WEIGHTS } from './weights';

// ─────────────────────────────────────────────────────────────
// DIMENSION SCORERS — pure functions, 0–100 each
// ─────────────────────────────────────────────────────────────

export function scoreSkills(candidateSkills: Skill[], jobSkills: JobSkill[]): number {
  if (jobSkills.length === 0) return 100;

  const candidateSet = new Set(candidateSkills.map(s => s.normalized_name.toLowerCase().trim()));

  const required = jobSkills.filter(s => s.is_required);
  const optional = jobSkills.filter(s => !s.is_required);

  // Required skills carry 80% of the skills score
  const requiredScore =
    required.length === 0
      ? 80
      : (required.filter(s => candidateSet.has(s.normalized_name.toLowerCase().trim())).length /
          required.length) *
        80;

  // Nice-to-have carry 20%
  const optionalScore =
    optional.length === 0
      ? 20
      : (optional.filter(s => candidateSet.has(s.normalized_name.toLowerCase().trim())).length /
          optional.length) *
        20;

  return Math.min(100, Math.round(requiredScore + optionalScore));
}

export function scoreExperience(candidate: CandidateProfile, job: JobProfile): number {
  const candidateYears = candidate.years_of_experience ?? 0;
  const requiredYears = job.ai_min_years_exp ?? 0;
  let score = 0;

  // Years match (0–70 pts)
  if (requiredYears === 0) {
    score += 70;
  } else if (candidateYears >= requiredYears) {
    const extra = Math.min(candidateYears - requiredYears, 5);
    score += Math.min(80, 70 + extra * 2);
  } else {
    score += Math.max(0, (candidateYears / requiredYears) * 70);
  }

  // Industry match (0–15 pts)
  const hasIndustryMatch = candidate.experiences.some(
    e => e.industry && job.industry && e.industry.toLowerCase() === job.industry.toLowerCase(),
  );
  if (hasIndustryMatch) score += 15;

  // GCC experience bonus (0–10 pts)
  if (GCC_COUNTRIES.has(job.location_country_code ?? '')) {
    const hasGCC = candidate.experiences.some(e => e.is_gcc_experience);
    if (hasGCC) score += 10;
  }

  return Math.min(100, Math.round(score));
}

export function scoreSeniority(candidateSeniority: string, jobSeniority: string): number {
  const candRank = SENIORITY_RANK[candidateSeniority] ?? 2;
  const jobRank = SENIORITY_RANK[jobSeniority] ?? 2;
  const diff = candRank - jobRank;

  if (diff === 0) return 100;
  if (diff === 1) return 85;   // slightly overqualified — common fit
  if (diff === -1) return 70;  // slight stretch role
  if (diff === 2) return 55;   // overqualified
  if (diff === -2) return 40;  // real gap
  return 20;
}

export function scoreLocation(candidate: CandidateProfile, job: JobProfile): number {
  if (job.is_remote || job.remote_policy === 'remote') return 100;
  if (job.remote_policy === 'flexible') return 90;

  if (candidate.location_country_code === job.location_country_code) {
    return candidate.location_city?.toLowerCase() === job.location_city?.toLowerCase()
      ? 100
      : 85;
  }

  if (candidate.willing_to_relocate) {
    const prefersThisCountry = (candidate.preferences?.preferred_locations ?? []).some(
      loc => loc.toLowerCase().includes(job.location_country?.toLowerCase() ?? ''),
    );
    return prefersThisCountry ? 75 : 55;
  }

  return 10;
}

export function scoreLanguage(candidateLanguages: Language[], job: JobProfile): number {
  const required = job.required_languages ?? [];
  if (required.length === 0) return 100;

  const candidateCodes = new Set(candidateLanguages.map(l => l.language_code?.toLowerCase() ?? ''));

  const matched = required.filter(code => candidateCodes.has(code.toLowerCase())).length;
  let score = (matched / required.length) * 90;

  // Arabic bonus in GCC context
  if (GCC_COUNTRIES.has(job.location_country_code ?? '') && candidateCodes.has('ara')) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
}

export function scoreEducation(education: Education[], requiredDegree: string | null): number {
  if (!requiredDegree || requiredDegree === 'any') return 100;

  const maxRank =
    education.length === 0
      ? 0
      : Math.max(...education.map(e => DEGREE_RANK[e.degree_level ?? 'other'] ?? 0));

  const required = DEGREE_RANK[requiredDegree] ?? 0;

  if (maxRank >= required) return 100;
  if (maxRank === required - 1) return 70;
  return 30;
}

export function scoreCertification(
  certifications: Certification[],
  requiredCerts: string[],
): number {
  if (requiredCerts.length === 0) return 100;

  const candidateSet = new Set(
    certifications
      .filter(c => c.is_active)
      .map(c => (c.normalized_name ?? c.name).toLowerCase().trim()),
  );

  const matched = requiredCerts.filter(rc => candidateSet.has(rc.toLowerCase().trim())).length;
  return Math.round((matched / requiredCerts.length) * 100);
}

// ─────────────────────────────────────────────────────────────
// STRENGTHS IDENTIFIER
// ─────────────────────────────────────────────────────────────
function identifyStrengths(
  candidate: CandidateProfile,
  job: JobProfile,
  scores: DimensionScores,
): Strength[] {
  const strengths: Strength[] = [];

  // Strong skill match
  if (scores.skills >= 75) {
    const matched = candidate.skills
      .filter(s =>
        job.job_skills.some(
          js => js.normalized_name.toLowerCase() === s.normalized_name.toLowerCase(),
        ),
      )
      .slice(0, 4)
      .map(s => s.name);
    if (matched.length > 0) {
      strengths.push({
        label: `${matched.length} key skills matched`,
        detail: matched.join(', '),
      });
    }
  }

  // Experience
  if (scores.experience >= 70) {
    const yrs = candidate.years_of_experience ?? 0;
    const req = job.ai_min_years_exp ?? 0;
    strengths.push({
      label: `${yrs} years of experience`,
      detail: req > 0 ? `Meets the ${req}-year requirement` : 'Exceeds typical requirements',
    });
  }

  // GCC bonus
  const isGCCJob = GCC_COUNTRIES.has(job.location_country_code ?? '');
  if (isGCCJob && candidate.experiences.some(e => e.is_gcc_experience)) {
    strengths.push({
      label: 'GCC experience',
      detail: 'Regional market knowledge and cultural familiarity',
    });
  }

  // Arabic speaker in GCC
  const arabicLang = candidate.languages.find(l => l.language_code === 'ara');
  if (arabicLang && isGCCJob) {
    strengths.push({
      label: `Arabic speaker (${arabicLang.proficiency})`,
      detail: 'Strong competitive advantage in the Gulf market',
    });
  }

  // Education
  if (scores.education === 100 && job.ai_required_degree) {
    strengths.push({
      label: 'Education requirement met',
      detail: `Holds required ${job.ai_required_degree.replace('_', ' ')} degree or higher`,
    });
  }

  // Industry match
  const industryMatch = candidate.experiences.find(
    e => e.industry?.toLowerCase() === job.industry?.toLowerCase(),
  );
  if (industryMatch && job.industry) {
    strengths.push({
      label: `${job.industry} industry experience`,
      detail: `Relevant background from ${industryMatch.company_name}`,
    });
  }

  // Location / remote
  if (scores.location === 100) {
    strengths.push({
      label: job.is_remote ? 'Remote role — location not a barrier' : 'Local candidate',
      detail: job.is_remote
        ? 'No relocation needed'
        : `Based in ${candidate.location_city ?? candidate.location_country}`,
    });
  }

  return strengths.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────
// GAPS IDENTIFIER
// ─────────────────────────────────────────────────────────────
function identifyGaps(candidate: CandidateProfile, job: JobProfile): Gap[] {
  const gaps: Gap[] = [];
  const candidateSkillSet = new Set(
    candidate.skills.map(s => s.normalized_name.toLowerCase().trim()),
  );

  // Missing required skills (show max 3)
  const missingRequired = job.job_skills
    .filter(js => js.is_required && !candidateSkillSet.has(js.normalized_name.toLowerCase().trim()))
    .slice(0, 3);

  for (const skill of missingRequired) {
    gaps.push({
      item: skill.skill_name,
      type: 'skill',
      importance: 'required',
      how_to_close: `Take a course or build a portfolio project in ${skill.skill_name}`,
    });
  }

  // Missing preferred skills (show max 2)
  const missingPreferred = job.job_skills
    .filter(
      js => !js.is_required && !candidateSkillSet.has(js.normalized_name.toLowerCase().trim()),
    )
    .slice(0, 2);

  for (const skill of missingPreferred) {
    gaps.push({
      item: skill.skill_name,
      type: 'skill',
      importance: 'preferred',
      how_to_close: `Adding ${skill.skill_name} would strengthen your application`,
    });
  }

  // Experience gap
  const candidateYears = candidate.years_of_experience ?? 0;
  const requiredYears = job.ai_min_years_exp ?? 0;
  if (requiredYears > 0 && candidateYears < requiredYears) {
    const diff = Math.ceil(requiredYears - candidateYears);
    gaps.push({
      item: `${diff} more year${diff > 1 ? 's' : ''} of experience needed`,
      type: 'experience',
      importance: 'required',
      how_to_close: 'Consider a stepping-stone role or freelance projects to bridge the gap',
    });
  }

  // Missing certifications
  const candidateCertSet = new Set(
    candidate.certifications
      .filter(c => c.is_active)
      .map(c => (c.normalized_name ?? c.name).toLowerCase().trim()),
  );
  for (const cert of job.required_certifications) {
    if (!candidateCertSet.has(cert.toLowerCase().trim())) {
      gaps.push({
        item: `${cert} certification`,
        type: 'certification',
        importance: 'required',
        how_to_close: `Obtain the ${cert} certification to meet this requirement`,
      });
    }
  }

  return gaps;
}

// ─────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────

/**
 * Compute a match score between a candidate and a job.
 * @param semanticScore  Pre-computed cosine similarity (0–100) from pgvector.
 *                       Pass 70 as a neutral default if embeddings aren't available.
 */
export function computeMatchScore(
  candidate: CandidateProfile,
  job: JobProfile,
  semanticScore = 70,
): MatchResult {
  const scores: DimensionScores = {
    skills:        scoreSkills(candidate.skills, job.job_skills),
    experience:    scoreExperience(candidate, job),
    seniority:     scoreSeniority(candidate.seniority_level ?? 'mid', job.seniority_level ?? 'mid'),
    education:     scoreEducation(candidate.education, job.ai_required_degree),
    location:      scoreLocation(candidate, job),
    language:      scoreLanguage(candidate.languages, job),
    certification: scoreCertification(candidate.certifications, job.required_certifications),
    semantic:      semanticScore,
  };

  const composite = Math.round(
    scores.skills        * WEIGHTS.skills +
    scores.experience    * WEIGHTS.experience +
    scores.seniority     * WEIGHTS.seniority +
    scores.education     * WEIGHTS.education +
    scores.location      * WEIGHTS.location +
    scores.language      * WEIGHTS.language +
    scores.certification * WEIGHTS.certification +
    scores.semantic      * WEIGHTS.semantic,
  );

  const tier =
    composite >= 85 ? 'excellent'
    : composite >= 70 ? 'strong'
    : composite >= 55 ? 'moderate'
    : 'weak';

  return {
    match_score: composite,
    tier,
    ...scores,
    strengths: identifyStrengths(candidate, job, scores),
    gaps: identifyGaps(candidate, job),
  };
}
