import { get, set } from "idb-keyval";
import type { Attempt } from "../domain/types";

const ATTEMPTS_KEY = "quizopedia.attempts";
const HANDLE_META_KEY = "quizopedia.historyConnected";

export async function idbLoadAttempts(): Promise<Attempt[]> {
  const value = await get(ATTEMPTS_KEY);
  return Array.isArray(value) ? (value as Attempt[]) : [];
}

export async function idbSaveAttempts(attempts: Attempt[]): Promise<void> {
  await set(ATTEMPTS_KEY, attempts);
}

export async function idbSetConnected(connected: boolean): Promise<void> {
  await set(HANDLE_META_KEY, connected);
}

export async function idbGetConnected(): Promise<boolean> {
  return Boolean(await get(HANDLE_META_KEY));
}
