import { eq, and, desc, count, isNotNull } from 'drizzle-orm';
import { getDb } from './db';
import { exams, examQuestions, examOptions, examAttempts, examAnswers } from './schema';
import type {
  ExamSummary,
  ExamDetail,
  AttemptQuestion,
  ExamAttempt,
  ExamAttemptSummary,
  ExamResult,
  AttemptStatus,
} from './api-types';
import { computeRemainingSeconds } from '../features/exams/lib/timer';
import { scoreAttempt } from '../features/exams/lib/scoring';

// ── Exams (read-only listing / detail) ───────────────────────────────────────

export async function getExams(): Promise<ExamSummary[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(exams)
      .where(isNotNull(exams.publishedAt))
      .orderBy(desc(exams.publishedAt));
    if (rows.length === 0) return [];

    const countRows = await db
      .select({ examId: examQuestions.examId, total: count() })
      .from(examQuestions)
      .groupBy(examQuestions.examId);

    const countMap = new Map(countRows.map((c) => [c.examId, c.total]));
    return rows.map((e) => ({ ...e, questionCount: countMap.get(e.id) ?? 0 })) as ExamSummary[];
  } catch (err) {
    console.error('getExams failed:', err);
    return [];
  }
}

/**
 * Minimal exam lookup by id — used by `POST /api/exams/attempts` to resolve the
 * exam's slug for the post-create redirect (createAttempt only returns the
 * attempt, not the exam's slug).
 */
export async function getExamById(examId: number): Promise<{ id: number; slug: string } | null> {
  try {
    const db = getDb();
    const [exam] = await db
      .select({ id: exams.id, slug: exams.slug })
      .from(exams)
      .where(eq(exams.id, examId))
      .limit(1);
    return exam ?? null;
  } catch (err) {
    console.error('getExamById failed:', err);
    return null;
  }
}

export async function getExamBySlug(slug: string): Promise<ExamDetail | null> {
  try {
    const db = getDb();
    const [exam] = await db.select().from(exams).where(eq(exams.slug, slug)).limit(1);
    if (!exam) return null;

    const [{ total }] = await db
      .select({ total: count() })
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id));

    return { ...exam, questionCount: total } as ExamDetail;
  } catch (err) {
    console.error('getExamBySlug failed:', err);
    return null;
  }
}

// ── Attempt history ───────────────────────────────────────────────────────────

export async function getAttemptHistory(examId: number, userId: string): Promise<ExamAttemptSummary[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, examId), eq(examAttempts.userId, userId)))
      .orderBy(desc(examAttempts.createdAt));

    return rows.map((r) => ({
      id: r.id,
      startedAt: r.startedAt,
      submittedAt: r.submittedAt,
      autoSubmitted: r.autoSubmitted,
      score: r.score,
      correctCount: r.correctCount,
      totalQuestions: r.totalQuestions,
    }));
  } catch (err) {
    console.error('getAttemptHistory failed:', err);
    return [];
  }
}

export async function getInProgressAttempt(examId: number, userId: string): Promise<ExamAttempt | null> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, examId), eq(examAttempts.userId, userId)))
      .orderBy(desc(examAttempts.createdAt));

    const inProgress = rows.find((r) => r.submittedAt == null);
    return (inProgress as ExamAttempt) ?? null;
  } catch (err) {
    console.error('getInProgressAttempt failed:', err);
    return null;
  }
}

/** Creates a new attempt, or reuses an in-progress one for the same exam/user. */
export async function createAttempt(examId: number, userId: string): Promise<ExamAttempt | null> {
  try {
    const db = getDb();

    const existing = await getInProgressAttempt(examId, userId);
    if (existing) return existing;

    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) return null;

    const now = new Date();
    const [inserted] = await db
      .insert(examAttempts)
      .values({
        examId,
        userId,
        timeLimitSeconds: exam.timeLimitSeconds,
        startedAt: now,
        pausedAt: null,
        pausedSeconds: 0,
        submittedAt: null,
        autoSubmitted: false,
        score: null,
        correctCount: null,
        totalQuestions: null,
        createdAt: now,
      })
      .returning();

    return (inserted as ExamAttempt) ?? null;
  } catch (err) {
    console.error('createAttempt failed:', err);
    return null;
  }
}

/** Scoped by owner — returns null if the attempt doesn't exist or belongs to someone else. */
export async function getAttemptById(attemptId: number, userId: string): Promise<ExamAttempt | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)))
      .limit(1);
    return (row as ExamAttempt) ?? null;
  } catch (err) {
    console.error('getAttemptById failed:', err);
    return null;
  }
}

