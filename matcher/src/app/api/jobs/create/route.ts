import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServiceClient();

  const {
    title, company_name, location_city, location_country, location_country_code,
    seniority_level, employment_type, remote_policy, industry, department,
    description, salary_min_usd, salary_max_usd, salary_disclosed,
    application_url, ai_min_years_exp, required_languages,
    required_skills, preferred_skills,
  } = body;

  if (!title || !company_name || !description) {
    return NextResponse.json({ error: 'title, company_name, description are required' }, { status: 400 });
  }

  // Find or create company
  const normalizedName = company_name.toLowerCase().trim();
  let companyId: string;

  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .ilike('normalized_name', normalizedName)
    .limit(1)
    .single();

  if (existing) {
    companyId = existing.id;
  } else {
    const { data: newCompany, error: compErr } = await supabase
      .from('companies')
      .insert({ name: company_name.trim(), normalized_name: normalizedName, country: location_country ?? null })
      .select('id')
      .single();
    if (compErr || !newCompany) return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    companyId = newCompany.id;
  }

  // Build trust score heuristic from completeness
  const trust = 50
    + (salary_disclosed ? 5 : 0)
    + (application_url ? 5 : 0)
    + (ai_min_years_exp ? 3 : 0)
    + (required_skills?.length > 0 ? 5 : 0);

  // Insert job
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .insert({
      company_id: companyId,
      title: title.trim(),
      normalized_title: title.toLowerCase().trim(),
      seniority_level: seniority_level || null,
      employment_type: employment_type || 'full_time',
      industry: industry || null,
      department: department || null,
      description: description.trim(),
      location_city: location_city || null,
      location_country: location_country || null,
      location_country_code: location_country_code || null,
      is_remote: remote_policy === 'remote',
      remote_policy: remote_policy || 'onsite',
      salary_min_usd: salary_min_usd || null,
      salary_max_usd: salary_max_usd || null,
      salary_disclosed: salary_disclosed ?? false,
      application_url: application_url || null,
      ai_min_years_exp: ai_min_years_exp || null,
      required_languages: required_languages ?? [],
      ai_extracted_skills: [...(required_skills ?? []), ...(preferred_skills ?? [])],
      status: 'active',
      trust_score: Math.min(trust, 75),
      posted_date: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    console.error(jobErr);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }

  // Insert skills
  const skillRows = [
    ...(required_skills ?? []).map((s: string) => ({
      job_id: job.id,
      skill_name: s.trim(),
      normalized_name: s.toLowerCase().trim(),
      is_required: true,
    })),
    ...(preferred_skills ?? []).map((s: string) => ({
      job_id: job.id,
      skill_name: s.trim(),
      normalized_name: s.toLowerCase().trim(),
      is_required: false,
    })),
  ].filter(r => r.skill_name.length > 0);

  if (skillRows.length > 0) {
    await supabase.from('job_skills').insert(skillRows);
  }

  return NextResponse.json({ id: job.id });
}
