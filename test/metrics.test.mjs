import { test } from "node:test";
import assert from "node:assert/strict";
import { attempts, summarize, median, countRageClicks } from "../dist/metrics.js";
import { injectTracker, safePath } from "../dist/commands/serve.js";
import { validateConfig } from "../dist/config.js";
import { toCsv } from "../dist/commands/export.js";

const ev = (type, ts, extra = {}) => ({ sessionId: "s1", taskId: "t1", type, ts, url: "/", data: {}, ...extra });

test("median handles odd, even and empty", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test("attempts computes outcome, duration and first click", () => {
  const [a] = attempts([
    ev("task_start", 1000),
    ev("click", 3000, { data: { selector: "a", interactive: true } }),
    ev("click", 4000, { data: { selector: "div", interactive: false } }),
    ev("task_success", 6000),
    ev("seq", 7000, { data: { value: 6 } }),
  ]);
  assert.equal(a.outcome, "success");
  assert.equal(a.durationMs, 5000);
  assert.equal(a.timeToFirstClickMs, 2000);
  assert.equal(a.misclicks, 1);
  assert.equal(a.seq, 6);
});

test("rage clicks: 3 clicks on same element within 1s = 1 burst", () => {
  const c = (ts, selector = "#x") => ev("click", ts, { data: { selector } });
  assert.equal(countRageClicks([c(0), c(200), c(400)]), 1);
  assert.equal(countRageClicks([c(0), c(200), c(2000)]), 0);
  assert.equal(countRageClicks([c(0), c(100, "#y"), c(200)]), 0);
});

test("summarize flags low sample size", () => {
  const [s] = summarize(attempts([ev("task_start", 0), ev("task_give_up", 1000)]));
  assert.equal(s.successRate, 0);
  assert.equal(s.lowSample, true);
});

test("injectTracker adds the script once, before </head>", () => {
  const out = injectTracker("<html><head></head><body></body></html>");
  assert.match(out, /tracker\.js" defer><\/script><\/head>/);
  assert.equal(injectTracker(out), out);
});

test("safePath blocks traversal and the data dir", () => {
  assert.equal(safePath("/srv/p", "/../etc/passwd")?.startsWith("/srv/p"), true);
  assert.equal(safePath("/srv/p", "/.protoprobe/study.sqlite"), null);
});

test("validateConfig rejects duplicate task ids", () => {
  const task = { id: "a", prompt: "x", success: { url: "/" } };
  assert.throws(() => validateConfig({ study: "s", tasks: [task, task] }), /Duplicate/);
});

test("toCsv escapes commas and quotes", () => {
  const csv = toCsv([ev("click", 1, { data: { selector: 'a, "b"' } })]);
  assert.match(csv.split("\n")[1], /^s1,t1,click,1,\/,"/);
});
