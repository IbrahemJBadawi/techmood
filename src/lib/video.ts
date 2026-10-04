/**
 * Turning a video link into something that plays inside the page.
 * YouTube (watch, youtu.be, shorts), Vimeo and Google Drive files become an
 * embedded player; a direct .mp4/.webm/.ogg file plays in <video>; anything
 * else stays a link that opens in a new tab.
 */
export type PlayableVideo =
  | { kind: 'embed'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'link'; src: string };

export function playable(url: string): PlayableVideo {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be') return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}${u.searchParams.get('t') ? `?start=${parseInt(u.searchParams.get('t')!, 10) || 0}` : ''}` };
    if (host === 'youtube.com') {
      const id = u.searchParams.get('v')
        ?? (u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/') || u.pathname.startsWith('/live/') ? u.pathname.split('/')[2] : null);
      const list = u.searchParams.get('list');
      if (id) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}` };
      if (list) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}` };
    }
    if (host === 'vimeo.com' && /^\/\d+/.test(u.pathname)) return { kind: 'embed', src: `https://player.vimeo.com/video${u.pathname}` };
    if (host === 'player.vimeo.com') return { kind: 'embed', src: url };
    if (host === 'drive.google.com') {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id');
      if (id) return { kind: 'embed', src: `https://drive.google.com/file/d/${id}/preview` };
    }
    if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) return { kind: 'file', src: url };
  } catch {
    /* not a URL */
  }
  return { kind: 'link', src: url };
}
