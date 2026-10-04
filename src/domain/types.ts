export type QuizMode = "straight" | "random";
export type AppScreen = "home" | "quiz" | "results" | "history";
export type QuestionType = "mcq" | "mcq_multi" | "fib";

export interface McqOption {
  id: string;
  text: string;
}

export interface McqQuestion {
  id: string;
  type: "mcq";
  prompt: string;
  options: McqOption[];
  correctOptionIds: string[];
  explanation?: string;
}

export interface McqMultiQuestion {
  id: string;
  type: "mcq_multi";
  prompt: string;
  options: McqOption[];
  correctOptionIds: string[];
  explanation?: string;
}

export interface FibQuestion {
  id: string;
  type: "fib";
  prompt: string;
  answers: string[];
  caseSensitive?: boolean;
  explanation?: string;
}

export type Question = McqQuestion | McqMultiQuestion | FibQuestion;

export interface QuestionBank {
  id: string;
  title: string;
  path: string;
  tags?: string[];
  questions: Question[];
}

export interface LoadedBank {
  bank: QuestionBank;
  diskPath: string;
  pathMatches: boolean;
  warnings: string[];
  validQuestions: Question[];
}

export type TreeNode =
  | { kind: "dir"; name: string; path: string; children: TreeNode[] }
  | {
      kind: "file";
      name: string;
      path: string;
      title: string;
      questionCount: number;
      pathMatches: boolean;
      warnings: string[];
    };

export interface SessionQuestion {
  key: string;
  sourcePath: string;
  bankId: string;
  tags: string[];
  question: Question;
  displayOptions?: McqOption[];
}

export type UserAnswer = string | string[];

export interface GradedItem {
  questionId: string;
  sourcePath: string;
  type: QuestionType;
  prompt: string;
  userAnswer: UserAnswer;
  correctOptionIds?: string[];
  expectedDisplay: string[];
  userDisplay: string[];
  isCorrect: boolean;
  durationMs: number;
  explanation?: string;
  tags: string[];
}

export interface AttemptTotals {
  correct: number;
  wrong: number;
  total: number;
  percent: number;
}

export interface AttemptBreakdown {
  bySource: { path: string; correct: number; total: number }[];
  byType: Record<string, { correct: number; total: number }>;
  byTag: { tag: string; correct: number; total: number }[];
  slowest: { questionId: string; prompt: string; durationMs: number }[];
}

export interface Attempt {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  timing: {
    totalMs: number;
    activeMs: number;
    perQuestionMs: { min: number; max: number; avg: number };
  };
  mode: QuizMode;
  sources: string[];
  sourceTitles: string[];
  totals: AttemptTotals;
  breakdown: AttemptBreakdown;
  items: GradedItem[];
}

export interface QuizRuntime {
  mode: QuizMode;
  sources: string[];
  sourceTitles: string[];
  questions: SessionQuestion[];
  index: number;
  startedAt: string;
  perfOrigin: number;
  questionStartedPerf: number;
  answers: Record<string, UserAnswer>;
  questionDurationMs: Record<string, number>;
}
