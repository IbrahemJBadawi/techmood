# TechMood Technology

منصة واحدة تربط التعلّم، الإرشاد، الفرق، العمل، وريادة الأعمال.

> **One account → one TechMood ID → one professional identity → one reputation → many journeys.**

This repository is the production rebuild of the TechMood prototype: the design,
the Arabic catalogue and the product ideas are carried over unchanged; the data
model, the authorization and the business rules are new and live in the database.

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, React 19, TypeScript, Server Actions) |
| Data | Supabase — PostgreSQL 17, Auth, Storage |
| Authorization | Row Level Security + `SECURITY DEFINER` functions |
| Styling | Plain CSS with design tokens, RTL-native, light/dark |
| Languages | Arabic and English, chosen per account |

No component framework and no CSS framework: the prototype's visual identity is
expressed directly as tokens in `src/app/globals.css`.

---

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL + anon key

# create the schema in your Supabase project
npx supabase link --project-ref <your-project-ref>
npx supabase db push              # applies supabase/migrations in order
psql "$DATABASE_URL" -f supabase/seed.sql   # loads the academy catalogue

npm run dev
```

### Signing in with Google

`Continue with Google` is wired up in the app, but the provider itself is
configured outside this repository:

1. Google Cloud → APIs & Services → Credentials → OAuth client ID (Web).
2. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase dashboard → Authentication → Providers → Google → paste the client
   ID and secret.
4. Set `NEXT_PUBLIC_SITE_URL` so the callback returns to the right origin.

Until that is done the button reports that the provider is not enabled rather
than failing silently. Email and password keep working either way — which is
also how the first admin below signs in.

### Languages

The interface is Arabic and English. The choice is stored on the account and
mirrored to a cookie, which is what each render reads and what a signed-out
visitor gets; `<html lang>` and `dir` follow it on the server, so the first
frame is already laid out correctly.

Content is not translated — a course description, a mentor bio, a message
someone wrote. Where a row carries its own English (`courses.title_en`,
`fields.name_en`) it is used; otherwise the Arabic is shown as written. See
`docs/architecture.md` for why.

### Making yourself an admin

The database refuses to let anyone grant themselves `admin`. Run this once,
against your project, after signing up:

```sql
insert into public.profile_roles (profile_id, role, status)
select id, 'admin', 'approved' from public.profiles where techmood_id = 'TMU-XXXXXXXX';
```

---

## Testing

The business rules are tested against a real PostgreSQL instance — no mocks.

```bash
scripts/validate-migrations.sh    # every migration applies cleanly, in order
scripts/test.sh                   # 404 business-rule assertions
```

Both take psql connection arguments, e.g. `scripts/test.sh -h localhost -U postgres`.

The suite covers identity and TechMood IDs, role review, the XP economy,
evaluation history, cross-mentor review visibility, RLS isolation between users,
certificate eligibility, mentor availability and derived slots, price integrity,
the booking state machine, reservation expiry, payment verification and receipt
rules, team workspace privacy, task and sprint rules, team XP, message rules and
reactions, invitations, and the admin surface.

---

## The rules this codebase exists to enforce

These were the failures found in the prototype audit. Each one is now a
database constraint with a test, not a UI convention:

1. **A certificate comes from approved work.** `issue_certificate()` refuses
   until every required assignment has an approved evaluation. Ticking lessons
   is not enough.
2. **XP and Stars are different systems.** XP measures progress and is an
   append-only, idempotent ledger driven by `xp_rules`. Stars measure quality
   and come only from evaluations. Neither is derived from the other.
3. **XP numbers are small and legible.** A lesson is 5, a graded assignment is
   3–15, a course is 25, a full path is 100.
4. **Every evaluation is traceable.** Resubmitting creates a new version; the
   earlier submission, its feedback and its score all survive.
5. **A booking is never confirmed before its payment is verified** and the
   mentor has accepted it. Slot, booking and payment are three separate state
   machines, so "paid but not yet accepted" is sayable instead of collapsing
   into one misleading flag.
5b. **The price is read from the mentor's level in the database.** Bookings are
   created by `create_booking_request()` and clients hold no INSERT policy, so
   nobody books a $100 session for $0.
6. **Mentor prices come from the published L1–L6 ladder**, and the platform and
   mentor shares must always sum to the session price.
7. **Availability is capped at 5 hours a day**, and a session needs 3 days'
   notice so a human can verify the payment.
8. **Payment proof is private** to the payer and admins — not the mentor.
9. **Changing an id in a URL gets you nothing.** Every table has RLS; helper
   functions, not client code, decide identity.
10. **Internal helpers are not callable by clients.** `award_xp()` and
    `notify()` have no grant, so nobody can mint XP or write into your inbox.
11. **A team is a closed workspace.** Its tasks, chat and documents are members-only;
    a team may opt into a public professional profile, and that publishes its name,
    members and finished projects — never its work in progress.
12. **A learning path is always open** — no cohorts, no intake windows. One
    permanent conversation per path, joined by enrolling, never closed.
13. **Exhibition contributions are derived, never self-reported.** Who built what
    is counted from completed tasks on the board, and an approved entry carries a
    frozen snapshot — so the gallery is public while the team behind it stays private.
14. **The wallet is a ledger, not a stored number.** A balance is the sum of its
    entries; requesting a payout holds the money immediately so the same balance
    cannot be requested twice, and rejecting returns it by cancelling the held row.
15. **A founder's thinking stays private.** A startup can be listed publicly, but
    its canvas, business plan and strategy are visible only to its own team — and
    applying to the incubator requires a canvas that was actually filled in.
16. **SMART means SMART.** A goal needs a metric with numbers that move and a date
    range; progress is computed from those numbers and shown against time elapsed,
    so drift is visible before the deadline.
17. **Posting work requires a reviewed role; applying does not.** A student-only
    account consumes the marketplace — that is what role review exists for. An
    applicant arrives with their record, and the poster sees it only because that
    person applied to them.
18. **Requirements are advisory, never a gate.** A platform whose point is growth
    must not tell someone they are not allowed to try: the match is shown honestly
    to both sides and the human decides.
19. **The chat is not where work is tracked.** A blocked task must say what is
    blocking it, every task carries an owner, a state and a date, and the chat only
    receives system messages reporting what happened on the board.

---

## Layout

```
src/
  app/
    (auth)/          login, signup, role requests
    (app)/           the signed-in shell: home, passport, academy, certificates, admin
    verify/[code]/   public certificate verification (the QR target)
  lib/
    supabase/        browser, server and proxy clients
    database.types.ts
