# Contributing to opencode Config

## Commit Message Convention

```
<type>(<scope>): <title>

What changed:
- <bullet(s) describing what was added/changed/removed>

Why:
- <bullet(s) explaining the problem solved or what it improves>
```

| Type       | Purpose                  | Example                                      |
| ---------- | ------------------------ | -------------------------------------------- |
| `feat`     | New features             | `feat(agents): add code-review agent`        |
| `fix`      | Bug fixes                | `fix(mentoring): correct typo in prompt`     |
| `docs`     | Documentation            | `docs(readme): update install steps`         |
| `upd`      | Updates / improvements   | `upd(plugin): bump to v2.0`                  |
| `test`     | Tests                    | `test(config): add validation tests`         |
| `audit`    | Security / dependencies  | `audit(deps): fix CVE in zod`                |

### Rules
- Keep the title under 72 characters.
- Use imperative mood ("add feature", not "added feature").
- Scope is the file or area affected (e.g., `agents`, `mentoring`, `config`).
- **The body is mandatory on EVERY commit** — on a branch, in a PR, or pushed
  directly to `main`. Without a PR description the commit message is the only
  place context lives. `What changed:` and `Why:` carry the same content the
  PR Description Template below would.
- This is machine-enforced: the repo's `.githooks/commit-msg` hook rejects
  title-only messages and non-conforming titles (git-generated
  merge/revert/fixup messages are exempt). One-time setup per clone:
  `git config core.hooksPath .githooks`. Bypass only with an explicit
  `git commit --no-verify` — never by default.

## Pull Requests

### Branch Naming

```
<type>/<short-description>
```

Examples: `feat/add-deploy-agent`, `fix/mentoring-prompt`

### PR Description Template

```markdown
## What changed
- `<type>(<scope>): <description of what was added/changed/removed>`

## Why
- `<explain what problem this solves or what it improves>`
```

Example:

```markdown
## What changed
- `feat(agents): add deploy command for production`
- `docs(readme): add deploy usage section`

## Why
- The team needed a one-command deploy flow
- Users didn't know the deploy command existed
```

## Style

- Keep `node_modules`, `package.json`, `package-lock.json`, `bun.lock`, and `.gitignore` out of commits (they are gitignored).
- Run any local tests or validation before every commit / PR.
