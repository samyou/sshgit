# sshgit

CLI to manage multiple GitHub/GitLab SSH accounts on one Mac and wire repos to the right identity.

## Install

```bash
bun install
```

## Quick Start

```bash
bun run build
./dist/sshgit init
./dist/sshgit account add --provider github --account work --email you@company.com
./dist/sshgit account test github-work
```

## Dev / Build

```bash
# run from source
bun run dev -- --help

# typecheck
bun run typecheck

# compile native binary
bun run build
./dist/sshgit --help
```

Optional local install:

```bash
mkdir -p "$HOME/.local/bin"
cp ./dist/sshgit "$HOME/.local/bin/sshgit"
chmod +x "$HOME/.local/bin/sshgit"
```

Then use:

```bash
sshgit --help
```

## Commands

Run from source:

```bash
bun run dev -- <command>
```

Run compiled binary:

```bash
./dist/sshgit <command>
```

Initialize managed files and SSH include:

```bash
bun run dev -- init
```

Add an account (creates key, updates `~/.ssh/sshgit_config`, stores metadata):

```bash
bun run dev -- account add \
  --provider github \
  --account work \
  --email you@company.com \
  --git-name "Your Name"
```

List accounts:

```bash
bun run dev -- account list
```

Test SSH auth:

```bash
bun run dev -- account test
# or
bun run dev -- account test github-work
```

Use an account in the current repo (rewrites remote + sets local git identity):

```bash
bun run dev -- repo use github-work
```

Remove an account:

```bash
bun run dev -- account remove --alias github-work
# optionally also delete key files
bun run dev -- account remove --alias github-work --delete-key
```

## Notes

- Generated keys default to `~/.ssh/id_ed25519_<provider>_<account>`.
- Managed SSH config lives in `~/.ssh/sshgit_config` and is included from `~/.ssh/config`.
- After `account add`, copy the printed public key into your provider settings page.

## License

MIT
