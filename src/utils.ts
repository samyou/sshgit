import { join } from "node:path";
import { HOME } from "./constants";
import type { Provider } from "./types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseProvider(input: string): Provider {
  const normalized = input.trim().toLowerCase();
  if (normalized === "github" || normalized === "gitlab") {
    return normalized;
  }
  throw new Error("--provider must be 'github' or 'gitlab'");
}

export function sanitizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function requireToken(value: string, flag: string): string {
  const sanitized = sanitizeToken(value);
  if (!sanitized) {
    throw new Error(`Invalid ${flag}; use letters, numbers, dash, underscore`);
  }
  return sanitized;
}

export function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return join(HOME, path.slice(2));
  }
  return path;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
