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
scripts/test.sh                   # 63 business-rule assertions
```

Both take psql connection arguments, e.g. `scripts/test.sh -h localhost -U postgres`.

The suite covers identity and TechMood IDs, role review, the XP economy,
evaluation history, RLS isolation between users, certificate eligibility,
mentor availability, the booking state machine, payment verification, message
rules, team quotas and the admin surface.

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
   mentor has accepted it. The state machine lives in a trigger.
6. **Mentor prices come from the published L1–L6 ladder**, and the platform and
   mentor shares must always sum to the session price.
7. **Availability is capped at 5 hours a day**, and a session needs 3 days'
   notice so a human can verify the payment.
8. **Payment proof is private** to the payer and admins — not the mentor.
9. **Changing an id in a URL gets you nothing.** Every table has RLS; helper
   functions, not client code, decide identity.
10. **Internal helpers are not callable by clients.** `award_xp()` and
    `notify()` have no grant, so nobody can mint XP or write into your inbox.

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

Built and tested: identity, roles and review, the academy catalogue, lesson
progress, submissions and evaluation history, the XP economy, certificates and
public verification, and the admin review queue.

Schema, rules and security are complete for the whole platform — mentors,
bookings, payments, teams, messaging, wallet, marketplace and the incubator all
have their tables, policies and tested business rules. What those modules still
need is their screens; see `docs/architecture.md` for what exists behind each.
