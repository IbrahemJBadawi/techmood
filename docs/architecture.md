# Architecture

## The shape of the data

Everything hangs off one table. `profiles.id` is the primary key of
`auth.users`, so an account and an identity are the same row, and every module —
academy, mentors, teams, wallet, work — references it. There is no second notion
of "user" anywhere in the schema.

```
auth.users ──1:1── profiles ──< profile_roles        (student auto-approved, rest reviewed)
                      │
                      ├──< enrollments / lesson_progress
                      ├──< submissions ──< submission_versions ──< submission_evidence
                      │         └──< evaluations  (append-only)
                      ├──< xp_events            (append-only, idempotent)
                      ├──< certificates         (snapshot frozen at issue time)
                      ├──< bookings ──< payments (manual verification)
                      ├──< team_members ──> teams
                      └──< wallet_entries
```

### Academy

`schools → learning_paths → path_courses → courses → modules → lessons`

A course is standalone and carries its own certificate. `path_courses.is_required`
decides which courses gate a path's completion; electives still earn XP. This is
the one structural change from the prototype, which had courses trapped inside a
single path.

Gradeable work lives in one table, `assignments`, discriminated by `kind`
(lesson assignment, course task, course project, path project). That is what
lets a single submission pipeline, a single evaluation history and a single XP
ledger serve all of them instead of the prototype's three parallel copies.

## Authorization

Three layers, in this order:

1. **Grants** (`0013_grants.sql`) decide which tables and functions a role may
   address at all. `award_xp()` and `notify()` are deliberately ungranted:
   they are `SECURITY DEFINER` helpers with no authorization of their own, so
   only triggers may reach them.
2. **RLS** (`0011_rls.sql`) decides which rows. Catalogue tables are world-readable
   and admin-written; personal tables are owner-only; money tables are payer-and-admin.
3. **Function checks** for anything a policy cannot express — `evaluate_submission()`
   verifies the mentor role, `verify_payment()` verifies admin, `issue_certificate()`
   verifies eligibility.

Helper functions (`current_profile_id`, `has_role`, `is_admin`, `is_mentor`,
`is_team_member`, `is_team_leader`, `is_conversation_participant`) are the single
source of truth. They are `SECURITY DEFINER` with `set search_path = ''` and
fully-qualified names, which is what keeps them safe to call from a policy.

## State machines

**Booking** — the ten states from the product spec, with the legal edges listed
explicitly in `enforce_booking_transition()`:

```
draft → payment_pending → payment_submitted → payment_verified
      → mentor_pending → confirmed → completed
                       ↘ rejected / cancelled / refunded
```

`confirmed` additionally requires a verified payment row to exist. A `draft`
does not hold the mentor's slot — an abandoned cart must not block other
students — but every live state does, enforced by a GiST exclusion constraint.

**Submission** — `draft → submitted → (changes_requested → submitted)* → approved`.
Each pass through creates a new `submission_versions` row and a new `evaluations`
row. Nothing is ever updated in place, so a re-evaluation can always be compared
with the original.

## XP and Stars

Two systems that must not be confused:

- **XP** is quantity and progress. It is an append-only ledger (`xp_events`) with
  a uniqueness constraint on `(profile_id, source, ref_table, ref_id)`, so an
  event can never pay twice. The amounts come from the `xp_rules` table, which
  makes the economy a data change rather than a code change.
- **Stars** are quality, 1–5, and exist only on `evaluations`. The profile
  average is a view over approved evaluations.

## What is built, and what is next

| Module | Schema + rules + RLS | Screens |
|---|---|---|
| Identity, roles, review | ✅ tested | ✅ signup, passport, admin |
| Academy catalogue | ✅ tested | ✅ paths, courses, lessons |
| Submissions & evaluation | ✅ tested | ✅ student side; mentor review UI next |
| XP & Stars | ✅ tested | ✅ passport, home |
| Certificates & verification | ✅ tested | ✅ issue, list, public /verify |
| Mentors, availability, levels | ✅ tested | — directory and profile next |
| Bookings & payments | ✅ tested | — booking flow and payment upload next |
| Teams & workspace | ✅ tested | — team pages next |
| Messaging | ✅ tested | — inbox next |
| Wallet | ✅ tested | — ledger view next |
| Marketplace, incubator | ✅ schema + RLS | — next |

The order above is the recommended build order: the mentor review UI closes the
loop a student already starts, and the booking flow is what turns the platform
into a business.
