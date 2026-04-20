import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_CONFIG, type PiWatchConfig } from "@pi-watch/shared";
import { log } from "./utils/logger.js";

export function loadConfig(configPath: string): PiWatchConfig {
  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      log({
        timestamp: new Date().toISOString(),
        event: "config_load_warning",
        error: String(error),
      });
    }
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(
  configPath: string,
  partial: Partial<PiWatchConfig>,
): void {
  const current = loadConfig(configPath);
  const merged = { ...current, ...partial };
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = configPath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(merged, null, 2));
  renameSync(tmpPath, configPath);
}
