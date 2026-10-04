'use client';

import { useState } from 'react';

import { useT } from '@/lib/i18n.client';
import { playable } from '@/lib/video';

export type PlayerVideo = { id: string; title: string; url: string; minutes: number | null; description: string | null };

/**
 * A lesson's videos, played inside the page (YouTube, Vimeo, Drive, a video
 * file). Several videos form a playlist: the first plays, the rest are a tap
 * away. A link that cannot be embedded opens in a new tab.
 */
export function LessonPlayer({ videos }: { videos: PlayerVideo[] }) {
  const t = useT();
  const [active, setActive] = useState(0);
  const video = videos[active];
  if (!video) return null;
  const play = playable(video.url);

  return (
    <div className="lp">
      <div className="lp-stage">
        {play.kind === 'embed' && (
          <iframe key={play.src} src={play.src} title={video.title} loading="lazy"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
        )}
        {play.kind === 'file' && <video key={play.src} src={play.src} controls preload="metadata" playsInline />}
        {play.kind === 'link' && (
          <a className="lp-external" href={play.src} target="_blank" rel="noreferrer">
            ▶ {t('افتح الفيديو', 'Open the video')} ↗
          </a>
        )}
      </div>
      <div className="lp-meta">
        <strong>{video.title}</strong>
        {video.minutes && <span className="muted eng"> · {video.minutes} min</span>}
        {play.kind !== 'link' && <a className="lp-open" href={video.url} target="_blank" rel="noreferrer">{t('افتح في نافذة ↗', 'Open in a tab ↗')}</a>}
        {video.description && <p className="muted lesson-text">{video.description}</p>}
      </div>
      {videos.length > 1 && (
        <ol className="lp-list">
          {videos.map((item, index) => (
            <li key={item.id}>
              <button type="button" className={index === active ? 'is-active' : ''} onClick={() => setActive(index)}
                      aria-current={index === active ? 'true' : undefined}>
                <span className="lp-num eng">{index + 1}</span>
                <span>{item.title}</span>
                {item.minutes && <span className="muted eng">{item.minutes}′</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
