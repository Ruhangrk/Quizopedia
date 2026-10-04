import { get, set, del } from "idb-keyval";
import type { Attempt } from "../domain/types";

const DIR_HANDLE_KEY = "quizopedia.historyDirHandle";
const ATTEMPTS_FILE = "attempts.json";
const ATTEMPTS_TMP = "attempts.tmp.json";

type DirHandle = FileSystemDirectoryHandle;

function supportsFsAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function isFsAccessAvailable(): boolean {
  return supportsFsAccess();
}

export async function getStoredDirHandle(): Promise<DirHandle | null> {
  if (!supportsFsAccess()) return null;
  const handle = (await get(DIR_HANDLE_KEY)) as DirHandle | undefined;
  return handle ?? null;
}

export async function clearStoredDirHandle(): Promise<void> {
  await del(DIR_HANDLE_KEY);
}

async function ensurePermission(handle: DirHandle, mode: "read" | "readwrite"): Promise<boolean> {
  const opts = { mode } as const;
  // queryPermission / requestPermission exist on handles in Chromium
  const withPerm = handle as DirHandle & {
    queryPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  };
  if (withPerm.queryPermission) {
    const state = await withPerm.queryPermission(opts);
    if (state === "granted") return true;
  }
  if (withPerm.requestPermission) {
    const state = await withPerm.requestPermission(opts);
    return state === "granted";
  }
  return true;
}

export async function pickHistoryDirectory(): Promise<DirHandle> {
  if (!supportsFsAccess()) {
    throw new Error("File System Access API is not available in this browser.");
  }
  const handle = await window.showDirectoryPicker({
    id: "quizopedia-history",
    mode: "readwrite",
    startIn: "documents",
  });
  await set(DIR_HANDLE_KEY, handle);
  return handle;
}

export async function verifyHistoryDirectory(): Promise<DirHandle | null> {
  const handle = await getStoredDirHandle();
  if (!handle) return null;
  const ok = await ensurePermission(handle, "readwrite");
  if (!ok) {
    await clearStoredDirHandle();
    return null;
  }
  return handle;
}

async function readAttemptsFromDir(dir: DirHandle): Promise<Attempt[]> {
  try {
    const fileHandle = await dir.getFileHandle(ATTEMPTS_FILE);
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text.trim()) return [];
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

async function writeAttemptsToDir(dir: DirHandle, attempts: Attempt[]): Promise<void> {
  const payload = `${JSON.stringify(attempts, null, 2)}\n`;

  const tmpHandle = await dir.getFileHandle(ATTEMPTS_TMP, { create: true });
  const tmpWritable = await tmpHandle.createWritable();
  await tmpWritable.write(payload);
  await tmpWritable.close();

  const finalHandle = await dir.getFileHandle(ATTEMPTS_FILE, { create: true });
  const finalWritable = await finalHandle.createWritable();
  await finalWritable.write(payload);
  await finalWritable.close();

  try {
    await dir.removeEntry(ATTEMPTS_TMP);
  } catch {
    // ignore cleanup failure
  }
}

export async function fsLoadAttempts(): Promise<Attempt[] | null> {
  const dir = await verifyHistoryDirectory();
  if (!dir) return null;
  return readAttemptsFromDir(dir);
}

export async function fsSaveAttempts(attempts: Attempt[]): Promise<boolean> {
  const dir = await verifyHistoryDirectory();
  if (!dir) return false;
  await writeAttemptsToDir(dir, attempts);
  return true;
}

export function downloadAttemptsJson(attempts: Attempt[]): void {
  const blob = new Blob([`${JSON.stringify(attempts, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attempts.json";
  a.click();
  URL.revokeObjectURL(url);
}
