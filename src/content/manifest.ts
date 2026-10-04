import type { LoadedBank, TreeNode } from "../domain/types";
import { validateBank } from "./validate";

const modules = import.meta.glob("../../questions/**/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function toDiskPath(globKey: string): string {
  const marker = "/questions/";
  const idx = globKey.lastIndexOf(marker);
  if (idx === -1) {
    // fallback: strip leading ../
    const cleaned = globKey.replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "");
    return cleaned.startsWith("questions/") ? cleaned : `questions/${cleaned}`;
  }
  return `questions/${globKey.slice(idx + marker.length)}`;
}

export function loadAllBanks(): LoadedBank[] {
  const banks: LoadedBank[] = [];
  const pathCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();

  for (const [key, raw] of Object.entries(modules)) {
    const diskPath = toDiskPath(key);
    const result = validateBank(raw, diskPath);
    if (!result.bank) {
      banks.push({
        bank: {
          id: diskPath,
          title: diskPath,
          path: diskPath,
          questions: [],
        },
        diskPath,
        pathMatches: false,
        warnings: result.warnings,
        validQuestions: [],
      });
      continue;
    }

    pathCounts.set(result.bank.path, (pathCounts.get(result.bank.path) ?? 0) + 1);
    idCounts.set(result.bank.id, (idCounts.get(result.bank.id) ?? 0) + 1);

    banks.push({
      bank: result.bank,
      diskPath,
      pathMatches: result.pathMatches,
      warnings: result.warnings,
      validQuestions: result.validQuestions,
    });
  }

  for (const bank of banks) {
    if ((pathCounts.get(bank.bank.path) ?? 0) > 1) {
      bank.warnings.push(`duplicate bank.path: ${bank.bank.path}`);
      bank.pathMatches = false;
    }
    if ((idCounts.get(bank.bank.id) ?? 0) > 1) {
      bank.warnings.push(`duplicate bank.id: ${bank.bank.id}`);
    }
  }

  return banks.sort((a, b) => a.diskPath.localeCompare(b.diskPath));
}

export function buildTree(banks: LoadedBank[]): TreeNode[] {
  type DirAcc = {
    kind: "dir";
    name: string;
    path: string;
    dirs: Map<string, DirAcc>;
    files: Extract<TreeNode, { kind: "file" }>[];
  };

  const root: DirAcc = {
    kind: "dir",
    name: "questions",
    path: "questions",
    dirs: new Map(),
    files: [],
  };

  for (const loaded of banks) {
    const parts = loaded.diskPath.split("/");
    let cursor = root;
    for (let i = 1; i < parts.length - 1; i += 1) {
      const name = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      let next = cursor.dirs.get(name);
      if (!next) {
        next = { kind: "dir", name, path, dirs: new Map(), files: [] };
        cursor.dirs.set(name, next);
      }
      cursor = next;
    }

    const fileName = parts[parts.length - 1];
    cursor.files.push({
      kind: "file",
      name: fileName,
      path: loaded.bank.path,
      title: loaded.bank.title,
      questionCount: loaded.validQuestions.length,
      pathMatches: loaded.pathMatches && loaded.validQuestions.length > 0,
      warnings: loaded.warnings,
    });
  }

  function finalize(node: DirAcc): Extract<TreeNode, { kind: "dir" }> {
    const children: TreeNode[] = [
      ...[...node.dirs.values()].map(finalize),
      ...node.files,
    ].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return { kind: "dir", name: node.name, path: node.path, children };
  }

  return finalize(root).children;
}

export function collectFilePaths(node: TreeNode): string[] {
  if (node.kind === "file") return node.pathMatches ? [node.path] : [];
  return node.children.flatMap(collectFilePaths);
}
