'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const GCC_COUNTRIES = [
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Bahrain', code: 'BH' },
  { name: 'Oman', code: 'OM' },
  { name: 'Lebanon', code: 'LB' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Egypt', code: 'EG' },
  { name: 'Other', code: '' },
];

function TagInput({ label, tags, onChange, placeholder }: {
  label: string; tags: string[]; onChange: (t: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {tags.map(t => (
          <span key={t} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700
                                   border border-blue-200 rounded-full px-2.5 py-1">
            {t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}
              className="text-blue-400 hover:text-blue-700 font-bold">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={add}
          className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600">
          Add
        </button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const selectCls = inputCls + ' bg-white';

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [extracting, setExtracting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Saudi Arabia');
  const [countryCode, setCountryCode] = useState('SA');
  const [seniority, setSeniority] = useState('');
  const [empType, setEmpType] = useState('full_time');
  const [remotePolicy, setRemotePolicy] = useState('onsite');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryDisclosed, setSalaryDisclosed] = useState(true);
  const [applyUrl, setApplyUrl] = useState('');
  const [minYears, setMinYears] = useState('');
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [preferredSkills, setPreferredSkills] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);

  // AI extraction from description
  async function extractFromDescription() {
    if (!description.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch('/api/jobs/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title && !title) setTitle(data.title);
        if (data.seniority) setSeniority(data.seniority);
        if (data.required_skills?.length) setRequiredSkills(data.required_skills);
        if (data.preferred_skills?.length) setPreferredSkills(data.preferred_skills);
        if (data.min_years_exp) setMinYears(String(data.min_years_exp));
        if (data.required_languages?.length) setLangs(data.required_languages);
        if (data.industry) setIndustry(data.industry);
      }
    } catch { /* no AI key — silently skip */ }
    setExtracting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !companyName || !description) {
      setError('Title, company, and description are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, company_name: companyName,
          location_city: city, location_country: country, location_country_code: countryCode,
          seniority_level: seniority || undefined,
          employment_type: empType, remote_policy: remotePolicy,
          industry: industry || undefined,
          description,
          salary_min_usd: salaryMin ? parseInt(salaryMin) : undefined,
          salary_max_usd: salaryMax ? parseInt(salaryMax) : undefined,
          salary_disclosed: salaryDisclosed,
          application_url: applyUrl || undefined,
          ai_min_years_exp: minYears ? parseFloat(minYears) : undefined,
          required_skills: requiredSkills,
          preferred_skills: preferredSkills,
          required_languages: langs,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save job.'); setSaving(false); return; }
      router.push(`/recruiter/jobs/${data.id}`);
    } catch (err) {
      setError('Network error. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/recruiter" className="text-sm text-gray-500 hover:text-gray-900">← Back</a>
        <h1 className="text-2xl font-bold text-gray-900">Post a Job</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* JD paste + AI extract */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-blue-900">Paste job description</h2>
              <p className="text-xs text-blue-600 mt-0.5">Start here — paste the full JD and we'll extract the fields below</p>
            </div>
            <button
              type="button"
              onClick={extractFromDescription}
              disabled={extracting || !description}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {extracting ? 'Extracting…' : '✨ Extract fields'}
            </button>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={6}
            placeholder="Paste the full job description here…"
            className="w-full text-sm border border-blue-200 rounded-xl px-3 py-2 bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="text-xs text-blue-500">✨ Extract with AI requires OPENAI_API_KEY in .env.local</p>
        </div>

        {/* Core fields */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Job details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Job Title" required>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Senior Product Manager" className={inputCls} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Company Name" required>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Saudi Aramco" className={inputCls} />
              </Field>
            </div>
            <Field label="City">
              <input value={city} onChange={e => setCity(e.target.value)}
                placeholder="e.g. Riyadh" className={inputCls} />
            </Field>
            <Field label="Country">
              <select value={countryCode} onChange={e => {
                const opt = GCC_COUNTRIES.find(c => c.code === e.target.value);
                setCountryCode(e.target.value);
                setCountry(opt?.name ?? '');
              }} className={selectCls}>
                {GCC_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Seniority">
              <select value={seniority} onChange={e => setSeniority(e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {['intern','junior','mid','senior','lead','manager','director','vp','executive']
                  .map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={empType} onChange={e => setEmpType(e.target.value)} className={selectCls}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="freelance">Freelance</option>
                <option value="internship">Internship</option>
              </select>
            </Field>
            <Field label="Remote">
              <select value={remotePolicy} onChange={e => setRemotePolicy(e.target.value)} className={selectCls}>
                <option value="onsite">On-site</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="flexible">Flexible</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Industry">
              <input value={industry} onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. Oil & Gas" className={inputCls} />
            </Field>
            <Field label="Min. years experience">
              <input type="number" value={minYears} onChange={e => setMinYears(e.target.value)}
                placeholder="e.g. 5" min="0" max="30" className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Salary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Salary (USD / month)</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={salaryDisclosed}
                onChange={e => setSalaryDisclosed(e.target.checked)}
                className="rounded" />
              Disclose salary
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Minimum">
              <input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)}
                placeholder="e.g. 8000" className={inputCls} />
            </Field>
            <Field label="Maximum">
              <input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)}
                placeholder="e.g. 14000" className={inputCls} />
            </Field>
          </div>
          <Field label="Apply link">
            <input value={applyUrl} onChange={e => setApplyUrl(e.target.value)}
              placeholder="https://..." className={inputCls} />
          </Field>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Skills &amp; languages</h2>
          <TagInput label="Required skills" tags={requiredSkills} onChange={setRequiredSkills}
            placeholder="Type a skill and press Enter" />
          <TagInput label="Preferred skills" tags={preferredSkills} onChange={setPreferredSkills}
            placeholder="Type a skill and press Enter" />
          <TagInput label="Required languages (e.g. Arabic, English)" tags={langs} onChange={setLangs}
            placeholder="Type a language and press Enter" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl
                     hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Post job & rank candidates'}
        </button>
      </form>
    </div>
  );
}
