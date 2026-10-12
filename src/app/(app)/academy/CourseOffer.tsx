'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';

import { buyCourseAction, subscribeMentorAction } from './actions';

/**
 * What a paid mentor course costs, and the one button that opens it (0162).
 * The money comes from the member's TechMood balance; when it is short, the
 * button becomes «top up» instead of failing.
 */
export function CourseOffer({
  courseId, mentorId, mode, price, monthly, balance, path,
}: {
  courseId: string;
  mentorId: string | null;
  mode: 'once' | 'subscription';
  price: number | null;
  monthly: number | null;
  balance: number;
  path: string;
}) {
  const t = useT();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const cost = mode === 'once' ? Number(price ?? 0) : Number(monthly ?? 0);
  const short = balance < cost;

  function pay() {
    setError('');
    start(async () => {
      const result = mode === 'once'
        ? await buyCourseAction(courseId, path)
        : mentorId ? await subscribeMentorAction(mentorId, path) : { ok: false, error: '' };
      if (!result.ok) setError(result.error ?? '');
    });
  }

  return (
    <div className="course-offer">
      <div className="course-offer-price">
        <strong className="eng">${cost.toFixed(cost % 1 ? 2 : 0)}</strong>
        <span>{mode === 'once' ? t('مرة واحدة — تبقى لك', 'once — yours to keep') : t('شهرياً — كل كورسات المنتور بالاشتراك', 'a month — all the mentor’s plan courses')}</span>
      </div>
      <p className="muted course-offer-note">
        {t('الدرس الأول مجاني للمعاينة. ', 'The first lesson is a free preview. ')}
        {t(`رصيدك: ${balance.toFixed(2)}$`, `Your balance: $${balance.toFixed(2)}`)}
      </p>
      {short ? (
        <Link className="btn btn-primary" href="/wallet/topup">{t('اشحن رصيدك للشراء', 'Top up to buy')}</Link>
      ) : (
        <button type="button" className="btn btn-primary" onClick={pay} disabled={pending}>
          {pending ? t('…', '…') : mode === 'once' ? t('اشترِ الدورة', 'Buy the course') : t('اشترك شهراً', 'Subscribe for a month')}
        </button>
      )}
      {error && <p className="notice notice-danger">{error}</p>}
    </div>
  );
}
