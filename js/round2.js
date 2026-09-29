/* Al-Biruni's Challenge 2026 — Round 2, judging, finalists, Grand Finale
   ------------------------------------------------------------------
   Round 2 is a mathematical communication challenge. Students submit a
   Google Drive link (presentation material, PDF, recording, or a folder).
   Large video files are deliberately not uploaded to this site.

   The rubric, weighting, deadline and judging structure are all
   admin-configurable — none of them are hardcoded. */

(function (global) {
  'use strict';

  const A = global.ABC;
  const R = A.repo;
  const db = () => A.db;
  const C = R.C;

  /* ---------------- round 2 configuration ---------------- */
  const round2Doc = () => db().collection(C.config).doc('round2');
  const grandFinaleDoc = () => db().collection(C.config).doc('grandFinale');

  function DEFAULT_ROUND2() {
    return {
      title: 'Round 2 — Mathematical Communication Challenge',
      brief: 'Create a presentation using the official Mathsimized PowerPoint template that explains a mathematical idea clearly and originally. You may include a recording of you presenting.',
      templateUrl: '',
      templateNote: '',
      opensAt: null,
      closesAt: null,
      resultsAt: null,
      instructions: '',
      /* Rubric: admin defines criteria. Empty by default — the brief
         states the rubric is not finalised, so nothing is invented. */
      rubric: [],
      /* Weighted average when true, plain average when false. */
      useWeights: false,
      requireAllJudges: false,
      resultsReleasedToStudents: false,
      status: 'draft'
    };
  }

  function DEFAULT_FINALE() {
    return {
      city: 'Karachi',            /* confirmed */
      month: 'November 2026',     /* confirmed */
      date: null,
      venue: '',
      reportingTime: '',
      demoMinutes: 2,             /* confirmed: up to two minutes */
      presentationMinutes: null,  /* admin-set once announced */
      interviewCount: null,       /* admin-set once announced */
      instructions: '',
      schedule: [],
      materials: '',
      finalistsConfirmed: false,
      finalistListReleased: false,
      resultsReleased: false,
      status: 'planning'
    };
  }

  async function getRound2Config() {
    const snap = await round2Doc().get();
    const cfg = Object.assign(DEFAULT_ROUND2(), snap.exists ? snap.data() : {});
    /* Cached so synchronous helpers such as rankSubmissions() can apply the
       configured rubric and weighting rules. */
    A.round2CfgCache = cfg;
    return cfg;
  }
  function onRound2Config(cb) {
    return round2Doc().onSnapshot(
      (s) => cb(Object.assign(DEFAULT_ROUND2(), s.exists ? s.data() : {})), () => cb(DEFAULT_ROUND2()));
  }
  async function saveRound2Config(patch) {
    await round2Doc().set(Object.assign({}, patch, { updatedAt: A.server }), { merge: true });
    return getRound2Config();
  }

  async function getFinaleConfig() {
    const snap = await grandFinaleDoc().get();
    return Object.assign(DEFAULT_FINALE(), snap.exists ? snap.data() : {});
  }
  function onFinaleConfig(cb) {
    return grandFinaleDoc().onSnapshot(
      (s) => cb(Object.assign(DEFAULT_FINALE(), s.exists ? s.data() : {})), () => cb(DEFAULT_FINALE()));
  }
  async function saveFinaleConfig(patch) {
    await grandFinaleDoc().set(Object.assign({}, patch, { updatedAt: A.server }), { merge: true });
    return getFinaleConfig();
  }

  /* ---------------- submissions ---------------- */
  const subRef = (uid) => db().collection(C.round2).doc(uid);

  function validateDriveUrl(url) {
    const s = String(url || '').trim();
    if (!s) return 'Please provide your Google Drive link.';
    if (!/^https?:\/\//i.test(s)) return 'The link must start with http:// or https://';
    if (!/(drive\.google\.com|docs\.google\.com|drive\.google\.com\/drive)/i.test(s)) {
      return 'The link must be a Google Drive link.';
    }
    return null;
  }

  async function getSubmission(uid) {
    const snap = await subRef(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onSubmission(uid, cb) {
    return subRef(uid).onSnapshot(
      (s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null), () => cb(null));
  }

  async function submitRound2(user, registration, data) {
    const cfg = await getRound2Config();
    if (cfg.status === 'draft') throw new Error('Round 2 is not open for submissions yet.');
    if (cfg.status === 'closed') throw new Error('The organiser has closed Round 2 submissions.');
    if (cfg.opensAt) {
      const t = A.toDate(cfg.opensAt);
      if (t && Date.now() < t.getTime()) throw new Error('Round 2 submissions have not opened yet.');
    }
    if (cfg.closesAt) {
      const t = A.toDate(cfg.closesAt);
      if (t && Date.now() > t.getTime()) throw new Error('Round 2 submissions have closed.');
    }
    if (!registration) throw new Error('You must be registered to submit.');
    if (!registration.qualifiedForRound2) {
      throw new Error('You are not currently qualified for Round 2.');
    }

    const existing = await getSubmission(user.uid);
    if (existing && existing.locked) {
      throw new Error('Your submission is locked. Contact the organiser if you need it reopened.');
    }

    const linkError = validateDriveUrl(data.driveUrl);
    if (linkError) throw new Error(linkError);

    const payload = {
      uid: user.uid,
      studentName: registration.studentName || user.displayName || '',
      email: registration.email || user.email || '',
      school: registration.school || '',
      city: registration.city || '',
      category: registration.category,
      title: String(data.title || '').trim(),
      driveUrl: String(data.driveUrl).trim(),
      notes: String(data.notes || '').trim(),
      topic: String(data.topic || '').trim(),
      locked: true,
      submittedAt: existing && existing.submittedAt ? existing.submittedAt : A.server,
      resubmittedAt: A.server,
      resubmitCount: existing ? A.num(existing.resubmitCount) + 1 : 0,
      status: 'submitted',
      updatedAt: A.server
    };
    await subRef(user.uid).set(payload);
    await R.audit('round2_submit', { uid: user.uid, resubmit: !!existing });
    return getSubmission(user.uid);
  }

  async function listSubmissions(filter) {
    let q = db().collection(C.round2);
    if (filter && filter.category) q = q.where('category', '==', filter.category);
    if (filter && filter.status) q = q.where('status', '==', filter.status);
    const snap = await q.get();
    return A.sortBy(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())), (r) => r.studentName);
  }

  /* Administrator reopens a locked submission for an exceptional case. */
  async function reopenSubmission(uid) {
    await subRef(uid).set({ locked: false, updatedAt: A.server }, { merge: true });
    await R.audit('round2_reopen', { uid });
  }

  async function lockSubmission(uid, locked) {
    await subRef(uid).set({ locked: !!locked, updatedAt: A.server }, { merge: true });
    await R.audit('round2_lock', { uid, locked: !!locked });
  }

  /* ---------------- judging ----------------
     Multiple judges per submission. Each judge records a score per rubric
     criterion plus an overall comment. Aggregation honours the configured
     weighting and can require all assigned judges to have scored. */
  const judgementRef = (submissionUid, judgeUid) =>
    db().collection(C.judgements).doc(submissionUid + '_' + judgeUid);

  /* A judgement is keyed by the judge's Firebase user id, never by the judge
     record id, so the rules can match it against request.auth.uid. The judge
     record carries that id in authUid once the judge has signed in. */
  const judgeKey = (judge) => (judge && judge.authUid) || (judge && judge.id) || '';

  async function getJudgements(submissionUid, judgeUids) {
    const ids = judgeUids || (await listJudges()).map(judgeKey);
    if (!ids.length) return [];
    const snaps = await Promise.all(ids.map((id) => judgementRef(submissionUid, id).get()));
    return snaps
      .filter((s) => s.exists)
      .map((s) => Object.assign({ id: s.id }, s.data()));
  }

  function onJudgementsForJudge(judgeUid, cb) {
    return db().collection(C.judgements)
      .where('judgeUid', '==', judgeUid)
      .onSnapshot((s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data()))), () => cb([]));
  }

  async function saveJudgement(submissionUid, judgeUid, data) {
    await judgementRef(submissionUid, judgeUid).set(Object.assign({
      submissionUid,
      judgeUid,
      updatedAt: A.server
    }, data), { merge: true });
    return getAggregatedScore(submissionUid);
  }

  async function deleteJudgement(submissionUid, judgeUid) {
    await judgementRef(submissionUid, judgeUid).delete();
  }

  function judgeTotal(judgement, rubric) {
    if (!judgement) return null;
    const criteria = (judgement.criteria || {});
    if (rubric && rubric.length) {
      return rubric.reduce((sum, c) => {
        const raw = A.num(criteria[c.id], NaN);
        if (!isFinite(raw)) return NaN;
        const max = A.num(c.max, 10) || 10;
        return sum + (raw / max) * 100;
      }, NaN);
    }
    const overall = A.num(judgement.overall, NaN);
    return isFinite(overall) ? overall : NaN;
  }

  /* Aggregate judge scores into a single figure for ranking. */
  function aggregate(cfg, judgements) {
    const rubric = cfg.rubric || [];
    const totals = [];
    let incomplete = 0;
    judgements.forEach((j) => {
      const t = judgeTotal(j, rubric);
      if (t === null || isNaN(t)) { incomplete += 1; return; }
      totals.push(t);
    });
    if (!totals.length) return { finalScore: null, judgeCount: 0, incomplete, complete: false };
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const final = cfg.useWeights ? weightedAverage(judgementWeights(judgements, rubric), totals) : avg;
    return {
      finalScore: Math.round(final * 100) / 100,
      judgeCount: totals.length,
      incomplete,
      complete: !cfg.requireAllJudges || incomplete === 0
    };
  }

  /* When weighted, each judge's weight is derived from the sum of the
     rubric maxima they scored — documented behaviour, admin-adjustable
     via cfg.judgeWeights when present. */
  function judgementWeights(judgements, rubric) {
    return judgements.map((j) => {
      if (j.weight !== undefined && j.weight !== null) return A.num(j.weight, 1);
      if (!rubric.length) return 1;
      const c = j.criteria || {};
      return rubric.reduce((s, cr) => s + A.num(cr.max, 10), 0) || 1;
    });
  }

  function weightedAverage(weights, values) {
    let wsum = 0, vsum = 0;
    weights.forEach((w, i) => { if (!isNaN(values[i])) { wsum += w; vsum += w * values[i]; } });
    return wsum ? vsum / wsum : 0;
  }

  /* Rank Round 2 submissions within a category. */
  /* Aggregate one submission across its judges using the configured rubric. */
  async function getAggregatedScore(submissionUid, judgeUids, cfg) {
    const config = cfg || await getRound2Config();
    const judgements = await getJudgements(submissionUid, judgeUids);
    const agg = aggregate(config, judgements);
    return Object.assign({ submissionUid, judgements }, agg);
  }

  function rankSubmissions(submissions, judgementsBySub, cfg) {
    const config = cfg || A.round2CfgCache || { rubric: [], useWeights: false };
    const rows = submissions.map((s) => {
      const agg = aggregate(config, judgementsBySub[s.id] || []);
      return Object.assign({}, s, {
        finalScore: agg.finalScore,
        judgeCount: agg.judgeCount,
        judgingComplete: agg.complete
      });
    });
    const ranked = A.sortBy(rows, (r) => (r.finalScore === null ? -1 : r.finalScore), 'desc');
    let rank = 0, prev = null;
    ranked.forEach((r) => {
      if (r.finalScore === null) { r.rank = null; return; }
      if (prev === null || r.finalScore !== prev) { rank += 1; prev = r.finalScore; }
      r.rank = rank;
    });
    return ranked;
  }

  async function listAllJudgements() {
    const snap = await db().collection(C.judgements).get();
    const out = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      (out[data.submissionUid] = out[data.submissionUid] || []).push(Object.assign({ id: d.id }, data));
    });
    return out;
  }

  /* ---------------- finalists ---------------- */
  const finalistRef = (uid) => db().collection(C.finalists).doc(uid);

  async function isFinalist(uid) {
    const snap = await finalistRef(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onFinalist(uid, cb) {
    return finalistRef(uid).onSnapshot(
      (s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null), () => cb(null));
  }

  async function listFinalists(category) {
    let q = db().collection(C.finalists);
    if (category) q = q.where('category', '==', category);
    const snap = await q.get();
    return A.sortBy(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())), (r) => A.num(r.finalScore), 'desc');
  }

  /* Administrator confirms a set of finalists. Nothing is published to
     students until the admin separately releases the finalist list. */
  async function confirmFinalist(uid, data) {
    await finalistRef(uid).set(Object.assign({
      uid,
      confirmedAt: A.server,
      updatedAt: A.server,
      released: false
    }, data), { merge: true });
    await R.audit('finalist_confirm', { uid });
  }

  async function removeFinalist(uid) {
    await finalistRef(uid).delete();
    await R.audit('finalist_remove', { uid });
  }

  async function setFinalistReleased(uid, released) {
    await finalistRef(uid).set({ released: !!released, releasedAt: released ? A.server : null, updatedAt: A.server }, { merge: true });
  }

  /* Bulk-confirm the top N of a ranked list — still requires an explicit
     admin action and never publishes automatically. */
  async function confirmTopN(category, n, rows, judgementsBySub, config) {
    const cfg = config || await getRound2Config();
    const ranked = rankSubmissions(rows, judgementsBySub, cfg);
    const top = ranked.filter((r) => r.rank && r.rank <= n);
    for (const r of top) {
      await confirmFinalist(r.id, {
        name: r.studentName,
        school: r.school,
        city: r.city,
        category: r.category,
        rank: r.rank,
        finalScore: r.finalScore,
        source: 'round2'
      });
    }
    await R.audit('finalists_confirm_top', { category, n, count: top.length });
    return top;
  }

  /* ---------------- grand finale results ---------------- */
  async function saveFinalistResult(uid, data) {
    await finalistRef(uid).set(Object.assign({ uid, updatedAt: A.server }, data), { merge: true });
  }

  const AWARDS = {
    winner: { label: 'Winner', cash: 'Rs. 30,000', shield: "Physical Winner's Shield" },
    runnerup: { label: 'Runner-up', cash: 'Rs. 10,000', shield: 'Physical Runner-Up Shield' },
    hm: { label: 'Honourable Mention', cash: null, shield: null }
  };

  A.round2 = {
    DEFAULT_ROUND2, DEFAULT_FINALE,
    getRound2Config, onRound2Config, saveRound2Config,
    getFinaleConfig, onFinaleConfig, saveFinaleConfig,
    validateDriveUrl, getSubmission, onSubmission, submitRound2, listSubmissions,
    reopenSubmission, lockSubmission,
    getJudgements, onJudgementsForJudge, saveJudgement, deleteJudgement,
    judgeTotal, judgeKey, aggregate, getAggregatedScore, rankSubmissions, listAllJudgements,
    isFinalist, onFinalist, listFinalists, confirmFinalist, removeFinalist,
    setFinalistReleased, confirmTopN, saveFinalistResult, AWARDS
  };
})(window);
