import { gradeQuestion } from "./grade";
import { summarizePerQuestion } from "./timing";
import type {
  Attempt,
  AttemptBreakdown,
  AttemptTotals,
  GradedItem,
  QuizMode,
  SessionQuestion,
  UserAnswer,
} from "./types";

export function buildTotals(items: GradedItem[]): AttemptTotals {
  const correct = items.filter((i) => i.isCorrect).length;
  const total = items.length;
  const wrong = total - correct;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, wrong, total, percent };
}

export function buildBreakdown(items: GradedItem[]): AttemptBreakdown {
  const bySourceMap = new Map<string, { correct: number; total: number }>();
  const byType: Record<string, { correct: number; total: number }> = {};
  const byTagMap = new Map<string, { correct: number; total: number }>();

  for (const item of items) {
    const src = bySourceMap.get(item.sourcePath) ?? { correct: 0, total: 0 };
    src.total += 1;
    if (item.isCorrect) src.correct += 1;
    bySourceMap.set(item.sourcePath, src);

    const typeBucket = byType[item.type] ?? { correct: 0, total: 0 };
    typeBucket.total += 1;
    if (item.isCorrect) typeBucket.correct += 1;
    byType[item.type] = typeBucket;

    for (const tag of item.tags) {
      const tagBucket = byTagMap.get(tag) ?? { correct: 0, total: 0 };
      tagBucket.total += 1;
      if (item.isCorrect) tagBucket.correct += 1;
      byTagMap.set(tag, tagBucket);
    }
  }

  const slowest = [...items]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5)
    .map((item) => ({
      questionId: item.questionId,
      prompt: item.prompt,
      durationMs: item.durationMs,
    }));

  return {
    bySource: [...bySourceMap.entries()].map(([path, stats]) => ({ path, ...stats })),
    byType,
    byTag: [...byTagMap.entries()].map(([tag, stats]) => ({ tag, ...stats })),
    slowest,
  };
}

export function buildAttempt(input: {
  mode: QuizMode;
  sources: string[];
  sourceTitles: string[];
  questions: SessionQuestion[];
  answers: Record<string, UserAnswer>;
  questionDurationMs: Record<string, number>;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}): Attempt {
  const items = input.questions.map((q) =>
    gradeQuestion(q, input.answers[q.key], input.questionDurationMs[q.key] ?? 0),
  );
  const totals = buildTotals(items);
  const breakdown = buildBreakdown(items);
  const durations = items.map((i) => i.durationMs);
  const activeMs = durations.reduce((a, b) => a + b, 0);
  const perQuestionMs = summarizePerQuestion(durations);

  return {
    id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    timing: {
      totalMs: input.durationMs,
      activeMs,
      perQuestionMs,
    },
    mode: input.mode,
    sources: input.sources,
    sourceTitles: input.sourceTitles,
    totals,
    breakdown,
    items,
  };
}
