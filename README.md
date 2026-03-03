# sshgit

CLI to manage multiple GitHub SSH accounts on one machine and wire repos to the right identity.

Published on npm as `@samyou/sshgit`.

## Install

```bash
npm install -g @samyou/sshgit
```

Requires Node.js 18+.

## Quick Start

```bash
sshgit init
sshgit account add --provider github --account work --email you@company.com
```

After `sshgit account add`, copy the `.pub` key to GitHub (before `sshgit account test` or `sshgit repo use`):

```bash
sshgit account copy-pub github-work
```

Then paste it into GitHub at `Settings -> SSH and GPG keys`:
`https://github.com/settings/keys`

Rewire remote origin url (optional)

```
sshgit repo use github-work
```

## Example usage

```bash
# show all configured account aliases
sshgit account list

# add a GitHub account
sshgit account add --provider github --account personal --email you@example.com --git-name "Your Name"

# test one specific alias
sshgit account test github-personal

# copy one account's public key to clipboard
sshgit account copy-pub github-personal

# wire the current repo to an alias
sshgit repo use github-work

# repo wiring example (origin -> alias host)
git remote add origin git@github.com:samyou/sshgit.git
sshgit repo use github-work
git remote get-url origin
# git@github-work:samyou/sshgit.git

# remove an alias and its key files
sshgit account remove --alias github-personal --delete-key
```

## Dev / Build

```bash
# run from source
bun run dev -- --help

# typecheck
bun run typecheck

# bundle CLI for publishing
bun run build
./dist/sshgit.js --help
```

Optional local install:

```bash
mkdir -p "$HOME/.local/bin"
cp ./dist/sshgit.js "$HOME/.local/bin/sshgit"
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
./dist/sshgit.js <command>
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

Copy public key to clipboard:

```bash
bun run dev -- account copy-pub github-work
# if only one account exists, alias is optional
bun run dev -- account copy-pub
```

Use an account in the current repo (rewrites remote + sets local git identity):

```bash
bun run dev -- repo use github-work
```

Example flow for `repo use`:

```bash
# start with a normal GitHub SSH remote
git remote add origin git@github.com:samyou/sshgit.git

# rewrite origin to your sshgit alias host
bun run dev -- repo use github-work

# origin is now wired to the alias host
git remote get-url origin
# git@github-work:samyou/sshgit.git
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
- After `account add`, run `sshgit account copy-pub <alias>` and paste the key into your provider settings page.

## License

MIT
