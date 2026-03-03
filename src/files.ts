import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function ensureDir(path: string, mode: number): void {
  mkdirSync(path, { recursive: true });
  setMode(path, mode);
}

export async function ensureFile(path: string, initialContent: string, mode: number): Promise<void> {
  if (!existsSync(path)) {
    await writeFile(path, initialContent, "utf8");
  }
  setMode(path, mode);
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function readTextIfExists(path: string): Promise<string | null> {
  if (!existsSync(path)) {
    return null;
  }
  return readFile(path, "utf8");
}

export async function writeText(path: string, content: string, mode?: number): Promise<void> {
  await writeFile(path, content, "utf8");
  if (mode !== undefined) {
    setMode(path, mode);
  }
}

export function setMode(path: string, mode: number): void {
  chmodSafe(path, mode);
}

export function removeFileIfExists(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  unlinkSync(path);
}

function chmodSafe(path: string, mode: number): void {
  try {
    chmodSync(path, mode);
  } catch {
    return;
  }
}
