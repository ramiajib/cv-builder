'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface Props {
  q: string;
  country: string;
  industry: string;
  countries: { code: string; name: string }[];
  industries: string[];
}

export function JobFilters({ q: initialQ, country: initialCountry, industry: initialIndustry, countries, industries }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(initialQ);

  function buildUrl(overrides: Partial<{ q: string; country: string; industry: string }>) {
    const merged = { q, country: initialCountry, industry: initialIndustry, ...overrides };
    const params = new URLSearchParams();
    if (merged.q)       params.set('q', merged.q);
    if (merged.country) params.set('country', merged.country);
    if (merged.industry) params.set('industry', merged.industry);
    const qs = params.toString();
    return qs ? `/recruiter?${qs}` : '/recruiter';
  }

  function go(overrides: Partial<{ q: string; country: string; industry: string }>) {
    startTransition(() => router.push(buildUrl(overrides)));
  }

  const hasFilters = !!initialQ || !!initialCountry || !!initialIndustry;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') go({ q }); }}
          onBlur={() => { if (q !== initialQ) go({ q }); }}
          placeholder="Search job titles…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Country */}
      <select
        value={initialCountry}
        onChange={e => go({ country: e.target.value, q })}
        className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All countries</option>
        {countries.map(c => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>

      {/* Industry */}
      <select
        value={initialIndustry}
        onChange={e => go({ industry: e.target.value, q })}
        className="text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All industries</option>
        {industries.map(ind => (
          <option key={ind} value={ind}>{ind}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => { setQ(''); startTransition(() => router.push('/recruiter')); }}
          className="text-sm text-gray-500 hover:text-gray-800 px-2 transition-colors"
        >
          ✕ Clear
        </button>
      )}

      {/* Spinner */}
      {isPending && (
        <svg className="w-4 h-4 animate-spin text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
        </svg>
      )}
    </div>
  );
}
