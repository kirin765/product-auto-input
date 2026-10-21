import { FREE_DAILY_FILLS, fillLimitForPlan, type PlanId } from "../../shared/schema";
import { STORAGE_KEYS } from "./config";

export type DailyFillUsage = {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  count: number;
};

export function localDateKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function normalizeDailyUsage(raw: unknown, now = new Date()): DailyFillUsage {
  const today = localDateKey(now);
  if (!raw || typeof raw !== "object") return { date: today, count: 0 };
  const record = raw as { date?: unknown; count?: unknown };
  const count = Number(record.count);
  if (String(record.date ?? "") !== today || !Number.isFinite(count) || count < 0) {
    return { date: today, count: 0 };
  }
  return { date: today, count: Math.floor(count) };
}

export function recordDailyFill(raw: unknown, now = new Date()): DailyFillUsage {
  const usage = normalizeDailyUsage(raw, now);
  return { date: usage.date, count: usage.count + 1 };
}

export function remainingFills(raw: unknown, plan: PlanId, now = new Date()): number | null {
  if (plan === "paid") return null;
  const limit = fillLimitForPlan("free");
  const usage = normalizeDailyUsage(raw, now);
  return Math.max(0, limit - usage.count);
}

export function canFill(raw: unknown, plan: PlanId, now = new Date()): boolean {
  if (plan === "paid") return true;
  return normalizeDailyUsage(raw, now).count < FREE_DAILY_FILLS;
}

export async function loadDailyUsage(now = new Date()): Promise<DailyFillUsage> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.dailyUsage);
  return normalizeDailyUsage(data[STORAGE_KEYS.dailyUsage], now);
}

export async function saveDailyUsage(usage: DailyFillUsage): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.dailyUsage]: usage });
}

export async function recordFill(now = new Date()): Promise<DailyFillUsage> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.dailyUsage);
  const usage = recordDailyFill(data[STORAGE_KEYS.dailyUsage], now);
  await saveDailyUsage(usage);
  return usage;
}
