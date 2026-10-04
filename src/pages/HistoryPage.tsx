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
};

export function HistoryPage({
  attempts,
  status,
  onBack,
  onConnect,
  onRetest,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="panel">
      <p className="eyebrow">Attempt history</p>
      <p className="lead">
        Older attempts stay. Retest uses the stored <code>path</code> list from that attempt.
      </p>

      <div className={styles.historyToolbar}>
        <span className={`status-pill ${status.connected ? "ok" : "warn"}`}>
          {status.connected ? "Disk folder connected" : "Browser cache only — connect history folder"}
        </span>
        <button type="button" className="btn" onClick={onConnect}>
          {status.connected ? "Reconnect folder" : "Connect history folder"}
        </button>
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
                onClick={() => setOpenId(open ? null : attempt.id)}
              >
                <strong className={styles.scoreLine}>
                  {attempt.totals.correct}/{attempt.totals.total} ({attempt.totals.percent}%)
                </strong>
                <span className={styles.historyMeta}>
                  {new Date(attempt.finishedAt).toLocaleString()} · {attempt.mode}
                </span>
                <span className={`${styles.historyMeta} ${styles.historyTitles}`}>
                  {attempt.sourceTitles.join(" · ")}
                </span>
                <span className={styles.historyDuration}>{formatDuration(attempt.durationMs)}</span>
                <span className={styles.historyToggle}>{open ? "Hide" : "Details"}</span>
              </button>

              {open && (
                <div className={styles.detail}>
                  <div className={styles.detailLabel}>
                    Sources ({attempt.sources.length})
                  </div>
                  <div className={styles.detailScroll} style={{ maxHeight: "var(--scroll-max-sm)" }}>
                    {attempt.sources.map((s) => (
                      <div key={s} className={styles.analysisRow}>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.detailLabel}>
                    Per-question times ({attempt.items.length})
                  </div>
                  <div className={styles.detailScroll}>
                    {attempt.items.map((item) => (
                      <div key={item.questionId} className={styles.analysisRow}>
                        <span>
                          {item.isCorrect ? "✓" : "✗"} {item.questionId}
                        </span>
                        <strong>{formatMsPrecise(item.durationMs)}</strong>
                      </div>
                    ))}
                  </div>
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
