import { join } from "node:path";
import { Command } from "commander";
import { findAccountByAlias, loadAccounts, removeAccountByAlias, saveAccounts } from "./accounts";
import {
  ACCOUNTS_PATH,
  PROVIDER_KEY_URL,
  SSH_CONFIG_PATH,
  SSH_DIR,
  SSH_MANAGED_PATH,
} from "./constants";
import { ensureBaseLayout, ensureIncludeInSshConfig, checkDependencies } from "./bootstrap";
import { fileExists } from "./files";
import {
  ensureInsideGitRepo,
  getRemoteUrl,
  listRemotes,
  rewriteRemoteToAlias,
  setLocalConfig,
  setRemoteUrl,
} from "./git";
import {
  addKeyToAgent,
  deleteKeyPair,
  ensureKeyPair,
  readPublicKey,
  removeManagedAliasBlock,
  testSshAlias,
  upsertManagedAliasBlock,
} from "./ssh";
import { copyTextToClipboard } from "./shell";
import type { AccountRecord } from "./types";
import { expandHome, nowIso, parseProvider, requireToken } from "./utils";

type AddAccountOptions = {
  provider: string;
  account: string;
  email: string;
  alias?: string;
  gitName?: string;
  signingKey?: string;
  keyPath?: string;
};

type RemoveAccountOptions = {
  alias: string;
  deleteKey: boolean;
};

type RepoUseOptions = {
  remote: string;
  email?: string;
  name?: string;
};

export function runCli(): void {
  const program = new Command();

  program
    .name("sshgit")
    .description("Manage multiple GitHub/GitLab SSH identities on one Mac")
    .version("0.1.0");

  registerInitCommand(program);
  registerAccountCommands(program);
  registerRepoCommands(program);

  void program.parseAsync().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}

function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize sshgit files and SSH include")
    .action(async () => {
      await initializeRuntime({ checkDeps: true, ensureInclude: true });
      console.log("Initialized sshgit");
      console.log(`- Accounts DB: ${ACCOUNTS_PATH}`);
      console.log(`- Managed SSH file: ${SSH_MANAGED_PATH}`);
      console.log(`- Include ensured in: ${SSH_CONFIG_PATH}`);
    });
}

function registerAccountCommands(program: Command): void {
  const account = program.command("account").description("Manage SSH accounts");

  account
    .command("add")
    .description("Add or update an SSH account")
    .requiredOption("--provider <provider>", "github|gitlab")
    .requiredOption("--account <account>", "Short account id (e.g. work, personal)")
    .requiredOption("--email <email>", "Email for SSH key comment and git user.email")
    .option("--alias <alias>", "SSH host alias (default: <provider>-<account>)")
    .option("--git-name <name>", "git user.name for repo wiring")
    .option("--signing-key <key>", "Optional git signing key fingerprint/id")
    .option("--key-path <path>", "Custom private key path")
    .action(async (options: AddAccountOptions) => {
      await handleAddAccount(options);
    });

  account
    .command("list")
    .description("List configured accounts")
    .action(async () => {
      await initializeRuntime({ checkDeps: false, ensureInclude: false });
      await handleListAccounts();
    });

  account
    .command("test")
    .description("Test SSH auth for one alias or all accounts")
    .argument("[alias]", "Alias to test")
    .action(async (alias?: string) => {
      await initializeRuntime({ checkDeps: false, ensureInclude: false });
      await handleTestAccounts(alias);
    });

  account
    .command("copy-pub")
    .description("Copy account public key to clipboard")
    .argument("[alias]", "Alias to copy (optional if only one account exists)")
    .action(async (alias?: string) => {
      await initializeRuntime({ checkDeps: false, ensureInclude: false });
      await handleCopyPublicKey(alias);
    });

  account
    .command("remove")
    .description("Remove an account and SSH alias")
    .requiredOption("--alias <alias>", "Alias to remove")
    .option("--delete-key", "Delete key files from disk", false)
    .action(async (options: RemoveAccountOptions) => {
      await initializeRuntime({ checkDeps: false, ensureInclude: false });
      await handleRemoveAccount(options);
    });
}

