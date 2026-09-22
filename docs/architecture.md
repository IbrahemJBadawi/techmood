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
| Academy catalogue | ✅ tested | ✅ discovery hub, paths, courses, lessons |
| Submissions & evaluation | ✅ tested | ✅ student side + mentor review queue |
| XP & Stars | ✅ tested | ✅ passport, home |
| Certificates & verification | ✅ tested | ✅ issue, list, public /verify |
| Mentors, availability, levels | ✅ tested | ✅ directory, profile, slots |
| Bookings & payments | ✅ tested | ✅ full journey + admin verification |
| Teams & workspace | ✅ tested | ✅ board, sprints, members, calendar, documents, settings |
| Messaging | ✅ tested | ✅ full chat with replies and reactions |
| Wallet & payouts | ✅ tested | ✅ ledger, payout accounts, admin transfers |
| Projects & Exhibition | ✅ tested | ✅ team projects, public gallery, admin review |
| Incubator & startups | ✅ tested | ✅ canvas, plan, strategy, admin review |
| Marketplace | ✅ tested | ✅ listings, applications, applicant evidence |

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

The last link in the chain: Team → Project → **Mentor evaluation** → Exhibition
→ Portfolio → Work. Without it a finished project stays inside a private
workspace and never reaches anyone's professional record.

Four decisions shape it.

**Contributions are derived.** Who did what on a project is counted from the
completed tasks that point at it, through `project_contributions()`. Asking
people to describe their own contribution would invite a nicer story than the
one the board tells, and the whole point of the platform is evidence.

**A mentor judges, against six criteria.** 0021 let only an admin approve an
entry; 0037 makes it "a mentor or an admin", which is what every other piece of
work on this platform has had since 0004. The rubric — requirements, technical
quality, UI/UX, problem solving, documentation, completeness — is stored as six
rows in `exhibition_review_scores`, and the overall rating is their average,
computed by `exhibition_review_rating()` and never typed by anyone. Reviews are
append-only: a second review of a second version is a second row, which is what
makes a project's history readable without a parallel log.

**Approving and exhibiting are separate decisions.** They used to be one step.
Approval is the mentor's judgement; exhibiting is the builder's choice to make
the work public, and `publish_exhibition_entry()` is theirs to call. This is the
same rule the academy follows when it refuses to make anyone publish their work
to be graded. The read policy had to move with it: 0019 opened `approved` to the
world, and `approved` now means *judged but not published*, so only `exhibited`
is public. That was the one real hole this change could have left.

**Approval freezes a snapshot**, the same pattern as certificates. The gallery is
public while most teams are private workspaces, so publishing copies what was
approved — project, problem, solution, outcome, the builders and their task
counts, the mentor's rubric and feedback, evidence links — instead of opening a
window into live data. `exhibition_gallery` reads snapshots only, and
`profile_exhibition_entries()` finds a person inside them for their passport and
their public profile, whether they built it in a team or alone.

A team earns its `project_completed` XP when the work survives review, not when
the last task is ticked. The rating is quality, the XP is progress, and neither
is computed from the other — the project page says so in as many words.

## The profile is an identity in three layers

A profile used to be one row with three link columns and a single boolean,
`is_public`, which answers "may anyone see me" and nothing else. 0042 makes it
the professional identity the platform is for.

Visibility is now a decision per section, `profile_section_visibility`:

* **public** — anyone, signed in or not;
* **professional** — signed-in members carrying an approved working role (a
  mentor, team leader, company or founder), plus admins;
* **private** — the owner and admins only.

`profiles.is_public` stays and still wins: a profile switched off publishes
nothing whatever its sections say. Per-section settings narrow, never widen —
one switch to disappear, finer control while visible. `can_see_profile_section()`
is the only place that rule is written, and every query on a profile asks it
rather than reimplementing it.

**The card is the hero and the thing people share.** `profile_card()` returns
it in one row and every number on it is counted from the record: the level from
the XP ladder, the stars from approved evaluations, the counts from
certificates issued, projects exhibited, sessions completed, skills proven.
Nothing on the card can be typed in, which is what makes it worth sharing —
and `/u/<id>/card` is the same component at 9:16 for a story, with the QR
walking whoever sees it back to the profile.

**The learning record is public by default** (0043). The academy's own
functions read as the caller and take no profile argument, which is what keeps
them from being pointed at somebody else; `profile_learning()` and
`profile_focus()` are the read-only, someone-else's view, and they ask
`can_see_profile_section()` before they answer at all. A profile says where its
owner is going — the paths they are on, how far, and the lesson they last
opened — not only where they have been.

**What the platform did not witness is marked as such.** External profiles,
education and experience are lists the owner writes, and they read as what they
are. An external exhibition goes further: it is the one claim about something
that happened elsewhere, so it is filed `pending_review`, nobody but its owner
and the admins can see it, and it becomes part of the record only after an
admin has opened the evidence. Its owner cannot verify their own claim.

The three link columns on `profiles` became `profile_links`, a list that can
hold Behance, Kaggle, YouTube and the rest — the old columns could hold exactly
GitHub, LinkedIn and one website.

## Skills come from approved work

`profile_skills` has carried this comment since 0002 — *evidence-backed skills
are the ones proven by an approved submission* — and nothing ever set
`is_verified`. The `skills` table was empty too: fields and interests were
seeded in 0029, skills never were. So a learner could tick skills in onboarding
and the platform had no way to tell a claim from a fact, which is the opposite
of what the rest of it does. 0040 closes both.

