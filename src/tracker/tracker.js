/* ProtoProbe tracker — injected into every served HTML page. Dependency-free.
 * Captures clicks, navigation and errors, shows the task overlay, and sends
 * events to the local ProtoProbe server only. Typed text is never captured. */
(() => {
  if (window.__protoprobe) return;
  const KEY = "protoprobe:state";
  const ENDPOINT = "/__protoprobe/events";
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } };
  const save = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  let state = load() || { sessionId: uid(), consent: false, taskIndex: 0, taskActive: false, taskStartedAt: 0, done: false };
  let config = null;
  let queue = [];

  const currentTask = () => (config && config.tasks[state.taskIndex]) || null;

  function track(type, data = {}) {
    if (!state.consent || state.done) return;
    const task = currentTask();
    queue.push({ sessionId: state.sessionId, taskId: state.taskActive && task ? task.id : null, type, ts: Date.now(), url: location.pathname + location.hash, data });
    if (queue.length >= 20 || type.startsWith("task_") || type === "seq") flush();
  }

  function flush() {
    if (!queue.length) return;
    const body = JSON.stringify(queue);
    queue = [];
    if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    else fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  }

  function selectorFor(el) {
    if (!(el instanceof Element)) return "";
    if (el.id) return "#" + el.id;
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      let part = el.tagName.toLowerCase();
      if (el.classList.length) part += "." + [...el.classList].slice(0, 2).join(".");
      const parent = el.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === el.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(" > ");
  }

  const isInteractive = (el) =>
    !!(el instanceof Element && el.closest("a,button,input,select,textarea,label,summary,[role=button],[role=link],[onclick],[tabindex]"));

  // ---- Success detection -------------------------------------------------
  function checkSuccess(eventName) {
    const task = currentTask();
    if (!task || !state.taskActive) return;
    const s = task.success || {};
    const hit =
      (s.url && (location.pathname + location.hash).includes(s.url)) ||
      (s.visible && (() => { const el = document.querySelector(s.visible); return el && el.getClientRects().length > 0; })()) ||
      (s.event && eventName === s.event);
    if (hit) endTask("task_success");
  }

  function startTask() {
    state.taskActive = true;
    state.taskStartedAt = Date.now();
    save(state);
    track("task_start");
    const task = currentTask();
    if (task.start && location.pathname !== task.start) location.href = task.start;
    else { render(); checkSuccess(); }
  }

  function endTask(type) {
    if (!state.taskActive) return;
    track(type);
    state.taskActive = false;
    state.awaitingSeq = true;
    save(state);
    render();
  }

  function submitSeq(value) {
    state.awaitingSeq = false;
    state.taskActive = true; // attribute the rating to the task just finished
    track("seq", { value });
    state.taskActive = false;
    state.taskIndex += 1;
    if (state.taskIndex >= config.tasks.length) { state.done = true; flush(); }
    save(state);
    render();
  }

  // ---- Overlay -----------------------------------------------------------
  let root;
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => (k.startsWith("on") ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v)));
    children.forEach((c) => n.append(c));
    return n;
  }

  function render() {
    if (!root) {
      const host = el("div", { "data-protoprobe": "" });
      document.body.append(host);
      root = host.attachShadow({ mode: "open" });
    }
    root.innerHTML = `<style>
      .pp{position:fixed;z-index:2147483647;font:14px/1.45 system-ui,sans-serif;color:#1d1d1f}
      .card{background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:16px;max-width:420px}
      .modal{inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}
      .bar{left:16px;bottom:16px}
      button{font:inherit;border:0;border-radius:8px;padding:8px 12px;cursor:pointer;margin:8px 8px 0 0;background:#e8e8ed}
      .primary{background:#0a66ff;color:#fff}
      .seq button{min-width:36px}
      small{color:#6e6e73}
    </style>`;
    const wrap = (cls, nodes) => root.append(el("div", { class: "pp " + cls }, [el("div", { class: "card" }, nodes)]));

    if (!state.consent) {
      wrap("modal", [
        el("strong", {}, [config.study]),
        el("p", {}, [config.consent || "This session records clicks and navigation on this prototype. No video, audio or typed text. Data stays on this computer."]),
        el("button", { class: "primary", onclick: () => { state.consent = true; save(state); render(); } }, ["I agree, start"]),
        el("button", { onclick: () => { state.done = true; save(state); root.innerHTML = ""; } }, ["No thanks"]),
      ]);
      return;
    }
    if (state.done) {
      wrap("modal", [el("strong", {}, ["All done — thank you!"]), el("p", {}, ["You can close this window."])]);
      return;
    }
    const task = currentTask();
    const label = `Task ${state.taskIndex + 1} of ${config.tasks.length}`;
    if (state.awaitingSeq) {
      const scale = el("div", { class: "seq" }, [1, 2, 3, 4, 5, 6, 7].map((v) => el("button", { onclick: () => submitSeq(v) }, [String(v)])));
      wrap("modal", [el("strong", {}, ["How easy was that task?"]), el("p", {}, [el("small", {}, ["1 = very difficult · 7 = very easy"])]), scale]);
      return;
    }
    if (!state.taskActive) {
      wrap("modal", [el("small", {}, [label]), el("p", {}, [task.prompt]), el("button", { class: "primary", onclick: startTask }, ["Start task"])]);
      return;
    }
    wrap("bar", [
      el("small", {}, [label]),
      el("div", {}, [task.prompt]),
      el("button", { class: "primary", onclick: () => endTask("task_success") }, ["I'm done"]),
      el("button", { onclick: () => endTask("task_give_up") }, ["Give up"]),
    ]);
  }

  // ---- Listeners ---------------------------------------------------------
  document.addEventListener("click", (e) => {
    const path = e.composedPath();
    if (path.some((n) => n instanceof Element && n.hasAttribute && n.hasAttribute("data-protoprobe"))) return;
    track("click", { selector: selectorFor(e.target), interactive: isInteractive(e.target), x: e.clientX, y: e.clientY, vw: innerWidth, vh: innerHeight });
    setTimeout(() => checkSuccess(), 50);
  }, true);

  window.addEventListener("error", (e) => track("error", { message: String(e.message).slice(0, 300) }));
  window.addEventListener("popstate", () => { track("navigate", { kind: "back" }); checkSuccess(); });
  window.addEventListener("hashchange", () => { track("navigate", { kind: "hash" }); checkSuccess(); });
  ["pushState", "replaceState"].forEach((fn) => {
    const orig = history[fn];
    history[fn] = function (...args) { const r = orig.apply(this, args); track("navigate", { kind: fn }); checkSuccess(); return r; };
  });
  window.addEventListener("pagehide", flush);
  setInterval(() => {
    const task = currentTask();
    if (state.taskActive && task && task.timeLimitSec && Date.now() - state.taskStartedAt > task.timeLimitSec * 1000) endTask("task_timeout");
    if (state.taskActive && task && task.success && task.success.visible) checkSuccess();
    flush();
  }, 2000);

  window.__protoprobe = {
    track: (name, data) => track("custom", { name, ...data }),
    success: (name) => checkSuccess(name),
  };
  window.protoprobe = window.__protoprobe;

  fetch("/__protoprobe/config").then((r) => r.json()).then((c) => {
    config = c;
    if (state.consent && !state.done) track("pageview", { title: document.title });
    render();
    checkSuccess();
  });
})();
