import type { CandidateProfile, JobProfile } from '../supabase/types';

// ─────────────────────────────────────────────────────────────
// CONTENT / OCCUPATION RELEVANCE
//
// The scraped job corpus has almost no structured requirements
// (≈3 of 1,678 jobs have parsed skills, 0 have ai_extracted_skills).
// What every job DOES have is a clean title + a ~765-char description.
// And every candidate has skill text, job titles, a headline and a
// field of study.
//
// This module turns that free text into a real relevance signal so a
// clinical pharmacist stops scoring 90% on "Coffee Roaster". It needs
// no embeddings, no external API — it is deterministic and free.
// ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'was', 'will',
  'have', 'has', 'had', 'this', 'that', 'these', 'those', 'from', 'into',
  'job', 'jobs', 'role', 'roles', 'work', 'working', 'experience', 'experienced',
  'year', 'years', 'team', 'teams', 'skill', 'skills', 'ability', 'able',
  'strong', 'good', 'excellent', 'knowledge', 'requirement', 'requirements',
  'responsibility', 'responsibilities', 'candidate', 'candidates', 'looking',
  'join', 'must', 'should', 'need', 'needed', 'required', 'preferred', 'plus',
  'company', 'companies', 'saudi', 'arabia', 'riyadh', 'jeddah', 'ksa', 'gcc',
  'salary', 'package', 'sar', 'per', 'month', 'full', 'time', 'part', 'new',
  'etc', 'including', 'related', 'field', 'based', 'within', 'across', 'using',
  'proficiency', 'fluent', 'native', 'communication', 'management', 'manager',
  'level', 'min', 'minimum', 'maximum', 'years.', 'bachelor', 'degree',
]);

// Occupation families. Each family is a set of distinctive terms (single
// or multi-word). A profile/job is classified by which families its text
// hits. Cross-family pairs (pharmacist ↔ coffee roaster) are penalised;
// same-family pairs are rewarded.
const FAMILIES: Record<string, string[]> = {
  healthcare_pharmacy: [
    'pharmac', 'clinical', 'medication', 'medicine', 'medical', 'nurse',
    'nursing', 'patient', 'hospital', 'health', 'therapeutic', 'dispens',
    'prescription', 'drug', 'physician', 'doctor', 'dental', 'dentist',
    'radiolog', 'physiotherap', 'rehabilitation', 'epidemiolog', 'pharmacolog',
    'laboratory', 'lab technician', 'caregiver', 'midwife', 'surgical',
  ],
  engineering_civil: [
    'civil', 'structural', 'construction', 'concrete', 'steel structure',
    'site engineer', 'surveyor', 'infrastructure', 'reinforcement', 'rebar',
    'quantity surveyor', 'building', 'roadworks', 'geotechnical',
  ],
  engineering_mechanical: [
    'mechanical', 'hvac', 'piping', 'thermodynam', 'machine', 'turbine',
    'manufacturing', 'production line', 'cnc', 'welding', 'fabrication',
  ],
  engineering_electrical: [
    'electrical', 'electronic', 'plc', 'low voltage', 'high voltage',
    'instrumentation', 'power system', 'wiring', 'panel', 'voltage drop',
  ],
  engineering_mep: ['mep', 'building services'],
  software_it: [
    'software', 'developer', 'programming', 'frontend', 'backend',
    'full stack', 'devops', 'web', 'mobile app', 'python', 'java', 'javascript',
    'react', 'node', 'database', 'cybersecurity', 'infosec', 'network',
    'it support', 'system administrator', 'cloud', 'api',
  ],
  data_analytics: [
    'data analyst', 'data analysis', 'business intelligence', 'power bi',
    'analytics', 'data science', 'machine learning', 'sql', 'etl', 'tableau',
    'reporting dashboard',
  ],
  finance_accounting: [
    'account', 'accounting', 'accountant', 'finance', 'financial', 'audit',
    'tax', 'zakat', 'vat', 'bookkeep', 'payable', 'receivable', 'treasury',
    'ledger', 'invoic', 'cma', 'cpa', 'ifrs', 'budgeting', 'payroll',
    'cost accounting', 'zatca', 'e-invoicing',
  ],
  sales_business: [
    'sales', 'business development', 'account manager', 'retail', 'merchandis',
    'b2b', 'b2c', 'telesales', 'revenue target', 'showroom', 'cashier',
  ],
  marketing_creative: [
    'marketing', 'brand', 'social media', 'content creat', 'seo', 'advertis',
    'campaign', 'public relations', 'graphic', 'designer', 'videograph',
    'copywrit', 'photoshop', 'illustrator', 'creative', 'influencer',
  ],
  logistics_supplychain: [
    'logistics', 'supply chain', 'procurement', 'warehouse', 'inventory',
    'freight', 'shipping', 'customs', 'fleet', 'dispatch', 'import', 'export',
    'purchasing', 'forwarding', 'distribution', 'demand planning',
  ],
  hospitality_fnb: [
    'hospitality', 'restaurant', 'chef', 'cook', 'barista', 'waiter',
    'waitress', 'f&b', 'food', 'beverage', 'hotel', 'catering', 'culinary',
    'coffee', 'roaster', 'kitchen', 'menu', 'guest experience', 'hostess',
  ],
  driving_transport: [
    'driver', 'truck', 'delivery', 'gps', 'traffic controller', 'heavy vehicle',
    'transport', 'chauffeur', 'haul', 'tanker', 'route planning',
  ],
  hr_admin: [
    'human resources', 'recruit', 'talent acquisition', 'hris', 'onboarding',
    'administrative', 'secretary', 'office manager', 'executive assistant',
    'receptionist', 'clerk', 'data entry',
  ],
  education_teaching: [
    'teacher', 'teaching', 'tutor', 'lecturer', 'instructor', 'professor',
    'academic', 'curriculum', 'classroom', 'student',
  ],
  legal: [
    'legal', 'lawyer', 'attorney', 'paralegal', 'contract law', 'litigation',
    'compliance officer', 'regulatory affairs',
  ],
  safety_qa: [
    'safety officer', 'hse', 'qa/qc', 'quality control', 'quality assurance',
    'iso', 'inspection', 'risk management',
  ],
  // generic engineering fallback — only used if no specific eng family hit
  engineering_generic: ['engineer', 'engineering'],
};

