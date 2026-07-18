import { describe, it, expect } from 'vitest';
import { scoreAttempt } from './scoring';

function q(id: number, correctOptionId: number, optionIds: number[] = [correctOptionId]) {
  return {
    id,
    options: optionIds.map((oid) => ({ id: oid, isCorrect: oid === correctOptionId })),
  };
}

describe('scoreAttempt', () => {
  it('scores 100% when every answer is correct', () => {
    const questions = [q(1, 10, [10, 11]), q(2, 20, [20, 21])];
    const answers = [
      { questionId: 1, selectedOptionId: 10 },
      { questionId: 2, selectedOptionId: 20 },
    ];
    const result = scoreAttempt(questions, answers);
    expect(result.correctCount).toBe(2);
    expect(result.totalQuestions).toBe(2);
    expect(result.scorePercent).toBe(100);
    expect(result.perQuestion.every((p) => p.isCorrect)).toBe(true);
  });

  it('scores 0% when every answer is incorrect', () => {
    const questions = [q(1, 10, [10, 11]), q(2, 20, [20, 21])];
    const answers = [
      { questionId: 1, selectedOptionId: 11 },
      { questionId: 2, selectedOptionId: 21 },
    ];
    const result = scoreAttempt(questions, answers);
    expect(result.correctCount).toBe(0);
    expect(result.scorePercent).toBe(0);
    expect(result.perQuestion.every((p) => !p.isCorrect)).toBe(true);
  });

  it('scores a mixed attempt proportionally', () => {
    const questions = [q(1, 10, [10, 11]), q(2, 20, [20, 21]), q(3, 30, [30, 31]), q(4, 40, [40, 41])];
    const answers = [
      { questionId: 1, selectedOptionId: 10 }, // correct
      { questionId: 2, selectedOptionId: 21 }, // wrong
      { questionId: 3, selectedOptionId: 30 }, // correct
      { questionId: 4, selectedOptionId: 41 }, // wrong
    ];
    const result = scoreAttempt(questions, answers);
    expect(result.correctCount).toBe(2);
    expect(result.totalQuestions).toBe(4);
    expect(result.scorePercent).toBe(50);
  });

  it('counts an unanswered question as incorrect but keeps it distinguishable (selectedOptionId null)', () => {
    const questions = [q(1, 10, [10, 11]), q(2, 20, [20, 21])];
    const answers = [{ questionId: 1, selectedOptionId: 10 }]; // question 2 never answered
    const result = scoreAttempt(questions, answers);
    expect(result.correctCount).toBe(1);
    expect(result.totalQuestions).toBe(2);

    const unanswered = result.perQuestion.find((p) => p.questionId === 2)!;
    expect(unanswered.selectedOptionId).toBeNull();
    expect(unanswered.isCorrect).toBe(false);
  });

  it('does not let flaggedForReview affect the score', () => {
    const questions = [q(1, 10, [10, 11])];
    const flagged = scoreAttempt(questions, [
      { questionId: 1, selectedOptionId: 10, flaggedForReview: true },
    ]);
    const unflagged = scoreAttempt(questions, [
      { questionId: 1, selectedOptionId: 10, flaggedForReview: false },
    ]);
    expect(flagged.scorePercent).toBe(unflagged.scorePercent);
    expect(flagged.correctCount).toBe(unflagged.correctCount);
  });

  it('does not divide by zero for an exam with 0 questions', () => {
    const result = scoreAttempt([], []);
    expect(result.totalQuestions).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.scorePercent).toBe(0);
    expect(Number.isFinite(result.scorePercent)).toBe(true);
  });
});
