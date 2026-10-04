import { useEffect, useState } from "react";
import { MarkdownBlock } from "../components/MarkdownBlock";
import { isAnswered } from "../domain/grade";
import { formatDuration } from "../domain/timing";
import type { QuizRuntime, UserAnswer } from "../domain/types";
import styles from "./pages.module.css";

type Props = {
  runtime: QuizRuntime;
  onAnswer: (key: string, answer: UserAnswer) => void;
  onGoto: (index: number) => void;
  onFinish: (answerOverrides?: Record<string, UserAnswer>) => void;
  onAbort: () => void;
};

export function QuizPage({ runtime, onAnswer, onGoto, onFinish, onAbort }: Props) {
  const q = runtime.questions[runtime.index];
  const [tick, setTick] = useState(0);
  const [fibDraft, setFibDraft] = useState(
    typeof runtime.answers[q.key] === "string" ? (runtime.answers[q.key] as string) : "",
  );

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setFibDraft(
      typeof runtime.answers[q.key] === "string" ? (runtime.answers[q.key] as string) : "",
    );
  }, [q.key, runtime.answers]);

  const elapsed = Math.round(performance.now() - runtime.perfOrigin);
  void tick;
  const progress = ((runtime.index + 1) / runtime.questions.length) * 100;
  const answer = runtime.answers[q.key];

  function goNext() {
    const answers = { ...runtime.answers };
    if (q.question.type === "fib") {
      answers[q.key] = fibDraft;
      onAnswer(q.key, fibDraft);
    }
    if (runtime.index >= runtime.questions.length - 1) {
      const stillOpen = runtime.questions.filter(
        (item) => !isAnswered(item.question, answers[item.key]),
      ).length;
      if (stillOpen > 0) {
        const ok = window.confirm("Finish with unanswered questions remaining?");
        if (!ok) return;
      }
      onFinish(answers);
      return;
    }
    onGoto(runtime.index + 1);
  }

  function toggleMulti(optionId: string) {
    const current = Array.isArray(answer) ? [...answer] : [];
    const idx = current.indexOf(optionId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(optionId);
    onAnswer(q.key, current);
  }

  return (
    <div className="panel">
      <div className={styles.quizHead}>
        <div>
          <p className="eyebrow">
            Question {runtime.index + 1} / {runtime.questions.length}
          </p>
          <div className={styles.muted}>{q.sourcePath}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className={styles.muted}>Elapsed</div>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem" }}>
            {formatDuration(elapsed)}
          </strong>
        </div>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.prompt}>
        <MarkdownBlock content={q.question.prompt} />
      </div>

      {(q.question.type === "mcq" || q.question.type === "mcq_multi") && (
        <>
          {q.question.type === "mcq_multi" && (
            <p className={styles.hint}>Select all that apply.</p>
          )}
          <div className={styles.options}>
            {(q.displayOptions ?? q.question.options).map((opt) => {
              const selected =
                q.question.type === "mcq"
                  ? answer === opt.id
                  : Array.isArray(answer) && answer.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.option} ${selected ? styles.selected : ""}`}
                  onClick={() =>
                    q.question.type === "mcq"
                      ? onAnswer(q.key, opt.id)
                      : toggleMulti(opt.id)
                  }
                >
                  <input
                    type={q.question.type === "mcq" ? "radio" : "checkbox"}
                    checked={selected}
                    readOnly
                  />
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {q.question.type === "fib" && (
        <input
          className={styles.fibInput}
          value={fibDraft}
          placeholder="Type your answer"
          onChange={(e) => setFibDraft(e.target.value)}
          onBlur={() => onAnswer(q.key, fibDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAnswer(q.key, fibDraft);
              goNext();
            }
          }}
        />
      )}

      <div className={styles.toolbar}>
        <button type="button" className="btn" onClick={onAbort}>
          Exit
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn"
            disabled={runtime.index === 0}
            onClick={() => {
              if (q.question.type === "fib") onAnswer(q.key, fibDraft);
              onGoto(runtime.index - 1);
            }}
          >
            Back
          </button>
          <button type="button" className="btn btn-primary" onClick={goNext}>
            {runtime.index >= runtime.questions.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
