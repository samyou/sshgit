import { runCommand } from "./shell";

export function ensureInsideGitRepo(): void {
  const output = runGit(["rev-parse", "--is-inside-work-tree"], true).trim();
  if (output !== "true") {
    throw new Error("Current directory is not a git repository");
  }
}

export function getRemoteUrl(remote: string): string {
  return runGit(["remote", "get-url", remote], true).trim();
}

export function setRemoteUrl(remote: string, url: string): void {
  runGit(["remote", "set-url", remote, url]);
}

export function setLocalConfig(key: string, value: string): void {
  runGit(["config", "--local", key, value]);
}

export function rewriteRemoteToAlias(remoteUrl: string, alias: string): string {
  const scpMatch = remoteUrl.match(/^([^@]+)@([^:]+):(.+)$/);
  if (scpMatch) {
    return `git@${alias}:${scpMatch[3]}`;
  }

  if (remoteUrl.startsWith("ssh://") || remoteUrl.startsWith("https://") || remoteUrl.startsWith("http://")) {
    const parsed = new URL(remoteUrl);
    const path = parsed.pathname.replace(/^\//, "");
    return `git@${alias}:${path}`;
  }

  throw new Error(`Unsupported remote URL format: ${remoteUrl}`);
}

function runGit(args: string[], captureStdout = false): string {
  const result = runCommand("git", args);

  if (!result.success) {
    const error = result.stderr.trim();
    throw new Error(error.length > 0 ? error : `git ${args.join(" ")} failed`);
  }

  return captureStdout ? result.stdout : "";
}
