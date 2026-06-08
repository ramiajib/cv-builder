export default function SetupPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 20 20">
              <path d="M10 3a7 7 0 100 14A7 7 0 0010 3zm0 4v4m0 3v.5"
                stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Setup required</h1>
            <p className="text-sm text-gray-500">Connect your Supabase project to get started</p>
          </div>
        </div>

        <ol className="space-y-4">
          {[
            {
              step: '1',
              title: 'Copy the example env file',
              code: 'cp .env.local.example .env.local',
            },
            {
              step: '2',
              title: 'Fill in your Supabase credentials',
              code: 'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...\nSUPABASE_SERVICE_ROLE_KEY=eyJ...',
            },
            {
              step: '3',
              title: 'Add your OpenAI API key (for match explanations)',
              code: 'OPENAI_API_KEY=sk-...',
            },
            {
              step: '4',
              title: 'Run the SQL migration in Supabase SQL editor',
              code: 'supabase/migrations/001_schema.sql',
            },
            {
              step: '5',
              title: 'Restart the dev server',
              code: 'npm run dev',
            },
          ].map(item => (
            <li key={item.step} className="flex gap-4">
              <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs
                               font-bold flex items-center justify-center mt-0.5">
                {item.step}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">{item.title}</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs
                                text-gray-600 overflow-x-auto whitespace-pre-wrap">
                  {item.code}
                </pre>
              </div>
            </li>
          ))}
        </ol>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <strong>Demo data</strong> is seeded automatically by the SQL migration —
            you'll see a sample candidate and 3 jobs with real match scores immediately after setup.
          </p>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-blue-600 text-white font-medium py-2.5 rounded-xl
                     hover:bg-blue-700 transition-colors text-sm"
        >
          Open Supabase Dashboard →
        </a>
      </div>
    </div>
  );
}
