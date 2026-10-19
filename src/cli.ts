#!/usr/bin/env node
import { parseArgs } from "node:util";

// node:sqlite is stable enough for our use but still prints an ExperimentalWarning on Node 22.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  if (String(warning).includes("SQLite")) return;
  return (emitWarning as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const HELP = `protoprobe — local-first usability testing for HTML prototypes

Usage:
  protoprobe init   [dir]                 Create protoprobe.yaml in a prototype folder
  protoprobe serve  [dir] [--port 4747]   Serve the prototype and record sessions
  protoprobe report [dir]                 Build report.html from recorded sessions
  protoprobe export [dir] [--format csv|json]  Export raw events

Options:
  -p, --port     Port for serve (default 4747)
  -f, --format   Export format (default json)
  -h, --help     Show this help
  -v, --version  Show version
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string", short: "p", default: "4747" },
      format: { type: "string", short: "f", default: "json" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  const [command, dir = "."] = positionals;

  if (values.version) {
    console.log("0.0.1");
    return;
  }
  if (values.help || !command) {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "init":
      await (await import("./commands/init.js")).init(dir);
      break;
    case "serve":
      await (await import("./commands/serve.js")).serve(dir, { port: Number(values.port) });
      break;
    case "report":
      await (await import("./commands/report.js")).report(dir);
      break;
    case "export":
      await (await import("./commands/export.js")).exportData(dir, values.format === "csv" ? "csv" : "json");
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
