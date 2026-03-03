import {
  ACCOUNTS_PATH,
  APP_DIR,
  MANAGED_SSH_HEADER,
  REQUIRED_BINARIES,
  SSH_CONFIG_PATH,
  SSH_DIR,
  SSH_INCLUDE_LINE,
  SSH_MANAGED_PATH,
} from "./constants";
import { ensureDir, ensureFile, fileExists, readText, writeText } from "./files";
import { runCommand } from "./shell";

export async function ensureBaseLayout(): Promise<void> {
  ensureDir(APP_DIR, 0o700);
  ensureDir(SSH_DIR, 0o700);
  await ensureFile(ACCOUNTS_PATH, "[]\n", 0o600);
  await ensureFile(SSH_MANAGED_PATH, MANAGED_SSH_HEADER, 0o600);
}

export async function ensureIncludeInSshConfig(): Promise<void> {
  if (!fileExists(SSH_CONFIG_PATH)) {
    await writeText(SSH_CONFIG_PATH, `${SSH_INCLUDE_LINE}\n`, 0o600);
    return;
  }

  const content = await readText(SSH_CONFIG_PATH);
  if (hasSshgitInclude(content)) {
    return;
  }

  const next = content.length === 0 ? `${SSH_INCLUDE_LINE}\n` : `${SSH_INCLUDE_LINE}\n${content}`;
  await writeText(SSH_CONFIG_PATH, next, 0o600);
}

export function checkDependencies(): void {
  for (const binary of REQUIRED_BINARIES) {
    const result = runCommand("which", [binary]);
    if (!result.success) {
      throw new Error(`Missing required dependency '${binary}'. Install it and run the command again.`);
    }
  }
}

function hasSshgitInclude(content: string): boolean {
  const lines = content.split(/\r?\n/);
  return lines.some((line) => {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith("include ")) {
      return false;
    }
    return /sshgit_config\s*$/i.test(trimmed);
  });
}
