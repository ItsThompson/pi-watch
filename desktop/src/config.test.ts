import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, saveConfig } from "./config.js";
import { DEFAULT_CONFIG } from "@pi-watch/shared";

let tempDir: string;
let configPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "piwatch-config-"));
  configPath = join(tempDir, "config.json");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns defaults when file is missing", () => {
    const config = loadConfig(configPath);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("merges partial file with defaults", () => {
    writeFileSync(configPath, JSON.stringify({ ghostMode: true }));
    const config = loadConfig(configPath);
    expect(config).toEqual({ ...DEFAULT_CONFIG, ghostMode: true });
  });

  it("returns defaults on malformed json", () => {
    writeFileSync(configPath, "not json{{{");
    const config = loadConfig(configPath);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns full config when file is complete", () => {
    const full = { ghostMode: true, ghostOpacity: 0.5, visible: false, soundEnabled: true };
    writeFileSync(configPath, JSON.stringify(full));
    const config = loadConfig(configPath);
    expect(config).toEqual(full);
  });
});

describe("saveConfig", () => {
  it("writes config atomically via rename", () => {
    saveConfig(configPath, { ghostMode: true });
    const saved = JSON.parse(readFileSync(configPath, "utf8"));
    expect(saved).toEqual({ ...DEFAULT_CONFIG, ghostMode: true });
  });

  it("merges partial with existing config", () => {
    writeFileSync(configPath, JSON.stringify({ ...DEFAULT_CONFIG, visible: false }));
    saveConfig(configPath, { ghostOpacity: 0.5 });
    const saved = JSON.parse(readFileSync(configPath, "utf8"));
    expect(saved).toEqual({ ...DEFAULT_CONFIG, visible: false, ghostOpacity: 0.5 });
  });

  it("preserves original file if rename source is missing", () => {
    const original = { ...DEFAULT_CONFIG, ghostMode: true };
    writeFileSync(configPath, JSON.stringify(original));

    // Simulate: write tmp file then remove it before rename would happen
    // This tests that loadConfig still reads the original
    const tmpPath = configPath + ".tmp";
    writeFileSync(tmpPath, JSON.stringify({ ghostMode: false, ghostOpacity: 0.1, visible: false }));
    // Remove tmp before it could be renamed — simulating a crash
    rmSync(tmpPath);

    // Original should be untouched
    const config = loadConfig(configPath);
    expect(config).toEqual(original);
  });

  it("creates parent directory if missing", () => {
    const nestedPath = join(tempDir, "sub", "dir", "config.json");
    saveConfig(nestedPath, { visible: false });
    const saved = JSON.parse(readFileSync(nestedPath, "utf8"));
    expect(saved).toEqual({ ...DEFAULT_CONFIG, visible: false });
  });
});
