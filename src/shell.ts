const decoder = new TextDecoder();

export type CommandResult = {
  exitCode: number;
  success: boolean;
  stdout: string;
  stderr: string;
};

export function runCommand(command: string, args: string[]): CommandResult {
  const proc = Bun.spawnSync({
    cmd: [command, ...args],
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    success: proc.success,
    stdout: decoder.decode(proc.stdout),
    stderr: decoder.decode(proc.stderr),
  };
}
