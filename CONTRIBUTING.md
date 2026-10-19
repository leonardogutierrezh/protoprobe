# Contributing

Thanks for helping. Keep changes small and focused.

## Setup

```bash
npm install
npm test          # builds and runs the test suite
npm run example   # serves examples/basic on http://localhost:4747
```

Node.js 22.13+ required.

## Ground rules

- **Local-first is non-negotiable.** No feature may send participant data off the host machine by default.
- **No prototype changes.** Anything that requires users to edit their HTML is a last resort.
- **Tracker stays dependency-free** (`src/tracker/tracker.js`).
- Check the non-goals in [docs/PRD.md](docs/PRD.md) before proposing a large feature.

## Pull requests

1. Open an issue first for anything bigger than a bug fix.
2. Add or update tests in `test/`.
3. `npm test` must pass.
4. One logical change per PR; describe the user-facing impact.

## Layout

```
src/cli.ts            CLI entry
src/commands/         init, serve, report, export
src/tracker/          browser script injected into served pages
src/metrics.ts        raw events → task metrics
src/store.ts          SQLite storage (node:sqlite)
examples/basic/       sample prototype + study config
docs/                 PRD and design notes
```
