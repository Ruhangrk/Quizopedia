import { TreePicker } from "../components/TreePicker";
import type { HistoryStatus } from "../storage/historyService";
import type { QuizMode, TreeNode } from "../domain/types";
import styles from "./pages.module.css";

type Props = {
  tree: TreeNode[];
  selected: Set<string>;
  mode: QuizMode;
  historyStatus: HistoryStatus;
  onMode: (mode: QuizMode) => void;
  onToggleFile: (path: string) => void;
  onToggleMany: (paths: string[], select: boolean) => void;
  onClearSelection: () => void;
  onStart: () => void;
  onOpenHistory: () => void;
  onConnectHistory: () => void;
};

export function HomePage({
  tree,
  selected,
  mode,
  historyStatus,
  onMode,
  onToggleFile,
  onToggleMany,
  onClearSelection,
  onStart,
  onOpenHistory,
  onConnectHistory,
}: Props) {
  return (
    <div className={`panel ${styles.grid}`}>
      <div>
        <p className="eyebrow">Practice desk</p>
        <p className="lead">
          Select one or more question banks, choose straight or random order, then start.
          Options shuffle every attempt.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className={`status-pill ${historyStatus.connected ? "ok" : "warn"}`}>
            History: {historyStatus.connected ? "folder connected" : "not connected to disk"}
          </span>
          {!historyStatus.fsAvailable && (
            <span className="status-pill warn">FS Access unavailable — export/import fallback</span>
          )}
        </div>
      </div>

      <div className={styles.treeScroll}>
        <TreePicker
          nodes={tree}
          selected={selected}
          onToggleFile={onToggleFile}
          onToggleMany={onToggleMany}
        />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.modeGroup} role="group" aria-label="Question order">
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "straight" ? styles.active : ""}`}
            onClick={() => onMode("straight")}
          >
            Straight
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "random" ? styles.active : ""}`}
            onClick={() => onMode("random")}
          >
            Random
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={onConnectHistory}>
            {historyStatus.connected ? "Reconnect history" : "Connect history folder"}
          </button>
          <button type="button" className="btn" onClick={onOpenHistory}>
            History
          </button>
          <button
            type="button"
            className="btn"
            disabled={selected.size === 0}
            onClick={onClearSelection}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.size === 0}
            onClick={onStart}
          >
            Start · {selected.size} file{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
