import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .single();

  // Onboarding is a one-way door: once it is done the app shell takes over.
  if (profile?.onboarding_completed_at) redirect('/home');

  return <div className="onboarding-shell">{children}</div>;
}
