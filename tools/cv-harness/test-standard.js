/* Smoke test for the upload "standard structure" rewrite:
   bullet rewriting, tense normalization, standard summary, years computation,
   newest-first sorting, and the standard section order in cvData/cvHTML/buildCvDoc. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'cv-builder.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('no script block found');

const stubEl = () => new Proxy(function(){}, {
  get: (t, k) => {
    if (k === 'classList') return { add(){}, remove(){}, contains(){ return false; } };
    if (k === 'style') return {};
    return typeof k === 'string' && /^(appendChild|remove|focus|click|addEventListener|setAttribute|getContext|scrollTo)$/.test(k) ? () => stubEl() : stubEl();
  },
  set: () => true,
  apply: () => stubEl(),
});
const sandbox = {
  console, setTimeout, clearTimeout, Math, JSON, RegExp, Date, Array, Object, String, Number, Promise, Set, Map,
  window: {},
  document: { getElementById: () => stubEl(), createElement: () => stubEl(), querySelectorAll: () => [], head: stubEl(), body: stubEl() },
  navigator: { language: 'en' },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  fetch: async () => ({ ok: false, json: async () => ({}) }),
  crypto: { randomUUID: () => '0' },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'cv-builder.js' });
const G = name => vm.runInContext(name, sandbox);

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  if (got === want) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n       got:  ' + JSON.stringify(got) + '\n       want: ' + JSON.stringify(want)); }
};
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra ? '\n       ' + extra : '')); }
};

/* ── 1. bullet rewriting (enhanceDuty in upload mode) ── */
console.log('\n— enhanceDuty(raw, preserve=true, isCurrent) —');
const enhanceDuty = G('enhanceDuty');
// past role: present-tense openers → past tense (real bullets from the reference set)
eq(enhanceDuty('Supervise and Support store or unit managers within the area.', true, false),
   'Supervised and supported store or unit managers within the area', 'base verb + coordination → past');
eq(enhanceDuty('Recruit, train and develop staff to maintain high service standards.', true, false),
   'Recruited, trained and developed staff to maintain high service standards', 'comma verb chain → past');
eq(enhanceDuty('Working with vendors to negotiate prices and orders supplies.', true, false),
   'Worked with vendors to negotiate prices and orders supplies', 'gerund opener → past');
eq(enhanceDuty('Analyzing data to identify trends and recommend improvements', true, false),
   'Analyzed data to identify trends and recommend improvements', 'gerund -ing → past');
eq(enhanceDuty('Ensure operational efficiency and consistency across all locations.', true, false),
   'Ensured operational efficiency and consistency across all locations', 'extended verb (ensure) → past');
eq(enhanceDuty('• Responsible for managing procurement teams across the Kingdom', true, false),
   'Managed procurement teams across the Kingdom', '"Responsible for managing…" → verb opener');
eq(enhanceDuty('Responsible for the business performance of 3 branches', true, false),
   'Oversaw the business performance of 3 branches', '"Responsible for the…" → Oversaw');
eq(enhanceDuty('I managed customer complaints and refunds', true, false),
   'Managed customer complaints and refunds', 'first person stripped');
// label-prefixed bullet keeps its label, content converted
eq(enhanceDuty('Market Research: Conduct consumer, market, and competitor analysis to identify trends', true, false),
   'Market Research: Conducted consumer, market, and competitor analysis to identify trends', 'label kept, verb converted');
// already-past bullets stay untouched
eq(enhanceDuty('Achieved 10% monthly profit growth through cost optimization and operational efficiency', true, false),
   'Achieved 10% monthly profit growth through cost optimization and operational efficiency', 'past bullet unchanged');
eq(enhanceDuty('✔ Delivered 1.5% COGS reduction by breaking legacy procurement practices', true, false),
   'Delivered 1.5% COGS reduction by breaking legacy procurement practices', '✔ glyph stripped');
// noun-lead ambiguity protected
ok(enhanceDuty('Track record of exceeding sales targets across the region', true, false).startsWith('Track record'),
   'ambiguous noun lead ("Track record") untouched');
ok(enhanceDuty('Stock control and inventory documentation for the warehouse', true, false).startsWith('Stock control'),
   'ambiguous noun lead ("Stock control") untouched');
// but coordination proves the verb
eq(enhanceDuty('Plan and coordinate menus', true, false), 'Planned and coordinated menus', 'ambiguous lead + verb coordination → past');
// current role: present forms preserved
eq(enhanceDuty('Lead and supervise customer support team, ensuring high performance', true, true),
   'Lead and supervise customer support team, ensuring high performance', 'current role keeps present tense');
eq(enhanceDuty('Responsible for daily operations of the resort', true, true),
   'Oversee daily operations of the resort', 'current role "Responsible for…" → Oversee');

/* ── 2. standard summary ── */
console.log('\n— standardSummary —');
const standardSummary = G('standardSummary');
const skills = ['Team Leadership', 'P&L Management', 'Customer Service'];
const jobs = [{ title: 'Area Manager', company: 'Burj Al Hamam' }];
const gen = standardSummary(null, 'Area Manager', '16+ years', skills, jobs);
ok(/^Area Manager with 16\+ years of experience in Team Leadership, P&L Management, Customer Service\./.test(gen),
   'generated summary follows the standard formula', gen);
