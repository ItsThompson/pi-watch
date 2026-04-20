import { join } from "node:path";
import { homedir } from "node:os";

export function getConfigPath(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "PiWatch",
    "config.json",
  );
}

export function getLogDir(): string {
  return join(homedir(), "Library", "Application Support", "PiWatch", "logs");
}
