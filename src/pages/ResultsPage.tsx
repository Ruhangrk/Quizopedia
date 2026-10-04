import { useState } from "react";
import { MarkdownBlock } from "../components/MarkdownBlock";
import { formatDuration, formatMsPrecise } from "../domain/timing";
import type { Attempt } from "../domain/types";
import styles from "./pages.module.css";

type Props = {
  attempt: Attempt;
  saveNote?: string;
  onRetest: () => void;
  onHome: () => void;
  onHistory: () => void;
};

type Tab = "correct" | "wrong" | "analysis";

export function ResultsPage({ attempt, saveNote, onRetest, onHome, onHistory }: Props) {
  const [tab, setTab] = useState<Tab>("wrong");
  const correct = attempt.items.filter((i) => i.isCorrect);
  const wrong = attempt.items.filter((i) => !i.isCorrect);

  return (
    <div className="panel">
      <p className="eyebrow">Results</p>
      <h2 className={styles.resultsTitle}>
        {attempt.totals.percent}% · {attempt.totals.correct}/{attempt.totals.total}
      </h2>
      <p className="muted">
        {attempt.mode} · {attempt.sourceTitles.join(", ")}
      </p>
      {saveNote && <p className="status-pill warn" style={{ marginTop: "0.75rem" }}>{saveNote}</p>}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <strong>{formatDuration(attempt.timing.totalMs)}</strong>
          <span>Total time</span>
        </div>
        <div className={styles.stat}>
          <strong>{formatDuration(attempt.timing.activeMs)}</strong>
          <span>Active on questions</span>
        </div>
        <div className={styles.stat}>
          <strong>{formatMsPrecise(attempt.timing.perQuestionMs.avg)}</strong>
          <span>Avg / question</span>
        </div>
        <div className={styles.stat}>
          <strong>{attempt.totals.wrong}</strong>
          <span>Wrong</span>
        </div>
      </div>

      <div className={styles.tabs}>
        {(["wrong", "correct", "analysis"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${tab === id ? styles.active : ""}`}
            onClick={() => setTab(id)}
          >
            {id === "wrong" && `Wrong (${wrong.length})`}
            {id === "correct" && `Correct (${correct.length})`}
            {id === "analysis" && "Analysis"}
          </button>
        ))}
      </div>

      {tab !== "analysis" && (
        <div className={styles.itemList}>
          {(tab === "wrong" ? wrong : correct).map((item) => (
            <div
              key={item.questionId}
              className={`${styles.item} ${item.isCorrect ? styles.ok : styles.bad}`}
            >
              <MarkdownBlock content={item.prompt} />
              <div className={styles.itemMeta}>
                <span>{item.type}</span>
                <span>{formatMsPrecise(item.durationMs)}</span>
                <span>{item.sourcePath}</span>
              </div>
              <div className={styles.itemMeta}>
                <span>
                  Yours: {item.userDisplay.length ? item.userDisplay.join(", ") : "—"}
                </span>
                <span>Expected: {item.expectedDisplay.join(", ")}</span>
              </div>
              {item.explanation && (
                <div style={{ marginTop: "0.75rem" }}>
                  <MarkdownBlock content={item.explanation} />
                </div>
              )}
            </div>
          ))}
          {(tab === "wrong" ? wrong : correct).length === 0 && (
            <p className="muted">Nothing in this list.</p>
          )}
        </div>
      )}

      {tab === "analysis" && (
        <div className={styles.analysisGrid}>
          <section className={styles.analysisSection}>
            <h3>By source</h3>
            {attempt.breakdown.bySource.map((row) => (
              <div key={row.path} className={styles.analysisRow}>
                <span>{row.path}</span>
                <strong>
                  {row.correct}/{row.total}
                </strong>
              </div>
            ))}
          </section>
          <section className={styles.analysisSection}>
            <h3>By type</h3>
            {Object.entries(attempt.breakdown.byType).map(([type, row]) => (
              <div key={type} className={styles.analysisRow}>
                <span>{type}</span>
                <strong>
                  {row.correct}/{row.total}
                </strong>
              </div>
            ))}
          </section>
          <section className={styles.analysisSection}>
            <h3>By tag</h3>
            {attempt.breakdown.byTag.length === 0 && <p className="muted">No tags.</p>}
            {attempt.breakdown.byTag.map((row) => (
              <div key={row.tag} className={styles.analysisRow}>
                <span>{row.tag}</span>
                <strong>
                  {row.correct}/{row.total}
                </strong>
              </div>
            ))}
          </section>
          <section className={styles.analysisSection}>
            <h3>Slowest questions</h3>
            {attempt.breakdown.slowest.map((row) => (
              <div key={row.questionId} className={styles.analysisRow}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.prompt.replace(/\n/g, " ").slice(0, 80)}
                </span>
                <strong>{formatMsPrecise(row.durationMs)}</strong>
              </div>
            ))}
          </section>
        </div>
      )}

      <div className={styles.toolbar}>
        <button type="button" className="btn" onClick={onHome}>
          Home
        </button>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={onHistory}>
            History
          </button>
          <button type="button" className="btn btn-primary" onClick={onRetest}>
            Retest same set
          </button>
        </div>
      </div>
    </div>
  );
}
