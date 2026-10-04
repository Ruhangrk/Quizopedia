import type { Attempt } from "../domain/types";
import {
  downloadAttemptsJson,
  fsLoadAttempts,
  fsSaveAttempts,
  isFsAccessAvailable,
  pickHistoryDirectory,
  verifyHistoryDirectory,
} from "./historyFs";
import { idbGetConnected, idbLoadAttempts, idbSaveAttempts, idbSetConnected } from "./historyIdb";

export type HistoryStatus = {
  connected: boolean;
  fsAvailable: boolean;
  source: "fs" | "idb" | "none";
};

export async function getHistoryStatus(): Promise<HistoryStatus> {
  const fsAvailable = isFsAccessAvailable();
  if (fsAvailable) {
    const dir = await verifyHistoryDirectory();
    if (dir) return { connected: true, fsAvailable, source: "fs" };
  }
  const attempts = await idbLoadAttempts();
  if (attempts.length > 0 || (await idbGetConnected())) {
    return { connected: false, fsAvailable, source: "idb" };
  }
  return { connected: false, fsAvailable, source: "none" };
}

export async function connectHistoryFolder(): Promise<void> {
  await pickHistoryDirectory();
  await idbSetConnected(true);
  // Prefer disk contents when connecting
  const fromDisk = await fsLoadAttempts();
  if (fromDisk) {
    await idbSaveAttempts(fromDisk);
  }
}

export async function loadAttempts(): Promise<Attempt[]> {
  const fromDisk = await fsLoadAttempts();
  if (fromDisk) {
    await idbSaveAttempts(fromDisk);
    return [...fromDisk].sort(
      (a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime(),
    );
  }
  const fromIdb = await idbLoadAttempts();
  return [...fromIdb].sort(
    (a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime(),
  );
}

export async function appendAttempt(attempt: Attempt): Promise<{
  savedToDisk: boolean;
  downloadedFallback: boolean;
}> {
  const existing = await loadAttempts();
  // loadAttempts sorts newest first; store chronological append order as array with newest last on disk
  const chronological = [...existing]
    .sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime());
  chronological.push(attempt);

  await idbSaveAttempts(chronological);

  const savedToDisk = await fsSaveAttempts(chronological);
  if (savedToDisk) {
    await idbSetConnected(true);
    return { savedToDisk: true, downloadedFallback: false };
  }

  // Fallback: download attempts.json if history folder is not connected
  downloadAttemptsJson(chronological);
  return { savedToDisk: false, downloadedFallback: true };
}
