'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';
import { giftAllowance, giftXp } from '@/app/u/[techmoodId]/gift-actions';

const AMOUNTS = [5, 10, 20, 50];

/** The usual amounts, plus whatever is left today when that is smaller than them. */
function choicesFor(left: number) {
  const fits = AMOUNTS.filter((value) => value <= left);
  return left > 0 && !AMOUNTS.includes(left) && left < 50 ? [...fits, left].sort((a, b) => a - b) : fits;
}

/**
 * 🎁 Give XP from your own points (design lab 5): yours go down by what theirs
 * go up, and it counts in the league. Up to 50 a gift and 100 a day.
 */
export function GiftXp({ to, name, path }: { to: string; name: string; path: string }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState('');
  const [allow, setAllow] = useState<{ balance: number; left: number } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  function show() {
    setOpen(true);
    setDone(false);
    setError('');
    start(async () => {
      const next = await giftAllowance();
      setAllow(next);
      // start on the biggest amount they can actually give
      setAmount((current) => (current <= next.left ? current : choicesFor(next.left).at(-1) ?? current));
    });
  }

  function send() {
    setError('');
    start(async () => {
      const result = await giftXp(to, amount, note, path);
      if (!result.ok) { setError(result.error ?? ''); return; }
      setDone(true);
      setNote('');
      setAllow(await giftAllowance());
    });
  }

  const left = allow?.left ?? 0;

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={show} aria-haspopup="dialog">
        🎁 {t('أهدِ XP', 'Gift XP')}
      </button>
      <dialog className="bottom-sheet gift-sheet" aria-label={t('إهداء نقاط', 'Gift XP')} ref={ref}
              onCancel={(event) => { event.preventDefault(); setOpen(false); }}
              onClick={(event) => { if (event.target === ref.current) setOpen(false); }}>
        <div className="bs-grip" aria-hidden="true" />
        <div className="bs-head">
          <strong>🎁 {t(`أهدِ ${name} نقاطاً`, `Gift ${name} some XP`)}</strong>
          <button type="button" className="bs-close" onClick={() => setOpen(false)} aria-label={t('إغلاق', 'Close')}>✕</button>
        </div>
        <div className="bs-body">
          {done ? (
            <p className="notice notice-ok">{t(`وصلت هديتك (${amount} XP) — وصله إشعار.`, `Your gift (${amount} XP) arrived — they were notified.`)}</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: '0.84rem' }}>
                {t('تُخصم من نقاطك وتُضاف لنقاطه، وتُحتسب في الدوري.', 'It comes out of your points, goes into theirs, and counts in the league.')}
                {allow && <> {t(`معك ${allow.balance} XP، وتستطيع اليوم إهداء ${left}.`, ` You hold ${allow.balance} XP and may give ${left} more today.`)}</>}
              </p>
              <div className="chip-row" role="radiogroup" aria-label={t('المقدار', 'Amount')} style={{ margin: '12px 0' }}>
                {(allow ? (choicesFor(left).length ? choicesFor(left) : AMOUNTS) : AMOUNTS).map((value) => (
                  <button key={value} type="button" role="radio" aria-checked={amount === value}
                          className={`chip${amount === value ? ' is-active' : ''}`} disabled={!!allow && value > left}
                          onClick={() => setAmount(value)}>
                    <span className="eng">{value} XP</span>
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="gift-note">{t('رسالة قصيرة (اختياري)', 'A short note (optional)')}</label>
                <input id="gift-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
                       placeholder={t('شكراً على مساعدتك في…', 'Thanks for helping with…')} />
              </div>
              {error && <p className="notice notice-danger">{error}</p>}
            </>
          )}
        </div>
        <div className="bs-foot">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('إغلاق', 'Close')}</button>
          {!done && (
            <button type="button" className="btn btn-primary" onClick={send} disabled={pending || (!!allow && amount > left)}>
              {pending ? t('…', '…') : t(`أهدِ ${amount} XP`, `Gift ${amount} XP`)}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
