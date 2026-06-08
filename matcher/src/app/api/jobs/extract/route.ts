import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const { description } = await req.json();
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no_key' }, { status: 402 });

  const client = new OpenAI({ apiKey });

  const prompt = `Extract structured data from this job description. Return ONLY valid JSON with these fields:
{
  "title": string,
  "seniority": one of ["intern","junior","mid","senior","lead","manager","director","vp","executive"] or null,
  "industry": string or null,
  "min_years_exp": number or null,
  "required_skills": string[] (max 8, specific technical/domain skills),
  "preferred_skills": string[] (max 5, nice-to-have skills),
  "required_languages": string[] (e.g. ["Arabic", "English"]),
  "remote_policy": one of ["remote","hybrid","onsite","flexible"] or null
}

Job description:
${description.slice(0, 3000)}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 400,
    });

    const extracted = JSON.parse(response.choices[0].message.content ?? '{}');
    return NextResponse.json(extracted);
  } catch (err) {
    console.error('AI extraction error:', err);
    return NextResponse.json({ error: 'extraction_failed' }, { status: 500 });
  }
}
