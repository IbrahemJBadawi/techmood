# TechMood — developer handover

Start here if you are a developer picking this code up. It says how the
system is put together, where each kind of change goes, and the rules that
keep it safe. The README has setup commands; `docs/architecture.md` has the
full schema and authorization model.

---

## 1. The shape of the system

```
Browser ──▶ Next.js 16 (App Router, React 19, TypeScript) on Vercel
              │   server components read with the signed-in person's session
              │   server actions write through database functions (RPC)
              ▼
            Supabase (Postgres 17 + Auth + Storage + Edge Functions)
              │   every rule lives here: RLS policies + SECURITY DEFINER functions
              │   pg_cron runs the clock (bookings, sessions, reminders, mail, push)
              ▼
            Edge Functions: push-dispatch (device notifications), email-dispatch (Resend)
```

**The one idea to keep:** the database is the authority. The app never uses a
service-role key; every query runs as the person who is signed in, so a page
that forgets a check still cannot read or write what RLS refuses. Buttons are
hidden in the interface for convenience, never for security.

## 2. Where to change things

| You want to… | Go to |
|---|---|
| Change a rule (who may do what, limits, prices, statuses) | a **new** migration in `supabase/migrations/` — never edit an applied one |
| Add a page | `src/app/(app)/<area>/page.tsx` (signed-in) or `src/app/<route>` (public) |
| Add a form that writes | a server action in the area's `actions.ts` calling an RPC; show errors with `ActionForm` |
| Show a database error in English | add its distinctive Arabic fragment to `src/lib/db-errors.ts` |
| Add a menu entry | `src/lib/roles.ts` (`ROLE_NAV`, and `MVP_ROLE_NAV` for the MVP menus) |
| Hide/show whole areas for the MVP | `src/lib/scope.ts` |
| Format a date or time | `formatDate` / `formatDateTime` in `src/lib/i18n.ts`, or pass `timeZone: PLATFORM_TIME_ZONE` (`src/lib/zoned.ts`) |
| Read a date and time typed in a form | `localToUtc(date, time)` in `src/lib/zoned.ts` |
| Add text | `t('عربي', 'English')` — Arabic is the source, English beside it |
| Add a notification kind | enum value in a migration **and** `NotificationKind` in `database.types.ts` **and** an entry in `NOTIFICATION_KIND` (`src/lib/notifications.ts`) |
| Change academy content | admin screens, the mentor studio (`/studio`), or `import_course()` (0112) |
| Change what the AI assistant may do | `ai_action_kinds` rows and `src/lib/ai-claude.ts` |

## 3. House rules (each one prevented a real bug)

1. **Rules in the database.** A new write goes through a function that checks
   the caller (`auth.uid()`, `is_admin()`, `is_team_leader()`…) and raises a
   clear Arabic message. RLS stays on for every table.
2. **A SECURITY DEFINER function skips RLS**, so it must re-check access itself.
   `roadmap()` once returned any company's roadmap because it did not (fixed in
   0116). Internal helpers get `revoke execute … from public, anon, authenticated`.
3. **Palestine's clock everywhere.** Vercel runs in UTC. Never call
   `toLocaleString()` or `new Intl.DateTimeFormat()` without `timeZone`; never
   build a date from form fields with `new Date('…T18:00')`.
4. **Types are kept by hand.** `src/lib/database.types.ts` is edited with each
   migration: new columns, new RPCs, new enum values. A missing enum value there
   is how the notification settings page crashed on `'reminder'`.
5. **Every migration comes with tests** in `scripts/test-rules.sql` (numbered
   sections). Test rules, not counts of seed rows: another migration will add rows.
6. **No secrets or personal financial data in the repo** — not in code,
   migrations, tests or commits. Account numbers live in the `payment_methods`
   table (Admin → Payment methods); keys live in Vault or Vercel.
7. **The AI never acts alone** on money, bookings, sensitive data, deletions or
   messages in someone's name: it proposes, the person confirms.

## 4. Working locally

```bash
npm install
cp .env.template .env.local       # fill in the Supabase URL and anon key
npm run dev                        # http://localhost:3000
npx tsc --noEmit && npx eslint src # before every commit
bash scripts/test.sh -h <pg host or socket> -U postgres   # all business-rule tests on a fresh database
```

`scripts/test.sh` creates a throw-away database, applies every migration,
the seed, then `scripts/test-rules.sql`, and drops it. It must end with
«all business rule tests passed».

## 5. Shipping a change

1. Migration first: apply it to Supabase (SQL editor, or `supabase db push`)
   and make sure it is recorded in `supabase_migrations.schema_migrations`.
2. Then the app: push to `main`; Vercel builds and deploys.
3. After a migration that adds or changes RPCs: `notify pgrst, 'reload schema';`.
4. Check the page you changed on the live site, signed in as the role it serves.

## 6. Configuration and secrets — where each one lives

| Name | Where | What for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | the app's connection (public by design; RLS protects the data) |
| `NEXT_PUBLIC_SITE_URL` | Vercel env | absolute links (sign-in redirects, share links) |
| `NEXT_PUBLIC_TECHMOOD_SCOPE` | Vercel env | unset = MVP areas only (the default); `full` = everything |
| `ANTHROPIC_API_KEY` | Vercel env (server only) | the AI assistant; without it the assistant says nothing is connected |
| `email_api_key` | Supabase Vault | Resend key for outgoing mail |
| `push_vapid_private_key`, `push_dispatch_secret`, `email_dispatch_secret` | Supabase Vault | device notifications and the dispatch functions |
| `email_from`, `push_vapid_public_key`, `ai_daily_messages`, … | `platform_settings` table | non-secret settings an admin may change |
| Bank / wallet details shown to payers | `payment_methods` table | Admin → Payment methods |

## 7. Security model in one screen

- Every table has RLS; signed-out visitors hold no write grant on any table
  and no client role may TRUNCATE (0116).
- Storage buckets are private except `avatars`; each has a size limit and the
  proof buckets a file-type list; paths start with the owner's id or the
  project/brief id, which the policies check.
- Security headers (no framing, nosniff, referrer policy, permissions policy,
  HSTS) are set in `next.config.ts`.
- The assistant has a daily per-person limit (`ai_daily_messages`).
- Supabase's security advisor still lists ~350 functions "callable by signed-in
  users": that is the design (writes go through functions), and each checks
  its caller. When you add one, check it the same way.

## 8. Known gaps (not bugs, decisions to make later)

- No full Content-Security-Policy yet (needs nonces for Next's inline scripts).
- `pg_net` sits in the `public` schema (Supabase's default when enabled); its
  functions live in the `net` schema, which the API does not expose.
- Leaked-password protection is a Supabase Auth dashboard switch (Pro plan).
