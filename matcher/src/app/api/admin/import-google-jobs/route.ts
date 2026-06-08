import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1MCviRyX_xOeHOxklaTFj4E3MTdH-xQxUI0oZrIwh4qQ/export?format=csv&gid=0';

// ── CSV parser (handles quoted fields with commas AND newlines inside) ──────
function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  const s = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  let fields: string[] = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (inQuote && s[i + 1] === '"') { cur += '"'; i++; }  // escaped quote
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(cur.trim()); cur = '';
    } else if (ch === '\n' && !inQuote) {
      // End of row — only emit if at least one field is non-empty
      fields.push(cur.trim()); cur = '';
      if (fields.some(f => f.length > 0)) rows.push(fields);
      fields = [];
    } else {
      cur += ch;  // also preserves \n inside quoted fields
    }
  }
  // trailing row with no final newline
  fields.push(cur.trim());
  if (fields.some(f => f.length > 0)) rows.push(fields);

  return rows;
}

// ── Location → country/code ────────────────────────────────────────────────
function parseLocation(loc: string): { city: string | null; country: string | null; code: string | null } {
  const l = loc.toLowerCase();
  let country: string | null = null;
  let code: string | null = null;

  if (l.includes('saudi') || l.includes('ksa') || l.includes('riyadh') || l.includes('jeddah') ||
      l.includes('dammam') || l.includes('makkah') || l.includes('madinah') || l.includes('medina') ||
      l.includes('khobar') || l.includes('jubail') || l.includes('tabuk') || l.includes('abha') ||
      l.includes('buraidah') || l.includes('arar') || l.includes('al baha') || l.includes('qassim')) {
    country = 'Saudi Arabia'; code = 'SA';
  } else if (l.includes('dubai') || l.includes('abu dhabi') || l.includes('sharjah') || l.includes('uae')) {
    country = 'United Arab Emirates'; code = 'AE';
  } else if (l.includes('qatar') || l.includes('doha')) {
    country = 'Qatar'; code = 'QA';
  } else if (l.includes('kuwait')) {
    country = 'Kuwait'; code = 'KW';
  } else if (l.includes('bahrain') || l.includes('manama')) {
    country = 'Bahrain'; code = 'BH';
  } else if (l.includes('oman') || l.includes('muscat')) {
    country = 'Oman'; code = 'OM';
  } else if (l.includes('lebanon') || l.includes('beirut') || l.includes('achrafieh')) {
    country = 'Lebanon'; code = 'LB';
  } else if (l.includes('jordan') || l.includes('amman')) {
    country = 'Jordan'; code = 'JO';
  } else if (l.includes('morocco') || l.includes('casablanca')) {
    country = 'Morocco'; code = 'MA';
  } else if (l.includes('nigeria') || l.includes('lagos')) {
    country = 'Nigeria'; code = 'NG';
  } else if (l.includes('uk') || l.includes('cambridge') || l.includes('london')) {
    country = 'United Kingdom'; code = 'GB';
  }

  // Extract city: take first part before comma
  const parts = loc.split(',');
  let city = parts[0].trim() || null;
  // Clean up generic country-only values
  if (city && ['ksa', 'uae', 'saudi arabia', 'unspecified'].includes(city.toLowerCase())) city = null;

  return { city, country, code };
}

// ── Guess seniority from description ──────────────────────────────────────
function guessSeniority(title: string, desc: string): string | null {
  const t = (title + ' ' + desc).toLowerCase();
  if (t.includes('vp ') || t.includes('vice president')) return 'vp';
  if (t.includes('director')) return 'director';
  if (t.includes('head of') || t.includes('head,')) return 'director';
  if (t.includes('senior') || t.includes('sr.') || t.includes('lead')) return 'senior';
  if (t.includes('manager')) return 'manager';
  if (t.includes('junior') || t.includes('fresh graduate') || t.includes('entry-level')) return 'junior';
  if (t.includes('intern')) return 'intern';
  return 'mid';
}

// ── Guess min years from description ──────────────────────────────────────
function guessMinYears(desc: string): number | null {
  const patterns = [
    /(\d+)\+\s*years?\s+of\s+experience/i,
    /minimum\s+(\d+)\s+years?/i,
    /(\d+)\s*[–-]\s*(\d+)\s*years?/i,
    /(\d+)\s*years?\s+of\s+experience/i,
    /(\d+)\s*yrs?\s+exp/i,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return parseInt(m[1]);
  }
  return null;
}

// ── Guess industry from title/description ─────────────────────────────────
function guessIndustry(title: string, desc: string): string | null {
  const t = (title + ' ' + desc).toLowerCase();
  if (t.includes('oil') || t.includes('gas') || t.includes('petroleum') || t.includes('aramco')) return 'Oil & Gas';
  if (t.includes('construction') || t.includes('civil') || t.includes('architect') || t.includes('fit-out')) return 'Construction';
  if (t.includes('real estate') || t.includes('property') || t.includes('development')) return 'Real Estate';
  if (t.includes('software') || t.includes('java') || t.includes('python') || t.includes('data scien') || t.includes('ai ') || t.includes('cloud') || t.includes('cyber') || t.includes('it ') || t.includes('tech')) return 'Technology';
  if (t.includes('sales') || t.includes('account manager') || t.includes('business development')) return 'Sales';
  if (t.includes('marketing') || t.includes('pr ') || t.includes('content') || t.includes('social media')) return 'Marketing';
  if (t.includes('finance') || t.includes('account') || t.includes('audit') || t.includes('banking')) return 'Finance & Banking';
  if (t.includes('hospitality') || t.includes('hotel') || t.includes('restaurant') || t.includes('f&b') || t.includes('food')) return 'Hospitality';
  if (t.includes('medical') || t.includes('nursing') || t.includes('health') || t.includes('clinical') || t.includes('hospital')) return 'Healthcare';
  if (t.includes('logistics') || t.includes('supply chain') || t.includes('warehouse') || t.includes('freight')) return 'Logistics';
  if (t.includes('legal') || t.includes('law') || t.includes('governance')) return 'Legal';
  if (t.includes('hr') || t.includes('talent') || t.includes('recruitment')) return 'Human Resources';
  if (t.includes('education') || t.includes('teacher') || t.includes('training')) return 'Education';
  if (t.includes('engineer')) return 'Engineering';
  return null;
}

