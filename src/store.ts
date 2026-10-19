import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DATA_DIR = ".protoprobe";

export interface ProbeEvent {
  sessionId: string;
  taskId: string | null;
  type: string;
  ts: number;
  url: string;
  data: Record<string, unknown>;
}

/** One SQLite file per study, stored next to the prototype. Never leaves the machine. */
export class Store {
  private db: DatabaseSync;

  constructor(dir: string) {
    const dataDir = join(dir, DATA_DIR);
    mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, "study.sqlite"));
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        task_id TEXT,
        type TEXT NOT NULL,
        ts INTEGER NOT NULL,
        url TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, ts);
    `);
  }

  insert(events: ProbeEvent[]): void {
    const stmt = this.db.prepare(
      "INSERT INTO events (session_id, task_id, type, ts, url, data) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const e of events) {
      stmt.run(e.sessionId, e.taskId, e.type, e.ts, e.url, JSON.stringify(e.data ?? {}));
    }
  }

  all(): ProbeEvent[] {
    const rows = this.db
      .prepare("SELECT session_id, task_id, type, ts, url, data FROM events ORDER BY session_id, ts")
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      sessionId: String(r.session_id),
      taskId: r.task_id == null ? null : String(r.task_id),
      type: String(r.type),
      ts: Number(r.ts),
      url: String(r.url),
      data: JSON.parse(String(r.data)),
    }));
  }

  close(): void {
    this.db.close();
  }
}
