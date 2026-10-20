# LEARNING.md — the notebook

Two sections: **🎓 stuff I learn** (concepts, "what is X for") and
**🐛 problems I find** (what broke, why, and how it got fixed).
If an explanation was worth asking for, it's worth writing down.

---

# 🎓 Stuff I learn

## What is the `upgrade` link for? (`pear touch`)

> "Before the app will boot, set a valid `upgrade` link." — [the tutorial](https://docs.pears.com/p2p/getting-started/from-a-template/start-from-hello-pear-electron/)

It's the app's **address on the Pear network** — and the one piece of plumbing the
runtime refuses to boot without.

- Every Pear app is distributed as a `pear://<key>` link. The key is a public key;
  you hold its secret after `pear touch` mints it — that's what makes you the only
  one who can publish updates for it.
- The `"upgrade"` field in `package.json` tells the app **where its own future
  updates live**. At boot, the worker builds a `PearRuntime` with that config
  (`workers/main.js` feeds `argv(2)` into the updater), so it needs a parseable
  link — the literal string `<YOUR_KEY_HERE>` isn't a valid key, hence the boot
  failure the docs warn about.
- `pear touch` "touches" a fresh project: creates the keypair, stages your code as
  version 0 locally, and prints the link to paste into `package.json`. It's not tied
  to a folder — the keypair is yours on that machine, so it travels with the repo.
- Note `npm start` passes `--no-updates` (updates disabled in dev) — but the link
  still has to be *valid*, just not active. In Level 3 this exact field becomes the
  OTA magic: you release a new version at that link and every running peer pulls it
  over the air.

Source: [Start a desktop app from the hello-pear-electron template](https://docs.pears.com/p2p/getting-started/from-a-template/start-from-hello-pear-electron/)

## What is the sidecar?

The Pear platform runs as **two pieces**: a fat background process and a thin CLI.

- The **sidecar** is a local daemon (background process) that owns the real
  machinery: the platform's corestore (storage), the DHT/Hyperswarm network
  connections, and the updater. The docs call it "a local-running IPC server for
  corestore access".
- The **`pear` CLI** is just a client: every command you run connects to the sidecar
  over IPC and asks it to do the work. It doesn't open storage or join the swarm itself.
- It boots on demand: the first `pear` command you run starts the sidecar, and it
  stays resident afterwards so later commands (and running Pear apps) reuse it.

Why it exists:

- A corestore can only be open in **one process at a time** — if the CLI, an app,
  and a seeder each opened their own, they'd fight over the same database. One
  resident owner fixes that; everyone else talks to it.
- Every Pear app on the machine **shares one swarm connection** instead of each
  spawning its own — fewer sockets, one NAT traversal setup, one updater.
- It's also why the CLI fails silently when the sidecar dies: the client has nothing
  to talk to, and (see problems below) it exits 0 without telling you.

## Electron dev loop: what reloads and what doesn't

`npm start` (electron-forge) does **not** watch files:

- `renderer/*` changes (`app.js`, `index.html`) → `Ctrl+R` in the app window. No restart.
- `workers/main.js` or `electron/main.js` changes → full restart (`Ctrl+C` → `npm start`).
  The worker is spawned once at boot; reloading the window does not respawn it.

---

# 🐛 Problems I find

## Pear commands print NOTHING (the silent sidecar saga)

> Symptom: `pear touch`, `pear versions`, even `pear touch --json` exit with code 0
> and **zero output**. No error, no link, nothing.

What was wrong on this machine (Windows), in order:

1. The old PearNote-era platform (`%APPDATA%\pear`) had OTA-updated its boot bundle,
   but the local `corestores` state was written by an older storage format — the
   sidecar crashed with `Unsupported version: 2` at boot.
2. After resetting `corestores`, the platform was half-old (June `current`/`checkout`)
   and half-new (October boot bundle) — the sidecar then exited cleanly *mid-boot*,
   still with no output.
3. Root cause of the silence: **the Pear CLI is a thin client for the sidecar, and it
   swallows sidecar boot failures** — printing nothing and exiting 0. A Pear command
   with no output usually means "sidecar never booted", not "command succeeded".

The fix that worked:

- Run the official installer (install.pears.com) — but `Start-BitsTransfer` inside
  `pear.ps1` failed with a bogus "no active network connections" (BITS is flaky).
  Worked around it by downloading `pear.exe` manually with `Invoke-WebRequest`,
  verifying the SHA256 from `checksums.sha256`, and installing to
  `%LOCALAPPDATA%\Programs\pear`, then repointing the old `%APPDATA%\pear\bin` shims.
- The standalone `pear.exe` self-bootstraps: `pear -v` printed `v3.6.0` — alive again.

**Diagnostic moves worth remembering:**

- `pear sidecar --log-level 3` — shows the sidecar's real boot errors (the CLI hides them).
- Docs say: if `pear sidecar` stops after `Closing any current Sidecar clients...`,
  a sidecar process is hanging; kill pear processes and retry.
- `pear -v` prints the platform's own link + version — a good "is Pear alive at all" check.
- Crash logs live in the platform dir (`sidecar.crash.log`, `cli.crash.log`), and
  sidecar logs persist to `pear.log` in the platform directory.

Source: [Pear CLI reference](https://docs.pears.com/pear/reference/pear/cli/) ·
[pear-cli #15](https://github.com/holepunchto/pear-cli/issues/15) ·
[troubleshooting docs](https://github.com/holepunchto/pear-docs/blob/main/reference/troubleshooting.md)

## `pear run` doesn't exist in Pear v3

> Issue #1 said "`pear run .` opens the app on this PC" — the command doesn't exist.

- `pear run` was **removed in Pear v3**. Running it exits with
  `pear run has been removed. Use the pear-runtime module instead`.
- Apps now embed the [`pear-runtime`](https://www.npmjs.com/package/pear-runtime)
  module themselves (that's the "Pear OTA" library): an installed app is
  self-launching and self-updating, no platform CLI involved.
- So the dev launch on this project is **`npm start`** (Electron Forge), and
  `workers/main.js` constructs its own `PearRuntime` at boot.

Source: [Pear CLI reference (`pear run`)](https://docs.pears.com/pear/reference/pear/cli/) ·
[Migrate from `pear run` to Pear OTA](https://docs.pears.com/pear/how-to/operate-an-app/migration/)

## The tutorial's worker diff assumes code you don't have

> Symptom: after pasting the tutorial's step-3 worker snippet, the app crashes at boot
> with `Uncaught ReferenceError: pipe is not defined` (`workers/main.js:1:1`).

- The template's `workers/main.js` is just **`require('hello-pear-worker')`** (2 lines).
- The ["Add a ping feature" diff](https://docs.pears.com/p2p/getting-started/from-a-template/start-from-hello-pear-electron/#example-add-a-ping-feature)
  edits a worker that already has `pipe`, `pear`, `updaterConfig` — the **inlined**
  bootstrap the docs show pages earlier "so you can see what it does". The tutorial
  never says to actually do that inlining ("keep the existing `pear:applyUpdate`
  handling" — the *existing* handling lives inside the package, not in your file).
- Pasting the diff alone → `pipe` doesn't exist → worker dies at boot.

The fix that worked: inline the real bootstrap (imports + `argv` helper +
`updaterConfig` + `pipe`/`store`/`swarm`/`pear` — from
[hello-pear-worker/index.js](https://github.com/holepunchto/hello-pear-worker/blob/main/index.js))
above the ping handler, plus install its deps
(`hyperswarm corestore graceful-goodbye bare-path bare-storage`). See
[our `workers/main.js`](./workers/main.js).

Status: **docs bug** — candidate for a PR to
[holepunchto/pear-docs](https://github.com/holepunchto/pear-docs) adding the missing
"inline the bootstrap first" step.
