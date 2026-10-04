import type {
  LoadedBank,
  McqOption,
  Question,
  QuizMode,
  SessionQuestion,
} from "./types";

export function shuffleInPlace<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function shuffleCopy<T>(items: T[], random: () => number = Math.random): T[] {
  return shuffleInPlace([...items], random);
}

function needsOptions(question: Question): question is Question & { options: McqOption[] } {
  return question.type === "mcq" || question.type === "mcq_multi";
}

export function buildSessionQuestions(
  banks: LoadedBank[],
  mode: QuizMode,
  random: () => number = Math.random,
): SessionQuestion[] {
  const session: SessionQuestion[] = [];

  for (const loaded of banks) {
    if (!loaded.pathMatches) {
      throw new Error(
        `Bank path mismatch for ${loaded.diskPath}. Run: python3 scripts/refresh_question_paths.py`,
      );
    }

    for (const question of loaded.validQuestions) {
      const entry: SessionQuestion = {
        key: `${loaded.bank.id}:${question.id}`,
        sourcePath: loaded.bank.path,
        bankId: loaded.bank.id,
        tags: loaded.bank.tags ?? [],
        question,
      };
      if (needsOptions(question)) {
        entry.displayOptions = shuffleCopy(question.options, random);
      }
      session.push(entry);
    }
  }

  if (mode === "random") {
    return shuffleCopy(session, random);
  }
  return session;
}

export function resolveBanksByPaths(
  allBanks: LoadedBank[],
  sources: string[],
): { found: LoadedBank[]; missing: string[] } {
  const byPath = new Map(
    allBanks.filter((b) => b.pathMatches).map((b) => [b.bank.path, b]),
  );
  const found: LoadedBank[] = [];
  const missing: string[] = [];
  for (const source of sources) {
    const bank = byPath.get(source);
    if (bank) found.push(bank);
    else missing.push(source);
  }
  return { found, missing };
}
