'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { markWelcomed } from '@/app/(app)/home/actions';

type Step = { icon: string; ar: [string, string]; en: [string, string]; href?: string; cta?: [string, string] };

const STEPS: Step[] = [
  { icon: '👋', ar: ['أهلاً بك في TechMood', 'منصة تتعلّم فيها وتعمل: أكاديمية، منتورز، فرق، ومعرض وسوق لأعمالك. جولة سريعة في دقيقة.'],
    en: ['Welcome to TechMood', 'A place to learn and to work: an academy, mentors, teams, and a gallery and market for your work. A one-minute tour.'] },
  { icon: '🎓', ar: ['الأكاديمية', 'مسارات ودورات تُفتح دروسها بالترتيب. كل درس فيه تطبيق، وتسليماتك يقيّمها منتور حقيقي.'],
    en: ['The academy', 'Paths and courses whose lessons open in order. Each lesson has practice, and a real mentor reviews your hand-ins.'],
    href: '/academy', cta: ['افتح الأكاديمية', 'Open the academy'] },
  { icon: '🧑‍🏫', ar: ['المنتورز', 'احجز جلسة واحد لواحد مع منتور يراجع عملك. الأسعار تبدأ من 10$، والحجز الفوري متاح بزيادة بسيطة.'],
    en: ['Mentors', 'Book a one-to-one session with a mentor who reviews your work. Prices start at $10, and instant booking is available for a little more.'],
    href: '/mentors', cta: ['تصفّح المنتورز', 'Browse mentors'] },
  { icon: '🖼️', ar: ['المعرض والسوق', 'اعرض مشاريعك في المعرض، أو بِعها وقدّم خدماتك في السوق — بصفحة كاملة ورابط دائم تشاركه.'],
    en: ['Gallery and market', 'Show your projects in the gallery, or sell them and offer services in the market — each with a full page and a permanent link.'],
    href: '/gallery', cta: ['زر المعرض', 'Visit the gallery'] },
  { icon: '🔥', ar: ['تقدّمك', 'أيامك المتتالية، تحديات الأسبوع، وإنجازاتك على الرئيسية. تابع زملاءك لتتسابقوا على نقاط الأسبوع.'],
    en: ['Your progress', 'Your streak, the week’s challenges and your achievements live on Home. Follow classmates to race for the week’s XP.'] },
];

/**
 * The first-visit guide (0129): five short cards. Finishing or skipping it is
 * remembered on the account; ?tour=1 on Home shows it again.
 */
export function WelcomeTour({ open: initiallyOpen }: { open: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(initiallyOpen);
  const [step, setStep] = useState(0);
  const [, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function close() {
    setOpen(false);
    start(() => { void markWelcomed(); });
  }

  if (!open) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const [title, body] = t.locale === 'ar' ? current.ar : current.en;

  return (
    <div className="wt-backdrop" role="presentation">
      <div className="wt-card" role="dialog" aria-modal="true" aria-labelledby="wt-title" tabIndex={-1} ref={dialogRef}>
        <button type="button" className="icon-button wt-skip" onClick={close} aria-label={t('تخطَّ الجولة', 'Skip the tour')}>✕</button>
        <span className="wt-icon" aria-hidden="true">{current.icon}</span>
        <h2 id="wt-title">{title}</h2>
        <p>{body}</p>
        {current.href && current.cta && (
          <Link className="wt-link" href={current.href} onClick={close}>{t(`${current.cta[0]} ←`, `${current.cta[1]} →`)}</Link>
        )}
        <div className="wt-dots" aria-label={t(`الخطوة ${step + 1} من ${STEPS.length}`, `Step ${step + 1} of ${STEPS.length}`)}>
          {STEPS.map((_, index) => <span key={index} className={index === step ? 'is-on' : ''} />)}
        </div>
        <div className="wt-actions">
          {step > 0
            ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}>{t('السابق', 'Back')}</button>
            : <button type="button" className="btn btn-ghost btn-sm" onClick={close}>{t('تخطَّ', 'Skip')}</button>}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? t('لنبدأ', 'Let’s start') : t('التالي', 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}