A skill is attached to **the smallest thing that demands it** — a lesson for
what it teaches, an assignment for what the work itself asks — and everything
above is derived:

```
lesson_skills     ┐
                  ├→ lesson_skills_all() → course_skills() → path_skills()
assignment_skills ┘
```

The second source (0041) exists because a path's capstone is built by a team,
documented in a repository and walked through on video, and no single lesson in
the path teaches any of that. Without it the only way to record teamwork was to
pretend some lesson taught it.

A course's skills are the union of its lessons'; a path's are the union of its
courses'. Nothing is stored twice, so a lesson that gains a skill gains it for
every course and path carrying it, with no second table to update and no way
for the three to disagree.

**Approval is what writes a skill onto a profile.** When an evaluation lands
with `decision = 'approved'`, `on_evaluation_grant_skills()` writes the skills
of what was approved onto the learner as verified: a lesson assignment grants
that lesson's, a course task or project the course's, a path project the
path's — each of them plus whatever that assignment demanded in its own right. A skill the learner had already claimed becomes verified — one row, not
two — and one they never claimed is added.

Three choices worth stating. Nothing is ever taken away by this trigger:
approval is a fact about a moment, and un-approving later does not unlearn.
Group work credits the submission's owner, the same person the XP goes to —
crediting every team member with every skill from one approval would make the
record say more than the work does. And `profile_verified_skills()` respects
the profile's own privacy flag, so a private profile publishes nothing.

## The certificate is a document, not a card

A certificate is the artefact somebody attaches to an application, so it is
built as a document: A4 landscape, the gold seal at the top, the same seal very
faint behind the words, the holder's name as the largest thing on the sheet, and
a footer carrying the date, the certificate id, the signature and the QR.

Three things keep it honest.

**It renders from the snapshot.** `verify_certificate()` returns what was frozen
when the certificate was issued, so renaming a course afterwards cannot rewrite
somebody's certificate. The page adds nothing of its own except the signatory,
which is the platform's, not the holder's. That is why the English title of the
work is frozen too (0039): the document is read in English, and reading the
title live would let a later rename change a certificate already in somebody's
hands.

**The QR carries one thing: the holder's public profile.** A certificate proves
one course; the profile is the record it belongs to, and it lists this
certificate among the rest — so a scan lands on the person, not on a single
claim, and the sheet needs no printed URL under the code.

**One markup, three sizes.** The sheet is a container query: everything inside
is measured in `cqw`, so it is a card on a phone, a sheet on a screen and an A4
landscape page in print with no second layout to keep in step. Printing is what
produces the PDF people attach — the browser's own dialogue, no server-side
renderer to maintain.

**A revoked certificate is not drawn as a document.** There is nothing to
present: the page says it was withdrawn and by whom it was issued, and stops.
Rendering the full sheet with a small "revoked" note would hand somebody a
screenshot that looks exactly like a valid certificate.

The QR points at this same verification page rather than at the holder's
profile: a verifier is checking one claim, and the page they land on answers it
and links on to the profile. The profile lists the certificates in the other
direction, so the two meet.

## Proving a project outside TechMood

A project on the wall is evidence only if somebody without a TechMood account
can check it. A certificate already had that — a code, a QR, and
`verify_certificate()` answering with what a verifier needs and nothing more —
so 0038 gives a project the same, built the same way.

`verify_exhibition_entry()` answers for **exhibited** entries only. That is the
line that matters: work a mentor approved but whose builders have not published
it is nobody else's business, and a withdrawn project stops verifying. The code
follows the decision rather than outliving it.

**The public history** says how many versions the work went through and what
each review decided — and deliberately carries no feedback text. A revision note
was written to the people who built the thing; the same sentence read by a
stranger years later is a different document. `exhibition_entry_reviews()` still
carries the notes to the people they were written for.

**Featured is a bar, not a ranking.** `exhibition_featured()` returns everything
that clears stated conditions — a full six-criterion rubric, 4.5 or better, a
described outcome, evidence anyone can open — newest first. A numbered top three
would make the wall a competition, which is not what it is for. Losing the bar
(evidence removed, say) drops a project out of the featured set and changes
nothing about its place on the wall.

**Categories** come from the school of the project's path, copied into the
snapshot and backfilled for entries frozen before this migration. It is
catalogue data about the project, not a window into the workspace it was built
in, so grouping the wall by field still reads snapshots only.

## The wallet

A balance is never stored; it is the sum of `wallet_entries`. That is what makes
a payout safe to model:

  * requesting one writes a negative `payout` row with status `available`, so the
    money is held the instant the request exists and the same balance cannot be
    requested twice
  * approving flips that row to `paid` — and `available_usd` counts `available`
    and `paid` together, so the balance stays reduced instead of bouncing back
  * rejecting cancels the row, which is what returns the money

A completed session credits the mentor their share and nothing else. The
platform's cut is already excluded from `mentor_share_usd` and is recorded on the
booking; an earlier version also debited it from the mentor, double-counting it.

A refund credits the student's wallet — traceable — and cancels the mentor's
earning for that session. If the mentor had already been paid out, the balance
goes negative. That is the honest record of what happened, and the wallet says so
rather than rounding it away.

## The incubator

