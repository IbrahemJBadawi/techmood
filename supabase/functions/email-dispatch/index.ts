// email-dispatch — sends TechMood's queued email (0065, 0111).
//
// Woken every minute by pg_cron (public.dispatch_email) with a shared secret.
// Reads the mail provider's API key, the sender and that secret from the
// database (public.email_config, which reads Supabase Vault) with the service
// role the platform injects, so no key lives in this file or in the app.
// Claims a batch from the outbox, sends each message through Resend, and
// reports back. Until a key and a sender exist it does nothing.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Item = { id: string; to_email: string; subject: string; body_ar: string; action_url: string | null };
type Config = { api_key: string | null; from_address: string | null; site_url: string; dispatch_secret: string | null };

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// A path from a notification becomes a link on the site; anything else that
// is not a web address is dropped rather than sent.
function linkFor(site: string, actionUrl: string | null): string {
  const base = site.replace(/\/+$/, '');
  if (!actionUrl) return `${base}/notifications`;
  if (actionUrl.startsWith('/') && !actionUrl.startsWith('//')) return `${base}${actionUrl}`;
  if (/^https:\/\//.test(actionUrl)) return actionUrl;
  return `${base}/notifications`;
}

function html(item: Item, link: string, site: string): string {
  const base = site.replace(/\/+$/, '');
  const body = escape(item.body_ar).replace(/\n/g, '<br>');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<body style="margin:0;padding:24px 12px;background:#f4f7fb;font-family:Tahoma,Arial,sans-serif;color:#0f1b2d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e3e9f2">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #e3e9f2">
      <img src="${base}/logo-mark.png" width="32" height="32" alt="" style="vertical-align:middle">
      <strong style="font-size:18px;vertical-align:middle;margin-inline-start:8px">TechMood</strong>
    </td></tr>
    <tr><td style="padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px">${escape(item.subject)}</h1>
      <p style="font-size:16px;line-height:1.8;margin:0 0 20px">${body}</p>
      <a href="${escape(link)}" style="display:inline-block;background:#006BE0;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:bold">افتح في TechMood</a>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #e3e9f2;font-size:13px;color:#627284;line-height:1.7">
      وصلتك هذه الرسالة لأن إشعارات البريد مفعّلة في حسابك.
      <a href="${base}/settings/notifications" style="color:#006BE0">غيّر تفضيلات الإشعارات</a>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: config, error: configError } = await supabase.rpc('email_config').single();
  const cfg = config as Config | null;
  if (configError || !cfg?.dispatch_secret || req.headers.get('x-dispatch-secret') !== cfg.dispatch_secret) {
    return new Response('forbidden', { status: 403 });
  }
  if (!cfg.api_key || !cfg.from_address) {
    return Response.json({ sent: 0, reason: 'no mail provider key or sender is configured' });
  }

  const { data: batch, error } = await supabase.rpc('claim_email_batch', { p_limit: 30 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const [index, item] of ((batch ?? []) as Item[]).entries()) {
    // The provider's free tier takes two requests a second.
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 550));
    const link = linkFor(cfg.site_url, item.action_url);
    let ok = false;
    let lastError: string | null = null;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: cfg.from_address,
          to: [item.to_email],
          subject: item.subject,
          html: html(item, link, cfg.site_url),
          text: `${item.subject}\n\n${item.body_ar}\n\n${link}`,
          headers: { 'X-Entity-Ref-ID': item.id },
        }),
      });
      ok = res.ok;
      if (!ok) lastError = `${res.status} ${(await res.text()).slice(0, 300)}`;
    } catch (err) {
      lastError = (err as Error).message;
    }

    await supabase.rpc('mark_email_sent', { p_email: item.id, p_ok: ok, p_error: ok ? null : lastError });
    if (ok) sent += 1;
  }

  return Response.json({ sent, claimed: (batch ?? []).length });
});
