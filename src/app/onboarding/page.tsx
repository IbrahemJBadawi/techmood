import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { OnboardingWizard } from './OnboardingWizard';

export const metadata = { title: 'Set up your account — TechMood' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profile },
    { data: roles },
    { data: fields },
    { data: interests },
    { data: skills },
    { data: myFields },
    { data: myInterests },
    { data: mySkills },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('techmood_id, full_name, display_name, username, avatar_url, headline, country, city, language')
      .eq('id', user.id)
      .single(),
    supabase.from('profile_roles').select('id, role, status, application_note').eq('profile_id', user.id),
    supabase.from('fields').select('id, slug, name_ar, name_en, status').order('name_ar'),
    supabase.from('interests').select('id, slug, name_ar, name_en, status').order('name_ar'),
    supabase.from('skills').select('id, slug, name_ar, name_en, status').order('name_ar'),
    supabase.from('profile_fields').select('field_id').eq('profile_id', user.id),
    supabase.from('profile_interests').select('interest_id').eq('profile_id', user.id),
    supabase.from('profile_skills').select('skill_id').eq('profile_id', user.id),
  ]);

  if (!profile) redirect('/login');

  // A term the person suggested comes back in the list with status
  // pending_review — it is shown as "under review", never as pickable.
  return (
    <OnboardingWizard
      userId={user.id}
      profile={profile}
      roles={roles ?? []}
      catalogues={{
        field: fields ?? [],
        interest: interests ?? [],
        skill: skills ?? [],
      }}
      selected={{
        field: (myFields ?? []).map((row) => row.field_id),
        interest: (myInterests ?? []).map((row) => row.interest_id),
        skill: (mySkills ?? []).map((row) => row.skill_id),
      }}
    />
  );
}
