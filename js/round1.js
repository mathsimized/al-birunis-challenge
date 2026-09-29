/* Al-Biruni's Challenge 2026 — Round 1 engine
   ------------------------------------------------------------------
   Attempt lifecycle:  not-started -> in-progress -> submitted -> scored

   Trust boundary
   --------------
   A student's browser never receives a correct answer and never writes a
   score. `beginAttempt()` returns a sanitised question list built from
   abc_questions, which holds no answers; the answers are in
   abc_answer_keys, a collection only admins may read. `scoreAttempt()` is
   the only place a score is computed, and it runs in the admin panel's
   authenticated session.

   All round parameters (window, question count, time limit, marks,
   selection method, randomisation, resumability) come from the admin
   configuration, so nothing about the round is hardcoded. */

(function (global) {
  'use strict';

  const A = global.ABC;
  const R = A.repo;
  const db = () => A.db;
  const C = R.C;

  const quizDoc = () => db().collection(C.quizzes).doc('round1');

  /* ---------------- quiz configuration ---------------- */
  function DEFAULT_QUIZ() {
    return {
      id: 'round1',
      title: 'Round 1 — Rapid-Fire Online Qualifier',
      /* window */
      opensAt: null,
      closesAt: null,
      /* paper */
      questionCount: null,          /* per attempt, admin-set */
      timeLimitMinutes: null,       /* admin-set */
      defaultMarks: null,           /* default per-question marks */
      selectionMethod: 'random',    /* 'random' | 'manual' */
      manualQuestionIds: [],
      randomizeQuestions: true,
      randomizeOptions: false,
      poolLimitPerCategory: null,   /* null = take from whole category */
      /* attempt policy */
      allowResume: true,
      oneAttemptPerStudent: true,
      autoSubmitOnTimeExpiry: true,
      /* results */
      resultsVisibleImmediately: false,
      resultsReleasedToStudents: false,
      /* null until the organiser confirms the tie-break rule.
         'submission_time' | 'first_to_finish' | 'none' */
      tieBreak: null,
      status: 'draft'                /* 'draft' | 'open' | 'closed' */
    };
  }

  async function getQuiz() {
    const snap = await quizDoc().get();
    return Object.assign(DEFAULT_QUIZ(), snap.exists ? snap.data() : {});
  }

  function onQuiz(cb) {
    return quizDoc().onSnapshot(
      (s) => cb(Object.assign(DEFAULT_QUIZ(), s.exists ? s.data() : {})),
      () => cb(DEFAULT_QUIZ())
    );
  }

  async function saveQuiz(patch) {
    await quizDoc().set(Object.assign({}, patch, { updatedAt: A.server }), { merge: true });
    return getQuiz();
  }

  /* ---------------- window state ---------------- */
  function windowState(quiz, now) {
    const t = now || Date.now();
    const open = A.toDate(quiz.opensAt);
    const close = A.toDate(quiz.closesAt);
    if (quiz.status === 'draft') return { code: 'not-published', label: 'Not published yet' };
    if (open && t < open.getTime()) return { code: 'upcoming', label: 'Opens soon', opensAt: open };
    if (close && t > close.getTime()) return { code: 'closed', label: 'Closed', closesAt: close };
    return { code: 'open', label: 'Open now', opensAt: open, closesAt: close };
  }

  /* ---------------- attempt helpers ---------------- */
  const attemptRef = (uid) => db().collection(C.attempts).doc(uid);

  function sanitise(question) {
    return {
      id: question.id,
      type: question.type,
      text: question.text,
      options: question.type === 'mcq' || question.type === 'multiple_select'
        ? (question.options || []).map((o) => (typeof o === 'string' ? o : o.text))
        : null,
      marks: question.marks,
      topic: question.topic || '',
      /* Deliberately omitted: correct, explanation, difficulty, category */
    };
  }

  function shuffle(arr, rng) {
    const r = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Select the questions for one attempt, honouring the admin's
     selection method, category pool and question count. */
  /* Builds the paper from the answer-free bank. The student sees only the
     fields returned by sanitise(). */
  async function selectQuestions(quiz, category) {
    const snap = await db().collection(C.questions)
      .where('category', '==', category)
      .where('status', '==', 'active')
      .get();
    let pool = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    if (quiz.selectionMethod === 'manual') {
      const ids = new Set(quiz.manualQuestionIds || []);
      pool = pool.filter((p) => ids.has(p.id));
      return pool.map(sanitise);
    }

    if (quiz.randomizeQuestions !== false) pool = shuffle(pool);

    const cap = quiz.poolLimitPerCategory ? A.num(quiz.poolLimitPerCategory) : pool.length;
    pool = pool.slice(0, cap);

    const count = quiz.questionCount ? A.num(quiz.questionCount) : pool.length;
    let chosen = pool.slice(0, count);
    if (quiz.randomizeOptions) {
      chosen = chosen.map((qst) => {
        if (qst.type !== 'mcq') return qst;
        return Object.assign({}, qst, { options: shuffle(qst.options) });
      });
    }
    return chosen.map(sanitise);
  }

  async function getAttempt(uid) {
    const snap = await attemptRef(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onAttempt(uid, cb) {
    return attemptRef(uid).onSnapshot(
      (s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null),
      () => cb(null)
    );
  }

  /* ---------------- start / resume ---------------- */
  /* The paper is assembled from the answer-free question bank. Answers live
     in abc_answer_keys, which the rules keep away from students, and scoring
     is done from the admin panel. Every time here is a Firestore server
     timestamp, not the student's clock. */
  async function beginAttempt(user, registration) {
    const quiz = await getQuiz();
    const state = windowState(quiz);

    if (!registration) throw new Error('You must be registered before starting Round 1.');
    if (state.code === 'not-published') throw new Error('Round 1 has not been published yet.');
    if (state.code === 'upcoming') throw new Error('Round 1 has not opened yet.');
    if (state.code === 'closed') throw new Error('Round 1 is now closed.');

    const existing = await getAttempt(user.uid);
    if (existing) {
      if (existing.status === 'in-progress') {
        if (quiz.allowResume === false) throw new Error('Resuming is disabled for this round. Contact the organiser.');
        return existing;
      }
      if (quiz.oneAttemptPerStudent !== false) {
        throw new Error('You have already used your official Round 1 attempt.');
      }
    }

    const questions = await selectQuestions(quiz, registration.category);
    if (!questions.length) throw new Error('No questions are available for your category yet.');

    const durationMs = quiz.timeLimitMinutes ? A.num(quiz.timeLimitMinutes) * 60000 : null;
    /* The window can close before the personal timer expires; the earlier of
       the two is the real deadline. */
    const hardClose = A.toDate(quiz.closesAt) ? A.toDate(quiz.closesAt).getTime() : null;
    const deadlineMs = durationMs
      ? (hardClose ? Math.min(Date.now() + durationMs, hardClose) : Date.now() + durationMs)
      : hardClose;

    const answers = {};
    questions.forEach((q, i) => { answers[String(i)] = null; });

    await attemptRef(user.uid).set({
      uid: user.uid,
      studentName: registration.studentName || user.displayName || '',
      school: registration.school || '',
      city: registration.city || '',
      category: registration.category,
      status: 'in-progress',
      questions,
      answers,
      flagged: {},
      visited: {},
      questionCount: questions.length,
      timeLimitMinutes: quiz.timeLimitMinutes || null,
      totalMarksAvailable: questions.reduce((sum, q) => sum + A.num(q.marks), 0),
      quizSnapshot: {
        questionCount: quiz.questionCount,
        timeLimitMinutes: quiz.timeLimitMinutes,
        defaultMarks: quiz.defaultMarks,
        tieBreak: quiz.tieBreak,
        selectionMethod: quiz.selectionMethod
      },
      startedAt: A.server,
      /* Display only. The authoritative elapsed time is startedAt, set by the
         server, and the admin panel can void an attempt that was left open. */
      clientDeadlineMs: deadlineMs,
      lastSavedAt: A.server,
      submittedAt: null,
      score: null,
      maxScore: null,
      correctCount: null,
      resultStatus: 'not-scored'
    });

    return getAttempt(user.uid);
  }


  async function saveAnswer(uid, index, value) {
    const ref = attemptRef(uid);
    return db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Attempt not found.');
      const data = snap.data();
      if (data.status !== 'in-progress') throw new Error('This attempt is no longer editable.');
      tx.update(ref, {
        [`answers.${index}`]: value === undefined ? null : value,
        lastSavedAt: A.server
      });
    });
  }

  async function saveFlag(uid, index, flagged) {
    const ref = attemptRef(uid);
    return db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Attempt not found.');
      if (snap.data().status !== 'in-progress') throw new Error('This attempt is no longer editable.');
      tx.update(ref, { [`flagged.${index}`]: !!flagged, lastSavedAt: A.server });
    });
  }

  async function markVisited(uid, index) {
    const ref = attemptRef(uid);
    return db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      if (snap.data().status !== 'in-progress') return;
      tx.update(ref, { [`visited.${index}`]: true, lastSavedAt: A.server });
    });
  }

  /* ---------------- submit ---------------- */
  /* Marks the attempt submitted and hands it to the admin panel for scoring.
     startedAt and submittedAt are both server timestamps, so a tampered
     device clock cannot rewrite history; the panel shows the true elapsed
     time and the organiser can void an attempt held open past the deadline. */
  async function submitAttempt(uid, opts) {
    const options = opts || {};
    const ref = attemptRef(uid);
    return db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Attempt not found.');
      const data = snap.data();
      if (data.status === 'submitted' || data.status === 'scored') {
        return { alreadySubmitted: true, autoSubmitted: true, attempt: data };
      }
      if (data.status !== 'in-progress') throw new Error('This attempt cannot be submitted.');

      /* The stored startedAt is the server's, so this measures the real time. */
      const startedMs = A.toDate(data.startedAt) ? A.toDate(data.startedAt).toMillis() : null;
      const limitMs = A.num(data.timeLimitMinutes, 0) * 60000;
      const expired = !!(startedMs && limitMs && (Date.now() - startedMs) > limitMs);
      const auto = expired || options.manual !== true;

      const patch = {
        status: 'submitted',
        submittedAt: A.server,
        autoSubmitted: auto,
        resultStatus: 'pending-scoring'
      };
      tx.update(ref, patch);
      return { alreadySubmitted: false, autoSubmitted: auto, attempt: Object.assign({}, data, patch) };
    });
  }


  /* Scoring runs in the admin panel, from the administrator's authenticated
     session. That is the point: the answer keys are administrator-only, so a
     student can start an attempt and autosave answers but can never see a
     correct answer or change a score. */
  async function scoreAttempt(uid) {
    const attemptSnap = await attemptRef(uid).get();
    if (!attemptSnap.exists) throw new Error('Attempt not found.');
    const attempt = attemptSnap.data();
    if (attempt.status === 'in-progress') throw new Error('Attempt has not been submitted.');

    const questions = attempt.questions || [];
    if (!questions.length) throw new Error('This attempt has no questions.');
    const keySnaps = await db().getAll(
      ...questions.map((q) => db().collection(C.answerKeyByQuestion).doc(q.id))
    );
    const keys = {};
    keySnaps.forEach((snap) => {
      if (snap.exists) keys[snap.id] = snap.data();
    });

    const perQuestion = {};
    let score = 0, maxScore = 0, correctCount = 0;
    questions.forEach((q, i) => {
      const key = keys[q.id] || {};
      const marks = A.num(key.marks, A.num(q.marks, 1));
      const given = (attempt.answers || {})[String(i)];
      const answered = given !== null && given !== undefined && given !== '';
      const isCorrect = answered && key.correct !== undefined && key.correct !== null &&
        A.answersMatch(given, key.correct, q.type);
      maxScore += marks;
      if (isCorrect) { score += marks; correctCount += 1; }
      perQuestion[String(i)] = {
        questionId: q.id,
        given: given === undefined ? null : given,
        correct: key.correct === undefined ? null : key.correct,
        isCorrect,
        marks,
        marksAwarded: isCorrect ? marks : 0,
        /* True when the attempt sat open well past the time limit, so the
           organiser can decide what to do before releasing anything. */
        suspect: !!(attempt.startedAt && A.num(attempt.timeLimitMinutes, 0) &&
          A.toDate(attempt.startedAt) &&
          (A.toDate(attempt.submittedAt || attempt.lastSavedAt) || new Date()) -
            A.toDate(attempt.startedAt) > A.num(attempt.timeLimitMinutes, 0) * 60000 * 1.25)
      };
    });

    await attemptRef(uid).set({
      score,
      maxScore,
      correctCount,
      questionCount: questions.length,
      breakdown: perQuestion,
      resultStatus: 'scored',
      scoredAt: A.server
    }, { merge: true });

    return { uid, score, maxScore, correctCount, breakdown: perQuestion };
  }

  /* Scores everything waiting, one attempt at a time so a single bad document
     cannot abandon a whole class. */
  async function scoreAllPending(category) {
    let q = db().collection(C.attempts).where('resultStatus', '==', 'pending-scoring');
    if (category) q = q.where('category', '==', category);
    const snap = await q.get();
    const results = [];
    for (const doc of snap.docs) {
      try {
        results.push(await scoreAttempt(doc.id));
      } catch (e) {
        results.push({ uid: doc.id, error: e.message });
      }
    }
    return results;
  }

  /* ---------------- ranking & qualification ----------------
     Dense ranks within a category. Tie-break is configurable and never
     hardcoded to a specific rule. */
  function rankAttempts(attempts, quiz) {
    /* No tie-break is applied until the organiser sets one; equal scores
       then share a rank and the next score skips (1, 2, 2, 4). */
    const tie = (quiz && quiz.tieBreak) || 'none';
    const rows = attempts.slice();
    rows.forEach((r) => { r.numericalScore = A.num(r.score); });
    rows.sort((a, b) => {
      if (b.numericalScore !== a.numericalScore) return b.numericalScore - a.numericalScore;
      if (tie === 'submission_time' || tie === 'first_to_finish') {
        return A.num(a.submittedAtMs, Infinity) - A.num(b.submittedAtMs, Infinity);
      }
      return 0;
    });
    let rank = 0, prev = null, i = 0;
    rows.forEach((r) => {
      i += 1;
      if (prev === null || r.numericalScore !== prev) { rank = i; prev = r.numericalScore; }
      r.rank = rank;
    });
    return rows;
  }

  /* Recompute category ranks and write the private results documents. */
  async function rebuildResults(category) {
    const cats = category ? [category] : R.CATEGORY_IDS;
    const summary = [];
    for (const cat of cats) {
      const snap = await db().collection(C.attempts).where('category', '==', cat).get();
      const scored = snap.docs
        .map((d) => Object.assign({ id: d.id }, d.data()))
        .filter((r) => r.resultStatus === 'scored');
      const [quiz, cfg] = await Promise.all([getQuiz(), R.getConfig()]);
      const ranked = rankAttempts(scored, quiz);
      /* Qualification quota is organiser-controlled and not yet confirmed,
         so it stays null until the admin sets it. A quota of 0 means nobody
         is auto-qualified; no quota means qualification is decided manually. */
      const rawQuota = quiz.qualifyPerCategory !== null && quiz.qualifyPerCategory !== undefined
        ? quiz.qualifyPerCategory
        : cfg.round1QualifyPerCategory;
      const quota = rawQuota === null || rawQuota === undefined || rawQuota === '' ? null : A.num(rawQuota);

      const batch = db().batch();
      ranked.forEach((r) => {
        const qualified = quota !== null ? r.rank <= quota : false;
        batch.set(db().collection(C.results).doc(r.id), {
          uid: r.id,
          studentName: r.studentName,
          name: r.studentName,
          school: r.school,
          city: r.city,
          category: r.category,
          score: r.score,
          maxScore: r.maxScore,
          correctCount: r.correctCount,
          questionCount: r.questionCount,
          rank: r.rank,
          qualified,
          attemptStatus: r.status,
          submittedAt: r.submittedAt,
          autoSubmitted: !!r.autoSubmitted,
          tieBreak: quiz.tieBreak,
          updatedAt: A.server
        }, { merge: true });
        batch.set(attemptRef(r.id), { qualified, rank: r.rank, resultStatus: r.resultStatus }, { merge: true });
        /* Mirror qualification onto the registration so Round 2 access and the
           portal stepper read one authoritative flag. */
        batch.set(db().collection(C.registrations).doc(r.id), {
          qualifiedForRound2: qualified,
          round1Rank: r.rank,
          updatedAt: A.server
        }, { merge: true });
      });
      await batch.commit();
      summary.push({ category: cat, ranked, quota });
    }
    return summary;
  }

  async function getResult(uid) {
    const snap = await db().collection(C.results).doc(uid).get();
    return snap.exists ? Object.assign({ id: snap.id, uid }, snap.data()) : null;
  }

  function onResult(uid, cb) {
    return db().collection(C.results).doc(uid).onSnapshot(
      (s) => cb(s.exists ? Object.assign({ id: s.id, uid }, s.data()) : null),
      () => cb(null)
    );
  }

  async function listResults(category) {
    let q = db().collection(C.results);
    if (category) q = q.where('category', '==', category);
    const snap = await q.get();
    return A.sortBy(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())), (r) => A.num(r.rank), 'asc');
  }

  /* Release or withdraw a single student's result. */
  async function setResultReleased(uid, released) {
    await db().collection(C.results).doc(uid)
      .update({ releasedToStudent: released, releasedAt: released ? A.server : null, updatedAt: A.server });
    await R.audit('result_release', { uid, released });
  }

  /* ---------------- public results ----------------
     Public visibility is a separately written, deliberately limited slice.
     The complete ranking never leaves abc_results. */
  const PUBLIC_MODES = ['hidden', 'top10', 'top25', 'top50', 'top100', 'top150', 'top200', 'everyone', 'custom'];

  function publicLimit(mode, custom) {
    if (mode === 'hidden') return 0;
    if (mode === 'everyone') return Infinity;
    if (mode === 'custom') return Math.max(0, A.num(custom));
    const n = parseInt(String(mode).replace('top', ''), 10);
    return isFinite(n) ? n : 0;
  }

  async function publishCategory(category, options) {
    const opts = options || {};
    const results = await listResults(category);
    const limit = publicLimit(opts.mode, opts.custom);
    const visible = results.filter((r) => r.rank <= limit).map((r) => ({
      rank: r.rank,
      name: r.name,
      school: r.school,
      city: r.city,
      category: r.category,
      score: r.score,
      maxScore: r.maxScore,
      qualified: !!r.qualified
    }));

    await db().collection(C.publicResults).doc(category).set({
      category,
      mode: opts.mode,
      custom: A.num(opts.custom),
      limit: limit === Infinity ? 'all' : limit,
      published: !!opts.published,
      showNames: opts.showNames !== false,
      showScores: opts.showScores !== false,
      showSchools: !!opts.showSchools,
      resultsReleasedToStudents: !!opts.resultsReleasedToStudents,
      rows: visible,
      totalRanked: results.length,
      publishedAt: A.server,
      publishedBy: A.user ? A.user.uid : 'system',
      note: opts.note || ''
    });
    await R.audit('publish_results', { category, mode: opts.mode, count: visible.length });
  }

  /* A category that has never been published is simply absent; the rules
     deny reads of unpublished snapshots, so that is treated as "no results". */
  async function getPublicResults(category) {
    try {
      const snap = await db().collection(C.publicResults).doc(category).get();
      return snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
    } catch (e) {
      return null;
    }
  }

  function onPublicResults(cb) {
    return db().collection(C.publicResults).onSnapshot(
      (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
      () => cb([])
    );
  }

  /* ---------------- admin listings ---------------- */
  async function listAttempts(filter) {
    let q = db().collection(C.attempts);
    if (filter && filter.category) q = q.where('category', '==', filter.category);
    if (filter && filter.status) q = q.where('status', '==', filter.status);
    const snap = await q.get();
    return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }

  /* There is no per-attempt answer key to remove: the answers live once, keyed
     by question, and belong to the question bank rather than to an attempt. */
  async function adminDeleteAttempt(uid) {
    const batch = db().batch();
    batch.delete(attemptRef(uid));
    batch.delete(db().collection(C.results).doc(uid));
    await batch.commit();
    await R.audit('attempt_delete', { uid });
  }

  /* Allow an administrator to reopen an attempt for an exceptional case. */
  async function reopenAttempt(uid) {
    await attemptRef(uid).set({ status: 'in-progress', submittedAt: null, submittedAtMs: null, resultStatus: 'not-scored', score: null, qualified: null, rank: null, updatedAt: A.server }, { merge: true });
    await db().collection(C.results).doc(uid).set({ uid, rank: null, qualified: null, updatedAt: A.server }, { merge: true });
    await R.audit('attempt_reopen', { uid });
  }

  /* ---------------- question bank ---------------- */
  const Q_TYPES = ['mcq', 'numeric', 'short_answer', 'multiple_select'];
  const Q_TYPE_LABELS = {
    mcq: 'Multiple choice',
    numeric: 'Numeric answer',
    short_answer: 'Short answer',
    multiple_select: 'Multiple select (more than one correct)'
  };
  const DIFFICULTIES = ['easy', 'medium', 'hard'];
  const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  /* A question is stored in two places. `abc_questions` holds the paper and
     is readable by any signed-in student, because a student must be able to
     read the questions they are asked. `abc_answer_keys/{questionId}` holds
     the correct answers and is administrator-only, and is the only place a
     score can come from. Nothing ever combines the two in a student-readable
     document. */
  function normaliseQuestion(input) {
    const type = Q_TYPES.includes(input.type) ? input.type : 'mcq';
    const marks = Math.max(0, A.num(input.marks, 1));
    let options = [];
    if (type === 'mcq' || type === 'multiple_select') {
      options = (input.options || [])
        .map((o) => (typeof o === 'string' ? o : (o && o.text) || ''))
        .map((t) => t.trim())
        .filter(Boolean);
    }
    let correct = input.correct;
    if (type === 'mcq') correct = String(correct || '').trim().toUpperCase();
    if (type === 'multiple_select') {
      correct = (Array.isArray(correct) ? correct : String(correct || '').split(/[|;,]/))
        .map((c) => String(c).trim().toUpperCase()).filter(Boolean).sort();
    }
    if (type === 'numeric') correct = A.normaliseAnswer(correct, 'numeric');
    if (type === 'short_answer') correct = A.normaliseAnswer(correct, 'short_answer');

    return {
      paper: {
        category: input.category,
        type,
        text: String(input.text || '').trim(),
        options,
        marks,
        difficulty: DIFFICULTIES.includes(input.difficulty) ? input.difficulty : 'medium',
        topic: String(input.topic || '').trim(),
        status: input.status === 'inactive' ? 'inactive' : 'active',
        updatedAt: A.server
      },
      key: {
        correct,
        explanation: String(input.explanation || '').trim(),
        marks,
        type,
        updatedAt: A.server
      }
    };
  }

  /* Validate a candidate question. Returns {ok, errors[], warnings[]}. */
  function validateQuestion(input, index) {
    const errors = [], warnings = [];
    const label = index === undefined ? 'Question' : `Row ${index + 1}`;
    if (!input.category || !R.CATEGORY_IDS.includes(input.category)) errors.push(`${label}: invalid or missing category.`);
    if (!input.text || String(input.text).trim().length < 5) errors.push(`${label}: question text is missing or too short.`);
    if (!Q_TYPES.includes(input.type)) errors.push(`${label}: unknown question type "${input.type}".`);

    const type = Q_TYPES.includes(input.type) ? input.type : 'mcq';
    if (type === 'mcq' || type === 'multiple_select') {
      const opts = (input.options || []).map((o) => String(typeof o === 'string' ? o : (o && o.text) || '').trim()).filter(Boolean);
      if (opts.length < 2) errors.push(`${label}: needs at least two answer options.`);
      const letters = opts.map((_, i) => String.fromCharCode(65 + i));
      const given = type === 'mcq'
        ? [String(input.correct || '').trim().toUpperCase()]
        : (Array.isArray(input.correct) ? input.correct : String(input.correct || '').split(/[|;,]/)).map((c) => String(c).trim().toUpperCase());
      if (!given.filter(Boolean).length) errors.push(`${label}: correct answer is missing.`);
      given.filter(Boolean).forEach((g) => {
        if (!letters.includes(g)) errors.push(`${label}: correct answer "${g}" does not match any option (${letters.join(', ')}).`);
      });
      if (type === 'multiple_select' && new Set(given).size !== given.length) warnings.push(`${label}: duplicate correct options.`);
    }
    if (type === 'numeric' && (input.correct === '' || input.correct === undefined || input.correct === null)) {
      errors.push(`${label}: correct numeric answer is missing.`);
    }
    if (type === 'short_answer' && !String(input.correct || '').trim()) {
      errors.push(`${label}: correct answer is missing.`);
    }
    if (A.num(input.marks, 1) <= 0) warnings.push(`${label}: marks must be greater than zero.`);
    if (!String(input.explanation || '').trim()) warnings.push(`${label}: no explanation provided.`);
    if (!String(input.topic || '').trim()) warnings.push(`${label}: no topic given.`);
    return { ok: errors.length === 0, errors, warnings, row: input };
  }

  async function listQuestions(filter) {
    let q = db().collection(C.questions);
    if (filter && filter.category) q = q.where('category', '==', filter.category);
    if (filter && filter.status) q = q.where('status', '==', filter.status);
    if (filter && filter.difficulty) q = q.where('difficulty', '==', filter.difficulty);
    const snap = await q.get();
    const rows = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    /* The admin editor needs the answers, so the keys are joined back on. */
    await attachKeys(rows);
    let out = rows;
    if (filter && filter.topic) {
      const t = String(filter.topic).toLowerCase();
      out = out.filter((r) => String(r.topic || '').toLowerCase().includes(t));
    }
    if (filter && filter.search) {
      const s = String(filter.search).toLowerCase();
      out = out.filter((r) => String(r.text || '').toLowerCase().includes(s) ||
        String(r.topic || '').toLowerCase().includes(s));
    }
    return A.sortBy(out, (r) => r.updatedAt, 'desc');
  }

  /* Fills in correct/explanation for the admin editor, in one read. */
  async function attachKeys(rows) {
    if (!rows.length) return rows;
    const snaps = await db().getAll(
      ...rows.map((r) => db().collection(C.answerKeyByQuestion).doc(r.id))
    );
    snaps.forEach((snap, i) => {
      if (snap.exists) {
        const d = snap.data();
        rows[i].correct = d.correct;
        rows[i].explanation = d.explanation || '';
      }
    });
    return rows;
  }

  async function getQuestion(id) {
    const snap = await db().collection(C.questions).doc(id).get();
    return snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
  }

  /* One write each, in a single batch, so a question and its key can never
     drift apart. */
  async function saveQuestion(input, id) {
    const data = normaliseQuestion(input);
    const check = validateQuestion(Object.assign({}, data.paper, { correct: data.key.correct }));
    if (!check.ok) throw new Error(check.errors.join(' '));

    if (id) {
      const batch = db().batch();
      batch.set(db().collection(C.questions).doc(id), data.paper, { merge: true });
      batch.set(db().collection(C.answerKeyByQuestion).doc(id),
        Object.assign({ questionId: id, category: data.paper.category }, data.key), { merge: true });
      await batch.commit();
      return id;
    }
    const ref = db().collection(C.questions).doc();
    const batch = db().batch();
    batch.set(ref, Object.assign({ createdAt: A.server }, data.paper));
    batch.set(db().collection(C.answerKeyByQuestion).doc(ref.id),
      Object.assign({ questionId: ref.id, category: data.paper.category, createdAt: A.server }, data.key));
    await batch.commit();
    return ref.id;
  }

  async function setQuestionStatus(id, status) {
    await db().collection(C.questions).doc(id).set({ status, updatedAt: A.server }, { merge: true });
  }

  async function deleteQuestion(id) {
    const batch = db().batch();
    batch.delete(db().collection(C.questions).doc(id));
    batch.delete(db().collection(C.answerKeyByQuestion).doc(id));
    await batch.commit();
    await R.audit('question_delete', { id });
  }

  async function importQuestions(rows) {
    const written = [];
    /* Batched, so a 300-row import is a handful of requests rather than
       hundreds of round trips. */
    for (let i = 0; i < rows.length; i += 400) {
      const slice = rows.slice(i, i + 400);
      const batch = db().batch();
      for (const item of slice) {
        const data = normaliseQuestion(item);
        const ref = db().collection(C.questions).doc();
        batch.set(ref, Object.assign({ createdAt: A.server }, data.paper));
        batch.set(db().collection(C.answerKeyByQuestion).doc(ref.id),
          Object.assign({ questionId: ref.id, category: data.paper.category, createdAt: A.server }, data.key));
        written.push(ref.id);
      }
      await batch.commit();
    }
    await R.audit('question_import', { count: written.length });
    return written;
  }

  function questionStats(rows) {
    const stats = { total: rows.length, active: 0, inactive: 0, byCategory: {}, byType: {}, byDifficulty: {} };
    R.CATEGORY_IDS.forEach((c) => { stats.byCategory[c] = { total: 0, active: 0 }; });
    Q_TYPES.forEach((t) => { stats.byType[t] = 0; });
    DIFFICULTIES.forEach((d) => { stats.byDifficulty[d] = 0; });
    rows.forEach((r) => {
      if (r.status === 'active') stats.active += 1; else stats.inactive += 1;
      if (stats.byCategory[r.category]) {
        stats.byCategory[r.category].total += 1;
        if (r.status === 'active') stats.byCategory[r.category].active += 1;
      }
      if (stats.byType[r.type] !== undefined) stats.byType[r.type] += 1;
      if (stats.byDifficulty[r.difficulty] !== undefined) stats.byDifficulty[r.difficulty] += 1;
    });
    return stats;
  }

  A.round1 = {
    DEFAULT_QUIZ, getQuiz, onQuiz, saveQuiz, windowState,
    beginAttempt, getAttempt, onAttempt, saveAnswer, saveFlag, markVisited, submitAttempt,
    scoreAttempt, scoreAllPending, rankAttempts, rebuildResults,
    getResult, onResult, listResults, setResultReleased,
    PUBLIC_MODES, publicLimit, publishCategory, getPublicResults, onPublicResults,
    listAttempts, adminDeleteAttempt, reopenAttempt,
    Q_TYPES, Q_TYPE_LABELS, DIFFICULTIES, DIFFICULTY_LABELS,
    normaliseQuestion, validateQuestion, listQuestions, getQuestion, saveQuestion,
    setQuestionStatus, deleteQuestion, importQuestions, questionStats, sanitise
  };
})(window);
