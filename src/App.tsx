import { useEffect, useMemo, useState } from "react";
import { buildTree, loadAllBanks } from "./content/manifest";
import { buildAttempt } from "./domain/analysis";
import { buildSessionQuestions, resolveBanksByPaths } from "./domain/session";
import { accumulateDuration, elapsedMs } from "./domain/timing";
import type {
  AppScreen,
  Attempt,
  LoadedBank,
  QuizMode,
  QuizRuntime,
  UserAnswer,
} from "./domain/types";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { QuizPage } from "./pages/QuizPage";
import { ResultsPage } from "./pages/ResultsPage";
import {
  appendAttempt,
  connectHistoryFolder,
  exportAttempts,
  getHistoryStatus,
  importAttemptsFile,
  loadAttempts,
  type HistoryStatus,
} from "./storage/historyService";

const banks: LoadedBank[] = loadAllBanks();

export default function App() {
  const tree = useMemo(() => buildTree(banks), []);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<QuizMode>("straight");
  const [runtime, setRuntime] = useState<QuizRuntime | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>({
    connected: false,
    fsAvailable: false,
    source: "none",
  });
  const [saveNote, setSaveNote] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  async function refreshHistory() {
    const [list, status] = await Promise.all([loadAttempts(), getHistoryStatus()]);
    setAttempts(list);
    setHistoryStatus(status);
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  function toggleFile(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleMany(paths: string[], select: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const path of paths) {
        if (select) next.add(path);
        else next.delete(path);
      }
      return next;
    });
  }

  function startWithSources(sources: string[], quizMode: QuizMode) {
    setError(null);
    const { found, missing } = resolveBanksByPaths(banks, sources);
    if (missing.length) {
      setError(
        `Missing banks for path(s):\n${missing.join("\n")}\n\nRun python3 scripts/refresh_question_paths.py if you moved files.`,
      );
      return;
    }
    if (found.some((b) => !b.pathMatches || b.validQuestions.length === 0)) {
      setError("One or more selected banks are invalid (path mismatch or no valid questions).");
      return;
    }

    const questions = buildSessionQuestions(found, quizMode);
    if (questions.length === 0) {
      setError("No valid questions in the selected banks.");
      return;
    }

    const nowPerf = performance.now();
    setRuntime({
      mode: quizMode,
      sources: found.map((b) => b.bank.path),
      sourceTitles: found.map((b) => b.bank.title),
      questions,
      index: 0,
      startedAt: new Date().toISOString(),
      perfOrigin: nowPerf,
      questionStartedPerf: nowPerf,
      answers: {},
      questionDurationMs: {},
    });
    setAttempt(null);
    setSaveNote(undefined);
    setScreen("quiz");
  }

  function handleStart() {
    startWithSources([...selected], mode);
  }

  function leaveCurrentQuestion(nextIndex: number) {
    setRuntime((prev) => {
      if (!prev) return prev;
      const current = prev.questions[prev.index];
      const questionDurationMs = {
        ...prev.questionDurationMs,
        [current.key]: accumulateDuration(
          prev.questionDurationMs[current.key],
          prev.questionStartedPerf,
        ),
      };
      return {
        ...prev,
        index: nextIndex,
        questionDurationMs,
        questionStartedPerf: performance.now(),
      };
    });
  }

  function handleAnswer(key: string, answer: UserAnswer) {
    setRuntime((prev) => (prev ? { ...prev, answers: { ...prev.answers, [key]: answer } } : prev));
  }

  async function handleFinish(answerOverrides?: Record<string, UserAnswer>) {
    if (!runtime) return;
    const finishedPerf = performance.now();
    const current = runtime.questions[runtime.index];
    const questionDurationMs = {
      ...runtime.questionDurationMs,
      [current.key]: accumulateDuration(
        runtime.questionDurationMs[current.key],
        runtime.questionStartedPerf,
        finishedPerf,
      ),
    };
    const durationMs = elapsedMs(runtime.perfOrigin, finishedPerf);
    const finished = buildAttempt({
      mode: runtime.mode,
      sources: runtime.sources,
      sourceTitles: runtime.sourceTitles,
      questions: runtime.questions,
      answers: { ...runtime.answers, ...answerOverrides },
      questionDurationMs,
      startedAt: runtime.startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
    });

    setAttempt(finished);
    setRuntime(null);
    setScreen("results");

    const result = await appendAttempt(finished);
    await refreshHistory();
    if (!result.savedToDisk && result.downloadedFallback) {
      setSaveNote(
        "Could not write history folder — downloaded attempts.json instead. Connect the history/ folder for permanent disk saves.",
      );
    } else if (!result.savedToDisk) {
      setSaveNote("Saved in browser storage only. Connect history/ for permanent disk saves.");
    } else {
      setSaveNote(undefined);
    }
  }

  return (
    <div className="app-shell">
      <header className="brand-row">
        <h1 className="brand">
          Quizopedia<span>.</span>
        </h1>
        <div className="nav-actions">
          {screen !== "home" && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (screen === "quiz") {
                  const ok = window.confirm("Leave quiz without saving?");
                  if (!ok) return;
                  setRuntime(null);
                }
                setScreen("home");
              }}
            >
              Home
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="panel" style={{ marginBottom: "1rem", borderColor: "rgba(196,92,92,0.45)" }}>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "var(--font-body)" }}>
            {error}
          </pre>
          <button type="button" className="btn" style={{ marginTop: "0.75rem" }} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {screen === "home" && (
        <HomePage
          tree={tree}
          selected={selected}
          mode={mode}
          historyStatus={historyStatus}
          onMode={setMode}
          onToggleFile={toggleFile}
          onToggleMany={toggleMany}
          onStart={handleStart}
          onOpenHistory={() => {
            void refreshHistory().then(() => setScreen("history"));
          }}
          onConnectHistory={() => {
            void connectHistoryFolder()
              .then(refreshHistory)
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not connect history folder"),
              );
          }}
        />
      )}

      {screen === "quiz" && runtime && (
        <QuizPage
          runtime={runtime}
          onAnswer={handleAnswer}
          onGoto={leaveCurrentQuestion}
          onFinish={(overrides) => void handleFinish(overrides)}
          onAbort={() => {
            const ok = window.confirm("Leave quiz without saving?");
            if (!ok) return;
            setRuntime(null);
            setScreen("home");
          }}
        />
      )}

      {screen === "results" && attempt && (
        <ResultsPage
          attempt={attempt}
          saveNote={saveNote}
          onHome={() => setScreen("home")}
          onHistory={() => {
            void refreshHistory().then(() => setScreen("history"));
          }}
          onRetest={() => startWithSources(attempt.sources, attempt.mode)}
        />
      )}

      {screen === "history" && (
        <HistoryPage
          attempts={attempts}
          status={historyStatus}
          onBack={() => setScreen("home")}
          onConnect={() => {
            void connectHistoryFolder()
              .then(refreshHistory)
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not connect history folder"),
              );
          }}
          onRetest={(row) => {
            setSelected(new Set(row.sources));
            setMode(row.mode);
            startWithSources(row.sources, row.mode);
          }}
          onExport={() => exportAttempts(attempts)}
          onImport={(file) => {
            void importAttemptsFile(file)
              .then((n) => {
                void refreshHistory();
                setSaveNote(`Imported ${n} attempt(s).`);
              })
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Import failed"),
              );
          }}
        />
      )}
    </div>
  );
}
