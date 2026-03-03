import { dirname } from "node:path";
import { MANAGED_SSH_HEADER, PROVIDER_HOST, SSH_MANAGED_PATH } from "./constants";
import {
  ensureDir,
  fileExists,
  readTextIfExists,
  removeFileIfExists,
  setMode,
  writeText,
} from "./files";
import { runCommand } from "./shell";
import type { AccountRecord, SshTestResult } from "./types";
import { escapeRegExp } from "./utils";

export function ensureKeyPair(keyPath: string, email: string): void {
  ensureDir(dirname(keyPath), 0o700);

  if (!fileExists(keyPath)) {
    const args = ["-t", "ed25519", "-C", email, "-f", keyPath, "-N", ""];
    const result = runCommand("ssh-keygen", args);
    if (!result.success) {
      const output = (result.stderr || result.stdout || "").trim();
      throw new Error(`Failed to generate SSH key with ssh-keygen: ${output || "unknown error"}`);
    }
  }

  setMode(keyPath, 0o600);
  if (fileExists(`${keyPath}.pub`)) {
    setMode(`${keyPath}.pub`, 0o644);
  }
}

export function addKeyToAgent(keyPath: string): boolean {
  const attempts: string[][] = [
    ["--apple-use-keychain", keyPath],
    ["-K", keyPath],
    [keyPath],
  ];

  for (const args of attempts) {
    const result = runCommand("ssh-add", args);
    if (result.success) {
      return true;
    }
  }

  return false;
}

export async function upsertManagedAliasBlock(account: AccountRecord): Promise<void> {
  const current = (await readTextIfExists(SSH_MANAGED_PATH)) ?? MANAGED_SSH_HEADER;
  const withoutAlias = removeManagedAliasFromContent(current, account.alias).trimEnd();
  const block = buildManagedAliasBlock(account).trimEnd();
  const next = `${withoutAlias}\n\n${block}\n`;
  await writeText(SSH_MANAGED_PATH, next, 0o600);
}

export async function removeManagedAliasBlock(alias: string): Promise<void> {
  const current = await readTextIfExists(SSH_MANAGED_PATH);
  if (!current) {
    return;
  }

  const stripped = removeManagedAliasFromContent(current, alias).trimEnd();
  const next = stripped.length > 0 ? `${stripped}\n` : MANAGED_SSH_HEADER;
  await writeText(SSH_MANAGED_PATH, next, 0o600);
}

export async function readPublicKey(keyPath: string): Promise<string | null> {
  return readTextIfExists(`${keyPath}.pub`);
}

export function deleteKeyPair(keyPath: string): void {
  removeFileIfExists(keyPath);
  removeFileIfExists(`${keyPath}.pub`);
}

export function testSshAlias(alias: string): SshTestResult {
  const result = runCommand("ssh", ["-T", `git@${alias}`]);
  const output = `${result.stdout}${result.stderr}`.trim();
  const ok =
    /successfully authenticated/i.test(output) || /welcome to gitlab/i.test(output) || result.success;

  return {
    alias,
    ok,
    output,
    error: result.success ? undefined : result.stderr.trim() || undefined,
  };
}

function buildManagedAliasBlock(account: AccountRecord): string {
  const hostName = PROVIDER_HOST[account.provider];
  const lines = [
    `# >>> sshgit:${account.alias} >>>`,
    `Host ${account.alias}`,
    `  HostName ${hostName}`,
    "  User git",
    `  IdentityFile ${account.keyPath}`,
    "  IdentitiesOnly yes",
    "  AddKeysToAgent yes",
    "  UseKeychain yes",
    `# <<< sshgit:${account.alias} <<<`,
  ];
  return lines.join("\n");
}

function removeManagedAliasFromContent(content: string, alias: string): string {
  const escapedAlias = escapeRegExp(alias);
  const pattern = new RegExp(
    `\\n?# >>> sshgit:${escapedAlias} >>>[\\s\\S]*?# <<< sshgit:${escapedAlias} <<<\\n?`,
    "g",
  );
  return content.replace(pattern, "\n");
}
