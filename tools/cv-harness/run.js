/* Harness: runs cv-builder.html's real extraction+parse pipeline on every PDF
   in ../../CV's and dumps raw extracted text + parsed cv JSON per file. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const CVDIR = path.join(ROOT, "CV's");
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// ── load the page script ──
const html = fs.readFileSync(path.join(ROOT, 'cv-builder.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('no script block found');
const pageJS = m[1];

// ── DOM stubs so the script evaluates ──
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
vm.runInContext(pageJS, sandbox, { filename: 'cv-builder.js' });

// grab the functions + cv object from the page
const G = name => vm.runInContext(name, sandbox);
const detectColumns = G('detectColumns');
const itemsToLines = G('itemsToLines');
const dehyphenate = G('dehyphenate');
const parseCV = G('parseCV');
const cvRef = G('cv');

const FRESH = JSON.parse(JSON.stringify(cvRef));
function resetCV() { for (const k of Object.keys(cvRef)) cvRef[k] = FRESH[k] === undefined ? '' : JSON.parse(JSON.stringify(FRESH[k])); }

// ── pdf.js extraction (mirror of extractPDF in the page) ──
async function extractPDF(file) {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(fs.readFileSync(file));
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let out = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const pageW = page.getViewport({ scale: 1 }).width;
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim().length).map(it => ({
      x: it.transform[4], y: it.transform[5], w: it.width || 0, s: it.str
    }));
    if (!items.length) { out += '\n'; continue; }
    const cols = detectColumns(items, pageW);
    cols.sort((a, b) => b.length - a.length);
    out += cols.map(c => dehyphenate(itemsToLines(c))).filter(Boolean).join('\n') + '\n';
  }
  return out;
}

(async () => {
  const files = fs.readdirSync(CVDIR).filter(f => /\.pdf$/i.test(f));
  const summary = [];
  for (const f of files) {
    const base = f.replace(/\.pdf$/i, '').replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 50);
    let text = '';
    try { text = await extractPDF(path.join(CVDIR, f)); } catch (e) { text = 'EXTRACT_ERROR: ' + e.message; }
    fs.writeFileSync(path.join(OUT, base + '.txt'), text, 'utf8');
    resetCV();
    cvRef._fileName = f;                       // mirror handleFile() setting the filename hint
    let err = '';
    try { parseCV(text); } catch (e) { err = e.stack; }
    const snap = JSON.parse(JSON.stringify(cvRef));
    fs.writeFileSync(path.join(OUT, base + '.json'), JSON.stringify(snap, null, 2), 'utf8');
    summary.push({
      file: f, chars: text.length, err: err || undefined,
      name: snap.name, title: snap.title, city: snap.city, email: snap.email, phone: snap.phone,
      jobs: snap.jobs.length,
      jobHeads: snap.jobs.map(j => `${j.title || '?'} @ ${j.company || '?'} [${j.from || ''}–${j.to || ''}] (${(j.duties || []).length}d)`),
      edu: (snap.eduList || []).map(e => `${e.level || '?'} | ${e.field || ''} | ${e.inst || '?'} | ${e.year || ''}`),
      skillsLen: (snap.skills || '').length, langs: snap.langs,
      summaryLen: (snap.summary || '').length,
      certs: (snap.certifications || '').split('\n').filter(Boolean).length,
    });
  }
  fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  for (const s of summary) {
    console.log('────────────────────────────────────────');
    console.log(s.file, `(${s.chars} chars)`, s.err ? 'PARSE ERROR' : '');
    console.log(`  name: ${s.name} | title: ${s.title}`);
    console.log(`  city: ${s.city} | email: ${s.email} | phone: ${s.phone}`);
    console.log(`  jobs: ${s.jobs}`); s.jobHeads.forEach(j => console.log('   - ' + j));
    console.log(`  edu:`); s.edu.forEach(e => console.log('   - ' + e));
    console.log(`  skillsLen: ${s.skillsLen} | langs: ${s.langs} | summaryLen: ${s.summaryLen} | certLines: ${s.certs}`);
    if (s.err) console.log(s.err);
  }
})();
