# Development Constraints

This project currently targets a pinned Node 22 runtime, but development/validation may happen on different host operating systems (including macOS). Follow these rules:

1. Use pinned runtime:
- Node.js `22.22.0` from `.nvmrc`
- npm `10.9.4` from `package.json#packageManager`

2. Treat Node 20 install warnings as a runtime mismatch, not as proof that the app is meant to support both runtimes equally.
- Current dependency/tooling choices are aligned to Node 22
- Recent install output also showed Electron-related tooling packages in the dependency chain requiring Node `>=22.12.0`

3. Validation should be judged in the intended local development environment for the repo, not by an unrelated container/host OS.
- Example: a Linux container may fail on Linux-native Rollup optional packages even when the actual macOS development machine builds correctly
- For ClawFace tickets, prefer the real active dev machine as the authoritative build result unless the ticket is explicitly about cross-platform packaging/runtime support

4. Never copy `node_modules/` between machines.
- Install deps per machine with `npm ci` or `npm install` as appropriate for the workflow

5. `package-lock.json` ownership:
- update it only from the intended pinned runtime/tooling environment
- avoid casual lockfile churn from unrelated hosts/containers

6. Required checks before merge:
- `make typecheck`
- `make build`
- use `npm run check:env` when validating repo/runtime assumptions, but keep any platform-specific checks honest about the current host OS

7. One-time hook setup after clone:
- `npm run hooks:install`

8. Known environment gotchas:
- some dev-dependency installs may fail if Electron cannot write to its cache directory
- Rollup native optional packages are host-OS/architecture specific; a failure on one host does not automatically mean the repo is broken on the intended development machine

## Standard flow

```bash
nvm use
npm ci
npm run dev -- --host 127.0.0.1 --port 3000
```

## Dependency update flow (only in pinned Linux env)

```bash
nvm use
npm install <pkg>
npm run check:env
npm run build
git add package.json package-lock.json
git commit -m "chore: update dependency"
```
