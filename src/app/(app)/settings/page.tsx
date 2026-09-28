import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n.server';

import { signOut } from '../../(auth)/actions';
import { setLanguage } from '../shell/actions';
import { Avatar } from '../shell/ProfileMenu';
import { SETTINGS_PAGES } from './settings-pages';

export const metadata = { title: 'Settings — TechMood' };

/**
 * The settings home: who you are at the top, then every section as one row
 * — the way a phone's settings read — and the few things that are a single
 * tap (language, signing out) right here rather than a page away.
 */
export default async function SettingsPage() {
  const t = await getT();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, display_name, techmood_id, avatar_url, headline, language')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/login');

  const name = profile.display_name ?? profile.full_name;

  return (
    <>
      <h1 className="st-title">{t('الإعدادات', 'Settings')}</h1>

      <section className="st-me section-block">
        <Avatar name={name} url={profile.avatar_url} size={64} />
        <div className="st-me-id">
          <strong>{name}</strong>
          <span className="muted">{profile.headline ?? t('لم تكتب عنواناً مهنياً بعد', 'No headline yet')}</span>
          <span className="id-chip">{profile.techmood_id}</span>
        </div>
        <Link className="btn btn-ghost btn-sm" href={`/u/${profile.techmood_id}`}>{t('ملفي العام', 'Public profile')}</Link>
      </section>

      <ul className="st-group section-block">
        {SETTINGS_PAGES.map((page) => (
          <li key={page.href}>
            <Link className="st-row" href={page.href}>
              <span className="st-row-icon" style={{ background: page.color }}><Icon name={page.icon} size={17} /></span>
              <span className="st-row-main">
                <strong>{t(page.label)}</strong>
                <span className="muted">{t(page.hint)}</span>
              </span>
              <span className="st-chevron" aria-hidden="true"><Icon name="arrow" size={16} /></span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="st-group section-block">
        <li>
          <Link className="st-row" href="/wallet">
            <span className="st-row-icon" style={{ background: '#16A36A' }}><Icon name="wallet" size={17} /></span>
            <span className="st-row-main">
              <strong>{t('المحفظة والسحب', 'Wallet & payouts')}</strong>
              <span className="muted">{t('رصيدك وحساب الاستلام', 'Your balance and payout account')}</span>
            </span>
            <span className="st-chevron" aria-hidden="true"><Icon name="arrow" size={16} /></span>
          </Link>
        </li>
        <li>
          <Link className="st-row" href="/support">
            <span className="st-row-icon" style={{ background: '#0B8FB3' }}><Icon name="review" size={17} /></span>
            <span className="st-row-main">
              <strong>{t('المساعدة والبلاغات', 'Help & reports')}</strong>
              <span className="muted">{t('اسأل، أو بلّغ عن مشكلة', 'Ask, or report a problem')}</span>
            </span>
            <span className="st-chevron" aria-hidden="true"><Icon name="arrow" size={16} /></span>
          </Link>
        </li>
        <li>
          <div className="st-row">
            <span className="st-row-icon" style={{ background: '#5B6B7C' }}><Icon name="globe" size={17} /></span>
            <span className="st-row-main">
              <strong>{t('اللغة', 'Language')}</strong>
              <span className="muted">{t('تُحفظ على حسابك وترافقك إلى أي جهاز', 'Saved on your account, on every device')}</span>
            </span>
            <form action={setLanguage} className="st-seg">
              <button className={profile.language === 'ar' ? 'is-on' : ''} name="language" value="ar" type="submit">العربية</button>
              <button className={profile.language === 'en' ? 'is-on' : ''} name="language" value="en" type="submit">English</button>
            </form>
          </div>
        </li>
      </ul>

      <form action={signOut} className="section-block">
        <button className="st-signout" type="submit">{t('تسجيل الخروج', 'Sign out')}</button>
      </form>
    </>
  );
}