function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9&/+\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distinctive content tokens (unigrams) from text, stopwords removed. */
function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalize(text).split(' ')) {
    const t = raw.replace(/[.\-/]+$/g, '');
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

/** Which occupation families does this text belong to? */
export function classifyOccupation(text: string): Set<string> {
  const norm = normalize(text);
  const hits: Record<string, number> = {};

  for (const [family, terms] of Object.entries(FAMILIES)) {
    let count = 0;
    for (const term of terms) {
      if (norm.includes(term)) count++;
    }
    if (count > 0) hits[family] = count;
  }

  const families = new Set(Object.keys(hits));

  // Drop the generic engineering fallback if a specific eng family matched.
  if (families.has('engineering_generic')) {
    const hasSpecific = [
      'engineering_civil', 'engineering_mechanical',
      'engineering_electrical', 'engineering_mep',
    ].some(f => families.has(f));
    if (hasSpecific) families.delete('engineering_generic');
  }

  return families;
}

// ── Build the text blobs we compare ──────────────────────────

function candidateText(c: CandidateProfile): string {
  const parts: string[] = [];
  // Titles + headline carry the strongest occupation signal — repeat them.
  if (c.headline) parts.push(c.headline, c.headline);
  for (const e of c.experiences ?? []) {
    if (e.title) parts.push(e.title, e.title);
    if (e.normalized_title) parts.push(e.normalized_title);
    if (e.industry) parts.push(e.industry);
  }
  for (const s of c.skills ?? []) parts.push(s.name);
  for (const ed of c.education ?? []) {
    if (ed.field_of_study) parts.push(ed.field_of_study);
  }
  if (c.summary) parts.push(c.summary);
  return parts.join(' ');
}

function candidateSkillText(c: CandidateProfile): string {
  const parts: string[] = [];
  for (const s of c.skills ?? []) parts.push(s.name);
  for (const e of c.experiences ?? []) {
    if (e.title) parts.push(e.title);
    for (const su of e.skills_used ?? []) parts.push(su);
  }
  return parts.join(' ');
}

function jobText(j: JobProfile): string {
  const parts: string[] = [];
  // Title is the cleanest, most reliable signal — weight it heavily.
  if (j.title) parts.push(j.title, j.title, j.title);
  if (j.industry) parts.push(j.industry);
  if (j.department) parts.push(j.department);
  if (j.description) parts.push(j.description);
  if (j.requirements) parts.push(j.requirements);
  if (j.responsibilities) parts.push(j.responsibilities);
  for (const s of j.job_skills ?? []) parts.push(s.skill_name);
  for (const s of j.ai_extracted_skills ?? []) parts.push(s);
  return parts.join(' ');
}

function jaccardish(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  // coverage of the smaller set — rewards focused overlap over raw size
  return inter / Math.min(a.size, b.size);
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: relevance score (0–100) used as the "semantic" dimension
// ─────────────────────────────────────────────────────────────
export function scoreRelevance(candidate: CandidateProfile, job: JobProfile): number {
  const candFamilies = classifyOccupation(candidateText(candidate));
  const jobFamilies = classifyOccupation(jobText(job));

  // ── Family signal (occupation alignment) ──
  let familyScore: number | null = null;
  if (candFamilies.size > 0 && jobFamilies.size > 0) {
    let shared = 0;
    for (const f of candFamilies) if (jobFamilies.has(f)) shared++;
    if (shared > 0) {
      familyScore = 100;           // same occupation domain
    } else {
      familyScore = 12;            // both known, but different domains → mismatch
    }
  }
  // if either side is unclassified, familyScore stays null → lean on lexical

  // ── Lexical signal ──
  // How much of the job's distinctive title/description vocabulary does the
  // candidate's profile actually cover?
  const candTokens = contentTokens(candidateText(candidate));
  const jobTitleTokens = contentTokens(job.title ?? '');
  const jobBodyTokens = contentTokens(jobText(job));

  const titleCoverage = jaccardish(jobTitleTokens, candTokens); // 0–1, strongest
  const bodyCoverage = jaccardish(jobBodyTokens, candTokens);   // 0–1, supporting
  const lexScore = Math.round((titleCoverage * 0.65 + bodyCoverage * 0.35) * 100);

  // ── Blend ──
  if (familyScore === null) {
    // No occupation classification available — lexical only, but pulled
    // toward a neutral-cautious middle so unknowns don't masquerade as fits.
    return Math.round(25 + lexScore * 0.6); // range ~25–85
  }

  // Family dominates; lexical refines within the band.
  const blended = familyScore * 0.7 + lexScore * 0.3;
  return Math.max(0, Math.min(100, Math.round(blended)));
}

// ─────────────────────────────────────────────────────────────
// PUBLIC: text-based skill overlap (0–100) — fallback for the skills
// dimension when a job has no structured job_skills / ai_extracted_skills.
// ─────────────────────────────────────────────────────────────
export function scoreSkillsFromText(candidate: CandidateProfile, job: JobProfile): number {
  const candTerms = contentTokens(candidateSkillText(candidate));
  if (candTerms.size === 0) return 50; // candidate has no usable skill text → neutral

  const jobBody = normalize(jobText(job));
  const jobTokens = contentTokens(jobText(job));

  let matched = 0;
  for (const t of candTerms) {
    if (jobTokens.has(t) || (t.length >= 4 && jobBody.includes(t))) matched++;
  }

  const ratio = matched / Math.min(candTerms.size, 12);

  // Penalise clear occupation mismatch so unrelated jobs can't ride generic
  // overlap words ("microsoft", "office", "team") into a high skills score.
  const candFamilies = classifyOccupation(candidateText(candidate));
  const jobFamilies = classifyOccupation(jobText(job));
  let cap = 100;
  if (candFamilies.size > 0 && jobFamilies.size > 0) {
    const shared = [...candFamilies].some(f => jobFamilies.has(f));
    if (!shared) cap = 30; // different domain → skills can't score high
  }

  const score = Math.round(15 + Math.min(1, ratio) * 85);
  return Math.min(cap, score);
}
