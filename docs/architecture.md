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

**Slot** — not a table. A slot is derived from the mentor's availability rules,
their date-level exceptions, their time off, and the live bookings that overlap
it. A "pending reservation" is a booking in `payment_pending` whose
`reserved_until` is still in the future, so there is one source of truth for
whether an hour is taken and no second table to drift.

**Payment** — `pending → under_review → verified | rejected | failed`, with
`refunded` reachable afterwards. A rejected receipt sends the booking back to
`payment_pending` with a fresh hold, so the student keeps their appointment
while they fix it.

**Task** — `todo → doing → review → done`, with `blocked` reachable from any of
them. `blocked` is a column rather than a flag, and the database refuses a
blocked task that does not record what is blocking it: a team leader's whole job
on the dashboard is seeing where to step in.

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
| Submissions & evaluation | ✅ tested | ✅ student side + mentor review queue |
| XP & Stars | ✅ tested | ✅ passport, home |
| Certificates & verification | ✅ tested | ✅ issue, list, public /verify |
| Mentors, availability, levels | ✅ tested | ✅ directory, profile, slots |
| Bookings & payments | ✅ tested | ✅ full journey + admin verification |
| Teams & workspace | ✅ tested | ✅ board, sprints, members, invites |
| Messaging | ✅ tested | ✅ full chat with replies and reactions |
| Wallet | ✅ tested | — ledger view next |
| Projects & Exhibition | ✅ tested | ✅ team projects, public gallery, admin review |
| Marketplace, incubator | ✅ schema + RLS | — next |

The order above is the recommended build order: the mentor review UI closes the
loop a student already starts, and the booking flow is what turns the platform
into a business.

## Teams and messaging

A team is a closed workspace, not a group chat. Tasks, sprints, documents and
the activity log are first-class; the conversation only reports what happened
elsewhere, through system messages written by triggers. That separation is
deliberate — it is what stops work from disappearing into a chat thread.

`teams.visibility` decides exposure: `private` hides the team completely, while
`listed` publishes only the professional profile the team opted into. Neither
ever exposes tasks, chat or documents, and the RLS policies name the leader
explicitly so a creator can read back the team they just made.

Conversations are never created by a person. All four kinds are opened by the
database: an admin thread when an account is created, a team chat when a team
is, a mentor conversation when a booking is confirmed, and a path conversation
when a path is published. Members join and leave the team chat with their
membership, and enrolling in a path joins its chat. There is no "new chat",
because every conversation must be backed by a relationship that already exists.

**A learning path is always open.** This is a product decision, not an
omission: there are no cohorts, no intake windows and no end date. So a path has
exactly one conversation for as long as it exists, enrolment is idempotent, and
the conversation is never closed or split. Anything that would need a per-intake
chat — a dated cohort, a graduation — would be a change to the Academy, not to
Messages.

An admin answers support threads through a policy rather than by being stored in
every one of them, so onboarding a new admin does not mean backfilling them into
thousands of conversations.

Team XP lives in its own ledger (`team_xp_events`), separate from personal XP,
so a team's reputation is neither the sum of its members' nor a way to inflate
it. A completed task pays the team 2 XP, plus 5 when it landed on time, and the
assignee a small fixed personal amount.

## Exhibition

The last link in the chain: Team → Project → Mentor → Evaluation → **Exhibition**
→ Portfolio → Work. Without it a finished project stays inside a private
workspace and never reaches anyone's professional record.

Two decisions shape it:

**Contributions are derived.** Who did what on a project is counted from the
completed tasks that point at it, through `project_contributions()`. Asking
people to describe their own contribution would invite a nicer story than the
one the board tells, and the whole point of the platform is evidence.

**Approval freezes a snapshot**, the same pattern as certificates. The gallery is
public while most teams are private workspaces, so publishing copies what was
approved — project, team name, members and their task counts, mentor reviews,
evidence links — instead of opening a window into live data. `exhibition_gallery`
reads snapshots only, and `profile_exhibition_entries()` finds a member inside
them for their passport.

A team earns its `project_completed` XP when the work is published, not when the
last task is ticked: the reward attaches to work that survived review.