A founder gets three working documents, kept separate because they answer
different questions:

  * **Canvas** — how the business works, on one page. Nine blocks fixed by the
    model; cards carry a colour from a named palette (never free hex, so a card
    stays legible in both themes) and a position inside their block, which is all
    "move" needs to be. `move_canvas_card()` settles ordering in the destination
    server-side so two people dragging at once cannot corrupt it.
  * **Plan** — the ten sections, one row each, so progress is a count of what is
    finished rather than a guess at how full a blob of text looks. A section
    cannot be marked complete while it is empty.
  * **Strategy** — vision, mission, values, SWOT, and SMART goals. The letters
    are only worth writing down if the system holds you to them: measurable means
    a metric whose target differs from its baseline, time-bound means a date
    range, and progress is computed from the numbers and shown against time
    elapsed so drift is visible before the deadline.

The startup itself may be listed publicly; the three documents never are. They
are visible to its members through `can_view_startup_workspace()` and editable
through `can_edit_startup()`.

Applying to the incubator requires at least six canvas cards. That is not
bureaucracy — it is the cheapest possible evidence that the idea has been thought
about before a human is asked to spend time on it. The application also records
the stage and plan completion at the moment it was made, so a reviewer compares
applications on what they were, not on what they became afterwards.

The canvas page talks to Supabase directly from the browser rather than
round-tripping a server action per keystroke and drag. That is safe because RLS,
not the component, decides who may write.

## The marketplace

What makes this different from a job board is that an applicant arrives with a
record. `applicant_evidence()` returns XP, stars, certificates, published work
and approved submissions — but only for an application made to the caller. A
poster does not get a window onto anyone else's history; they get the record of
the person who chose to apply to them.

Requirements — minimum stars, a path certificate, named skills — are **advisory**.
`opportunity_match()` reports honestly what is met and what is missing, to both
sides, and nothing blocks the application. A platform whose point is growth must
not tell someone they are not allowed to try; the human decides.

Posting requires a reviewed role (company, founder, team leader or freelancer); a
team seat additionally requires leading that team. A student-only account
consumes the marketplace. This is what role review is for, and it was previously
missing entirely — any account could advertise a paid job.

A team seat does not open a second decision surface. Applying creates a request
in the team's own queue, the leader decides there once, and a trigger syncs that
answer back to the marketplace record, so the applicant never sees two different
answers to the same question.

## The team calendar

Derived, like the mentor's slots. A team's dates already exist on its tasks,
sprints, project milestones and booked sessions; `team_calendar()` gathers them
for a window rather than storing them a second time where they could drift.

The function filters on the caller's own membership, so a non-member calling it
directly gets an empty list rather than a permission error — the same answer the
UI would give them.

## Team settings

Permissions are per-team rather than per-role, so a leader can delegate task
creation or invitations without the platform inventing new roles for it. The
leader always holds every permission regardless of the settings; the toggles
describe what an ordinary member may do.

`transfer_team_leadership()` does the handover in one transaction — demote the
old leader, promote the new one, update the team — so a team is never left with
two leaders or none. The new leader must already be a member, and the handover
is written to the activity log.

## Identity, onboarding and roles

### One identifier, two names

`profiles.techmood_id` is issued by the database when the account is created and
never changes. `username` is a handle the person chooses — unique, lowercase,
and refused for the names the router already uses — and `display_name` is what
people read. None of the three is the identity: the identity is the row, and XP,
stars, certificates, projects and reputation all hang off its id, never off a
role or a name.

### Three taxonomies, kept apart

`fields`, `interests` and `skills` are separate tables with identical shapes, and
that repetition is the point:

| | question | limit | read by |
|---|---|---|---|
| field | where do you work? | 3 | mentor matching, team matching, work matching |
| interest | what do you care about? | none | recommendations, discovery |
| skill | what can you do? | none | portfolio, search, evidence verification |

Merging them into one `tags` table would be less code and a worse product: the
matching that reads fields would drown in interests, and a skill that an
approved submission verified would be indistinguishable from a hobby.

The three-field cap is a constraint trigger, not a form rule, because a direct
PostgREST call has to hit it too. Attaching an unapproved term is refused in the
same trigger and again in the RLS `with check`.

Anyone may `suggest_taxonomy_term()`. It files the term as `pending_review`,
which means: nobody else can see it, nobody can pick it, and the person who
suggested it sees it marked as under review rather than watching it vanish. An
admin publishes it with `review_taxonomy_term()`.

### The role lifecycle

`profile_roles` stays the single source of truth for who may enter which
workspace; there is no second table and no client-held "active role".

```
                  apply_for_role()
                        │
                        ▼
                 pending_review ──── decide_role_request('approved') ──▶ approved
                   ▲        │                                              │
  answer_role_     │        └── decide_role_request('more_info_requested')─┤
  request()        │                        │                              │
                   └──── needs_more_info ◀──┘                              │
                                                                           │
                 rejected ◀── decide_role_request('rejected', reason)      │
                                                             suspended ◀───┘
```

Three rules the functions enforce rather than trust:

* a rejection without a reason is refused — the account survives the rejection,
  and the person is owed an explanation they can act on;
* "request more information" must say what is missing;
* only an admin decides, and every step is appended to `role_request_events`,
  which no client may write to at all (the privilege is revoked, not just the
  policy).

`student` is granted at sign-up and can never be applied for; `admin` can never
be applied for at all.

### Primary role and "browse as"

`profiles.primary_role` decides which workspace the shell opens on. A trigger
refuses a primary role the person does not hold, and a second trigger clears it
the moment that role stops being approved — so the shell can never open on a
door that is now closed.

The switcher in the top bar lists every role the person holds, including pending
and rejected ones, because hiding them would leave someone guessing what became
of their request. Selecting one calls `switchRole()`, which asks
`can_enter_role()` before writing the cookie; the cookie is a preference, and the
layout re-checks the approved list on every request regardless of what it says.
This is deliberate: the v23 prototype's `switchPersona()` only showed a toast,
and a switcher that lies is worse than none.

