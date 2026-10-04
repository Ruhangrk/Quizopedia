import { useState } from "react";
import type { TreeNode } from "../domain/types";
import { collectFilePaths } from "../content/manifest";
import styles from "./TreePicker.module.css";

type Props = {
  nodes: TreeNode[];
  selected: Set<string>;
  onToggleFile: (path: string) => void;
  onToggleMany: (paths: string[], select: boolean) => void;
};

function DirNode({
  node,
  selected,
  onToggleFile,
  onToggleMany,
}: {
  node: Extract<TreeNode, { kind: "dir" }>;
  selected: Set<string>;
  onToggleFile: (path: string) => void;
  onToggleMany: (paths: string[], select: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const filePaths = collectFilePaths(node);
  const selectedCount = filePaths.filter((p) => selected.has(p)).length;
  const allSelected = filePaths.length > 0 && selectedCount === filePaths.length;

  return (
    <div className={styles.dir}>
      <div className={styles.dirRow}>
        <button
          type="button"
          className={styles.dirHeader}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={styles.chevron}>{open ? "▾" : "▸"}</span>
          <span className={styles.title}>{node.name}/</span>
          <span className={styles.count}>
            {selectedCount}/{filePaths.length}
          </span>
        </button>
        {filePaths.length > 0 && (
          <button
            type="button"
            className={styles.allBtn}
            onClick={() => onToggleMany(filePaths, !allSelected)}
          >
            {allSelected ? "Clear" : "All"}
          </button>
        )}
      </div>
      {open && (
        <div className={styles.children}>
          {node.children.map((child) =>
            child.kind === "dir" ? (
              <DirNode
                key={child.path}
                node={child}
                selected={selected}
                onToggleFile={onToggleFile}
                onToggleMany={onToggleMany}
              />
            ) : (
              <FileNode
                key={child.path}
                node={child}
                selected={selected.has(child.path)}
                onToggle={() => onToggleFile(child.path)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function FileNode({
  node,
  selected,
  onToggle,
}: {
  node: Extract<TreeNode, { kind: "file" }>;
  selected: boolean;
  onToggle: () => void;
}) {
  const tip = [node.path, ...node.warnings].filter(Boolean).join("\n");
  return (
    <button
      type="button"
      className={`${styles.fileRow} ${selected ? styles.selected : ""}`}
      onClick={onToggle}
      disabled={!node.pathMatches}
      title={tip}
    >
      <input type="checkbox" checked={selected} readOnly disabled={!node.pathMatches} />
      <span className={styles.main}>
        <span className={styles.title}>{node.title}</span>
        <span className={styles.path}>{node.path}</span>
        {!node.pathMatches && <span className={styles.warn}>path mismatch</span>}
      </span>
      <span className={styles.count}>{node.questionCount} q</span>
    </button>
  );
}

export function TreePicker({ nodes, selected, onToggleFile, onToggleMany }: Props) {
  return (
    <div className={styles.tree}>
      {nodes.map((node) =>
        node.kind === "dir" ? (
          <DirNode
            key={node.path}
            node={node}
            selected={selected}
            onToggleFile={onToggleFile}
            onToggleMany={onToggleMany}
          />
        ) : (
          <FileNode
            key={node.path}
            node={node}
            selected={selected.has(node.path)}
            onToggle={() => onToggleFile(node.path)}
          />
        ),
      )}
    </div>
  );
}
