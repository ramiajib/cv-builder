/**
 * submission-to-profile.ts
 *
 * Converts a raw cv-builder submission payload (the `cv` object saved to Supabase)
 * into a CandidateProfile that the match engine can consume directly.
 * No DB writes — everything is built in-memory from the JSON.
 */

import type {
  CandidateProfile, Skill, Experience, Education, Language, Certification,
  DegreeLevel, SeniorityLevel, EmploymentType, SkillProficiency,
} from '../supabase/types';

// ─── Years-of-experience string → number ─────────────────────────────────────
const YOE_EN: Record<string, number> = {
  'less than 1 year': 0,
  '1–3 years': 2,
  '1-3 years': 2,
  '3–7 years': 5,
  '3-7 years': 5,
  '7–10 years': 8,
  '7-10 years': 8,
  '10+ years': 12,
  'several years': 3,
};

function parseYoe(raw: string): number {
  if (!raw) return 0;
  const hit = YOE_EN[raw.trim().toLowerCase()];
  if (hit !== undefined) return hit;
  // bare number (upload path sometimes sets a number string)
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : Math.round(n);
}

function yoeToSeniority(years: number): SeniorityLevel {
  if (years < 1)  return 'intern';
  if (years < 3)  return 'junior';
  if (years < 6)  return 'mid';
  if (years < 10) return 'senior';
  return 'lead';
}

// ─── Degree level mapping ─────────────────────────────────────────────────────
function mapDegreeLevel(level: string): DegreeLevel | null {
  if (!level) return null;
  const l = level.toLowerCase();
  if (l.includes('phd') || l.includes('doctorate'))           return 'phd';
  if (l.includes('mba'))                                       return 'mba';
  if (l.includes('master') || l.includes('msc') || l.includes('m.sc')) return 'master';
  if (l.includes('bachelor') || l.includes('bsc') || l.includes('b.sc') ||
      l.includes('degree') || l.includes('licence') || l.includes('licen')) return 'bachelor';
  if (l.includes('diploma') || l.includes('associate') || l.includes('technician')) return 'diploma';
  if (l.includes('high school') || l.includes('secondary') || l.includes('baccalaureate')) return 'high_school';
  return 'other';
}

// ─── Country-code heuristics ──────────────────────────────────────────────────
const CITY_COUNTRY: Record<string, [string, string]> = {
  dubai: ['AE', 'United Arab Emirates'],
  'abu dhabi': ['AE', 'United Arab Emirates'],
  sharjah: ['AE', 'United Arab Emirates'],
  uae: ['AE', 'United Arab Emirates'],
  'united arab emirates': ['AE', 'United Arab Emirates'],
  riyadh: ['SA', 'Saudi Arabia'],
  jeddah: ['SA', 'Saudi Arabia'],
  dammam: ['SA', 'Saudi Arabia'],
  ksa: ['SA', 'Saudi Arabia'],
  'saudi arabia': ['SA', 'Saudi Arabia'],
  doha: ['QA', 'Qatar'],
  qatar: ['QA', 'Qatar'],
  kuwait: ['KW', 'Kuwait'],
  'kuwait city': ['KW', 'Kuwait'],
  manama: ['BH', 'Bahrain'],
  bahrain: ['BH', 'Bahrain'],
  muscat: ['OM', 'Oman'],
  oman: ['OM', 'Oman'],
  beirut: ['LB', 'Lebanon'],
  lebanon: ['LB', 'Lebanon'],
  amman: ['JO', 'Jordan'],
  jordan: ['JO', 'Jordan'],
  cairo: ['EG', 'Egypt'],
  egypt: ['EG', 'Egypt'],
  'tripoli': ['LB', 'Lebanon'],   // cv-builder resolves ambiguous cities to Lebanon
};

const GCC_CODES = new Set(['AE', 'SA', 'QA', 'KW', 'BH', 'OM']);

function parseLocation(city: string): { city: string | null; country: string | null; code: string | null } {
  if (!city) return { city: null, country: null, code: null };
  // "Dubai, UAE" or "Dubai, United Arab Emirates"
  const parts = city.split(',').map(p => p.trim());
  const primary = parts[0];
  const secondary = parts[1] ?? '';

  // Try secondary first (explicit country)
  for (const part of [secondary, primary]) {
    const hit = CITY_COUNTRY[part.toLowerCase()];
    if (hit) return { city: primary, country: hit[1], code: hit[0] };
  }

  return { city: primary, country: null, code: null };
}

