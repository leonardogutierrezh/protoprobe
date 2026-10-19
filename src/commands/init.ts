import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_FILE } from "../config.js";

const TEMPLATE = `# ProtoProbe study config — https://github.com/leonardogutierrezh/protoprobe
study: My first study
consent: >
  We'll record your clicks and navigation on this prototype to improve it.
  No video, audio or typed text is stored. Data stays on this computer.
maskInputs: true

tasks:
  - id: find-pricing
    prompt: Find out how much the Pro plan costs per month.
    start: /index.html
    success:
      url: /pricing.html        # or: visible: "#pro-price"  |  event: pricing-seen
    timeLimitSec: 120
`;

export async function init(dir: string): Promise<void> {
  const target = join(dir, CONFIG_FILE);
  const exists = await access(target).then(() => true, () => false);
  if (exists) {
    console.log(`${target} already exists — leaving it untouched.`);
    return;
  }
  await writeFile(target, TEMPLATE, "utf8");
  console.log(`Created ${target}. Edit the tasks, then run: protoprobe serve ${dir}`);
}
