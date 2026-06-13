# CV Builder | مساعد السيرة الذاتية

A free, friendly CV builder that helps everyday job seekers in the GULF create a clean, **ATS-friendly** resume — one simple question at a time. No experience or technical knowledge needed.

### 🔗 Use it now: **[carmyne-cv-builder.netlify.app](https://carmyne-cv-builder.netlify.app/)**

---

## What it does

- **Guided, one-question-at-a-time** chat flow — designed for non-technical users on a mobile phone.
- **Bilingual** — works in English and العربية.
- Turns plain, messy answers (even voice-note transcriptions) into polished, professional English.
- Produces an **ATS-friendly CV**: single column, no tables or graphics, standard headings — so it passes employer scanning systems.
- Built with GULF job seekers in mind (visa status, GCC licences, common trades and service roles).
- **Privacy-first**: never asks for passport, ID, bank details, date of birth, or a photo.

## Who it's for

Drivers, cleaners, security guards, helpers, receptionists, salespeople, technicians, admins, trades workers — anyone who needs a clean CV without the hassle.

## How to use

1. Open **[carmyne-cv-builder.netlify.app](https://carmyne-cv-builder.netlify.app/)**.
2. Pick your language (English / العربية).
3. Answer the simple questions — short words are fine.
4. Download your finished CV and send it to employers.

---

## The Matcher — AI-Powered Job Matching

The `matcher/` subfolder is a companion **Next.js 14** application called **JobMatch**. It extends the CV Builder concept: instead of just building a CV, it matches a candidate's full profile against real job listings using a multi-dimensional AI scoring engine.

### What problem it solves

GULF job seekers — particularly blue-collar and mid-level workers — face two problems beyond a bad CV:

1. **Irrelevant applications.** They send the same CV to everything and get no responses.
2. **Fraudulent job posts.** Ghost jobs, fake recruiters, and bait-and-switch offers are rampant in the region.

JobMatch surfaces only jobs above 50% match (ranked best-first) and assigns every job a **trust score** — a concrete, explainable signal of how legitimate the posting is.

### Match scoring engine

Each candidate–job pair is scored across multiple dimensions:

| Dimension | Logic |
|-----------|-------|
| **Skills** | Required skills carry 80% of the skills score; optional/nice-to-have skills carry 20%. Falls back to text-based overlap when no structured skills exist. |
| **Experience** | Years of experience and seniority level matched against job requirements. |
| **Education** | Degree rank compared with GCC-aware calibration. |
| **Location / GCC** | Candidate's current location vs. job geography. |
| **Languages** | Candidate language profile matched against job language requirements. |

Match results are cached in Supabase (`match_results` table) with `expires_at` and `is_stale` fields to avoid redundant OpenAI calls.

### Job trust score

Every job receives a trust score (0–100) built from:

- **Company verification** — 25 pts if the company is verified
- **Hiring track record** — up to 8 pts based on confirmed historical hires
- **Recruiter signals** — verified status, response rate, ghost rate, successful hire count
- **Job transparency** — salary disclosed, has application URL, days since posted
- **Submitter reputation** — score of whoever added the job to the platform

This gives candidates a single, actionable number to guide their effort.

### Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase (PostgreSQL) |
| AI | OpenAI API |
| Deployment | Netlify (`@netlify/plugin-nextjs`) |
| Dev port | 3001 (`npm run dev`) |

### Supabase schema

Core tables: `candidates`, `skills`, `experiences`, `education`, `certifications`, `languages`, `candidate_preferences`, `jobs`, `companies`, `recruiters`, `job_skills`, `match_results`

### Application routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Candidate view — ranked job matches with scores and trust indicators |
| `/jobs` | Browse all available jobs |
| `/match` | Detailed match breakdown for a specific job |
| `/recruiter` | Recruiter-facing view of candidate matches |
| `/setup` | Onboarding / environment check |

### Demo mode

The app works without authentication. When Supabase environment variables are absent, it falls back to a seed candidate so the matching engine can be tested end-to-end.

### Running locally

```bash
cd matcher
npm install
npm run dev   # starts on http://localhost:3001
```

Required environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`

---

## Project structure

| File / Folder | Description |
|---------------|-------------|
| [`cv-builder.html`](cv-builder.html) | The CV Builder — a single self-contained HTML file. |
| [`matcher/`](matcher/) | The JobMatch companion app — Next.js 14, Supabase, OpenAI. |
| [`netlify.toml`](netlify.toml) | Netlify deployment config for the CV Builder. |
| [`CV's/`](CV's/) | Sample CVs generated during testing. |

## License

Free to use. Contributions and suggestions welcome.
