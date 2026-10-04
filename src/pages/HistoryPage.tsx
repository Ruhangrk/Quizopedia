import { useState } from "react";
import { formatDuration, formatMsPrecise } from "../domain/timing";
import type { Attempt } from "../domain/types";
import type { HistoryStatus } from "../storage/historyService";
import styles from "./pages.module.css";

type Props = {
  attempts: Attempt[];
  status: HistoryStatus;
  onBack: () => void;
  onConnect: () => void;
  onRetest: (attempt: Attempt) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export function HistoryPage({
  attempts,
  status,
  onBack,
  onConnect,
  onRetest,
  onExport,
  onImport,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(attempts[0]?.id ?? null);

  return (
    <div className="panel">
      <p className="eyebrow">Attempt history</p>
      <p className="lead">
        Older attempts stay. Retest uses the stored <code>path</code> list from that attempt.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <span className={`status-pill ${status.connected ? "ok" : "warn"}`}>
          {status.connected ? "Disk folder connected" : "Using browser cache / export"}
        </span>
        <button type="button" className="btn" onClick={onConnect}>
          {status.connected ? "Reconnect folder" : "Connect history folder"}
        </button>
        <button type="button" className="btn" onClick={onExport} disabled={attempts.length === 0}>
          Export JSON
        </button>
        <label className="btn" style={{ cursor: "pointer" }}>
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {attempts.length === 0 && <p className="muted">No attempts yet.</p>}

      <div className={styles.historyList}>
        {attempts.map((attempt) => {
          const open = openId === attempt.id;
          return (
            <div key={attempt.id} className={styles.historyRow}>
              <button
                type="button"
                className={styles.historyTop}
                style={{ width: "100%", background: "transparent", border: 0, padding: 0 }}
                onClick={() => setOpenId(open ? null : attempt.id)}
              >
                <div>
                  <strong>
                    {attempt.totals.correct}/{attempt.totals.total} ({attempt.totals.percent}%)
                  </strong>
                  <div className={styles.muted}>
                    {new Date(attempt.finishedAt).toLocaleString()} · {attempt.mode}
                  </div>
                  <div className={styles.muted}>{attempt.sourceTitles.join(" · ")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>{formatDuration(attempt.durationMs)}</div>
                  <div className={styles.muted}>{open ? "Hide" : "Details"}</div>
                </div>
              </button>

              {open && (
                <div className={styles.detail}>
                  <div className={styles.muted} style={{ marginBottom: "0.5rem" }}>
                    Sources
                  </div>
                  {attempt.sources.map((s) => (
                    <div key={s} className={styles.analysisRow}>
                      <span>{s}</span>
                    </div>
                  ))}
                  <div className={styles.muted} style={{ margin: "0.75rem 0 0.35rem" }}>
                    Per-question times
                  </div>
                  {attempt.items.map((item) => (
                    <div key={item.questionId} className={styles.analysisRow}>
                      <span>
                        {item.isCorrect ? "✓" : "✗"} {item.questionId}
                      </span>
                      <strong>{formatMsPrecise(item.durationMs)}</strong>
                    </div>
                  ))}
                  <div className={styles.toolbar}>
                    <button type="button" className="btn btn-primary" onClick={() => onRetest(attempt)}>
                      Retest this set
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.toolbar}>
        <button type="button" className="btn" onClick={onBack}>
          Back home
        </button>
      </div>
    </div>
  );
}
