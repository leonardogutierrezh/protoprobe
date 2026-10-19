import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";

export const CONFIG_FILE = "protoprobe.yaml";

export type SuccessCondition =
  | { url: string }
  | { visible: string }
  | { event: string };

export interface TaskConfig {
  id: string;
  prompt: string;
  start?: string;
  success: SuccessCondition;
  timeLimitSec?: number;
  expectedPath?: string[];
}

export interface StudyConfig {
  study: string;
  consent?: string;
  maskInputs?: boolean;
  tasks: TaskConfig[];
}

export async function loadConfig(dir: string): Promise<StudyConfig> {
  const raw = await readFile(join(dir, CONFIG_FILE), "utf8").catch(() => {
    throw new Error(`No ${CONFIG_FILE} found in ${dir}. Run "protoprobe init ${dir}" first.`);
  });
  const config = parse(raw) as StudyConfig;
  validateConfig(config);
  return config;
}

export function validateConfig(config: StudyConfig): void {
  if (!config || typeof config !== "object") throw new Error("Config is empty.");
  if (!config.study) throw new Error('Config needs a "study" name.');
  if (!Array.isArray(config.tasks) || config.tasks.length === 0) {
    throw new Error("Config needs at least one task.");
  }
  const ids = new Set<string>();
  for (const task of config.tasks) {
    if (!task.id || !task.prompt || !task.success) {
      throw new Error(`Each task needs id, prompt and success (check task "${task.id ?? "?"}").`);
    }
    if (ids.has(task.id)) throw new Error(`Duplicate task id "${task.id}".`);
    ids.add(task.id);
  }
}
