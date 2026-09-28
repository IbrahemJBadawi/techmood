'use client';

import { useState } from 'react';

import { AvatarUploader } from '@/components/AvatarUploader';
import { useT } from '@/lib/i18n.client';

import { setAvatar } from './actions';

export function PhotoCard({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const t = useT();
  const [value, setValue] = useState(url);
  const [error, setError] = useState('');

  return (
    <section className="hm-card st-section section-block">
      <h3>{t('صورتك', 'Your photo')}</h3>
      <AvatarUploader
        userId={userId}
        name={name}
        value={value}
        onChange={async (next) => {
          const result = await setAvatar(next);
          if (result?.error) {
            setError(result.error);
            throw new Error(result.error);
          }
          setError('');
          setValue(next);
        }}
      />
      {error && <p className="notice notice-danger">{error}</p>}
    </section>
  );
}