function registerRepoCommands(program: Command): void {
  const repo = program.command("repo").description("Wire current git repo to an alias identity");

  repo
    .command("use")
    .description("Set local git identity and rewrite remote host to alias")
    .argument("<alias>", "Account alias")
    .option("--remote <name>", "Remote name", "origin")
    .option("--email <email>", "Override git user.email")
    .option("--name <name>", "Override git user.name")
    .action(async (alias: string, options: RepoUseOptions) => {
      await initializeRuntime({ checkDeps: false, ensureInclude: true });
      await handleRepoUse(alias, options);
    });
}

async function initializeRuntime(options: { checkDeps: boolean; ensureInclude: boolean }): Promise<void> {
  if (options.checkDeps) {
    checkDependencies();
  }
  await ensureBaseLayout();
  if (options.ensureInclude) {
    await ensureIncludeInSshConfig();
  }
}

async function handleAddAccount(options: AddAccountOptions): Promise<void> {
  await initializeRuntime({ checkDeps: true, ensureInclude: true });

  const provider = parseProvider(options.provider);
  const account = requireToken(options.account, "--account");
  const alias = requireToken(options.alias ?? `${provider}-${account}`, "--alias");
  const keyPath = options.keyPath
    ? expandHome(options.keyPath)
    : join(SSH_DIR, `id_ed25519_${provider}_${account}`);
  const publicKeyPath = `${keyPath}.pub`;

  ensureKeyPair(keyPath, options.email);

  const accounts = await loadAccounts();
  const now = nowIso();
  const existing = findAccountByAlias(accounts, alias);
  const nextRecord: AccountRecord = {
    provider,
    account,
    alias,
    email: options.email,
    gitName: options.gitName,
    signingKey: options.signingKey,
    keyPath,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextAccounts = removeAccountByAlias(accounts, alias);
  nextAccounts.push(nextRecord);

  await saveAccounts(nextAccounts);
  await upsertManagedAliasBlock(nextRecord);

  const addedToAgent = addKeyToAgent(keyPath);

  console.log(`Configured ${provider} account '${account}' as alias '${alias}'`);
  console.log(`- Private key: ${keyPath}`);
  console.log(`- Public key: ${publicKeyPath}`);
  console.log(`- Add this key in ${provider}: ${PROVIDER_KEY_URL[provider]}`);
  if (provider === "github") {
    console.log("- Before running 'sshgit account test', copy your public key to GitHub (Settings -> SSH and GPG keys).");
    console.log(`  Copy command (macOS): pbcopy < "${publicKeyPath}"`);
  }

  const publicKey = await readPublicKey(keyPath);
  if (publicKey) {
    console.log("\nPublic key:\n");
    console.log(publicKey.trim());
  }

  if (!addedToAgent) {
    console.log("Warning: failed to add key to ssh-agent. Add it manually with ssh-add.");
  }
}

async function handleListAccounts(): Promise<void> {
  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    console.log("No accounts configured. Run: sshgit account add ...");
    return;
  }

  const sorted = [...accounts].sort((left, right) => left.alias.localeCompare(right.alias));
  for (const account of sorted) {
    const keyExists = fileExists(account.keyPath);
    const publicKeyExists = fileExists(`${account.keyPath}.pub`);
    const status = keyExists && publicKeyExists ? "ok" : "missing-key";
    console.log(
      `${account.alias} | ${account.provider} | ${account.email} | key=${account.keyPath} | ${status}`,
    );
  }
}

async function handleTestAccounts(alias?: string): Promise<void> {
  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    console.log("No accounts configured yet. Add one with: sshgit account add --provider github --account <name> --email <email>");
    return;
  }

  const targetAlias = alias ? requireToken(alias, "alias") : undefined;
  const targets = targetAlias ? accounts.filter((account) => account.alias === targetAlias) : accounts;
  if (targets.length === 0) {
    throw new Error(buildAliasNotFoundMessage(targetAlias ?? alias ?? "", accounts));
  }

  for (const account of targets) {
    const result = testSshAlias(account.alias);
    console.log(`\n[${account.alias}] ${result.ok ? "OK" : "FAIL"}`);

    if (result.output) {
      console.log(result.output);
    }

    if (!result.ok && result.error) {
      console.log(result.error);
    }
  }
}

