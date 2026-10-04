import type { FibQuestion, McqMultiQuestion, McqQuestion, Question, QuestionBank } from "../domain/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function validateOptions(
  rawOptions: unknown,
  correctOptionIds: string[],
  minCorrect: number,
  maxCorrect: number | null,
): { options: { id: string; text: string }[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
    return { options: [], errors: ["options must be an array with at least 2 items"] };
  }

  const options: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const opt of rawOptions) {
    if (!isObject(opt)) {
      errors.push("option must be an object");
      continue;
    }
    const id = asString(opt.id);
    const text = asString(opt.text);
    if (!id || !text) {
      errors.push("option requires non-empty id and text");
      continue;
    }
    if (seen.has(id)) {
      errors.push(`duplicate option id: ${id}`);
      continue;
    }
    seen.add(id);
    options.push({ id, text });
  }

  if (correctOptionIds.length < minCorrect) {
    errors.push(`correctOptionIds needs at least ${minCorrect} id(s)`);
  }
  if (maxCorrect !== null && correctOptionIds.length > maxCorrect) {
    errors.push(`correctOptionIds needs at most ${maxCorrect} id(s)`);
  }
  for (const id of correctOptionIds) {
    if (!seen.has(id)) errors.push(`correctOptionIds unknown id: ${id}`);
  }

  return { options, errors };
}

export function validateQuestion(raw: unknown): { question?: Question; errors: string[] } {
  if (!isObject(raw)) return { errors: ["question must be an object"] };
  const errors: string[] = [];
  const id = asString(raw.id);
  const type = asString(raw.type);
  const prompt = asString(raw.prompt);
  if (!id) errors.push("question.id required");
  if (!type) errors.push("question.type required");
  if (!prompt) errors.push("question.prompt required");
  if (errors.length) return { errors };

  const explanation = typeof raw.explanation === "string" ? raw.explanation : undefined;

  if (type === "mcq" || type === "mcq_multi") {
    const correctOptionIds = Array.isArray(raw.correctOptionIds)
      ? raw.correctOptionIds.filter((x): x is string => typeof x === "string")
      : [];
    const minCorrect = type === "mcq" ? 1 : 2;
    const maxCorrect = type === "mcq" ? 1 : null;
    const { options, errors: optErrors } = validateOptions(
      raw.options,
      correctOptionIds,
      minCorrect,
      maxCorrect,
    );
    errors.push(...optErrors);
    if (errors.length) return { errors };

    if (type === "mcq") {
      const question: McqQuestion = {
        id: id!,
        type: "mcq",
        prompt: prompt!,
        options,
        correctOptionIds,
        explanation,
      };
      return { question, errors: [] };
    }

    const question: McqMultiQuestion = {
      id: id!,
      type: "mcq_multi",
      prompt: prompt!,
      options,
      correctOptionIds,
      explanation,
    };
    return { question, errors: [] };
  }

  if (type === "fib") {
    const answers = Array.isArray(raw.answers)
      ? raw.answers.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    if (answers.length === 0) errors.push("fib.answers must be a non-empty string array");
    if (errors.length) return { errors };
    const question: FibQuestion = {
      id: id!,
      type: "fib",
      prompt: prompt!,
      answers,
      caseSensitive: raw.caseSensitive === true,
      explanation,
    };
    return { question, errors: [] };
  }

  return { errors: [`unknown question type: ${type}`] };
}

export function validateBank(
  raw: unknown,
  diskPath: string,
): { bank?: QuestionBank; validQuestions: Question[]; warnings: string[]; pathMatches: boolean } {
  const warnings: string[] = [];
  if (!isObject(raw)) {
    return {
      validQuestions: [],
      warnings: ["bank root must be an object"],
      pathMatches: false,
    };
  }

  const id = asString(raw.id);
  const title = asString(raw.title);
  const path = asString(raw.path);
  if (!id) warnings.push("bank.id missing");
  if (!title) warnings.push("bank.title missing");
  if (!path) warnings.push("bank.path missing");

  const pathMatches = Boolean(path && path === diskPath);
  if (path && !pathMatches) {
    warnings.push(
      `path mismatch: json has "${path}" but file is at "${diskPath}". Run python3 scripts/refresh_question_paths.py`,
    );
  }

  if (!id || !title || !path) {
    return { validQuestions: [], warnings, pathMatches: false };
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string")
    : undefined;

  const validQuestions: Question[] = [];
  const seenQ = new Set<string>();
  const list = Array.isArray(raw.questions) ? raw.questions : [];
  if (list.length === 0) warnings.push("bank.questions is empty");

  for (const [index, item] of list.entries()) {
    const { question, errors } = validateQuestion(item);
    if (!question) {
      warnings.push(`question[${index}] skipped: ${errors.join("; ")}`);
      continue;
    }
    if (seenQ.has(question.id)) {
      warnings.push(`duplicate question id skipped: ${question.id}`);
      continue;
    }
    seenQ.add(question.id);
    validQuestions.push(question);
  }

  const bank: QuestionBank = {
    id,
    title,
    path,
    tags,
    questions: validQuestions,
  };

  return { bank, validQuestions, warnings, pathMatches };
}
