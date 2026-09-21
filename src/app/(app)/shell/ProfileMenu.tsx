'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useT } from '@/lib/i18n.client';
import type { UiLanguage } from '@/lib/database.types';

import { signOut } from '../../(auth)/actions';
import { setLanguage } from './actions';

export function ProfileMenu({
  name,
  techmoodId,
  username,
  avatarUrl,
  language,
}: {
  name: string;
  techmoodId: string;
  username: string | null;
  avatarUrl: string | null;
  language: UiLanguage;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="header-menu">
      <button
        type="button"
        className="profile-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={name} url={avatarUrl} size={30} />
        <span className="profile-trigger-name">{name}</span>
      </button>

      {open && (
        <div className="header-dropdown" role="menu">
          <div className="profile-card">
            <Avatar name={name} url={avatarUrl} size={44} />
            <div>
              <strong>{name}</strong>
              {username && <span className="muted" dir="ltr">@{username}</span>}
              <span className="id-chip">{techmoodId}</span>
            </div>
          </div>

          <Link className="header-dropdown-item" href="/passport" onClick={() => setOpen(false)}>
            {t('الجواز المهني', 'Professional passport')}
          </Link>
          <Link className="header-dropdown-item" href={`/u/${techmoodId}`} onClick={() => setOpen(false)}>
            {t('ملفي العام', 'My public profile')}
          </Link>
          <Link className="header-dropdown-item" href="/settings/profile" onClick={() => setOpen(false)}>
            {t('تحرير الملف والخصوصية', 'Edit profile & privacy')}
          </Link>
          <Link className="header-dropdown-item" href="/settings/roles" onClick={() => setOpen(false)}>
            {t('أدواري', 'My roles')}
          </Link>
          <Link className="header-dropdown-item" href="/settings/fields" onClick={() => setOpen(false)}>
            {t('مجالاتي ومهاراتي', 'Fields & skills')}
          </Link>
          <Link className="header-dropdown-item" href="/certificates" onClick={() => setOpen(false)}>
            {t('شهاداتي', 'My certificates')}
          </Link>
          <Link className="header-dropdown-item" href="/wallet" onClick={() => setOpen(false)}>
            {t('المحفظة', 'Wallet')}
          </Link>

          <div className="header-dropdown-section">
            <span className="muted">{t('اللغة', 'Language')}</span>
            <form action={setLanguage} className="language-row">
              <button
                className={`language-option${language === 'ar' ? ' is-on' : ''}`}
                name="language"
                value="ar"
                type="submit"
              >
                العربية
              </button>
              <button
                className={`language-option${language === 'en' ? ' is-on' : ''}`}
                name="language"
                value="en"
                type="submit"
              >
                English
              </button>
            </form>
            <p className="header-note">
              {t('الاختيار محفوظ على حسابك، فيرافقك إلى أي جهاز. ما يكتبه الناس — وصف دورة، نبذة منتور، رسالة — يبقى بلغته.',
                 'Your choice is saved on your account, so it follows you to any device. What people write — a course description, a mentor bio, a message — stays in the language they wrote it in.')}
            </p>
          </div>

          <form action={signOut}>
            <button className="header-dropdown-item is-danger" type="submit">
              {t('تسجيل الخروج', 'Sign out')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="avatar" src={url} alt="" width={size} height={size}
           style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="avatar avatar-initial" style={{ width: size, height: size, fontSize: size / 2.4 }}>
      {name.trim().slice(0, 1)}
    </span>
  );
}
