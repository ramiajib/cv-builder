// Dimension weights — must sum to 1.00
// Adjust these to tune matching quality as you gather feedback data.
//
// Content signals (skills + semantic/occupation relevance) carry ~55% so that
// genuine field alignment — not generic location/seniority overlap — drives the
// score. This is what stops unrelated jobs (e.g. a pharmacist matched to a
// coffee-roaster posting) from landing in the "excellent" tier.
export const WEIGHTS = {
  skills:        0.30,
  semantic:      0.25,  // occupation/content relevance (or pgvector if available)
  experience:    0.15,
  seniority:     0.10,
  location:      0.07,
  education:     0.06,
  language:      0.04,
  certification: 0.03,
} as const;

export const GCC_COUNTRIES = new Set(['SA', 'AE', 'QA', 'KW', 'BH', 'OM']);

export const SENIORITY_RANK: Record<string, number> = {
  intern:    0,
  junior:    1,
  mid:       2,
  senior:    3,
  lead:      4,
  manager:   4,
  director:  5,
  vp:        6,
  executive: 7,
};

export const DEGREE_RANK: Record<string, number> = {
  high_school: 0,
  diploma:     1,
  associate:   2,
  bachelor:    3,
  master:      4,
  mba:         4,
  phd:         5,
  other:       1,
};
