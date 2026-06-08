-- ─────────────────────────────────────────────────────────────
-- Job Matching Platform — Initial Schema
-- Run in Supabase SQL editor or via supabase db push
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE seniority_level AS ENUM ('intern','junior','mid','senior','lead','manager','director','vp','executive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE remote_policy AS ENUM ('remote','hybrid','onsite','flexible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE employment_type AS ENUM ('full_time','part_time','contract','freelance','internship');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skill_proficiency AS ENUM ('beginner','intermediate','advanced','expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE degree_level AS ENUM ('high_school','diploma','associate','bachelor','master','mba','phd','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('draft','active','filled','expired','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- CANDIDATES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  full_name               TEXT NOT NULL,
  headline                TEXT,
  summary                 TEXT,
  email                   TEXT,
  avatar_url              TEXT,
  linkedin_url            TEXT,

  location_city           TEXT,
  location_country        TEXT,
  location_country_code   CHAR(2),
  timezone                TEXT,
  willing_to_relocate     BOOLEAN DEFAULT FALSE,
  relocation_targets      TEXT[] DEFAULT '{}',

  remote_preference       remote_policy DEFAULT 'flexible',
  years_of_experience     NUMERIC(4,1),
  seniority_level         seniority_level,

  expected_salary_min_usd INT,
  expected_salary_max_usd INT,
  salary_currency         CHAR(3) DEFAULT 'USD',

  availability_date       DATE,
  notice_period_days      INT DEFAULT 0,
  is_open_to_work         BOOLEAN DEFAULT TRUE,
  is_active               BOOLEAN DEFAULT TRUE,

  -- AI / matching
  profile_embedding       VECTOR(1536),
  profile_text_snapshot   TEXT,
  profile_completeness    INT DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
  last_matched_at         TIMESTAMPTZ,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CANDIDATE CHILD TABLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS experiences (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id      UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  title             TEXT NOT NULL,
  normalized_title  TEXT,
  employment_type   employment_type DEFAULT 'full_time',
  industry          TEXT,
  industry_code     TEXT,
  start_date        DATE,
  end_date          DATE,
  is_current        BOOLEAN DEFAULT FALSE,
  description       TEXT,
  achievements      TEXT[] DEFAULT '{}',
  skills_used       TEXT[] DEFAULT '{}',
  location_city     TEXT,
  location_country  TEXT,
  is_gcc_experience BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id      UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  normalized_name   TEXT NOT NULL,
  category          TEXT DEFAULT 'technical',
  proficiency_level skill_proficiency DEFAULT 'intermediate',
  years_experience  NUMERIC(4,1),
  is_primary        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS languages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  language_code CHAR(3),
  proficiency   TEXT DEFAULT 'conversational',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS education (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  institution     TEXT NOT NULL,
  degree          TEXT,
  degree_level    degree_level,
  field_of_study  TEXT,
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT FALSE,
  gpa             NUMERIC(3,2),
  honors          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  normalized_name TEXT,
  issuer          TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  is_verified     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_preferences (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id            UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE UNIQUE,
  preferred_industries    TEXT[] DEFAULT '{}',
  preferred_locations     TEXT[] DEFAULT '{}',
  preferred_remote_policy remote_policy,
  deal_breakers           TEXT[] DEFAULT '{}',
  min_match_score         INT DEFAULT 65 CHECK (min_match_score BETWEEN 0 AND 100),
  notify_new_matches      BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- COMPANIES & RECRUITERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL,
  normalized_name       TEXT NOT NULL,
  industry              TEXT,
  size_range            TEXT,
  website               TEXT,
  linkedin_url          TEXT,
  country               TEXT,
  logo_url              TEXT,
  is_verified           BOOLEAN DEFAULT FALSE,
  trust_score           INT DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  total_hires_confirmed INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recruiters (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id              UUID REFERENCES companies(id),
  full_name               TEXT NOT NULL,
  email                   TEXT,
  linkedin_url            TEXT,
  is_verified             BOOLEAN DEFAULT FALSE,
  trust_score             INT DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  successful_hires        INT DEFAULT 0,
  response_rate           NUMERIC(4,3),
  avg_response_time_hours INT,
  ghost_rate              NUMERIC(4,3) DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- JOBS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id              UUID REFERENCES companies(id),
  recruiter_id            UUID REFERENCES recruiters(id),

  title                   TEXT NOT NULL,
  normalized_title        TEXT,
  seniority_level         seniority_level,
  employment_type         employment_type DEFAULT 'full_time',
  industry                TEXT,
  department              TEXT,

  description             TEXT NOT NULL,
  requirements            TEXT,
  responsibilities        TEXT,
  benefits                TEXT,

  location_city           TEXT,
  location_country        TEXT,
  location_country_code   CHAR(2),
  is_remote               BOOLEAN DEFAULT FALSE,
  remote_policy           remote_policy DEFAULT 'onsite',

  salary_min_usd          INT,
  salary_max_usd          INT,
  salary_disclosed        BOOLEAN DEFAULT FALSE,

  status                  job_status DEFAULT 'active',
  posted_date             DATE DEFAULT CURRENT_DATE,
  expires_at              TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '60 days'),
  source_url              TEXT,
  application_url         TEXT,

  -- AI-extracted structured data
  ai_min_years_exp        NUMERIC(4,1),
  ai_required_degree      degree_level,
  ai_extracted_skills     TEXT[] DEFAULT '{}',
  required_certifications TEXT[] DEFAULT '{}',
  required_languages      TEXT[] DEFAULT '{}',

  -- AI / matching
  job_embedding           VECTOR(1536),
  job_text_snapshot       TEXT,

  -- Trust
  trust_score             INT DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  submitted_by_name       TEXT,
  submitted_by_reputation INT DEFAULT 50,

  -- Analytics
  view_count              INT DEFAULT 0,
  application_count       INT DEFAULT 0,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_skills (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_name        TEXT NOT NULL,
  normalized_name   TEXT NOT NULL,
  is_required       BOOLEAN DEFAULT TRUE,
  proficiency_level skill_proficiency,
  years_required    NUMERIC(4,1),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MATCH RESULTS (computed cache)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_results (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id          UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id                UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  match_score           INT NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  skills_score          INT,
  experience_score      INT,
  seniority_score       INT,
  education_score       INT,
  location_score        INT,
  language_score        INT,
  certification_score   INT,
  semantic_score        INT,

  strengths             JSONB DEFAULT '[]',
  gaps                  JSONB DEFAULT '[]',
  explanation_summary   TEXT,
  ai_explanation        JSONB,

  algorithm_version     TEXT DEFAULT 'v1',
  is_stale              BOOLEAN DEFAULT FALSE,
  computed_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at            TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),

  UNIQUE(candidate_id, job_id)
);

-- ─────────────────────────────────────────────────────────────
-- APPLICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  match_score     INT,
  status          TEXT DEFAULT 'applied',
  source          TEXT DEFAULT 'recommendation',
  applied_at      TIMESTAMPTZ DEFAULT NOW(),
  last_update_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_candidates_user ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_open ON candidates(is_open_to_work, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_candidates_country ON candidates(location_country_code);
CREATE INDEX IF NOT EXISTS idx_candidates_embedding ON candidates
  USING ivfflat (profile_embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_experiences_candidate ON experiences(candidate_id);
CREATE INDEX IF NOT EXISTS idx_skills_candidate ON skills(candidate_id);
CREATE INDEX IF NOT EXISTS idx_skills_normalized ON skills(normalized_name);
CREATE INDEX IF NOT EXISTS idx_languages_candidate ON languages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_education_candidate ON education(candidate_id);
CREATE INDEX IF NOT EXISTS idx_certs_candidate ON certifications(candidate_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs(location_country_code);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs(posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_trust ON jobs(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs
  USING ivfflat (job_embedding vector_cosine_ops) WITH (lists = 50) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_job_skills_job ON job_skills(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_norm ON job_skills(normalized_name);

CREATE INDEX IF NOT EXISTS idx_match_candidate ON match_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_match_score ON match_results(candidate_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_stale ON match_results(is_stale, expires_at) WHERE is_stale = FALSE;

CREATE INDEX IF NOT EXISTS idx_apps_candidate ON applications(candidate_id);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_own" ON candidates FOR ALL USING (user_id = auth.uid());
CREATE POLICY "candidates_public_read" ON candidates FOR SELECT USING (is_active = TRUE);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_via_candidate" ON skills FOR ALL USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);
CREATE POLICY "skills_public_read" ON skills FOR SELECT USING (TRUE);

ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp_via_candidate" ON experiences FOR ALL USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);
CREATE POLICY "exp_public_read" ON experiences FOR SELECT USING (TRUE);

ALTER TABLE education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edu_via_candidate" ON education FOR ALL USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);
CREATE POLICY "edu_public_read" ON education FOR SELECT USING (TRUE);

ALTER TABLE languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lang_via_candidate" ON languages FOR ALL USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);
CREATE POLICY "lang_public_read" ON languages FOR SELECT USING (TRUE);

ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_via_candidate" ON certifications FOR ALL USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);
CREATE POLICY "cert_public_read" ON certifications FOR SELECT USING (TRUE);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_public_read" ON jobs FOR SELECT USING (status = 'active');

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_own" ON match_results FOR SELECT USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps_own" ON applications FOR ALL USING (
  candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
);

-- ─────────────────────────────────────────────────────────────
-- HELPER: profile completeness function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_profile_completeness(p_candidate_id UUID)
RETURNS INT AS $$
DECLARE
  score       INT := 0;
  exp_count   INT;
  skill_count INT;
  edu_count   INT;
  lang_count  INT;
  c           candidates%ROWTYPE;
BEGIN
  SELECT * INTO c FROM candidates WHERE id = p_candidate_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF c.full_name IS NOT NULL AND length(c.full_name) > 1 THEN score := score + 10; END IF;
  IF c.headline IS NOT NULL THEN score := score + 10; END IF;
  IF c.summary  IS NOT NULL THEN score := score + 10; END IF;
  IF c.location_country IS NOT NULL THEN score := score + 5; END IF;
  IF c.expected_salary_min_usd IS NOT NULL THEN score := score + 5; END IF;

  SELECT COUNT(*) INTO exp_count FROM experiences WHERE candidate_id = p_candidate_id;
  score := score + LEAST(25, exp_count * 12);

  SELECT COUNT(*) INTO skill_count FROM skills WHERE candidate_id = p_candidate_id;
  score := score + LEAST(20, skill_count * 3);

  SELECT COUNT(*) INTO edu_count FROM education WHERE candidate_id = p_candidate_id;
  IF edu_count > 0 THEN score := score + 10; END IF;

  SELECT COUNT(*) INTO lang_count FROM languages WHERE candidate_id = p_candidate_id;
  score := score + LEAST(5, lang_count * 3);

  RETURN LEAST(100, score);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update completeness when child rows change
CREATE OR REPLACE FUNCTION trigger_completeness() RETURNS TRIGGER AS $$
BEGIN
  UPDATE candidates
  SET profile_completeness = compute_profile_completeness(
        COALESCE(NEW.candidate_id, OLD.candidate_id)
      ),
      updated_at = NOW()
  WHERE id = COALESCE(NEW.candidate_id, OLD.candidate_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_completeness_skills
  AFTER INSERT OR UPDATE OR DELETE ON skills
  FOR EACH ROW EXECUTE FUNCTION trigger_completeness();

CREATE TRIGGER trg_completeness_exp
  AFTER INSERT OR UPDATE OR DELETE ON experiences
  FOR EACH ROW EXECUTE FUNCTION trigger_completeness();

CREATE TRIGGER trg_completeness_edu
  AFTER INSERT OR UPDATE OR DELETE ON education
  FOR EACH ROW EXECUTE FUNCTION trigger_completeness();

CREATE TRIGGER trg_completeness_lang
  AFTER INSERT OR UPDATE OR DELETE ON languages
  FOR EACH ROW EXECUTE FUNCTION trigger_completeness();

-- ─────────────────────────────────────────────────────────────
-- DEMO SEED DATA (safe to remove in production)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  company_id  UUID := uuid_generate_v4();
  company2_id UUID := uuid_generate_v4();
  recruiter_id UUID := uuid_generate_v4();
  job1_id     UUID := uuid_generate_v4();
  job2_id     UUID := uuid_generate_v4();
  job3_id     UUID := uuid_generate_v4();
  cand_id     UUID := uuid_generate_v4();
BEGIN
  -- Companies
  INSERT INTO companies (id, name, normalized_name, industry, size_range, country, is_verified, trust_score, total_hires_confirmed)
  VALUES
    (company_id,  'Saudi Aramco', 'saudi aramco', 'Oil & Gas', '10000+', 'SA', TRUE, 96, 24),
    (company2_id, 'NEOM',         'neom',         'Construction & Tech', '5000+', 'SA', TRUE, 88, 9);

  -- Recruiter
  INSERT INTO recruiters (id, company_id, full_name, is_verified, trust_score, successful_hires, response_rate, ghost_rate)
  VALUES (recruiter_id, company_id, 'Fatima Al-Rashid', TRUE, 91, 12, 0.82, 0.05);

  -- Jobs
  INSERT INTO jobs (id, company_id, recruiter_id, title, normalized_title, seniority_level, employment_type,
    industry, description, location_city, location_country, location_country_code, is_remote, remote_policy,
    salary_min_usd, salary_max_usd, salary_disclosed, status, posted_date, ai_min_years_exp,
    ai_required_degree, required_certifications, required_languages, trust_score, submitted_by_name, submitted_by_reputation)
  VALUES
    (job1_id, company_id, recruiter_id,
     'Senior Product Manager', 'senior product manager', 'senior', 'full_time',
     'Oil & Gas',
     'Lead product strategy for digital transformation initiatives across Aramco''s upstream operations. You will own the product roadmap, work with engineering teams, and drive adoption of new technology platforms.',
     'Dhahran', 'Saudi Arabia', 'SA', FALSE, 'onsite',
     12000, 18000, TRUE, 'active', CURRENT_DATE - 3,
     7, 'bachelor', ARRAY['PMP'], ARRAY['ara', 'eng'], 94,
     'Mohamed Al-Farsi', 87),

    (job2_id, company2_id, recruiter_id,
     'Full Stack Engineer', 'full stack engineer', 'mid', 'full_time',
     'Technology',
     'Build and maintain internal platforms for NEOM''s smart city infrastructure. Stack: React, Node.js, PostgreSQL, AWS. You will work in a fast-paced team shipping features weekly.',
     'Tabuk', 'Saudi Arabia', 'SA', TRUE, 'hybrid',
     8000, 13000, TRUE, 'active', CURRENT_DATE - 1,
     3, 'bachelor', ARRAY[]::TEXT[], ARRAY['eng'], 88,
     'Sara Younis', 92),

    (job3_id, company2_id, NULL,
     'Data Analyst', 'data analyst', 'junior', 'full_time',
     'Technology',
     'Analyze large datasets to support NEOM project delivery decisions. You will build dashboards, run SQL queries, and present findings to stakeholders. Python and SQL required.',
     'Tabuk', 'Saudi Arabia', 'SA', FALSE, 'onsite',
     5000, 8000, TRUE, 'active', CURRENT_DATE - 7,
     1, 'bachelor', ARRAY[]::TEXT[], ARRAY['eng'], 72,
     'Laila Hassan', 65);

  -- Job skills
  INSERT INTO job_skills (job_id, skill_name, normalized_name, is_required, years_required) VALUES
    (job1_id, 'Product Management',  'product management', TRUE,  5),
    (job1_id, 'Roadmap Planning',    'roadmap planning',   TRUE,  3),
    (job1_id, 'Agile / Scrum',       'agile',              TRUE,  2),
    (job1_id, 'Data Analysis',       'data analysis',      FALSE, NULL),
    (job1_id, 'SQL',                 'sql',                FALSE, NULL),
    (job2_id, 'React',               'react',              TRUE,  2),
    (job2_id, 'Node.js',             'nodejs',             TRUE,  2),
    (job2_id, 'PostgreSQL',          'postgresql',         TRUE,  1),
    (job2_id, 'TypeScript',          'typescript',         TRUE,  1),
    (job2_id, 'AWS',                 'aws',                FALSE, NULL),
    (job2_id, 'Docker',              'docker',             FALSE, NULL),
    (job3_id, 'Python',              'python',             TRUE,  1),
    (job3_id, 'SQL',                 'sql',                TRUE,  1),
    (job3_id, 'Power BI',            'power bi',           FALSE, NULL),
    (job3_id, 'Data Visualization',  'data visualization', FALSE, NULL);

  -- Demo candidate
  INSERT INTO candidates (id, full_name, headline, summary,
    location_city, location_country, location_country_code,
    willing_to_relocate, remote_preference, years_of_experience, seniority_level,
    expected_salary_min_usd, expected_salary_max_usd, is_open_to_work, profile_completeness)
  VALUES (cand_id,
    'Rami Ajib',
    'Senior Product Manager | 8 yrs GCC experience',
    'Product leader with 8 years building digital products in the Gulf region. Strong background in oil & gas tech, agile delivery, and cross-functional team leadership.',
    'Dubai', 'United Arab Emirates', 'AE',
    TRUE, 'hybrid', 8, 'senior',
    10000, 16000, TRUE, 82);

  INSERT INTO experiences (candidate_id, company_name, title, industry, start_date, end_date, is_current, is_gcc_experience,
    description, skills_used) VALUES
    (cand_id, 'ADNOC Digital', 'Product Manager', 'Oil & Gas', '2020-01-01', NULL, TRUE, TRUE,
     'Led digital product strategy for upstream operations platform serving 4,000 engineers.',
     ARRAY['Product Management','Agile','SQL','Data Analysis','Stakeholder Management']),
    (cand_id, 'Majid Al Futtaim', 'Associate Product Manager', 'Retail Technology', '2017-06-01', '2019-12-01', FALSE, TRUE,
     'Built internal tooling for retail analytics, reducing reporting time by 60%.',
     ARRAY['Product Management','SQL','Python','Roadmap Planning']);

  INSERT INTO skills (candidate_id, name, normalized_name, category, proficiency_level, years_experience, is_primary) VALUES
    (cand_id, 'Product Management', 'product management', 'domain',    'expert',        8,    TRUE),
    (cand_id, 'Agile / Scrum',      'agile',              'methodology','advanced',      6,    TRUE),
    (cand_id, 'SQL',                'sql',                'technical', 'advanced',      5,    TRUE),
    (cand_id, 'Data Analysis',      'data analysis',      'technical', 'intermediate',  4,    FALSE),
    (cand_id, 'Roadmap Planning',   'roadmap planning',   'domain',    'expert',        7,    TRUE),
    (cand_id, 'Python',             'python',             'technical', 'beginner',      1,    FALSE),
    (cand_id, 'Stakeholder Mgmt',   'stakeholder management','soft',   'advanced',      6,    FALSE);

  INSERT INTO languages (candidate_id, language, language_code, proficiency) VALUES
    (cand_id, 'Arabic',  'ara', 'native'),
    (cand_id, 'English', 'eng', 'fluent');

  INSERT INTO education (candidate_id, institution, degree, degree_level, field_of_study, start_date, end_date) VALUES
    (cand_id, 'American University of Beirut', 'Bachelor of Engineering', 'bachelor', 'Computer & Communications Engineering', '2013-09-01', '2017-06-01');

END $$;
