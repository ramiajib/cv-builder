import type { TrustResult, TrustSignal } from '../matching/types';
import type { JobProfile } from '../supabase/types';

export interface JobTrustInputs {
  company_is_verified: boolean;
  company_total_hires: number;
  recruiter_is_verified: boolean;
  recruiter_trust_score: number;         // 0–100
  recruiter_response_rate: number;       // 0.0–1.0
  recruiter_ghost_rate: number;          // 0.0–1.0
  recruiter_successful_hires: number;
  days_since_posted: number;
  is_salary_disclosed: boolean;
  submitted_by_reputation: number;       // 0–100
  has_application_url: boolean;
}

// ─────────────────────────────────────────────────────────────
// JOB TRUST SCORE
// ─────────────────────────────────────────────────────────────
export function computeJobTrustScore(inputs: JobTrustInputs): TrustResult {
  let score = 0;
  const signals: TrustSignal[] = [];

  // Company verification — 25 pts
  if (inputs.company_is_verified) {
    score += 25;
    signals.push({ label: 'Verified company', positive: true, icon: 'check' });
  } else {
    score += 5;
    signals.push({ label: 'Company not yet verified', positive: false, icon: 'warning' });
  }

  // Company hiring track record — up to 8 pts
  if (inputs.company_total_hires >= 5) {
    const bonus = Math.min(8, inputs.company_total_hires);
    score += bonus;
    signals.push({
      label: `${inputs.company_total_hires} confirmed hires`,
      positive: true,
      icon: 'check',
    });
  }

  // Recruiter verification — 15 pts
  if (inputs.recruiter_is_verified) {
    score += 15;
    signals.push({ label: 'Verified recruiter', positive: true, icon: 'check' });
  }

  // Recruiter response rate — up to 10 pts
  if (inputs.recruiter_response_rate > 0) {
    const bonus = Math.round(inputs.recruiter_response_rate * 10);
    score += bonus;
    if (inputs.recruiter_response_rate >= 0.7) {
      signals.push({
        label: `${Math.round(inputs.recruiter_response_rate * 100)}% response rate`,
        positive: true,
        icon: 'check',
      });
    } else if (inputs.recruiter_response_rate < 0.4) {
      signals.push({
        label: `Low response rate (${Math.round(inputs.recruiter_response_rate * 100)}%)`,
        positive: false,
        icon: 'warning',
      });
    }
  }

  // Recruiter successful hires — up to 10 pts
  if (inputs.recruiter_successful_hires > 0) {
    const bonus = Math.min(10, inputs.recruiter_successful_hires * 2);
    score += bonus;
    signals.push({
      label: `${inputs.recruiter_successful_hires} hire${inputs.recruiter_successful_hires > 1 ? 's' : ''} via this recruiter`,
      positive: true,
      icon: 'check',
    });
  }

  // Community submitter reputation — up to 12 pts
  score += Math.round((inputs.submitted_by_reputation / 100) * 12);

  // Job freshness — up to 10 pts (linear decay over 30 days)
  const freshness = Math.max(0, 1 - inputs.days_since_posted / 30);
  score += Math.round(freshness * 10);
  if (inputs.days_since_posted <= 7) {
    signals.push({
      label: `Posted ${inputs.days_since_posted === 0 ? 'today' : `${inputs.days_since_posted}d ago`}`,
      positive: true,
      icon: 'check',
    });
  } else if (inputs.days_since_posted > 21) {
    signals.push({
      label: `Posted ${inputs.days_since_posted} days ago`,
      positive: false,
      icon: 'warning',
    });
  }

  // Salary transparency — 5 pts
  if (inputs.is_salary_disclosed) {
    score += 5;
    signals.push({ label: 'Salary disclosed', positive: true, icon: 'check' });
  }

  // Application URL present — 5 pts
  if (inputs.has_application_url) {
    score += 5;
  } else {
    signals.push({ label: 'No direct apply link', positive: false, icon: 'info' });
  }

  // Ghost rate penalty — up to −15 pts
  const ghostPenalty = Math.round(inputs.recruiter_ghost_rate * 15);
  score -= ghostPenalty;
  if (inputs.recruiter_ghost_rate > 0.3) {
    signals.push({
      label: `${Math.round(inputs.recruiter_ghost_rate * 100)}% ghosting rate`,
      positive: false,
      icon: 'warning',
    });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const tier: 'high' | 'medium' | 'low' =
    finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low';

  const explanation =
    finalScore >= 80
      ? 'Strong trust signals — verified company and recruiter with a proven hiring track record.'
      : finalScore >= 60
        ? 'Moderate trust signals. Legitimate posting with some unverified details.'
        : 'Limited trust signals available. Verify the role directly before investing time in applications.';

  return { score: finalScore, tier, signals, explanation };
}

// ─────────────────────────────────────────────────────────────
// BUILD INPUTS FROM DB OBJECTS
// ─────────────────────────────────────────────────────────────
export function buildJobTrustInputs(job: JobProfile): JobTrustInputs {
  const now = new Date();
  const posted = new Date(job.posted_date);
  const days = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));

  return {
    company_is_verified:       job.company?.is_verified ?? false,
    company_total_hires:       job.company?.total_hires_confirmed ?? 0,
    recruiter_is_verified:     job.recruiter?.is_verified ?? false,
    recruiter_trust_score:     job.recruiter?.trust_score ?? 50,
    recruiter_response_rate:   job.recruiter?.response_rate ?? 0.5,
    recruiter_ghost_rate:      job.recruiter?.ghost_rate ?? 0,
    recruiter_successful_hires: job.recruiter?.successful_hires ?? 0,
    days_since_posted:         days,
    is_salary_disclosed:       job.salary_disclosed,
    submitted_by_reputation:   job.submitted_by_reputation ?? 50,
    has_application_url:       !!job.application_url,
  };
}