supabase/
  migrations/        0001-0013, applied in order
  seed.sql           generated — edit scripts/build-seed.py instead
scripts/
  validate-migrations.sh, test.sh, test-rules.sql, build-seed.py, local-shim.sql
docs/
  audit-phase-1.md   the prototype audit this rebuild answers
  architecture.md    schema and authorization model
```

---

## Status

Built and tested end to end: identity and roles, the academy catalogue, lesson
progress, submissions with evaluation history, the mentor review queue,
certificates and public verification, the full booking and payment journey
(mentor directory → session type → slot → goal → payment method → receipt →
admin verification → mentor approval → confirmed), and the admin surface.

Also built: the team workspace (board with a real `blocked` column, sprints,
members and invitations by TechMood ID, activity log, team XP and stars) and
Messages — a private contextual chat with replies, reactions, read state and
system messages, and no links, files or posts by design.

Also built: team projects and the Exhibition — a completed project is submitted,
reviewed by an admin, then published to a public gallery and onto the passport of
everyone who worked on it.

Also built: the wallet — ledger, payout accounts, payout requests with an admin
transfer queue, and refunds that credit the student and cancel the mentor's
earning.

Also built: the Incubator — startups with a stage ladder, an interactive Business
Model Canvas (editable, colourable, draggable cards), a ten-section business plan
with real progress, and strategy with vision, mission, SWOT and SMART goals.

Also built: team documents, the team calendar and team settings — completing the
workspace. And the marketplace — listings with structured pay and advisory
requirements, evidence-backed applications, a poster's applicant queue, and team
seats that route into the team's own decision queue instead of duplicating it.

**Every module now has its screens.** What remains is not a missing feature but
the step this repository cannot take for you: creating the Supabase project,
running `supabase db push`, and exercising the interface against live data.
Each already has its tables, policies and tested rules — see
`docs/architecture.md`.

### Scheduled job

`public.expire_stale_bookings()` releases slots held by reservations that were
never paid for. Run it every few minutes with pg_cron:

```sql
select cron.schedule('expire-bookings', '*/5 * * * *', $$select public.expire_stale_bookings()$$);
```
