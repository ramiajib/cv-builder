export interface DimensionScores {
  skills: number;
  experience: number;
  seniority: number;
  education: number;
  location: number;
  language: number;
  certification: number;
  semantic: number;
}

export interface Strength {
  label: string;
  detail: string;
}

export interface Gap {
  item: string;
  type: 'skill' | 'experience' | 'education' | 'certification' | 'language';
  importance: 'required' | 'preferred';
  how_to_close: string;
}

export interface MatchResult extends DimensionScores {
  match_score: number;
  tier: 'excellent' | 'strong' | 'moderate' | 'weak';
  strengths: Strength[];
  gaps: Gap[];
}

export interface AIExplanation {
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

export type MatchTier = 'excellent' | 'strong' | 'moderate' | 'weak';

export const TIER_COLORS: Record<MatchTier, string> = {
  excellent: '#22c55e',  // green-500
  strong:    '#3b82f6',  // blue-500
  moderate:  '#f59e0b',  // amber-500
  weak:      '#ef4444',  // red-500
};

export const TIER_LABELS: Record<MatchTier, string> = {
  excellent: 'Excellent Match',
  strong:    'Strong Match',
  moderate:  'Moderate Match',
  weak:      'Weak Match',
};