// ─── Skills ───────────────────────────────────────────────────────────────────
function parseSkills(payload: any, submissionId: string): Skill[] {
  const results: Skill[] = [];

  // skillGroups: [{label: 'Programming', items: ['Python','Java']}, ...]
  if (Array.isArray(payload.skillGroups) && payload.skillGroups.length > 0) {
    for (const group of payload.skillGroups) {
      const items: string[] = Array.isArray(group.items) ? group.items : [];
      for (const item of items) {
        const name = (typeof item === 'string' ? item : String(item)).trim();
        if (!name) continue;
        results.push(makeSkill(name, group.label || 'general', submissionId, results.length));
      }
    }
    if (results.length > 0) return results;
  }

  // Flat string: newline or comma separated
  const raw: string = payload.skills || '';
  for (const line of raw.split(/\n+/)) {
    for (const part of line.split(',')) {
      const name = part.trim();
      if (name) results.push(makeSkill(name, 'general', submissionId, results.length));
    }
  }

  return results;
}

function makeSkill(name: string, category: string, submissionId: string, idx: number): Skill {
  return {
    id: `${submissionId}-sk-${idx}`,
    candidate_id: submissionId,
    name,
    normalized_name: name.toLowerCase().replace(/[^a-z0-9+#.]/g, ' ').replace(/\s+/g, ' ').trim(),
    category,
    proficiency_level: 'intermediate' as SkillProficiency,
    years_experience: null,
    is_primary: true,
    created_at: '',
  };
}

// ─── Experience ───────────────────────────────────────────────────────────────
function parseExperiences(payload: any, submissionId: string): Experience[] {
  if (!Array.isArray(payload.jobs) || payload.jobs.length === 0) return [];

  return payload.jobs.map((job: any, i: number) => {
    const to = String(job.to || '');
    const isPresent = !to || /present|current|now/i.test(to);
    const startYear = parseInt(String(job.from || ''), 10);
    const endYear   = isPresent ? null : parseInt(to, 10);

    // GCC detection: scan company name + any city field
    const text = ((job.company || '') + ' ' + (job.city || '')).toUpperCase();
    const isGcc = ['KSA','UAE','DUBAI','RIYADH','JEDDAH','DAMMAM','QATAR','DOHA',
                   'KUWAIT','BAHRAIN','MANAMA','OMAN','MUSCAT','ABU DHABI','SHARJAH',
                   'SAUDI','ARAMCO','NEOM'].some(kw => text.includes(kw));

    const duties: string[] = Array.isArray(job.duties) ? job.duties : [];

    return {
      id: `${submissionId}-exp-${i}`,
      candidate_id: submissionId,
      company_name: job.company || '',
      title: job.title || '',
      normalized_title: (job.title || '').toLowerCase(),
      employment_type: 'full_time' as EmploymentType,
      industry: null,
      industry_code: null,
      start_date: !isNaN(startYear) ? `${startYear}-01-01` : null,
      end_date: endYear && !isNaN(endYear) ? `${endYear}-12-31` : null,
      is_current: isPresent,
      description: duties.join('\n') || null,
      achievements: [],
      skills_used: [],
      location_city: null,
      location_country: null,
      is_gcc_experience: isGcc,
      created_at: '',
    };
  });
}

// ─── Education ────────────────────────────────────────────────────────────────
function parseEducation(payload: any, submissionId: string): Education[] {
  const list = Array.isArray(payload.eduList) && payload.eduList.length > 0
    ? payload.eduList
    : null;

  if (list) {
    return list.map((e: any, i: number) => ({
      id: `${submissionId}-edu-${i}`,
      candidate_id: submissionId,
      institution: e.inst || e.institution || '',
      degree: e.field || e.degree || null,
      degree_level: mapDegreeLevel(e.level || e.eduLevel || e.degree_level || ''),
      field_of_study: e.field || e.eduField || null,
      start_date: null,
      end_date: e.year ? `${e.year}-06-01` : null,
      is_current: !!e.isCurrent,
      gpa: null,
      honors: null,
      created_at: '',
    }));
  }

  // Flat fields fallback
  if (payload.eduLevel || payload.eduInst) {
    return [{
      id: `${submissionId}-edu-0`,
      candidate_id: submissionId,
      institution: payload.eduInst || '',
      degree: payload.eduField || null,
      degree_level: mapDegreeLevel(payload.eduLevel || ''),
      field_of_study: payload.eduField || null,
      start_date: null,
      end_date: payload.eduYear ? `${payload.eduYear}-06-01` : null,
      is_current: false,
      gpa: null,
      honors: null,
      created_at: '',
    }];
  }

  return [];
}

// ─── Languages ────────────────────────────────────────────────────────────────
const LANG_CODES: Record<string, string> = {
  english: 'eng', arabic: 'ara', french: 'fra', spanish: 'spa',
  german: 'deu', mandarin: 'zho', chinese: 'zho', hindi: 'hin',
  urdu: 'urd', tagalog: 'tgl', turkish: 'tur', russian: 'rus',
  italian: 'ita', portuguese: 'por', korean: 'kor', japanese: 'jpn',
};

const LEVEL_CANON: Record<string, string> = {
  fluent: 'Fluent', native: 'Native', 'mother tongue': 'Native',
  advanced: 'Advanced', intermediate: 'Intermediate',
  basic: 'Basic', elementary: 'Basic', beginner: 'Basic',
  professional: 'Advanced',
};

function parseLanguages(payload: any, submissionId: string): Language[] {
  const raw: string = payload.langs || '';
  if (!raw.trim()) return [];

  const results: Language[] = [];

  for (const entry of raw.split(/[,;]+/).map(e => e.trim()).filter(Boolean)) {
    // "English (Fluent)"
    let m = entry.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (!m) m = entry.match(/^([^–\-:]+)[–\-:]\s*(.+)$/); // "English - Fluent"

    if (m) {
      const lang  = m[1].trim();
      const level = m[2].trim();
      results.push({
        id: `${submissionId}-lang-${results.length}`,
        candidate_id: submissionId,
        language: lang,
        language_code: LANG_CODES[lang.toLowerCase()] ?? null,
        proficiency: LEVEL_CANON[level.toLowerCase()] ?? level,
        created_at: '',
      });
    } else {
      results.push({
        id: `${submissionId}-lang-${results.length}`,
        candidate_id: submissionId,
        language: entry,
        language_code: LANG_CODES[entry.toLowerCase()] ?? null,
        proficiency: 'Fluent',
        created_at: '',
      });
    }
  }

  return results;
}

// ─── Certifications ───────────────────────────────────────────────────────────
function parseCertifications(payload: any, submissionId: string): Certification[] {
  const raw: string = payload.certifications || payload.certs || '';
  if (!raw.trim()) return [];

  return raw
    .split(/[\n,]+/)
    .map((c: string) => c.trim())
    .filter(Boolean)
    .map((name: string, i: number) => ({
      id: `${submissionId}-cert-${i}`,
      candidate_id: submissionId,
      name,
      normalized_name: name.toLowerCase(),
      issuer: null,
      issue_date: null,
      expiry_date: null,
      is_active: true,
      is_verified: false,
      created_at: '',
    }));
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function submissionToProfile(payload: any, submissionId: string): CandidateProfile {
  const loc = parseLocation(payload.city || '');
  const yoe = parseYoe(payload.yearsExp || payload.years_exp || '');

  // Derive total years from job dates when the YOE string is missing/vague
  let computedYoe = yoe;
  if (yoe === 0 || yoe === 3) {
    const fromJobs = (payload.jobs || []).reduce((sum: number, j: any) => {
      const start = parseInt(String(j.from || ''), 10);
      const end   = /present|current|now/i.test(String(j.to || ''))
        ? new Date().getFullYear()
        : parseInt(String(j.to || ''), 10);
      if (!isNaN(start) && !isNaN(end) && end > start) return sum + (end - start);
      return sum;
    }, 0);
    if (fromJobs > 0) computedYoe = Math.min(fromJobs, 40);
  }

  const skills        = parseSkills(payload, submissionId);
  const experiences   = parseExperiences(payload, submissionId);
  const education     = parseEducation(payload, submissionId);
  const languages     = parseLanguages(payload, submissionId);
  const certifications = parseCertifications(payload, submissionId);

  return {
    // ── Identity ──────────────────────────────────────────────
    id:                       submissionId,
    user_id:                  null,
    full_name:                payload.name  || 'Candidate',
    headline:                 payload.title || null,
    summary:                  payload.summary || null,
    email:                    payload.email || null,
    avatar_url:               null,
    linkedin_url:             payload.linkedin || null,

    // ── Location ──────────────────────────────────────────────
    location_city:            loc.city,
    location_country:         loc.country,
    location_country_code:    loc.code,
    timezone:                 null,

    // ── Availability ──────────────────────────────────────────
    willing_to_relocate:      !!payload.relocate,
    relocation_targets:       payload.relocateWhere
                                ? [payload.relocateWhere]
                                : [],
    remote_preference:        'flexible',
    years_of_experience:      computedYoe,
    seniority_level:          yoeToSeniority(computedYoe),
    expected_salary_min_usd:  null,
    expected_salary_max_usd:  null,
    salary_currency:          'USD',
    availability_date:        null,
    notice_period_days:       30,
    is_open_to_work:          true,
    is_active:                true,
    profile_completeness:     80,
    last_matched_at:          null,
    created_at:               new Date().toISOString(),
    updated_at:               new Date().toISOString(),

    // ── Relations ──────────────────────────────────────────────
    skills,
    experiences,
    education,
    certifications,
    languages,
    preferences: null,
  };
}