// ── Parse contact field ────────────────────────────────────────────────────
function parseContact(contact: string): { applyUrl: string | null; submittedBy: string } {
  const c = contact.trim();
  if (!c) return { applyUrl: null, submittedBy: 'External Listing' };
  if (c.startsWith('http') || c.startsWith('www')) return { applyUrl: c, submittedBy: 'External Listing' };
  if (c.includes('@')) return { applyUrl: `mailto:${c}`, submittedBy: c.split('@')[1]?.split('.')[0] ?? 'External' };
  if (c.toLowerCase().startsWith('whatsapp')) return { applyUrl: null, submittedBy: 'WhatsApp: ' + c.replace(/whatsapp:?\s*/i, '') };
  return { applyUrl: null, submittedBy: c };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createServiceClient();

  // 1. Fetch sheet CSV (follow redirects)
  let csvText: string;
  try {
    const res = await fetch(SHEET_URL, { redirect: 'follow' });
    if (!res.ok) return NextResponse.json({ error: `Sheet fetch failed: ${res.status}` }, { status: 500 });
    csvText = await res.text();
  } catch {
    return NextResponse.json({ error: 'Cannot reach Google Sheets' }, { status: 500 });
  }

  const rows = parseCSV(csvText);
  if (rows.length < 2) return NextResponse.json({ error: 'Empty sheet' }, { status: 400 });

  // 2. Find or create "External Listings" company (no upsert — no unique constraint)
  let defaultCompanyId: string;
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('normalized_name', 'external listings')
    .limit(1)
    .single();

  if (existing) {
    defaultCompanyId = existing.id;
  } else {
    const { data: created, error: ce } = await supabase
      .from('companies')
      .insert({ name: 'External Listings', normalized_name: 'external listings', trust_score: 50 })
      .select('id')
      .single();
    if (!created) return NextResponse.json({ error: `Company create failed: ${ce?.message}` }, { status: 500 });
    defaultCompanyId = created.id;
  }

  // 3. Delete previous import to avoid duplicates on re-sync
  //    Also sweep up any null-company_id orphans from past broken runs
  await Promise.all([
    supabase.from('jobs').delete().eq('company_id', defaultCompanyId),
    supabase.from('jobs').delete().is('company_id', null),
  ]);

  // 4. Build all job rows in memory, then batch insert
  const today = new Date().toISOString().split('T')[0];
  const dataRows = rows.slice(1);
  const jobBatch: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const row of dataRows) {
    const [titleRaw = '', locationRaw = '', descRaw = '', contactRaw = ''] = row;
    if (!titleRaw.trim() || !descRaw.trim()) { skipped++; continue; }

    const title = titleRaw.trim();
    const { city, country, code } = parseLocation(locationRaw);
    const { applyUrl, submittedBy } = parseContact(contactRaw);
    const seniority = guessSeniority(title, descRaw);
    const minYears = guessMinYears(descRaw);
    const industry = guessIndustry(title, descRaw);
    const isGCC = ['SA','AE','QA','KW','BH','OM'].includes(code ?? '');

    const trustScore = Math.min(50
      + (applyUrl ? 5 : 0)
      + (isGCC ? 5 : 0)
      + (minYears ? 3 : 0)
      + (industry ? 2 : 0), 70);

    jobBatch.push({
      company_id:              defaultCompanyId,
      title,
      normalized_title:        title.toLowerCase(),
      seniority_level:         seniority,
      employment_type:         'full_time',
      industry:                industry ?? null,
      description:             descRaw.trim(),
      location_city:           city ?? null,
      location_country:        country ?? null,
      location_country_code:   code ?? null,
      is_remote:               false,
      remote_policy:           'onsite',
      salary_disclosed:        false,
      application_url:         applyUrl ?? null,
      submitted_by_name:       submittedBy,
      submitted_by_reputation: 50,
      ai_min_years_exp:        minYears ?? null,
      status:                  'active',
      trust_score:             trustScore,
      posted_date:             today,
    });
  }

  // 5. Batch insert in chunks of 50 (Supabase row limit per call)
  let inserted = 0;
  const CHUNK = 50;
  for (let i = 0; i < jobBatch.length; i += CHUNK) {
    const chunk = jobBatch.slice(i, i + CHUNK);
    const { error, data } = await supabase.from('jobs').insert(chunk).select('id');
    if (error) { console.error('Batch insert error:', error.message); skipped += chunk.length; }
    else inserted += data?.length ?? 0;
  }

  return NextResponse.json({ inserted, skipped, total: dataRows.length });
}
