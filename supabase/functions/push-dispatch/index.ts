// push-dispatch — sends TechMood's queued device notifications (0100).
//
// Woken every minute by pg_cron (public.dispatch_push) with a shared secret.
// Reads its VAPID keys and that secret from the database (public.push_config,
// which reads Supabase Vault) with the service role the platform injects, so
// no key lives in this file or in the app. Claims a batch from the outbox,
// sends each to every device of its person, reports back, and drops devices
// the push service says are gone.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
type Item = { id: string; title: string; body: string | null; url: string | null; subscriptions: Subscription[] };

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: config, error: configError } = await supabase.rpc('push_config').single();
  const cfg = config as { public_key: string | null; private_key: string | null; subject: string; dispatch_secret: string | null } | null;
  if (configError || !cfg?.dispatch_secret || req.headers.get('x-dispatch-secret') !== cfg.dispatch_secret) {
    return new Response('forbidden', { status: 403 });
  }
  if (!cfg.public_key || !cfg.private_key) {
    return Response.json({ sent: 0, reason: 'VAPID keys are not configured' });
  }

  webpush.setVapidDetails(cfg.subject, cfg.public_key, cfg.private_key);

  const { data: batch, error } = await supabase.rpc('claim_push_batch', { p_limit: 50 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const item of (batch ?? []) as Item[]) {
    const payload = JSON.stringify({ title: item.title, body: item.body ?? '', url: item.url ?? '/notifications', tag: item.id });
    const gone: string[] = [];
    let delivered = 0;
    let lastError: string | null = null;

    for (const sub of item.subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.id);
        lastError = `${status ?? ''} ${(err as Error).message}`.trim();
      }
    }

    await supabase.rpc('mark_push_result', {
      p_outbox: item.id,
      p_ok: delivered > 0,
      p_error: delivered > 0 ? null : (lastError ?? 'no device'),
      p_gone: gone,
    });
    if (delivered > 0) sent += 1;
  }

  return Response.json({ sent, claimed: (batch ?? []).length });
});
