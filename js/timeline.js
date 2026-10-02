/* Al-Biruni's Challenge 2026 — the competition timeline
   One dated list, built from the same config the portal, the registration page
   and every countdown already read.

   The reason this exists as a module rather than as markup on a page: the
   schedule lives in the config, and a hand-written copy of it on a public page
   is a second thing to forget. Two dates sharing a day are grouped into one
   entry, because "5 October: registration opens" and "5 October: applications
   close" as two separate dots reads as two separate days and is how a student
   ends up looking twice. */

(function (global) {
  'use strict';

  const A = global.ABC;

  /* The milestones, in order. Each is skipped when its date is absent, so a
     date the team has not set yet simply does not appear rather than printing
     "To be announced" seven times. `until` is the end of a span: Round 1 runs
     for a day and Round 2 runs for nine, and a timeline that shows only the
     first day of a nine-day window is not much use to somebody planning. */
  function milestones(cfg) {
    return [
      {
        key: 'registration-opens',
        at: cfg.registrationOpensAt,
        what: 'Competition registration opens',
        detail: 'Create an account, pick a username and register for your category. Registration is free.'
      },
      {
        key: 'ba-close',
        at: cfg.baApplicationsCloseAt,
        what: 'Brand Ambassador applications close',
        detail: 'Applications to refer other students are made on a short form and close on this date.'
      },
      {
        key: 'round1',
        at: cfg.round1WindowOpensAt,
        until: cfg.round1WindowClosesAt,
        what: 'Round 1 — Rapid-Fire Online Qualifier',
        detail: 'A timed online mathematics quiz. Open for the whole day. One official attempt per student, and you can register on this date and sit it straight away.'
      },
      {
        key: 'registration-closes',
        at: cfg.registrationClosesAt,
        what: 'Registration closes, 11:59 PM',
        detail: 'The last moment to register for the competition. Round 1 also closes at this time.'
      },
      {
        key: 'round1-results',
        at: cfg.round1ResultsAt,
        what: 'Round 1 results released',
        detail: 'You see your own score and rank in your portal. We contact everyone who qualifies for Round 2.'
      },
      {
        key: 'round2',
        at: cfg.round2OpensAt,
        until: cfg.round2ClosesAt,
        what: 'Round 2 — Mathematical Communication Challenge opens',
        detail: 'Qualified students build a presentation using the official Mathsimized template and submit it as a Google Drive link.'
      },
      {
        key: 'round2-deadline',
        at: cfg.round2ClosesAt,
        what: 'Round 2 submission deadline, 11:59 PM',
        detail: 'The last moment to submit. Once submitted, your link is locked.'
      },
      {
        key: 'finalists',
        at: cfg.finalistsAnnouncedAt,
        what: '30 national finalists announced',
        detail: 'Thirty students from across Pakistan are named, and told what happens next.'
      },
      {
        key: 'grand-finale',
        at: cfg.grandFinaleDate,
        what: 'Grand Finale — Build a Better World',
        detail: (cfg.grandFinaleCity || 'Karachi') + '. Each finalist builds an individual physical model and has up to two minutes to demonstrate it.'
      }
    ].filter((m) => !!m.at).sort((a, b) => A.toDate(a.at) - A.toDate(b.at));
  }

  /* Entries grouped by calendar day. The day is the unit a student plans
     around, so it is the unit shown; the events on it are listed underneath. */
  function groupByDay(list) {
    const days = [];
    const index = {};
    list.forEach((m) => {
      const d = A.toDate(m.at);
      if (!d) return;
      const id = d.toDateString();
      if (!index[id]) {
        index[id] = { at: d, entries: [] };
        days.push(index[id]);
      }
      index[id].entries.push(m);
    });
    return days;
  }

  /* Where the student stands today. `soon` marks the next thing still to come,
     which is the one row worth a student scanning for. */
  function stateOf(day, now) {
    const at = new Date(day.at);
    const end = new Date(day.at.getFullYear(), day.at.getMonth(), day.at.getDate(), 23, 59, 59);
    if (now > end) return 'done';
    if (now >= at) return 'today';
    return 'upcoming';
  }

  const BADGE = { done: 'badge-muted', today: 'badge-ok', upcoming: 'badge-burgundy' };
  const LABEL = { done: 'Done', today: 'Happening now', upcoming: 'Upcoming' };

  function render(config, options) {
    const opts = options || {};
    const host = opts.mount && document.querySelector(opts.mount);
    if (!host) return;
    const now = Date.now();
    const days = groupByDay(milestones(config || {}));
    if (!days.length) return;

    /* The next day that has not happened yet. Marking it, rather than only
       marking what is past, is what makes the page useful on the day: a list of
       eight finished rows with no pointer to the next one reads as finished. */
    const next = days.find((d) => stateOf(d, now) !== 'done') || null;
    const compact = !!opts.compact;

    host.innerHTML = days.map((day) => {
      const state = stateOf(day, now);
      const cls = ['timeline-item'];
      if (state === 'done') cls.push('done');
      /* How far a window on this day runs. Only worth printing when it leaves
         the day: "Runs through 7 Nov" under an entry already reading 7 Nov is
         noise, and Round 2 has its own entry on the 18th to say it. */
      const span = day.entries.map((m) => (m.until ? A.toDate(m.until) : null)).filter(Boolean)
        .reduce((a, b) => (b > a ? b : a), null);
      const spansBeyond = span && span.toDateString() !== day.at.toDateString();
      const rows = day.entries.map((m) => (
        '<li' + (m.detail && !compact ? ' class="timeline-event"' : '') + '>'
        + '<h4>' + A.esc(m.what) + '</h4>'
        + (m.detail ? '<p class="muted small" style="margin:.15rem 0 0">' + A.esc(m.detail) + '</p>' : '')
        + '</li>'
      )).join('');
      return (
        '<div class="' + cls.join(' ') + (state === 'today' ? ' timeline-now' : '') + '"'
        + (next === day ? ' data-next="1"' : '') + '>'
        + '<div class="timeline-date">'
        + '<span class="timeline-day">' + day.at.getDate() + '</span>'
        + '<span class="timeline-month">' + day.at.toLocaleDateString('en-GB', { month: 'short' })
        + (day.at.getFullYear() !== new Date().getFullYear() ? ' ' + day.at.getFullYear() : '')
        + '</span></div>'
        + '<div class="timeline-body">'
        + '<span class="badge ' + BADGE[state] + ' timeline-state">' + LABEL[state] + '</span>'
        + '<ul class="timeline-events">' + rows + '</ul>'
        + (compact || !spansBeyond ? '' : '<p class="muted small timeline-span-note">Open until '
          + A.esc(A.fmtDate(span)) + '</p>')
        + '</div>'
        + '</div>'
      );
    }).join('');
  }

  A.timeline = { milestones, groupByDay, stateOf, render };
})(window);