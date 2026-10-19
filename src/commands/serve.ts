import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type StudyConfig } from "../config.js";
import { Store, DATA_DIR, type ProbeEvent } from "../store.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const TRACKER_PATH = "/__protoprobe/tracker.js";
const here = dirname(fileURLToPath(import.meta.url));

export function injectTracker(html: string): string {
  const tag = `<script src="${TRACKER_PATH}" defer></script>`;
  if (html.includes(TRACKER_PATH)) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => `${m}${tag}`);
  return tag + html;
}

/** Resolve a request path inside root; returns null if it escapes root. */
export function safePath(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const full = resolve(root, "." + normalize(decoded));
  if (full !== root && !full.startsWith(root + sep)) return null;
  if (full.includes(`${sep}${DATA_DIR}`)) return null;
  return full;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Payload too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function serve(dir: string, opts: { port: number }): Promise<void> {
  const root = resolve(dir);
  const config: StudyConfig = await loadConfig(root);
  const store = new Store(root);
  const tracker = await readFile(join(here, "..", "tracker", "tracker.js"), "utf8");

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = req.url ?? "/";

      if (url === TRACKER_PATH) {
        res.writeHead(200, { "content-type": MIME[".js"], "cache-control": "no-store" });
        res.end(tracker);
        return;
      }
      if (url === "/__protoprobe/config") {
        res.writeHead(200, { "content-type": MIME[".json"] });
        res.end(JSON.stringify(config));
        return;
      }
      if (url === "/__protoprobe/events" && req.method === "POST") {
        const events = JSON.parse(await readBody(req)) as ProbeEvent[];
        store.insert(Array.isArray(events) ? events : []);
        res.writeHead(204);
        res.end();
        return;
      }

      let file = safePath(root, url);
      if (!file) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const info = await stat(file).catch(() => null);
      if (info?.isDirectory()) file = join(file, "index.html");
      const ext = extname(file).toLowerCase();
      const body = await readFile(file).catch(() => null);
      if (!body) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(ext === ".html" || ext === ".htm" ? injectTracker(body.toString("utf8")) : body);
    } catch (err) {
      res.writeHead(500);
      res.end(err instanceof Error ? err.message : "Server error");
    }
  });

  server.listen(opts.port, "127.0.0.1", () => {
    console.log(`ProtoProbe serving "${config.study}" (${config.tasks.length} tasks)`);
    console.log(`  → http://localhost:${opts.port}/`);
    console.log(`  Data: ${join(root, DATA_DIR, "study.sqlite")}`);
    console.log("  Ctrl+C to stop, then run: protoprobe report " + dir);
  });

  const shutdown = () => {
    server.close();
    store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