### The mentor application

An application is not a separate table — it is a `mentor_profiles` row whose
`approved_at` is still null. Approval is one timestamp rather than a copy from
one table into another, and `mentor_profiles_read` shows only approved rows to
the public, so an applicant never appears in the mentor list.

`submit_mentor_application()` opens the role request first, because a
`mentor_profiles` row is only allowed to exist while a live application stands
behind it.

A mentor's `level`, `sessions_count`, `rating_avg` and `approved_at` are stripped
from any update the mentor makes themselves: the level sets the session price, so
leaving it under the self-update policy was a way to raise your own fee. The
triggers that maintain those columns from real sessions still write to them.

### Signing in

Email and password remain, and Google is offered alongside them. Google answers
one question — is this the same person as last time — and nothing else is read
from or written to the Google account. `handle_new_user()` takes the name and
picture Google supplies so onboarding does not ask for them again; the profile,
the TechMood ID and the reputation are TechMood's own.

## The student home page

Home is not a brochure. It is the place a student works from, and it reads top
to bottom as a sequence of questions: where do I stand, what do I do now, what
am I on, who am I seeing, who am I with, what is open to me, what have I earned,
how far have I come, what is my standing, where am I ranked, who could help,
what else is here.

Sections that belong to data the person does not have — no team, no booked
session — are not rendered as empty boxes. They are replaced by the single
action that would fill them.

### Activity and the streak are derived

Every qualifying act is already written down somewhere: a finished lesson, a
submission, an assessment attempt, an attended session, a closed team task,
joining a path. `activity_days(from, to)` gathers them into one row per day, and
`current_streak()` counts back from today over the days that have any.

Nothing is stored. A `streak` column would be a number that can drift from the
facts it claims to summarise, and the first time it drifted nobody would know
which one to believe.

The streak tolerates an empty today and counts from yesterday instead: a day is
not over until it is over, and losing a forty-day streak at nine in the morning
would be a lie about the person's week.

Opening the app is not activity. Neither is a focus session — see below.

### One agenda, five sources

`student_agenda()` puts lessons, the student's own submitted work, unpassed
assessments, booked sessions and assigned team tasks into four columns: today,
in progress, upcoming, completed.

It gathers; it does not own. A team task stays on its team's board and a lesson
stays in its course, so the cards do not offer drag-and-drop — a card that moved
here would have to lie about where the truth lives. Each card links to the place
that can actually change it.

### The pomodoro is recorded, and earns nothing

`focus_sessions` stores the timer: how long was planned, what the person said
they were working on, when it started and ended, and whether it ran out.

It awards no XP and does not feed the streak. XP is for work a mentor can look
at; sitting with a timer produces nothing to look at. What the table gives back
is an honest record of where the hours went, which a number nobody keeps cannot.

### Leaderboards

Four boards — students, mentors, teams, companies — each ranked, each windowed
by `p_since` (this month, this year, all time), and `my_leaderboard_rank()`
answers "where am I?" over everyone rather than over the page on screen.

Points are XP and rating is stars, the same two numbers the passport shows, and
they are never added into one figure. Neither is ever a count of followers,
logins or posts.

Companies are the exception worth naming: they are ranked on opportunities
published, seats filled and people accepted, because **nothing in TechMood rates
an employer yet**. Their rating column shows a dash rather than a number
invented to fill it. Giving companies a real rating is a product decision — who
rates them, after what, and with what right of reply — not a formula.

### Everything reads as the caller

`activity_days`, `current_streak`, `continue_learning`, `student_agenda`,
`student_progress`, `suggested_opportunities` and `suggested_mentors` take no
profile argument at all. They resolve the caller through `auth.uid()`, so the
home page cannot be pointed at somebody else by editing an id — there is no id
to edit.

## The academy is a place to discover learning, not a catalogue

`/academy` answers three questions in order: what is here, what am I on, and
where do I go next. It is not a detail page — a path and a course each keep
their own — and it is not a list of every row in `learning_paths` either.

Two functions do the work, `academy_paths()` and `academy_courses()` (0032).
Each returns one row per card, already carrying this caller's standing: how many
courses are done, what percent that is, whether the path is joined, and which of
the three words the academy uses — not started, in progress, completed — applies.
Three reasons they live in the database rather than in the page:

* **One definition of complete.** Both call `is_course_complete()` and
  `is_path_complete()`, the same helpers the path page and the certificate rule
  use. A card cannot average lesson ticks and disagree with the certificate.
* **One round trip.** The alternative is a query per card — the catalogue, then
  each path's courses, then each course's lessons, then this learner's progress
  against all of them. The page makes two calls and renders.
* **No id to tamper with.** Like the home page functions, they take no profile
  argument and resolve the caller through `auth.uid()`.

`courses.level` is a real column, not a guess made at render time. A course's
level is the position it holds in its path — first, second, third — because that
is how the catalogue was built: three courses per path, each building on the one
before. `backfill_course_levels()` holds that rule once and is called twice, by
the migration for a database that already has a catalogue and by `seed.sql`,
which loads the catalogue after every migration has run. A path has no level of
its own; it reports the **range** its courses cover, because all six paths start
from zero and a single label would be a lie.

A course belongs to no school. Its domain is whichever published paths carry it,
which is what the domain filter matches on, and why a course card says "part
of …" rather than naming one field.

