// ─────────────────────────────────────────────────────────────
// Database entity types — mirrors the SQL schema exactly
// ─────────────────────────────────────────────────────────────

export type SeniorityLevel =
  | 'intern' | 'junior' | 'mid' | 'senior'
  | 'lead' | 'manager' | 'director' | 'vp' | 'executive';

export type RemotePolicy = 'remote' | 'hybrid' | 'onsite' | 'flexible';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship';
export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type DegreeLevel = 'high_school' | 'diploma' | 'associate' | 'bachelor' | 'master' | 'mba' | 'phd' | 'other';

// ─── Candidate ────────────────────────────────────────────────
export interface Candidate {
  id: string;
  user_id: string | null;
  full_name: string;
  headline: string | null;
  summary: string | null;
  email: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
  location_city: string | null;
  location_country: string | null;
  location_country_code: string | null;
  timezone: string | null;
  willing_to_relocate: boolean;
  relocation_targets: string[];
  remote_preference: RemotePolicy;
  years_of_experience: number | null;
  seniority_level: SeniorityLevel | null;
  expected_salary_min_usd: number | null;
  expected_salary_max_usd: number | null;
  salary_currency: string;
  availability_date: string | null;
  notice_period_days: number;
  is_open_to_work: boolean;
  is_active: boolean;
  profile_completeness: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  candidate_id: string;
  company_name: string;
  title: string;
  normalized_title: string | null;
  employment_type: EmploymentType;
  industry: string | null;
  industry_code: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  achievements: string[];
  skills_used: string[];
  location_city: string | null;
  location_country: string | null;
  is_gcc_experience: boolean;
  created_at: string;
}

export interface Skill {
  id: string;
  candidate_id: string;
  name: string;
  normalized_name: string;
  category: string;
  proficiency_level: SkillProficiency;
  years_experience: number | null;
  is_primary: boolean;
  created_at: string;
}

export interface Language {
  id: string;
  candidate_id: string;
  language: string;
  language_code: string | null;
  proficiency: string;
  created_at: string;
}

export interface Education {
  id: string;
  candidate_id: string;
  institution: string;
  degree: string | null;
  degree_level: DegreeLevel | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  gpa: number | null;
  honors: string | null;
  created_at: string;
}

export interface Certification {
  id: string;
  candidate_id: string;
  name: string;
  normalized_name: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface CandidatePreferences {
  id: string;
  candidate_id: string;
  preferred_industries: string[];
  preferred_locations: string[];
  preferred_remote_policy: RemotePolicy | null;
  deal_breakers: string[];
  min_match_score: number;
  notify_new_matches: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Company & Recruiter ──────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  normalized_name: string;
  industry: string | null;
  size_range: string | null;
  website: string | null;
  linkedin_url: string | null;
  country: string | null;
  logo_url: string | null;
  is_verified: boolean;
  trust_score: number;
  total_hires_confirmed: number;
  created_at: string;
  updated_at: string;
}

export interface Recruiter {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  is_verified: boolean;
  trust_score: number;
  successful_hires: number;
  response_rate: number | null;
  avg_response_time_hours: number | null;
  ghost_rate: number;
  created_at: string;
  updated_at: string;
}

// ─── Job ──────────────────────────────────────────────────────
export interface Job {
  id: string;
  company_id: string | null;
  recruiter_id: string | null;
  title: string;
  normalized_title: string | null;
  seniority_level: SeniorityLevel | null;
  employment_type: EmploymentType;
  industry: string | null;
  department: string | null;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
  benefits: string | null;
  location_city: string | null;
  location_country: string | null;
  location_country_code: string | null;
  is_remote: boolean;
  remote_policy: RemotePolicy;
  salary_min_usd: number | null;
  salary_max_usd: number | null;
  salary_disclosed: boolean;
  status: 'draft' | 'active' | 'filled' | 'expired' | 'removed';
  posted_date: string;
  expires_at: string | null;
  source_url: string | null;
  application_url: string | null;
  ai_min_years_exp: number | null;
  ai_required_degree: DegreeLevel | null;
  ai_extracted_skills: string[];
  required_certifications: string[];
  required_languages: string[];
  trust_score: number;
  submitted_by_name: string | null;
  submitted_by_reputation: number;
  view_count: number;
  application_count: number;
  created_at: string;
  updated_at: string;
}

export interface JobSkill {
  id: string;
  job_id: string;
  skill_name: string;
  normalized_name: string;
  is_required: boolean;
  proficiency_level: SkillProficiency | null;
  years_required: number | null;
  created_at: string;
}

// ─── Match Results ────────────────────────────────────────────
export interface MatchResultDB {
  id: string;
  candidate_id: string;
  job_id: string;
  match_score: number;
  skills_score: number | null;
  experience_score: number | null;
  seniority_score: number | null;
  education_score: number | null;
  location_score: number | null;
  language_score: number | null;
  certification_score: number | null;
  semantic_score: number | null;
  strengths: import('../matching/types').Strength[];
  gaps: import('../matching/types').Gap[];
  explanation_summary: string | null;
  ai_explanation: import('../matching/types').AIExplanation | null;
  algorithm_version: string;
  is_stale: boolean;
  computed_at: string;
  expires_at: string;
}

export interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  match_score: number | null;
  status: string;
  source: string;
  applied_at: string;
  last_update_at: string;
}

// ─── Composite (joined) types ─────────────────────────────────
export interface CandidateProfile extends Candidate {
  skills: Skill[];
  experiences: Experience[];
  education: Education[];
  certifications: Certification[];
  languages: Language[];
  preferences: CandidatePreferences | null;
}

export interface JobProfile extends Job {
  company: Company | null;
  recruiter: Recruiter | null;
  job_skills: JobSkill[];
}

export interface MatchWithJob {
  match: MatchResultDB;
  job: JobProfile;
}