/** Questions for an attempt — never includes isCorrect, hydrates previously saved answers. */
export async function getExamQuestionsForAttempt(
  examId: number,
  attemptId: number,
): Promise<AttemptQuestion[]> {
  try {
    const db = getDb();
    const questions = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.order);

    if (questions.length === 0) return [];

    const [optionRows, answers] = await Promise.all([
      Promise.all(
        questions.map((q) =>
          db.select().from(examOptions).where(eq(examOptions.questionId, q.id)).orderBy(examOptions.order),
        ),
      ),
      db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId)),
    ]);

    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    return questions.map((q, i) => {
      const answer = answerByQuestion.get(q.id);
      return {
        id: q.id,
        order: q.order,
        prompt: q.prompt,
        allowMultiple: q.allowMultiple,
        options: optionRows[i].map((o) => ({ id: o.id, order: o.order, text: o.text })),
        selectedOptionId: answer?.selectedOptionId ?? null,
        flaggedForReview: answer?.flaggedForReview ?? false,
      };
    });
  } catch (err) {
    console.error('getExamQuestionsForAttempt failed:', err);
    return [];
  }
}

/**
 * Unscoped owner lookup — lets API routes tell "attempt doesn't exist" (404)
 * apart from "attempt belongs to someone else" (403) without leaking any
 * attempt data. All other attempt functions are owner-scoped in their query
 * and return `null` for both cases, which isn't enough to pick the right
 * HTTP status per REQ-008.
 */
export async function getAttemptOwnerId(attemptId: number): Promise<string | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ userId: examAttempts.userId })
      .from(examAttempts)
      .where(eq(examAttempts.id, attemptId))
      .limit(1);
    return row?.userId ?? null;
  } catch (err) {
    console.error('getAttemptOwnerId failed:', err);
    return null;
  }
}

// ── Attempt lifecycle ──────────────────────────────────────────────────────────

export async function getAttemptStatus(
  attemptId: number,
  userId: string,
  nowMs: number = Date.now(),
): Promise<AttemptStatus | null> {
  try {
    const attempt = await getAttemptById(attemptId, userId);
    if (!attempt) return null;

    if (attempt.submittedAt) {
      return { remainingSeconds: 0, paused: false, submitted: true, expired: false };
    }

    const remainingSeconds = computeRemainingSeconds({
      timeLimitSeconds: attempt.timeLimitSeconds,
      startedAtMs: attempt.startedAt.getTime(),
      pausedAtMs: attempt.pausedAt ? attempt.pausedAt.getTime() : null,
      pausedSeconds: attempt.pausedSeconds,
      nowMs,
    });

    if (remainingSeconds <= 0 && !attempt.pausedAt) {
      await submitAttempt(attemptId, userId, { auto: true });
      return { remainingSeconds: 0, paused: false, submitted: true, expired: true };
    }

    return {
      remainingSeconds,
      paused: attempt.pausedAt != null,
      submitted: false,
      expired: false,
    };
  } catch (err) {
    console.error('getAttemptStatus failed:', err);
    return null;
  }
}

export async function pauseAttempt(attemptId: number, userId: string): Promise<boolean> {
  try {
    const db = getDb();
    const attempt = await getAttemptById(attemptId, userId);
    if (!attempt || attempt.submittedAt || attempt.pausedAt) return false;

    await db
      .update(examAttempts)
      .set({ pausedAt: new Date() })
      .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)));
    return true;
  } catch (err) {
    console.error('pauseAttempt failed:', err);
    return false;
  }
}

export async function resumeAttempt(attemptId: number, userId: string): Promise<boolean> {
  try {
    const db = getDb();
    const attempt = await getAttemptById(attemptId, userId);
    if (!attempt || attempt.submittedAt || !attempt.pausedAt) return false;

    const now = new Date();
    const additionalPausedSeconds = Math.floor((now.getTime() - attempt.pausedAt.getTime()) / 1000);

    await db
      .update(examAttempts)
      .set({
        pausedAt: null,
        pausedSeconds: attempt.pausedSeconds + additionalPausedSeconds,
      })
      .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)));
    return true;
  } catch (err) {
    console.error('resumeAttempt failed:', err);
    return false;
  }
}

export interface SaveAnswerInput {
  questionId: number;
  selectedOptionId?: number | null;
  flaggedForReview?: boolean;
}

export interface SaveAnswerResult {
  ok: boolean;
  expired: boolean;
  paused?: boolean;
}

