'use client';

import type { AIExplanation, Gap, Strength } from '@/lib/matching/types';

interface Props {
  strengths: Strength[];
  gaps: Gap[];
  aiExplanation?: AIExplanation | null;
  matchScore: number;
}

function StrengthItem({ label, detail }: Strength) {
  return (
    <li className="flex gap-2.5 items-start">
      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
      </div>
    </li>
  );
}

function GapItem({ item, importance, how_to_close }: Gap) {
  const isRequired = importance === 'required';
  return (
    <li className="flex gap-2.5 items-start">
      <span className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center
        ${isRequired ? 'bg-red-100' : 'bg-amber-100'}`}>
        {isRequired ? (
          <svg className="w-2.5 h-2.5 text-red-500" fill="none" viewBox="0 0 12 12">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-2.5 h-2.5 text-amber-500" fill="none" viewBox="0 0 12 12">
            <path d="M6 2v4M6 9v1" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        )}
      </span>
      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{item}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full
            ${isRequired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            {isRequired ? 'required' : 'nice to have'}
          </span>
        </div>
        {how_to_close && (
          <p className="text-xs text-gray-500 mt-0.5">{how_to_close}</p>
        )}
      </div>
    </li>
  );
}

export function WhyThisMatches({ strengths, gaps, aiExplanation, matchScore }: Props) {
  const displayStrengths = aiExplanation?.strengths
    ? aiExplanation.strengths.map(s => ({ label: s, detail: '' }))
    : strengths;

  return (
    <div className="space-y-5">
      {/* AI Summary */}
      {aiExplanation?.summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3v4l2.5 2.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
            </span>
            <p className="text-sm text-blue-800 leading-relaxed">{aiExplanation.summary}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Strengths */}
        {displayStrengths.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Why you match
            </h4>
            <ul className="space-y-3">
              {displayStrengths.map((s, i) => (
                <StrengthItem key={i} {...s} />
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              What you're missing
            </h4>
            <ul className="space-y-3">
              {gaps.map((g, i) => (
                <GapItem key={i} {...g} />
              ))}
            </ul>
          </div>
        )}

        {gaps.length === 0 && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl p-4">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 20 20">
              <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium">
              No significant gaps — you meet all requirements.
            </span>
          </div>
        )}
      </div>

      {/* AI recommendation */}
      {aiExplanation?.recommendation && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700">
            <span className="text-gray-400">Recommendation: </span>
            {aiExplanation.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}
