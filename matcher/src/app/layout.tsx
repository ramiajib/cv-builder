import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Matcher',
  description: 'AI-powered job matching with trust scores',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 16 16">
                  <path d="M2 8a6 6 0 1112 0A6 6 0 012 8z" stroke="currentColor" strokeWidth={1.5}/>
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/>
                </svg>
              </span>
              JobMatch
            </a>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <a href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</a>
              <a href="/recruiter" className="hover:text-gray-900 transition-colors">Recruiter</a>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