The page fetches the whole catalogue once and filters in the browser: search,
category, level and status narrow both lists together, the search is debounced,
and the results page in. While a search or a filter is on, the learner's own
sections — my paths, continue learning, the suggestions — step aside, so the
same card is never on screen twice. Continue learning is not rebuilt here; it is
the component the home page already uses, reading the same `continue_learning()`.

## Eight schools, fifty paths, and the difference between announced and written

The academy document names eight schools and fifty paths. The catalogue the
code carried was the prototype's six paths under schools named before that
document existed. 0033 makes the map the document's own, without a second
catalogue beside the first.

The schools become the eight by **renaming the rows that survive**, so every
path, conversation and certificate that points at a school keeps pointing at
it. Two schools the document folds into others (project management, technical
languages) are merged away after their paths are moved; two new ones are added.

`content_status` gains **`planned`**. A path the academy has committed to but
has not written is not a draft — a draft is private, unfinished work — and it
is certainly not published. It is announced, and saying so in the status is
what lets the academy show its whole map without inventing a single lesson:

* a planned path has no lessons, so it cannot be started;
* `academy_paths()` filters on `published`, so it never appears as a startable
  card, and `academy_courses()` filters on published courses, so an outline
  course is never offered either;
* `academy_roadmap()` returns the announced paths with their outline, and the
  page renders them with no button, because there is nothing behind them yet.

**Depth and Breadth needed no column.** The document's deep courses are the
ones a path requires; its exposure courses are the ones it carries without
gating completion. That is what `path_courses.is_required` has always meant, so
the philosophy is stored rather than restated — `academy_roadmap()` simply
reads the required rows as the depth list and the rest as the breadth list.

One consequence had to be closed. A course can sit in several paths, and 0032
read its level from its earliest position in any of them. Once a planned
outline can carry a published course — `modern-js` is the second course of the
web path and the first of JavaScript & TypeScript — an outline nobody is
studying could demote a course somebody is. A level describes where a course
sits in what is actually being taught, so `backfill_course_levels()` now counts
positions in published paths only.

## A lesson is a place, not a row

A lesson used to exist only as a line on the course page: a title, a duration
and a checkbox. The academy document describes something else — videos, what
you will learn, review material, an assignment, a case study, deliverables, a
portfolio home, an optional challenge, the next lesson — with a board and a
timer beside it. 0034 gives a lesson its own address and its own page.

What that needed, and what it did not:

| The document asks for | Where it lives |
|---|---|
| A lesson address (TM-CODE-L01) | `lessons.slug`, backfilled from the course and the lesson's place in it; a trigger numbers new ones |
| Several videos | `lesson_videos`; the single unused `lessons.video_url` is dropped |
| What you will learn, a case study, a challenge | `lessons.outcomes_ar`, `case_study_ar`, `case_question_ar`, `challenge_ar` |
| Review material | `lesson_resources`, which already existed |
| Deliverables | `assignments.required_evidence`, which already said exactly this |
| The LinkedIn draft, the portfolio folder | **Nothing.** Both are a function of the path, the course and the lesson, so the page writes them from names it already has |
| Next lesson | **Nothing.** The lessons are ordered; the next one is the next one |
| A kanban for the lesson | **Nothing stored.** `lesson_board()` reads the rows that already record each step |
| A pomodoro for the lesson | `focus_sessions.ref_table` / `ref_id`, which 0030 already carried |

`lesson_board()` is the point worth keeping in mind. Its four steps — watch,
do the assignment, get it reviewed, document it — are read from the progress
row, the submission, that submission's status, and whether its evidence carries
a public link. Move the work and the board moves with it; it cannot drift from
the course page or from the mentor's review queue, because it is looking at the
same rows they are. It resolves the caller through `auth.uid()`, so two people
looking at the same lesson see two different boards and neither can ask for the
other's.

Publishing is a step and not a requirement unless the assignment itself asks
for a public link. The page offers a draft post, already written from the
lesson's own names, and says in as many words that publishing does not affect
the grade — the mentor reviews what was submitted.

Sections a lesson does not carry are not rendered. A lesson whose videos have
not been authored yet simply has no video section; the page never shows an
empty frame where content is meant to be.

## Career goals: the ladder, not the shelf

The academy document is explicit about the question to ask. Not "which courses
do you want" but "what do you want to become", with the platform answering in
skills, courses, projects and work. 0035 builds that.

A goal is not a bigger path. Data Analyst crosses six paths in three schools
and does not stop at the catalogue — it ends in a real project, a portfolio, a
team and work. So `career_goals` holds the goal, and `career_goal_steps` holds
an ordered list where a step is one of three things: a course, a whole path, or
a milestone outside the academy.

Two rules keep it from becoming a second progress system:

* **A goal stores no progress.** Each step's state comes from the rule that
  already owns it — `is_course_complete()`, `is_path_complete()`, an approved
  submission, an active team seat, an accepted application. Finish a course
  anywhere and the goal moves on its own.
* **A goal invents no content.** Its steps point at courses and paths that
  exist, which is how a plan can say "this rung is not built yet" instead of
  pretending.

That second rule had teeth. `is_course_complete()` answers *nothing left to
do*, and an outline course — no lessons, no required work — has nothing left to
do the moment it is created. A plan mostly made of outlines reported itself
half finished on the day it was written. `is_goal_step_open()` is the guard: a
step whose content is still an outline can be neither started nor counted, and
both the catalogue and the plan run every step through it.

