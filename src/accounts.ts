import { ACCOUNTS_PATH } from "./constants";
import { fileExists, readText, writeText } from "./files";
import type { AccountRecord } from "./types";

export async function loadAccounts(): Promise<AccountRecord[]> {
  if (!fileExists(ACCOUNTS_PATH)) {
    return [];
  }

  const raw = (await readText(ACCOUNTS_PATH)).trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `Invalid JSON in '${ACCOUNTS_PATH}'. Fix the file or run 'sshgit init' to recreate base files.`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Invalid accounts file format at '${ACCOUNTS_PATH}'. Expected a JSON array. Try 'sshgit init' to recreate base files.`,
    );
  }

  return parsed as AccountRecord[];
}

export async function saveAccounts(accounts: AccountRecord[]): Promise<void> {
  const content = `${JSON.stringify(accounts, null, 2)}\n`;
  await writeText(ACCOUNTS_PATH, content, 0o600);
}

export function findAccountByAlias(accounts: AccountRecord[], alias: string): AccountRecord | undefined {
  return accounts.find((account) => account.alias === alias);
}

export function removeAccountByAlias(accounts: AccountRecord[], alias: string): AccountRecord[] {
  return accounts.filter((account) => account.alias !== alias);
}
