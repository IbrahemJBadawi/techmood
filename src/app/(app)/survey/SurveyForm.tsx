'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { useT } from '@/lib/i18n.client';

import { submitSurvey } from './actions';
import { EASE_FACES, MOST_USED, PAINS } from './options';

export function SurveyForm() {
  const t = useT();
  const [ease, setEase] = useState(0);
  const [recommend, setRecommend] = useState(-1);
  const [mostUsed, setMostUsed] = useState('');
  const [pains, setPains] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const togglePain = (key: string) =>
    setPains((now) => key === 'nothing' ? (now.includes('nothing') ? [] : ['nothing'])
      : now.includes(key) ? now.filter((k) => k !== key) : [...now.filter((k) => k !== 'nothing'), key]);

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (!ease || recommend < 0) {
      setError(t('أجب على أول سؤالين على الأقل.', 'Answer at least the first two questions.'));
      return;
    }
    setError('');
    start(async () => {
      const result = await submitSurvey({ ease, recommend, mostUsed, pains, suggestion });
      if (!result.ok) setError(result.error ?? '');
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="panel section-block survey-done">
        <span aria-hidden="true">💙</span>
        <h2>{t('شكراً لك!', 'Thank you!')}</h2>
        <p className="muted">{t('وصل رأيك لفريق TechMood ويُقرأ فعلاً. نعود إليك بعد ثلاثة أشهر لنرى ما تغيّر.',
                                'Your answer reached the TechMood team and is actually read. We will ask again in three months.')}</p>
        <Link className="btn btn-primary" href="/home">{t('عودة للرئيسية', 'Back home')}</Link>
      </div>
    );
  }

  return (
    <form className="survey-form section-block" onSubmit={send}>
      <fieldset className="panel survey-q">
        <legend>1. {t('ما مدى سهولة استخدام TechMood؟', 'How easy is TechMood to use?')}</legend>
        <div className="survey-faces" role="radiogroup">
          {EASE_FACES.map((face, index) => (
            <button key={face} type="button" role="radio" aria-checked={ease === index + 1}
                    className={`survey-face${ease === index + 1 ? ' is-on' : ''}`} onClick={() => setEase(index + 1)}
                    aria-label={t(`${index + 1} من 5`, `${index + 1} of 5`)}>
              <span aria-hidden="true">{face}</span><small className="eng">{index + 1}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="panel survey-q">
        <legend>2. {t('ما احتمال أن تنصح صديقاً بـ TechMood؟', 'How likely are you to recommend TechMood to a friend?')}</legend>
        <div className="survey-scale" role="radiogroup">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" role="radio" aria-checked={recommend === n}
                    className={`survey-num${recommend === n ? ' is-on' : ''}`} onClick={() => setRecommend(n)}>
              <span className="eng">{n}</span>
            </button>
          ))}
        </div>
        <div className="survey-scale-ends muted"><span>{t('لا أنصح', 'Not likely')}</span><span>{t('أنصح بشدة', 'Very likely')}</span></div>
      </fieldset>

      <fieldset className="panel survey-q">
        <legend>3. {t('ما أكثر ما تستخدمه؟', 'What do you use most?')}</legend>
        <div className="chip-row">
          {MOST_USED.map((item) => (
            <button key={item.key} type="button" className={`chip${mostUsed === item.key ? ' is-active' : ''}`}
                    aria-pressed={mostUsed === item.key} onClick={() => setMostUsed(mostUsed === item.key ? '' : item.key)}>
              <span aria-hidden="true">{item.icon}</span> {t(item.label)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="panel survey-q">
        <legend>4. {t('ما الذي يزعجك أو يعيقك؟ (اختر ما ينطبق)', 'What gets in your way? (pick any)')}</legend>
        <div className="chip-row">
          {PAINS.map((item) => (
            <button key={item.key} type="button" className={`chip${pains.includes(item.key) ? ' is-active' : ''}`}
                    aria-pressed={pains.includes(item.key)} onClick={() => togglePain(item.key)}>
              {t(item.label)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="panel survey-q">
        <legend>5. {t('ماذا تقترح أن نضيف أو نحسّن؟', 'What should we add or improve?')}</legend>
        <textarea rows={4} maxLength={1000} value={suggestion} onChange={(e) => setSuggestion(e.target.value)}
                  placeholder={t('فكرة، ميزة، أو شيء أزعجك…', 'An idea, a feature, or something that bothered you…')} />
      </fieldset>

      {error && <p className="notice notice-danger">{error}</p>}
      <button className="btn btn-primary survey-send" type="submit" disabled={pending}>
        {pending ? t('يُرسل…', 'Sending…') : t('أرسل رأيي', 'Send my answer')}
      </button>
    </form>
  );
}