`has_reached_milestone(profile, milestone)` takes a profile id, so it is
revoked from clients entirely. It would otherwise answer "does this stranger
have a team, a job, a startup" for any id dropped into a request. The two
functions that use it are `SECURITY DEFINER` and call it for the caller only;
`choose_career_goal()` and `clear_career_goal()` resolve the caller themselves,
and `profile_career_goals` is keyed by profile with an own-row policy, so a
goal cannot be pinned on somebody else's account.

One goal at a time: the table is keyed by profile, so changing your mind
replaces the row rather than stacking another. The plan renders as a timeline
because the order is the point — each rung stands on the one below it — and a
milestone links to where it is actually earned (the teams page, the
marketplace, the passport) rather than being awarded by the plan.

## Writing the catalogue, and the guard that keeps it honest

0033 drew the line between announced and written and leaned on one fact: a
planned path has no lessons, so nobody can start it. That fact has to survive
an author. The moment a status can be flipped in an admin screen, the academy
can acquire a published course with nothing in it, and the discovery page's
promise — what is open you can open — stops being true.

So 0036 makes publishing a transition with conditions, enforced on the status
change rather than in the page asking for it: a course with no lessons is
refused, and a path is refused while any course it requires is still an
outline. The refusal carries the reason, and the admin screen prints it. The
guards run on UPDATE, because publishing in the product is always a move from
draft or planned; `seed.sql` is the other case, loading a finished catalogue in
one transaction with each course already published before its lessons exist.
Publishing also re-runs `backfill_course_levels()`, so a newly written course
never sits at the default level.

`/admin/academy` is the authoring surface: the outlines waiting to be written,
the published courses, and the announced paths with their publish button. The
lesson form is the lesson page in the same order — what it is, what the learner
will be able to do, videos, review material, the case, the challenge — and a
field left empty renders no section, so a lesson can be written in passes
without ever looking broken to a learner.

None of these actions carry a permission of their own. The catalogue's admin
policies from 0011 are what decides, which is why a learner who sends the same
request updates no rows and inserts nothing.

## Bookings are written by functions, not by their parties

0011 gave the student and the mentor a blanket update policy on `bookings`,
written for "the student cancels and the mentor decides". 0016 then moved both
of those into `SECURITY DEFINER` functions, but the policy stayed, and it never
said which columns may change.

So any student could, with one PostgREST call against their own booking:

* set `status = 'confirmed'`, skipping the mentor's decision — which the booking
  document forbids in as many words;
* set `status = 'completed'`, firing `on_booking_completed()` and so crediting
  the mentor's wallet and awarding session XP for a session that never happened;
* rewrite `price_usd` and `mentor_share_usd`, after `create_booking_request()`
  had deliberately taken the price out of the client's hands.

0031 drops the policy and revokes `insert`, `update` and `delete` on the table
from `authenticated` altogether, so a future policy cannot reopen it by
accident. `cancel_booking()` and `set_meeting_url()` join the functions that
were already there, each authorising its own caller and notifying the other
side. `meeting_url` is only settable by the booked mentor, only on a confirmed
session, and only as an http(s) address — and since 0044 gave a confirmed
booking a room of its own, no screen asks for it any more: the column and
`set_meeting_url()` remain in the database, unused, rather than being dropped
under working data.

The general rule this restates: where a table's rows carry money or state that
other triggers act on, clients get `select` and nothing else, and every move
goes through a function that can explain itself.

## The call is part of the booking, not a link

A booking has always carried who, when, how much and whether it was paid for.
What it carried until 0044 was `meeting_url` — and a link is exactly what this
system must not be, because a link can be forwarded to somebody the session was
never booked for.

So the call became an object with a life of its own:

```
Booking (confirmed) ──> VideoSession ──> VideoSessionParticipant
                              │                └─ video_presence_events
                              └─ scheduled → live → completed / no_show
```

Four rules shape it, and each is a line of SQL rather than a screen's good
manners.

**No session exists before the booking is confirmed.** `open_session_for_booking()`
fires on the transition into `confirmed` and nowhere else, so a pending booking
is not a room waiting to be entered. A team's own hour comes from
`schedule_internal_session()` instead: free, no mentor, and limited to two a
week *for the team* — counted across the team so nobody gets around it by taking
turns.

**The server is the clock.** `session_phase()` returns `waiting`, `lobby`,
`live` or `ended` from `now()` against the session's own times, with the lobby
opening five minutes before. `join_video_session()` asks the same function, so
a browser with a helpful clock cannot open a door, and `server_now()` gives the
page something to anchor its countdown to that is not the machine it is drawn
on.

**Attendance is a log; presence is derived.** Joining and leaving append to
`video_presence_events`, never edit it, so a reconnect is two more lines rather
than a lost record. `session_attendance()` pairs them into spans and counts the
minutes; `is_present` is read from the last event. Leaving cancels nothing and
ends nothing — the session runs until its time is up and the same person may
come back.

**Only named participants enter.** `video_sessions` is readable only through
`is_session_participant()`, so a stranger holding the session id cannot join
it, and cannot even read that it exists. A team booking admits the members it
was booked for, which is what the seats were paid for.

`close_due_video_sessions()` ends what the clock has ended, marking `no_show`
when nobody came, and `notify_due_sessions()` (0046) sends the reminders that
depend only on time — a day before, an hour before, the door opening, the start,
the end. Each reminder is written to `video_session_reminders` as it is sent, so
the job is safe to run as often as one likes. Both are revoked from clients:
they are the platform's jobs, not anybody's API.

### Rating: criteria, and blind until both have spoken

