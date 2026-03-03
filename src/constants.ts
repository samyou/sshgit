import { homedir } from "node:os";
import { join } from "node:path";
import type { Provider } from "./types";

export const HOME = homedir();

export const SSH_DIR = join(HOME, ".ssh");
export const SSH_CONFIG_PATH = join(SSH_DIR, "config");
export const SSH_MANAGED_PATH = join(SSH_DIR, "sshgit_config");

export const APP_DIR = join(HOME, ".config", "sshgit");
export const ACCOUNTS_PATH = join(APP_DIR, "accounts.json");

export const SSH_INCLUDE_LINE = "Include ~/.ssh/sshgit_config";
export const MANAGED_SSH_HEADER = "# Managed by sshgit. Changes may be overwritten.\n";

export const REQUIRED_BINARIES = ["git", "ssh", "ssh-keygen", "ssh-add"] as const;

export const PROVIDER_HOST: Record<Provider, string> = {
  github: "github.com",
  gitlab: "gitlab.com",
};

export const PROVIDER_KEY_URL: Record<Provider, string> = {
  github: "https://github.com/settings/keys",
  gitlab: "https://gitlab.com/-/profile/keys",
};
