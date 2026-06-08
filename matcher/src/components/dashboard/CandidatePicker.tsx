'use client';

import { useState } from 'react';

interface Candidate {
  id: string;
  full_name: string;
  headline: string | null;
  location_city: string | null;
  location_country: string | null;
  profile_completeness: number | null;
  skills: { name: string }[];
}

export function CandidatePicker({ candidates }: { candidates: Candidate[] }) {
  const [q, setQ] = useState('');

  const filtered = q.trim()
    ? candidates.filter(c =>
        c.full_name.toLowerCase().includes(q.toLowerCase()) ||
        c.headline?.toLowerCase().includes(q.toLowerCase()) ||
        c.location_country?.toLowerCase().includes(q.toLowerCase())
      )
    : candidates;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search candidates by name, title, or country…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {q && (
          <button onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            ✕
          </button>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">
        {filtered.length} of {candidates.length} candidates
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(c => {
          const pct = c.profile_completeness ?? 0;
          const topSkills = c.skills.slice(0, 3).map(s => s.name);

          return (
            <a
              key={c.id}
              href={`/dashboard?candidate_id=${c.id}`}
              className="bg-white rounded-2xl border border-gray-200 p-4
                         hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              {/* Avatar + name */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500
                                flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {c.full_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate
                                  group-hover:text-blue-600 transition-colors">
                    {c.full_name}
                  </div>
                  {c.headline && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">{c.headline}</div>
                  )}
                  {(c.location_city || c.location_country) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[c.location_city, c.location_country].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Skills */}
              {topSkills.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {topSkills.map(s => (
                    <span key={s}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {s}
                    </span>
                  ))}
                  {c.skills.length > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      +{c.skills.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Completeness bar */}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">Profile completeness</span>
                  <span className={`text-xs font-medium
                    ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all
                      ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-blue-500 mt-3 group-hover:translate-x-1 transition-transform">
                View matches →
              </div>
            </a>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
          No candidates match "{q}"
        </div>
      )}
    </div>
  );
}