/** Upserts a single answer. If the time limit has already expired, auto-finalizes instead. */
export async function saveAnswer(
  attemptId: number,
  userId: string,
  input: SaveAnswerInput,
): Promise<SaveAnswerResult> {
  try {
    const db = getDb();
    const attempt = await getAttemptById(attemptId, userId);
    if (!attempt || attempt.submittedAt) return { ok: false, expired: false };

    // A paused attempt must be resumed before it can be written to — otherwise
    // pausing would freeze the clock but not actually stop progress, letting a
    // client keep answering indefinitely via direct API calls.
    if (attempt.pausedAt) return { ok: false, expired: false, paused: true };

    const remaining = computeRemainingSeconds({
      timeLimitSeconds: attempt.timeLimitSeconds,
      startedAtMs: attempt.startedAt.getTime(),
      pausedAtMs: null,
      pausedSeconds: attempt.pausedSeconds,
      nowMs: Date.now(),
    });
    if (remaining <= 0) {
      await submitAttempt(attemptId, userId, { auto: true });
      return { ok: false, expired: true };
    }

    const existing = await db
      .select()
      .from(examAnswers)
      .where(and(eq(examAnswers.attemptId, attemptId), eq(examAnswers.questionId, input.questionId)))
      .limit(1);

    const now = new Date();
    if (existing.length > 0) {
      await db
        .update(examAnswers)
        .set({
          selectedOptionId: input.selectedOptionId ?? null,
          flaggedForReview: input.flaggedForReview ?? existing[0].flaggedForReview,
          answeredAt: now,
        })
        .where(eq(examAnswers.id, existing[0].id));
    } else {
      await db.insert(examAnswers).values({
        attemptId,
        questionId: input.questionId,
        selectedOptionId: input.selectedOptionId ?? null,
        flaggedForReview: input.flaggedForReview ?? false,
        answeredAt: now,
      });
    }

    return { ok: true, expired: false };
  } catch (err) {
    console.error('saveAnswer failed:', err);
    return { ok: false, expired: false };
  }
}

export interface SubmitAttemptOptions {
  auto?: boolean;
}

/** Scores the attempt and persists the result. Idempotent — returns the existing result if already submitted. */
export async function submitAttempt(
  attemptId: number,
  userId: string,
  opts: SubmitAttemptOptions = {},
): Promise<ExamResult | null> {
  try {
    const db = getDb();
    const attempt = await getAttemptById(attemptId, userId);
    if (!attempt) return null;

    if (attempt.submittedAt) {
      return getAttemptResult(attemptId, userId);
    }

    const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId)).limit(1);
    if (!exam) return null;

    const questions = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, attempt.examId))
      .orderBy(examQuestions.order);

    const optionRows = await Promise.all(
      questions.map((q) => db.select().from(examOptions).where(eq(examOptions.questionId, q.id)).orderBy(examOptions.order)),
    );

    const answers = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));

    const scoringQuestions = questions.map((q, i) => ({
      id: q.id,
      options: optionRows[i].map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
    }));
    const scoringAnswers = answers.map((a) => ({
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
      flaggedForReview: a.flaggedForReview,
    }));

    const scored = scoreAttempt(scoringQuestions, scoringAnswers);
    const now = new Date();

    await db
      .update(examAttempts)
      .set({
        submittedAt: now,
        autoSubmitted: opts.auto ?? false,
        score: scored.scorePercent,
        correctCount: scored.correctCount,
        totalQuestions: scored.totalQuestions,
      })
      .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)));

    return getAttemptResult(attemptId, userId);
  } catch (err) {
    console.error('submitAttempt failed:', err);
    return null;
  }
}

/** Read-only — does NOT auto-submit. Returns null if the attempt hasn't been submitted yet. */
export async function getAttemptResult(attemptId: number, userId: string): Promise<ExamResult | null> {
  try {
    const db = getDb();
    const attempt = await getAttemptById(attemptId, userId);
    if (!attempt || !attempt.submittedAt) return null;

    const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId)).limit(1);
    if (!exam) return null;

    const questions = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, attempt.examId))
      .orderBy(examQuestions.order);

    const optionRows = await Promise.all(
      questions.map((q) => db.select().from(examOptions).where(eq(examOptions.questionId, q.id)).orderBy(examOptions.order)),
    );

    const answers = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const resultQuestions = questions.map((q, i) => {
      const options = optionRows[i];
      const answer = answerByQuestion.get(q.id);
      const selectedOptionId = answer?.selectedOptionId ?? null;
      const correctOption = options.find((o) => o.isCorrect) ?? null;
      const isCorrect = selectedOptionId != null && correctOption != null && selectedOptionId === correctOption.id;

      return {
        id: q.id,
        order: q.order,
        prompt: q.prompt,
        explanation: q.explanation,
        options: options.map((o) => ({ id: o.id, order: o.order, text: o.text, isCorrect: o.isCorrect })),
        selectedOptionId,
        isCorrect,
        flaggedForReview: answer?.flaggedForReview ?? false,
      };
    });

    const score = attempt.score ?? 0;

    return {
      attemptId: attempt.id,
      examId: exam.id,
      examSlug: exam.slug,
      examTitle: exam.title,
      score,
      correctCount: attempt.correctCount ?? 0,
      totalQuestions: attempt.totalQuestions ?? 0,
      passScorePercent: exam.passScorePercent,
      passed: score >= exam.passScorePercent,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
      questions: resultQuestions,
    };
  } catch (err) {
    console.error('getAttemptResult failed:', err);
    return null;
  }
}
