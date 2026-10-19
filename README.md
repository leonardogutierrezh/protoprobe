# ProtoProbe

**Local-first usability testing for HTML prototypes.** Point it at a folder of HTML files, define tasks in one YAML file, run sessions, get task metrics and a shareable report. No SaaS, no account, no participant data leaving your machine.

> Status: early development (v0.0.x). The MVP scope is in [docs/PRD.md](docs/PRD.md).

## Why

HTML prototypes are now the cheapest thing to produce. Testing them still means a stopwatch and notes, or a SaaS tool built for Figma that ships your participants' data to someone else's cloud. ProtoProbe gives you the numbers — success rate, time on task, misclicks — without either.

## Quick start

Requires Node.js 22.13 or later.

```bash
npx protoprobe init ./my-prototype     # writes protoprobe.yaml
# edit the tasks
npx protoprobe serve ./my-prototype    # http://localhost:4747
# run sessions, then Ctrl+C
npx protoprobe report ./my-prototype   # .protoprobe/report.html
```

No changes to your prototype code: ProtoProbe injects its tracker when it serves the HTML.

## Define tasks

```yaml
study: Pricing discoverability
consent: We'll record clicks and navigation. No video, audio or typed text.
tasks:
  - id: find-pro-price
    prompt: Find out how much the Pro plan costs per month.
    start: /index.html
    success:
      visible: "#pro-price"   # or  url: /pricing.html  |  event: pricing-seen
    timeLimitSec: 90
```

Success can be a URL match, an element becoming visible, or a custom event from your code: `protoprobe.success("pricing-seen")`.

## What it measures

| Metric | Definition |
| --- | --- |
| Task success rate | Attempts that hit the success condition before "Give up" or the time limit |
| Time on task | Median seconds from task start to success or abandon |
| Time to first click | Hesitation proxy |
| Misclicks | Clicks on non-interactive elements |
| Rage clicks | 3+ clicks on the same element within 1 s |
| JS errors | Uncaught errors during the task |
| SEQ | Single Ease Question, 1–7, after each task |

The report flags any task with fewer than 5 attempts.

## Privacy

- All data lives in `.protoprobe/study.sqlite` next to your prototype.
- Typed text is never captured.
- Participants see a consent screen before anything is recorded.
- The server binds to `127.0.0.1` only. No telemetry.

## Commands

| Command | What it does |
| --- | --- |
| `protoprobe init [dir]` | Create a starter `protoprobe.yaml` |
| `protoprobe serve [dir] [-p 4747]` | Serve the prototype and record sessions |
| `protoprobe report [dir]` | Build a static HTML report |
| `protoprobe export [dir] [-f csv\|json]` | Export raw events |

## Try the example

```bash
git clone https://github.com/leonardogutierrezh/protoprobe.git
cd protoprobe && npm install
npm run example        # serves examples/basic on http://localhost:4747
```

## Roadmap

v0.1 (MVP): CLI, injection, task overlay, metrics, HTML report, CSV/JSON export.
v0.2: session replay (opt-in), SUS questionnaire, A/B variant comparison, record mode for success paths, remote sessions.
Full scope and trade-offs: [docs/PRD.md](docs/PRD.md).

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Look for `good first issue`.

## License

[MIT](LICENSE)
