'use client';

import { useState } from 'react';

export function ImportJobsButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  async function run() {
    setState('loading');
    try {
      const res = await fetch('/api/admin/import-google-jobs', { method: 'POST' });
      const data = await res.json();
      if (res.ok) { setResult(data); setState('done'); window.location.reload(); }
      else { setState('error'); }
    } catch { setState('error'); }
  }

  if (state === 'loading') return (
    <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 text-sm rounded-xl">
      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
      </svg>
      Importing…
    </button>
  );

  if (state === 'done' && result) return (
    <span className="text-sm text-green-600 font-medium">
      ✓ {result.inserted} jobs imported
    </span>
  );

  if (state === 'error') return (
    <button onClick={run} className="px-4 py-2 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200">
      Retry import
    </button>
  );

  return (
    <button onClick={run}
      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200
                 text-gray-700 text-sm font-medium rounded-xl transition-colors">
      ↻ Sync Google Sheet
    </button>
  );
}
