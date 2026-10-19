import { cp, chmod, mkdir } from "node:fs/promises";

await mkdir("dist/tracker", { recursive: true });
await cp("src/tracker/tracker.js", "dist/tracker/tracker.js");
await chmod("dist/cli.js", 0o755);
