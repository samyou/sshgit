import { spawnSync } from "node:child_process";

export type CommandResult = {
  exitCode: number;
  success: boolean;
  stdout: string;
  stderr: string;
};

export function runCommand(command: string, args: string[]): CommandResult {
  const proc = spawnSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  const stderr = `${proc.stderr ?? ""}${proc.error ? proc.error.message : ""}`;
  const exitCode = proc.status ?? (proc.error ? 1 : 0);

  return {
    exitCode,
    success: exitCode === 0,
    stdout: proc.stdout ?? "",
    stderr,
  };
}

export function copyTextToClipboard(text: string): boolean {
  const proc = spawnSync("pbcopy", [], {
    input: text,
    stdio: ["pipe", "ignore", "pipe"],
    encoding: "utf8",
  });

  const exitCode = proc.status ?? (proc.error ? 1 : 0);
  return exitCode === 0;
}
