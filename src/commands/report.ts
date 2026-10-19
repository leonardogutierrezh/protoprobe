import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadConfig } from "../config.js";
import { Store, DATA_DIR } from "../store.js";
import { attempts, summarize, type TaskSummary } from "../metrics.js";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));

export function renderReport(study: string, prompts: Map<string, string>, rows: TaskSummary[], sessions: number): string {
  const body = rows
    .map(
      (r) => `<tr>
  <td><strong>${esc(r.taskId)}</strong><br><small>${esc(prompts.get(r.taskId) ?? "")}</small></td>
  <td>${r.n}${r.lowSample ? ' <span class="warn" title="Fewer than 5 attempts">low n</span>' : ""}</td>
  <td>${Math.round(r.successRate * 100)}%</td>
  <td>${fmt(r.medianTimeSec)}</td>
  <td>${fmt(r.medianFirstClickSec)}</td>
  <td>${fmt(r.avgMisclicks)}</td>
  <td>${r.rageClicks}</td>
  <td>${r.errors}</td>
  <td>${fmt(r.avgSeq)}</td>
</tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(study)} · ProtoProbe report</title>
<style>
  body{font:15px/1.5 system-ui,sans-serif;margin:32px auto;max-width:1040px;padding:0 16px;color:#1d1d1f;background:#fff}
  table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e5e5ea;vertical-align:top}
  th{font-size:12px;text-transform:uppercase;color:#6e6e73}small{color:#6e6e73}
  .warn{background:#fff4d6;color:#7a5900;padding:1px 6px;border-radius:6px;font-size:12px}
  @media (prefers-color-scheme:dark){body{background:#111;color:#eee}th,td{border-color:#333}small,th{color:#999}}
</style></head><body>
<h1>${esc(study)}</h1>
<p>${sessions} session(s) · generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · data never left this machine</p>
<table>
<thead><tr><th>Task</th><th>n</th><th>Success</th><th>Median time (s)</th><th>First click (s)</th><th>Misclicks / attempt</th><th>Rage clicks</th><th>JS errors</th><th>SEQ (1–7)</th></tr></thead>
<tbody>
${body || '<tr><td colspan="9">No task attempts recorded yet.</td></tr>'}
</tbody></table>
</body></html>
`;
}

export async function report(dir: string): Promise<void> {
  const root = resolve(dir);
  const config = await loadConfig(root);
  const store = new Store(root);
  const events = store.all();
  store.close();

  const sessions = new Set(events.map((e) => e.sessionId)).size;
  const rows = summarize(attempts(events));
  const prompts = new Map(config.tasks.map((t) => [t.id, t.prompt]));
  const out = join(root, DATA_DIR, "report.html");
  await writeFile(out, renderReport(config.study, prompts, rows, sessions), "utf8");
  console.log(`Report written: ${out}`);
}
