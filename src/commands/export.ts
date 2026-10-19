import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Store, DATA_DIR, type ProbeEvent } from "../store.js";

export function toCsv(events: ProbeEvent[]): string {
  const cell = (v: unknown) => {
    const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "session_id,task_id,type,ts,url,data";
  const lines = events.map((e) => [e.sessionId, e.taskId ?? "", e.type, e.ts, e.url, e.data].map(cell).join(","));
  return [header, ...lines].join("\n") + "\n";
}

export async function exportData(dir: string, format: "csv" | "json"): Promise<void> {
  const root = resolve(dir);
  const store = new Store(root);
  const events = store.all();
  store.close();
  const out = join(root, DATA_DIR, `events.${format}`);
  await writeFile(out, format === "csv" ? toCsv(events) : JSON.stringify(events, null, 2), "utf8");
  console.log(`Exported ${events.length} events → ${out}`);
}
