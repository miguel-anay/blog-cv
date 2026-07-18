// Pure scoring math for exam attempts — no DB, no I/O.
// Feedback (isCorrect per option) is only ever computed here, after submit —
// never exposed to the client while an attempt is in progress.

export interface ScoringOption {
  id: number;
  isCorrect: boolean;
}

export interface ScoringQuestion {
  id: number;
  options: ScoringOption[];
}

export interface ScoringAnswer {
  questionId: number;
  selectedOptionId?: number | null;
  /** Accepted but ignored — flagging for review never affects scoring. */
  flaggedForReview?: boolean;
}

export interface PerQuestionResult {
  questionId: number;
  selectedOptionId: number | null;
  correctOptionId: number | null;
  isCorrect: boolean;
}

export interface ScoreResult {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  perQuestion: PerQuestionResult[];
}

export function scoreAttempt(questions: ScoringQuestion[], answers: ScoringAnswer[]): ScoreResult {
  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  const perQuestion: PerQuestionResult[] = questions.map((q) => {
    const correctOption = q.options.find((o) => o.isCorrect) ?? null;
    const answer = answerByQuestion.get(q.id);
    const selectedOptionId = answer?.selectedOptionId ?? null;
    const isCorrect =
      selectedOptionId != null && correctOption != null && selectedOptionId === correctOption.id;

    return {
      questionId: q.id,
      selectedOptionId,
      correctOptionId: correctOption?.id ?? null,
      isCorrect,
    };
  });

  const totalQuestions = questions.length;
  const correctCount = perQuestion.filter((p) => p.isCorrect).length;
  const scorePercent = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);

  return { correctCount, totalQuestions, scorePercent, perQuestion };
}
