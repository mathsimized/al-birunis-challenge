# Al-Biruni's Challenge 2026

A standalone competition website — public site, student portal and
administrator panel — hosted on the existing MATHSIMIZED Firebase project so
that participants keep their existing login identity.

The existing MATHSIMIZED site is **not** modified in any way. Competition data
lives in its own `abc_*` collections, with its own rules and admin panel.

The Firebase web configuration in `js/firebase-config.js` is committed on
purpose. A Firebase web API key is not a secret — it ships in the HTML of every
Firebase web app, and access is governed by `firestore.rules`, which is the
whole security model of this project. No service account, private key or admin
token belongs in this repository, and `.env` is ignored.

---

## 1. Layout

```
al-birunis-challenge/
├── index.html … rules.html        public pages
├── login.html register.html       authentication
│   forgot-password.html reset-password.html
├── student/                       student portal (10 pages)
├── admin/                         admin panel (14 pages)
├── js/
│   ├── firebase-config.js         project config + auth
│   ├── core.js  ui.js  repo.js    shared runtime
│   ├── round1.js round2.js       competition logic
│   ├── session.js portal.js admin.js page.js
│   └── pages/{public,student,admin}/
├── css/main.css                   single stylesheet
├── assets/                        images and emblems
├── tests/                         route, link and privacy checks
├── firestore.rules  firestore.indexes.json
└── firebase.json  .firebaserc
```

## 2. Roles

Roles live in `abc_users/{uid}.role` and are never taken from the identity
provider, so the MATHSIMIZED user record is never mutated.

| Role    | Can do |
| ------- | ------ |
| student | own registration, attempt, result, Round 2 submission, certificates, and the answer-free Round 1 question paper |
| admin   | the whole competition panel |

There is no judge role. **Round 2 is judged off this platform.** The organiser
receives the results separately, then marks the qualifying students on
**Admin → Round 2** and publishes their names on **Admin → Finalists**. No
scores, rubric or judge records are stored anywhere in the app, so there is
nothing for them to leak from.

The admin account is `mathsimized@gmail.com`. Access is decided by the
**verified sign-in token**, not by a role stored in Firestore, and the browser
and the ruleset make the same comparison — so the two can never disagree. That
address signs in straight to the panel, on the first attempt and even if its
record is deleted. Everyone else lands in their own portal and is never shown
the panel. An earlier version required an existing admin to create the first
admin's record, which is impossible, and locked the organiser out of their own
site.

Other roles are set on **Admin → Users & Access → Accounts**.

## 2b. One login, two steps

A student has **one** account, the MATHSIMIZED one, and it works here. Signing up
asks for a **username** (lowercase letters, numbers and underscores, checked for
availability against the shared `users` collection so it cannot collide with an
account made on the main site), an email and a password. Nothing else.

Creating that account sends the student straight into the portal, where the
**competition registration** form collects the full name, category, school, city,
grade and optional Brand Ambassador code. The full name belongs there rather than
on the signup page because it is what appears on certificates, and because a
username is what someone signs in with. It is saved to the account, so it is
filled in once.

## 3. Data model

| Collection | Holds |
| ---------- | ----- |
| `abc_config/{main}` | dates, registration flags, finale details, contact details |
| `abc_users/{uid}` | display name, email, role |
| `abc_registrations/{uid}` | category, school, city, the Brand Ambassador code the student typed, qualification |
| `abc_ba/{code}` | Brand Ambassadors, codes and attributed counts — **administrator only** |
| `abc_public_ba/topFive` | published top five: names and ranks, never a count |
| `abc_questions/{id}` | the question paper, with no answers — readable by signed-in users |
| `abc_quizzes/round1` | Round 1 status, window, length, quotas, tie-break |
| `abc_answer_keys/{questionId}` | the answer to one question — **administrator only** |
| `abc_attempts/{uid}` | the sanitised paper, autosaved answers, timer, score |
| `abc_results/{uid}` | private result, rank, qualification, release flag |
| `abc_public_results/{category}` | published, deliberately limited leaderboard snapshot |
| `abc_round2_submissions/{uid}` | presentation links and status |
| `abc_finalists/{uid}` | finalist confirmation, award, release flag |
| `abc_config/grandFinale` | venue, schedule, interview plan |
| `abc_certificates/{id}` | certificate code, type, award, inline file or share link, release flag |
| `abc_announcements/{id}` | notices by audience |
| `abc_audit_log/{id}` | every privileged action |
| `users/{uid}` | **read-only** MATHSIMIZED profile, used to prefill forms |