async function handleRemoveAccount(options: RemoveAccountOptions): Promise<void> {
  const alias = requireToken(options.alias, "--alias");
  const accounts = await loadAccounts();
  const target = findAccountByAlias(accounts, alias);
  if (!target) {
    throw new Error(buildAliasNotFoundMessage(alias, accounts));
  }

  await saveAccounts(removeAccountByAlias(accounts, alias));
  await removeManagedAliasBlock(alias);

  if (options.deleteKey) {
    deleteKeyPair(target.keyPath);
  }

  console.log(`Removed alias '${alias}'`);
  if (options.deleteKey) {
    console.log("Deleted SSH key files");
  }
}

async function handleCopyPublicKey(aliasInput?: string): Promise<void> {
  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    console.log("No accounts configured yet. Add one with: sshgit account add --provider github --account <name> --email <email>");
    return;
  }

  let account: AccountRecord;

  if (aliasInput) {
    const alias = requireToken(aliasInput, "alias");
    const target = findAccountByAlias(accounts, alias);
    if (!target) {
      throw new Error(buildAliasNotFoundMessage(alias, accounts));
    }
    account = target;
  } else if (accounts.length === 1) {
    account = accounts[0]!;
  } else {
    const aliases = [...accounts].map((item) => item.alias).sort((left, right) => left.localeCompare(right));
    throw new Error(
      `Multiple accounts are configured. Choose one alias: ${aliases.join(", ")}. Example: sshgit account copy-pub ${aliases[0]}`,
    );
  }

  const publicKeyPath = `${account.keyPath}.pub`;
  const publicKey = await readPublicKey(account.keyPath);
  if (!publicKey) {
    throw new Error(
      `Public key not found at '${publicKeyPath}'. Re-run 'sshgit account add --provider ${account.provider} --account ${account.account} --email ${account.email}' to recreate it.`,
    );
  }

  const copied = copyTextToClipboard(`${publicKey.trim()}\n`);
  if (!copied) {
    throw new Error(`Failed to copy key to clipboard. Copy it manually with: pbcopy < "${publicKeyPath}"`);
  }

  console.log(`Copied public key for '${account.alias}' to clipboard`);
  console.log(`Next, paste it into: ${PROVIDER_KEY_URL[account.provider]}`);
}

async function handleRepoUse(aliasInput: string, options: RepoUseOptions): Promise<void> {
  const alias = requireToken(aliasInput, "alias");
  const remote = options.remote;

  ensureInsideGitRepo();

  const accounts = await loadAccounts();
  const account = findAccountByAlias(accounts, alias);
  if (!account) {
    throw new Error(buildAliasNotFoundMessage(alias, accounts));
  }

  const remotes = listRemotes();
  if (!remotes.includes(remote)) {
    if (remotes.length === 0) {
      throw new Error(
        "No git remotes are configured for this repository yet. Add one first with `git remote add <name> <url>`, then run this command again.",
      );
    }

    const exampleRemote = remotes[0];
    throw new Error(
      `Remote '${remote}' was not found. Available remotes: ${remotes.join(", ")}. Re-run with --remote <name> (for example: --remote ${exampleRemote}).`,
    );
  }

  const currentRemote = getRemoteUrl(remote);
  if (!currentRemote) {
    throw new Error(`Remote '${remote}' exists but has no URL configured. Set one with: git remote set-url ${remote} <url>`);
  }

  const rewritten = rewriteRemoteToAlias(currentRemote, alias);
  setRemoteUrl(remote, rewritten);

  const email = options.email ?? account.email;
  setLocalConfig("user.email", email);

  const name = options.name ?? account.gitName;
  if (name) {
    setLocalConfig("user.name", name);
  }

  if (account.signingKey) {
    setLocalConfig("user.signingkey", account.signingKey);
  }

  console.log(`Rewired '${remote}' to '${rewritten}'`);
  console.log(`Set local user.email to '${email}'`);
  if (name) {
    console.log(`Set local user.name to '${name}'`);
  }
  if (account.signingKey) {
    console.log(`Set local user.signingkey to '${account.signingKey}'`);
  }
}

function buildAliasNotFoundMessage(alias: string, accounts: AccountRecord[]): string {
  if (accounts.length === 0) {
    return "No accounts configured yet. Add one with: sshgit account add --provider github --account <name> --email <email>";
  }

  const aliases = [...accounts].map((account) => account.alias).sort((left, right) => left.localeCompare(right));
  return `Alias '${alias}' was not found. Available aliases: ${aliases.join(", ")}. Run 'sshgit account list' to see configured accounts.`;
}
