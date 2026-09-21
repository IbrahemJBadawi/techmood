'use client';

import Link from 'next/link';
import { useState } from 'react';

import { signOut } from '../../(auth)/actions';
import { setLanguage } from './actions';
import type { UiLanguage } from '@/lib/database.types';

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
            الجواز المهني
          </Link>
          <Link className="header-dropdown-item" href="/settings/roles" onClick={() => setOpen(false)}>
            أدواري
          </Link>
          <Link className="header-dropdown-item" href="/certificates" onClick={() => setOpen(false)}>
            شهاداتي
          </Link>
          <Link className="header-dropdown-item" href="/wallet" onClick={() => setOpen(false)}>
            المحفظة
          </Link>

          <div className="header-dropdown-section">
            <span className="muted">اللغة</span>
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
              الاختيار محفوظ على حسابك ويضبط تنسيق التواريخ والأرقام. نصوص الواجهة
              ما زالت بالعربية حتى تكتمل الترجمة.
            </p>
          </div>

          <form action={signOut}>
            <button className="header-dropdown-item is-danger" type="submit">تسجيل الخروج</button>
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