ok(gen.includes('Most recently Area Manager at Burj Al Hamam'), 'generated summary cites the latest role', gen);
const own = 'Results-driven F&B professional with 30+ years of experience in restaurant operations.';
eq(standardSummary(own, 'Area Manager', '16+ years', skills, jobs), own, 'own standard-shaped summary kept verbatim');
const weak = 'Passionate about food and hospitality, having served thousands of happy guests.';
ok(standardSummary(weak, 'Area Manager', '16+ years', skills, jobs).startsWith('Area Manager with 16+ years of experience in'),
   'non-standard summary gets the standard opener prefixed');

/* ── 3. years computation + newest-first sorting ── */
console.log('\n— standardizeUpload —');
const cvRef = G('cv');
const standardizeUpload = G('standardizeUpload');
cvRef.jobs = [
  { title: 'Floor Manager', company: 'Le Particulier', from: 'January 2009', to: 'March 2011', duties: ['x'] },
  { title: 'Area Manager', company: 'Burj Al Hamam', from: 'July 2023', to: 'July 2025', duties: ['x'] },
  { title: 'Operations Manager', company: 'Katal Catering', from: 'January 2021', to: 'January 2022', duties: ['x'] },
];
cvRef.eduList = [
  { level: 'Baccalaureate', field: '', inst: 'Antonine Sisters School', year: '1990' },
  { level: 'MBA', field: 'Strategic Management', inst: 'Aston University', year: '2012' },
];
cvRef.yearsExp = '';
standardizeUpload();
eq(cvRef.yearsExp, '16+ years', 'years total computed from job dates (2009→2025)');
eq(cvRef.jobs.map(j => j.company).join(' | '), 'Burj Al Hamam | Katal Catering | Le Particulier', 'jobs sorted newest-first');
eq(cvRef.eduList[0].level, 'MBA', 'education sorted newest-first');
// undated job → no scrambling
cvRef.jobs = [
  { title: 'A', company: 'First', from: '', to: '', duties: ['x'] },
  { title: 'B', company: 'Second', from: '2010', to: '2012', duties: ['x'] },
];
standardizeUpload();
eq(cvRef.jobs[0].company, 'First', 'partial dates → original order preserved');

/* ── 4. standard section order in the rendered output ── */
console.log('\n— cvData / cvHTML / buildCvDoc —');
for (const k of Object.keys(cvRef)) { // reset
  cvRef[k] = (k === 'jobs' || k === 'eduList') ? [] : (typeof cvRef[k] === 'boolean' ? false : '');
}
Object.assign(cvRef, {
  _fromUpload: true,
  name: 'antoine abi abboud', title: 'Area Manager', city: 'Riyadh', email: 'toni@example.com',
  phone: '+966501234567', countryCode: '+966',
  yearsExp: '16+ years',
  jobs: [{ title: 'Area Manager', company: 'Burj Al Hamam', from: 'July 2023', to: 'July 2025',
    duties: ['Supervise and Support store or unit managers within the area.',
             'Supervise and Support store or unit managers within the area.',   // duplicate → dropped
             'Responsible for managing budgets, expenses, and resource allocation'] }],
  eduList: [{ level: 'TS3', field: 'Hotel Management', inst: 'Francel College', year: '2001' }],
  skills: 'Team Leadership, P&L Management, Customer Service',
  langs: 'Arabic (Native), English (Fluent)',
  certifications: 'Food Safety Level 2', achievements: 'Best Manager Award 2024', summary: '',
});
const d = vm.runInContext('cvData()', sandbox);
eq(d.jobs[0].duties.length, 2, 'duplicate bullets deduped');
eq(d.jobs[0].duties[0], 'Supervised and supported store or unit managers within the area', 'rendered duty rewritten to standard');
ok(d.summary.startsWith('Area Manager with 16+ years of experience in'), 'rendered summary uses the standard formula', d.summary);
eq(d.labels.exp, 'Professional Experience', 'standard label: Professional Experience');
eq(d.labels.ski, 'Core Competencies', 'standard label: Core Competencies');
eq(d.labels.ach, 'Key Achievements', 'standard label: Key Achievements');

const htmlOut = vm.runInContext('cvHTML()', sandbox);
const order = ['Professional Summary', 'Key Achievements', 'Core Competencies', 'Professional Experience', 'Education', 'Certifications', 'Languages']
  .map(t => htmlOut.indexOf(t));
ok(order.every(i => i >= 0) && order.every((v, i, a) => i === 0 || v > a[i - 1]),
   'upload preview renders sections in the standard order', JSON.stringify(order));
ok(!htmlOut.includes('flex:1.7'), 'upload preview is single-flow (no two-column split)');

cvRef._fromUpload = false;
const htmlScratch = vm.runInContext('cvHTML()', sandbox);
ok(htmlScratch.includes('flex:1.7'), 'from-scratch preview keeps the two-column design');
cvRef._fromUpload = true;

const doc = vm.runInContext('buildCvDoc(cvData())', sandbox);
const flat = JSON.stringify(doc.content);
const pdfOrder = ['PROFESSIONAL SUMMARY', 'KEY ACHIEVEMENTS', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE', 'EDUCATION', 'CERTIFICATIONS', 'LANGUAGES']
  .map(t => flat.indexOf(t));
ok(pdfOrder.every(i => i >= 0) && pdfOrder.every((v, i, a) => i === 0 || v > a[i - 1]),
   'PDF sections follow the standard order', JSON.stringify(pdfOrder));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