`session_feedback` has existed since 0007 as one star and a comment. A mentor's
rating rides on it, and a single number for a whole hour tells neither side what
was good. 0045 gives it criteria — five per direction plus communication — and
makes `stars` their average, so nobody can leave five stars without saying what
was worth five.

It was also visible the moment it was written, which invites an answer rather
than a judgement. `session_feedback_is_open()` seals both sides until both have
written, or until the week to write in has passed; the read policy, the reader
and the writer all ask that same function.

### What is not built

The media path between participants. The camera and microphone in the room are
the browser's own — `getUserMedia`, real tracks, real toggles — but there is no
signalling channel and no SFU in this repository, so the other tiles show
presence from the database rather than video, and the room says so rather than
pretending. Everything around it (who may enter, when, the timer, attendance,
the summary and the rating) is real and tested. Adding WebRTC over Supabase
Realtime signalling, or an SFU, changes the tiles and nothing else: the
authorization, the clock and the log stay where they are.

## Bookings & Calendar is one place, not two pages

Time was decided in four places: the mentor's availability (0006), the booking
journey (0016), the team's calendar (0026) and the call (0044). Each was right
where it stood, and nothing gathered them — so a person had to know where to
look, and a mentor had no screen that showed their own week at all.

0047 gives the hub three reads, each of which gathers and owns nothing:

* `my_calendar(from, to)` — bookings the caller is a party to, their team's own
  hours, what is due from them on a team board, their teams' milestones and
  sprint ends. It reads as the caller, so a team-mate's personal mentor session
  is not on anybody else's calendar.
* `needs_action()` — what is waiting on this person *and only this person*:
  a payment to finish, a request to decide, a session to rate, and for an admin
  the payments, payouts and empty hours nobody else can settle.
* `booking_stats()` — the numbers at the top, counted at read time.

The page adds two rules the product had always stated and the database had
never enforced: **five sessions a day** (`daily_session_limit`) and a **gap
between sessions** (`buffer_minutes`). Both live in `enforce_booking_rules()`,
and `mentor_available_slots()` asks the same questions — an hour the mentor
would refuse is never offered, so nobody meets the rule only after choosing.

### The gap that made rating unreachable

0031 revoked writes on `bookings` from clients, for good reasons: completing a
booking credits a wallet and awards XP. But nothing replaced the path, so no
booking could ever reach `completed`, and `rate_session()` — which requires a
completed booking — could never be called by anyone.

What completes a booking is now the fact that the session happened.
`close_due_video_sessions()` reads the presence log 0044 writes: two distinct
people in the room means the hour took place, and the booking completes itself.
One person alone in a room did not hold a session — that booking stays
confirmed, nobody is paid, and it appears in the admin's `needs_action()` as an
hour waiting for a human to settle.

### A team books a mentor, and pays per member

`bookings` has carried `kind = 'team_mentor'` and `seats` since 0007, and the
pricing document says a team session costs the mentor's rate times the number
of attending members — but nothing created such a booking, and nowhere said
which members the seats were for. 0048 adds both.

`booking_seats` names them. `create_team_booking_request()` is the leader's
version of the student's request: it refuses anybody but the team's leader,
refuses a seat for somebody outside the team, and reads the price here rather
than taking it from the caller — seats × the mentor's rate, with the platform
and mentor shares scaled the same way, so a crafted call cannot buy five seats
at the price of one. `open_session_for_booking()` then admits exactly those
members, and falls back to the old rule (the team's own members, up to the
number of seats) only for bookings made before seats had names.

### What the hub does not do

An admin's global calendar is today the same page: row-level security returns
them every booking in the list, but `my_calendar()` still gathers only their
own dates. Rescheduling by dragging an entry is not built either — a booking's
time is changed through the booking, where the rules that guard it live.

## The market is the platform's other end, not a job board on the side

0025 built one side of a marketplace: an opening is posted, somebody applies,
and the poster sees a record rather than a CV. Four things were missing, and
each of them is what makes a market a market. 0050 adds them, and builds none
of them from scratch.

**Nobody could be found.** `freelancer_profiles` is a single choice — am I
available, from what price — hanging off the profile that already exists. There
is no second identity: `market_talent()` reads the person's own skills, stars,
exhibited projects and certificates. Listing yourself needs the freelancer role
after review, enforced by a trigger, because the platform is saying something
about you to somebody who will pay. `teams` gained the same three columns, so
the thing this platform is best at making can be hired as one.

**Nobody could be asked.** `opportunity_invites` lets a poster ask somebody by
name — only somebody who offered their work, and only on their own opening.
Accepting an invitation is applying: the same queue, at `shortlisted`, because
being asked for is one step further along than asking.

**Nothing could be kept.** `market_saves` is private to whoever saved it: not a
count on a card, not a signal, not a ranking.

**And "accepted" was the end of the road.** The market recorded a decision and
forgot the work — although the work is the thing this whole platform exists to
prove. Accepting now opens an ordinary TechMood project (`kind = 'client'`),
owned by the person doing it, with the client on it and the amount agreed;
0052 then lets the client read it, which `projects_read` had never allowed for
a private project owned by somebody else. A team seat opens nothing: joining a
team is not work being handed over, and the team already has a workspace.

An application carries a proposal (`proposed_amount_usd`, `proposed_days`) and
`shared_sections` — which parts of their identity the applicant put in front of
this poster. That last column is the market's whole idea in one field: applying
with a TechMood identity rather than a CV only means something if choosing what
to share is a real, recorded choice.

