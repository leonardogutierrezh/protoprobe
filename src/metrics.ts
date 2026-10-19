import type { ProbeEvent } from "./store.js";

export interface TaskAttempt {
  sessionId: string;
  taskId: string;
  outcome: "success" | "gave_up" | "timeout" | "incomplete";
  durationMs: number | null;
  timeToFirstClickMs: number | null;
  clicks: number;
  misclicks: number;
  rageClicks: number;
  errors: number;
  seq: number | null;
}

export interface TaskSummary {
  taskId: string;
  n: number;
  successRate: number;
  medianTimeSec: number | null;
  medianFirstClickSec: number | null;
  avgMisclicks: number;
  rageClicks: number;
  errors: number;
  avgSeq: number | null;
  lowSample: boolean;
}

/** Group raw events into one attempt per (session, task). */
export function attempts(events: ProbeEvent[]): TaskAttempt[] {
  const byKey = new Map<string, ProbeEvent[]>();
  for (const e of events) {
    if (!e.taskId) continue;
    const key = `${e.sessionId}::${e.taskId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(e);
  }

  const result: TaskAttempt[] = [];
  for (const [key, evs] of byKey) {
    const [sessionId, taskId] = key.split("::");
    evs.sort((a, b) => a.ts - b.ts);
    const start = evs.find((e) => e.type === "task_start");
    const end = evs.find((e) => ["task_success", "task_give_up", "task_timeout"].includes(e.type));
    const clicks = evs.filter((e) => e.type === "click");
    const firstClick = clicks[0];
    const seqEvent = evs.find((e) => e.type === "seq");

    const outcome: TaskAttempt["outcome"] =
      end?.type === "task_success"
        ? "success"
        : end?.type === "task_give_up"
          ? "gave_up"
          : end?.type === "task_timeout"
            ? "timeout"
            : "incomplete";

    result.push({
      sessionId,
      taskId,
      outcome,
      durationMs: start && end ? end.ts - start.ts : null,
      timeToFirstClickMs: start && firstClick ? firstClick.ts - start.ts : null,
      clicks: clicks.length,
      misclicks: clicks.filter((c) => c.data.interactive === false).length,
      rageClicks: countRageClicks(clicks),
      errors: evs.filter((e) => e.type === "error").length,
      seq: seqEvent ? Number(seqEvent.data.value) : null,
    });
  }
  return result;
}

/** ≥3 clicks on the same element within 1 s counts as one rage click burst. */
export function countRageClicks(clicks: ProbeEvent[]): number {
  let bursts = 0;
  let i = 0;
  while (i < clicks.length) {
    let j = i;
    while (
      j + 1 < clicks.length &&
      clicks[j + 1].data.selector === clicks[i].data.selector &&
      clicks[j + 1].ts - clicks[i].ts <= 1000
    ) {
      j++;
    }
    if (j - i + 1 >= 3) {
      bursts++;
      i = j + 1;
    } else {
      i++;
    }
  }
  return bursts;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summarize(all: TaskAttempt[]): TaskSummary[] {
  const byTask = new Map<string, TaskAttempt[]>();
  for (const a of all) {
    if (!byTask.has(a.taskId)) byTask.set(a.taskId, []);
    byTask.get(a.taskId)!.push(a);
  }
  return [...byTask].map(([taskId, list]) => {
    const n = list.length;
    const durations = list.filter((a) => a.durationMs != null).map((a) => a.durationMs! / 1000);
    const firstClicks = list
      .filter((a) => a.timeToFirstClickMs != null)
      .map((a) => a.timeToFirstClickMs! / 1000);
    const seqs = list.filter((a) => a.seq != null).map((a) => a.seq!);
    return {
      taskId,
      n,
      successRate: list.filter((a) => a.outcome === "success").length / n,
      medianTimeSec: median(durations),
      medianFirstClickSec: median(firstClicks),
      avgMisclicks: list.reduce((s, a) => s + a.misclicks, 0) / n,
      rageClicks: list.reduce((s, a) => s + a.rageClicks, 0),
      errors: list.reduce((s, a) => s + a.errors, 0),
      avgSeq: seqs.length ? seqs.reduce((s, v) => s + v, 0) / seqs.length : null,
      lowSample: n < 5,
    };
  });
}
