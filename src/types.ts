export type Provider = "github" | "gitlab";

export type AccountRecord = {
  provider: Provider;
  account: string;
  alias: string;
  email: string;
  gitName?: string;
  signingKey?: string;
  keyPath: string;
  createdAt: string;
  updatedAt: string;
};

export type SshTestResult = {
  alias: string;
  ok: boolean;
  output: string;
  error?: string;
};