## 4. There is no backend

This site runs on the **free Spark plan**. There are no Cloud Functions, no
server-side code and no email service. Everything a browser does is constrained
by `firestore.rules`, and that one file is the whole security model. The design
consequence is deliberate:

**The question bank is split in two.**

| Collection | Readable by | Contents |
| ---------- | ----------- | -------- |
| `abc_questions/{id}` | any signed-in user, active questions only | the text, options and marks — **no answers** |
| `abc_answer_keys/{questionId}` | administrators only | the correct answer and explanation |

A student has to be able to read the questions they are asked, so the paper is
open. They can never read a correct answer, because the answers live in a
separate collection the rules refuse. Question and key are written together in
a single batch, so they cannot drift apart.

**Scoring runs in the admin panel.** `A.round1.scoreAttempt()` and
`scoreAllPending()` read the answer keys from the administrator's own
authenticated session. This is the reason scoring is a deliberate button rather
than something that happens the moment a student presses submit — the student
simply has no path to the key.

**Timing uses Firestore server timestamps**, not the student's device clock.
`startedAt` and `submittedAt` are written with `serverTimestamp()`, and the
submit path measures elapsed time against the server's own `startedAt`, so a
tampered clock cannot rewrite history. `autoSubmitted` records when a timer
expired. The attempt rules freeze `score`, `maxScore`, `correctCount`,
`breakdown`, `questions` and `startedAt` against student writes, so a client
cannot award itself marks.

**Certificates are attached by the organiser** and read from the student's
portal. No email is sent: sending one from a browser would mean shipping an
email API key to every visitor. Students see their certificates in
**Student → My certificates**, and each one carries a code they can quote if
they need a replacement.

There are two ways to attach a certificate, because Cloud Storage needs a paid
plan:

- **Upload a file** from the certificate list. It is stored in Firestore as a
  data URI, capped at 700 KB so it stays under the 1 MiB document limit. A
  generated certificate is normally far smaller than that.
- **Paste a link** for anything larger. Save the file to Google Drive, set it to
  *anyone with the link can view*, and paste the URL. This is how Round 2
  presentation files already work.

Both paths are administrator-only writes. The student sees a *Download* button
for an inline file and an *Open* button for a link, on their own certificate
only.

### What was given up, honestly

- A student assembles their own paper from the active questions, because
  choosing it for them is the one job no browser can be trusted with. The rules
  pin the category to the one they registered for and the count to the one you
  configured, so nobody can sit an easier category's paper or a short paper —
  but a determined student could read every active question before starting, and
  could pick a set of questions they expect to do well. They still cannot see
  any answer, so the choice cannot be exploited for marks.
- The deadline is enforced at submission by comparing the server's timestamps
  rather than by refusing a write. An attempt left open past the limit is
  flagged `autoSubmitted` and shows as suspect in the scoring breakdown, and the
  organiser can void it from **Round 1**.
- Results are not instant. They appear once the organiser presses **Score all
  pending**, which is after the window closes.

Each of these is a real limitation, and all three are the price of not billing.
If any of them stops being acceptable, the answer is a small function — not a
rewrite.

## 5. Setup

```bash
# 1. install the CLI once
npm install -g firebase-tools

# 2. sign in and select the project
firebase login
firebase use mathsimized-e4ff0
```

There are no dependencies to install: the site is static and talks to Firebase
from the browser through the compatibility SDK loaded from a CDN.

### Local testing

```bash
firebase emulators:start          # firestore, hosting
```

Six checks need no tooling at all:

```bash
node tests/run-all.js                     # everything below
```

| Check | What it protects |
| ----- | ---------------- |
| `tests/route-guards.js` | route protection, including hosting in a subdirectory |
| `tests/check-links.js` | every local link, script and asset resolves |
| `tests/rules-lint.js` | a collection used in code always has a rule, and no dead rule is left behind |
| `tests/export-surface.js` | every `A.repo.x` / `A.round1.x` call resolves to something the module really defines |
| `tests/privacy-and-no-backend.js` | no backend creeps back in, and no Brand Ambassador count can reach a student |

