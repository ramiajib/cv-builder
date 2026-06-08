import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { computeJobTrustScore, buildJobTrustInputs } from '@/lib/trust/calculator';
import { ImportJobsButton } from '@/components/recruiter/ImportJobsButton';
import { JobFilters } from '@/components/recruiter/JobFilters';
import type { JobProfile } from '@/lib/supabase/types';

const PAGE_SIZE = 50;

export default async function RecruiterPage({
  searchParams,
}: {
  searchParams: { q?: string; country?: string; industry?: string; page?: string };
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://your-project.supabase.co'
  ) {
    redirect('/setup');
  }

  const q        = searchParams.q?.trim()       ?? '';
  const country  = searchParams.country?.trim() ?? '';
  const industry = searchParams.industry?.trim() ?? '';
  const page     = Math.max(1, parseInt(searchParams.page ?? '1'));
  const offset   = (page - 1) * PAGE_SIZE;

  const supabase = createServiceClient();

  // ── Jobs query (filtered + paginated) ────────────────────────────────────
  let jobQuery = supabase
    .from('jobs')
    .select('*, company:companies(*), recruiter:recruiters(*), job_skills(*)', { count: 'exact' })
    .eq('status', 'active')
    .order('trust_score', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (q)        jobQuery = jobQuery.ilike('title', `%${q}%`);
  if (country)  jobQuery = jobQuery.eq('location_country_code', country);
  if (industry) jobQuery = jobQuery.eq('industry', industry);

  // ── Filter option lookups + candidate count ───────────────────────────────
  const [
    { data: jobs, count: totalCount },
    { data: countryRows },
    { data: industryRows },
    { count: candidateCount },
  ] = await Promise.all([
    jobQuery,
    supabase
      .from('jobs')
      .select('location_country_code, location_country')
      .eq('status', 'active')
      .not('location_country_code', 'is', null)
      .order('location_country'),
    supabase
      .from('jobs')
      .select('industry')
      .eq('status', 'active')
      .not('industry', 'is', null)
      .order('industry'),
    supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true }),
  ]);

  const totalJobs  = totalCount ?? 0;
  const totalPages = Math.ceil(totalJobs / PAGE_SIZE);
  const candidates = candidateCount ?? 0;

  // Deduplicate country/industry options
  const countryMap = new Map<string, string>();
  for (const r of countryRows ?? []) {
    if (r.location_country_code && r.location_country)
      countryMap.set(r.location_country_code, r.location_country);
  }
  const countries = Array.from(countryMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const industries = [...new Set((industryRows ?? []).map((r: any) => r.industry as string))]
    .filter(Boolean)
    .sort();

  // ── Pagination URL helper ─────────────────────────────────────────────────
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q)        params.set('q', q);
    if (country)  params.set('country', country);
    if (industry) params.set('industry', industry);
    if (p > 1)    params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/recruiter?${qs}` : '/recruiter';
  }

  const hasFilters = !!(q || country || industry);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruiter View</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Select a job to see candidates ranked by match score
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportJobsButton />
          <a
            href="/recruiter/jobs/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl
                       hover:bg-blue-700 transition-colors"
          >
            + Post a job
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-3xl font-bold text-blue-600">
            {hasFilters ? totalJobs.toLocaleString() : totalJobs.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {hasFilters ? 'Matching jobs' : 'Active jobs'}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-3xl font-bold text-green-600">{candidates}</div>
          <div className="text-xs text-gray-500 mt-1">Candidates in pool</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-3xl font-bold text-purple-600">
            {(totalJobs * candidates).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Possible matches</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <JobFilters
          q={q}
          country={country}
          industry={industry}
          countries={countries}
          industries={industries}
        />
      </div>

      {/* Job list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {hasFilters
              ? `${totalJobs.toLocaleString()} result${totalJobs !== 1 ? 's' : ''}`
              : 'Choose a job to rank candidates'}
          </h2>
          {totalPages > 1 && (
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
          )}
        </div>

        {(jobs ?? []).length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            No jobs match your filters.
          </div>
        )}

        {(jobs ?? []).map(j => {
          const job = j as unknown as JobProfile;
          const trust = computeJobTrustScore(buildJobTrustInputs(job));
          return (
            <a
              key={job.id}
              href={`/recruiter/jobs/${job.id}`}
              className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-5
                         hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              {/* Trust indicator */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm
                  ${trust.tier === 'high'   ? 'bg-green-100 text-green-700' :
                    trust.tier === 'medium' ? 'bg-amber-100 text-amber-700' :
                                              'bg-gray-100 text-gray-500'}`}
              >
                {trust.score}
              </div>

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                  {job.title}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {(job as any).company?.name}
                  {job.location_city ? ` · ${job.location_city}` : ''}
                  {job.location_country ? `, ${job.location_country}` : ''}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {job.industry && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      {job.industry}
                    </span>
                  )}
                  {job.seniority_level && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                      {job.seniority_level}
                    </span>
                  )}
                  {(job as any).job_skills?.slice(0, 3).map((s: any) => (
                    <span
                      key={s.id}
                      className={`text-xs px-2 py-0.5 rounded-full
                        ${s.is_required ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {s.skill_name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right side */}
              <div className="text-right shrink-0">
                {job.salary_disclosed && job.salary_min_usd ? (
                  <div className="text-sm font-medium text-gray-700">
                    ${(job.salary_min_usd / 1000).toFixed(0)}–
                    {((job.salary_max_usd ?? 0) / 1000).toFixed(0)}k
                    <span className="text-gray-400 font-normal"> /mo</span>
                  </div>
                ) : null}
                {job.ai_min_years_exp ? (
                  <div className="text-xs text-gray-400 mt-1">
                    {job.ai_min_years_exp}+ yrs exp
                  </div>
                ) : null}
                <div className="text-blue-500 mt-2 text-sm group-hover:translate-x-1 transition-transform">
                  View candidates →
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <a
              href={pageUrl(page - 1)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ← Prev
            </a>
          )}

          {/* Page window: show at most 7 pages around current */}
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 3, totalPages - 6));
            return start + i;
          }).map(p => (
            <a
              key={p}
              href={pageUrl(p)}
              className={`w-9 h-9 flex items-center justify-center text-sm rounded-xl border transition-colors
                ${p === page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'}`}
            >
              {p}
            </a>
          ))}

          {page < totalPages && (
            <a
              href={pageUrl(page + 1)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