Two reads close the loop the platform is built on. `opportunity_learning()`
takes the skills an opening asks for, subtracts the ones the reader has already
earned, and names the academy paths that teach the rest — so an opening is a
description of something learnable rather than a door. `trust_signals()` never
says the word "verified": it names what was checked and counts the records
behind it, so a reader can disagree with it.

The application ladder gained `under_review`, `interview` and `offer` (0049),
because "submitted" was silently covering all three and an applicant could not
tell being read from being ignored.

## Money the two sides can check: escrow, commission, and an argument

The market moved no money at all until 0054. Somebody was accepted and what
happened next was between two people and a bank transfer the platform knew
nothing about — which is the one part of a market that cannot be left to good
faith, because the client fears paying for nothing and the freelancer fears
working for nothing.

An escrow is funded through `payments`: the same receipt, the same admin, the
same queue as a booking, because a second payment system is a second place for
money to go missing. `verify_payment()` learned to tell the two apart and does
the right thing for each. Funding writes the earning into the freelancer's
wallet as **pending** — visible, not spendable — and releasing flips that same
row to `available` rather than inventing a new one. Only the payer releases;
only an admin refunds, and only a hold somebody disputed. Either side can
dispute, which freezes the money and hands the question to a human instead of
deciding it.

Commission is `commission_tiers` plus `compute_commission()`, which is the only
thing that reads them. Rates fall as the amount rises, because the platform's
cost per piece of work does not grow with its price, and pretending otherwise
pushes the biggest work into a private message.

### Bidding without the auction

0055 makes a proposal a round rather than a single number: `proposal_terms` is
append-only, one open offer per side, and only the *other* side can accept —
which is the whole difference between an agreement and an announcement.
Accepting freezes those terms onto the application and supersedes the rest;
every round is kept, so the agreed price has a history.

What deliberately does not exist: connects to spend, hundreds of unread bids, a
race to the cheapest.

The talking goes where talking already happens. `conversations` gained
`application_id` and a `market` kind, and shortlisting somebody opens one with
both sides in it — the same Messages surface, with its read state and replies,
rather than a second inbox nobody checks.

### The client's judgement, and meters that are finally computed

`reputation_scores` had been a table since 0002 with an admin-only write policy
and **no producer**: every passport meter was reading rows nobody ever wrote.
0056 makes reputation derived-and-written: `recompute_reputation()` works out
all eight dimensions from real records — mentors' evaluations, exhibition
panels, session feedback, client reviews, team tasks, and whether held money was
released or refunded — and triggers on each of those sources keep it current. A
dimension with no evidence behind it is **deleted rather than shown as zero**,
because "nothing yet" and "judged and found wanting" are different things.

`client_reviews` is the new source, and it has one rule: it can only be written
once the escrow was released. A review follows money that actually moved, which
is also why `profile_stars` now averages a client's stars together with a
mentor's — both are somebody with standing saying how good the work was.

### Selling finished work, without selling the authorship

0057 lets a completed, exhibited project be listed and bought through the same
escrow. The decision that shapes it, stated once so it is never quietly undone:

> **A sale transfers the work, never the authorship.**

The buyer gets the deliverables, the licence and permanent read access, and the
sale is recorded. The exhibition entry, the mentor's evaluation, the skills the
work proved and the credit on the maker's passport all stay exactly where they
were — because those are statements about a person, and a person's record is not
for sale here. Work built for a client is not the builder's to resell at all,
and only work that was judged and exhibited can be listed, so the shelf cannot
fill with unfinished zip files.

## Two languages

TechMood is written in Arabic first. The Arabic is the source text, not a
translation of an English original, so the English lives beside it at the point
of use rather than behind a key in a table somewhere else:

```tsx
t('حجوزاتي', 'My bookings')
```

The reason is what changes together. A key table drifts: a string gets reworded
in Arabic, its key keeps the old English, and nobody notices because the two
live in different files. Here they cannot drift, because they are one call.

A server component gets `t` from `await getT()`; a client component gets the
same function from `useT()`. Library modules that carry labels (roles, booking
states, task columns) hold them as `Text` pairs — `{ ar, en }` — which the same
`t` unwraps.

### What is translated, and what is not

The **interface** is translated. **Content is not**: a course description, a
mentor's bio, a team's name, a message somebody wrote, the note an admin left on
a rejected application. Those are data, and machine-guessing them would put
words in people's mouths.

Where a row carries its own English — `courses.title_en`, `fields.name_en`,
`session_types.name_en` — `contentText()` uses it. Where it does not, the Arabic
is shown as written and marked `dir="rtl"` so an English reader sees Arabic text
laid out correctly rather than mangled into a left-to-right paragraph.

The database speaks Arabic too: every `raise exception` in the migrations is
Arabic, because the message has to be right for the person who usually reads it.
`dbError()` maps the ones a client can actually trigger onto English wording, and
falls back to the original Arabic for anything unlisted — showing the real reason
in the wrong language is more useful than hiding it in the right one.

### Where the choice lives

`profiles.language` is the durable copy that follows the account onto a new
device. A cookie is what every render actually reads, because it is the same
answer without a database round trip and it is the only answer a signed-out
visitor has. Signing in copies the profile onto the cookie; the switch writes
both.

### Direction

`<html dir>` is decided on the server from that cookie, so the first frame is
already laid out the right way round. Every rule in the stylesheet was already
written with logical properties — `border-inline-start`, `inset-inline-end`,
`margin-inline` — so flipping the direction needed no second, mirrored
stylesheet and no change to the design system.

Numbers use Latin digits in both languages. They sit next to code, prices and
XP, and switching digit shapes between screens reads as a bug rather than as a
translation.