Those exist because of bugs they would have caught: `A.repo.listJudges()` was
exported but never defined, so the Users & Access page threw on load; the
Brand Ambassador rules let a student read their own count; `importQuestions()`
wrote 800 operations into a 500-operation batch; and the rules file replaced the
live MATHSIMIZED ruleset without carrying any of it over, which would have
broken the existing website on the first deploy.

To run against the emulators, change `ABC_FIREBASE_CONFIG` in
`js/firebase-config.js` to the emulator host and set the project id to
`demo-al-birunis`.

## 6. Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
```

Nothing here needs the Blaze plan. Deploy the rules **before** the hosting, so
the new collections are never briefly unguarded.

## 7. Running the competition

1. **Settings** — set the registration window, Round 1 window, quotas, Round 2
   rubric and Grand Finale details. Anything left blank simply stays
   unannounced; nothing is assumed.
2. **Questions** — build the bank, or import a CSV. Every row is validated
   before it is written, and a correct answer is mandatory.
3. **Round 1** — set the status to open when you are ready. Students build
   their own paper from the active questions in their category.
4. **Results** — after the window closes, press **Score all pending**. The
   breakdown flags any attempt that looks like it was left open. Then rebuild
   ranks, release individual results, and publish a limited public leaderboard.
5. **Round 2** — open submissions. When your results arrive, tick the students
   who qualified, then publish their names and release the finalist area. There
   is no scoring to do here: judging happens off the platform.
6. **Certificates** — issue in bulk, upload each file from the panel, then
   release. Students see them in their portal.
7. **Announcements** — publish to everyone, a category, or the finalists only.

## 7b. Brand Ambassadors

Applications are made on a Google Form, not on this site:
<https://forms.gle/QvNTaC4cwCdNzzzR7>. The window is **20 September 2026** to
**5 October 2026**, which is separate from competition registration on 1 October.

1. **Brand Ambassadors** — add applicants from the form's response sheet. One
   at a time with **Add applicant**, or select the rows in the sheet, copy, and
   use **Paste from sheet**. The header line is read to find the name, email,
   contact, category, school and city columns, so the timestamp and "never
   submit again" columns are ignored, and both tab-separated and CSV pastes
   work. Everything is shown for confirmation before anything is written.
   Approving mints a code like `BA-XXXXXX`, which you send to the ambassador.
2. A student types that code on the competition registration form. The code is
   stored as text; nothing is looked up at that moment, so a student cannot
   discover who the approved ambassadors are.
3. **Credit them now** credits every registration carrying a code, once each.
   Unknown or inactive codes are skipped and reported.
4. **Publish top five** writes names and ranks to the public page. That snapshot
   has no count field in it, so there is nothing to leak by accident.
5. Announce it on the site and on
   <https://www.instagram.com/al_birunis_challenge/>, using the
   **Quick notice: BA top five** button in Announcements.

The **Best Brand Ambassador is not published**. It is announced at the Grand
Finale award ceremony, and `bestCopy()` in the Announcements panel holds the
wording for that.

## 8. Security notes

- Answer keys are administrator-only. A student can read the paper, submit
  answers, and nothing else. Every write that could move a score is refused for
  a non-administrator.
- `abc_ba` is administrator-only, in both directions. No student can read a
  count, and no student can raise one.
- The public top five is a separate snapshot that never holds a count.
- Public results are a separate, sanitised snapshot. The full ranking stays in
  `abc_results`, which a student can read only for their own released result.
- There is no judge role, no judge collection and no scoring record. Judging
  results arrive outside the app and only the finalist list is recorded.
- The shared MATHSIMIZED `users` collection is read-only here; roles live in
  `abc_users`.
- Every privileged action writes to `abc_audit_log`.
- Certificates are administrator-only to write and readable only by the student
  they belong to.
- **There is no Cloud Storage.** Cloud Storage for Firebase has required the
  Blaze plan since 3 February 2026, so on the free plan a bucket answers every
  call with a 402. A certificate file is therefore stored in Firestore as a data
  URI (capped at 700 KB, under the 1 MiB document limit), and anything larger is
  a Google Drive link the organiser pastes in — the same approach Round 2 uses
  for presentation files. `tests/privacy-and-no-backend.js` fails the build if a
  bucket, the Storage SDK or a `storageBucket` key comes back.
- `tests/privacy-and-no-backend.js` fails the build if any of the above is
  quietly undone.

Before going live, add the production hostname to **Authentication → Settings →
Authorised domains**.
