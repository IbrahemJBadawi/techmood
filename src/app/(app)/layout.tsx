import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { signOut } from '../(auth)/actions';

import { NavLink } from './NavLink';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('full_name, techmood_id').eq('id', user.id).single(),
    supabase.from('profile_roles').select('role, status').eq('profile_id', user.id),
  ]);

  const approved = (roles ?? []).filter((role) => role.status === 'approved').map((role) => role.role);
  const isAdmin = approved.includes('admin');
  const isMentor = approved.includes('mentor');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-mark" />
          TechMood
        </div>

        <div className="nav-group">
          <NavLink href="/home">الرئيسية</NavLink>
        </div>

        <div className="nav-group">
          <div className="nav-group-label">التعلّم والبناء</div>
          <NavLink href="/passport">الجواز المهني</NavLink>
          <NavLink href="/academy">الأكاديمية</NavLink>
          <NavLink href="/certificates">الشهادات</NavLink>
        </div>

        {(isAdmin || isMentor) && (
          <div className="nav-group">
            <div className="nav-group-label">المراجعة</div>
            {(isMentor || isAdmin) && <NavLink href="/review">مراجعة الأعمال</NavLink>}
            {isAdmin && <NavLink href="/admin">لوحة الإدارة</NavLink>}
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <h1>{profile?.full_name ?? 'TechMood'}</h1>
            <div className="topbar-actions">
              {profile?.techmood_id && <span className="id-chip">{profile.techmood_id}</span>}
              <Link className="btn btn-ghost btn-sm" href="/passport">ملفي</Link>
              <form action={signOut}>
                <button className="btn btn-ghost btn-sm" type="submit">خروج</button>
              </form>
            </div>
          </div>
        </header>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
