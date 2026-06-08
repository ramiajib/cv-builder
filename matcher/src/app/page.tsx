import { redirect } from 'next/navigation';

export default async function Home() {
  // Guard: require Supabase env vars before trying to connect
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey ||
      supabaseUrl === 'https://your-project.supabase.co') {
    redirect('/setup');
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (candidate) redirect(`/dashboard?candidate_id=${candidate.id}`);
  }

  // No logged-in user — use demo seed candidate
  const { createServiceClient } = await import('@/lib/supabase/server');
  const service = createServiceClient();
  const { data: demo } = await service
    .from('candidates')
    .select('id')
    .limit(1)
    .single();

  if (demo) redirect(`/dashboard?candidate_id=${demo.id}`);

  redirect('/dashboard');
}
