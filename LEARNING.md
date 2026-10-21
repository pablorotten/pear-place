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
  still has to be _valid_, just not active. In Level 3 this exact field becomes the
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

## The opencode GitHub agent: how "the cloud implements my issue" actually works

Comment `/oc implement this ticket` on an issue and an agent codes it — but the
"cloud" doing the work is **two clouds splitting the job**:

- **GitHub Actions = the hands.** GitHub spins up an _ephemeral Ubuntu VM_ (a
  runner), checks out the repo at the default branch, runs opencode there,
  and the agent pushes a **new branch + opens a PR** — never committing to
  `main` directly. The run then comments the PR link back on the issue. The
  runner VM is destroyed after the run: its `~` (and any credentials in
  memory) is gone forever.
- **The model API = the brain.** On that VM, the opencode CLI is just a client
  for the hosted model (`opencode-go/glm-5.3-flash` here) authenticated with
  `OPENCODE_API_KEY`. No opencode sandbox somewhere "runs" anything — the
  _runner_ runs, the _model_ suggests.

Anatomy learned by polling a live run:

- The CLI can't stream a running job's logs (`--log` errors until completion),
  but `gh api repos/OWNER/REPO/actions/jobs/ID` returns each step's status —
  that's how you tell "agent is thinking" from "runner is stuck". (The web
  page _does_ show a live tail; CLI doesn't.)
- A 20+ min agent step is normal, not stuck: the agent explores, edits,
  **and verifies itself** — our #3 run spontaneously built a headless
  `backend/seeder.js` smoke script in Bare, tested restart-persistence
  (reopen the same Corestore → same canvas), even chased its own false
  positive (verify script racing the seeder) and self-corrected. Step 79 of
  one session.
- `gh pr checkout <n>` locally = the human verification layer: run the branch
  on your machine, break it apart, merge only after `npm start` proves it.

Workflow config notes (`.github/workflows/opencode.yml`):

- `model: provider/model` is a one-line lever per run; `variant` is a
  _reasoning-effort_ lever, and it's the **wrong fix for slow runs** — more
  thinking tokens = longer, not shorter. Slow+thorough is a `flash` trait,
  not a bug; fix patience with `timeout-minutes`, not with reasoning level.
- Sequential tickets need **merge-before-next**: every run branches off
  `main`, so a parallel #4 would build on code _without_ #3's changes and
  collide in the same files at review time.
- Runners can never "open the app" the way devs do (headless VM) — CI-worthy
  verification = lint + headless p2p/data smoke tests (Hyperbee & Hyperswarm
  run fine without a display), optionally `xvfb-run` for an Electron boot
  smoke. Whether the canvas _looks_ right stays human.

Source: [opencode GitHub docs](https://opencode.ai/docs/github/) ·
[anomalyco/opencode#25699](https://github.com/anomalyco/opencode/issues/25699)

## GitHub Actions secrets: a write-only vault

Three facts that make secrets safe enough to trust with an API key:

1. **Encrypted before transit** — `gh secret set` encrypts with GitHub's
   per-repo public key _before_ upload.
2. **Write-only at rest** — after saving, even you can't read it back; the
   UI only shows name + timestamp. Overwriteable, never readable.
3. **Ephemeral at runtime** — decrypted only into the runner's memory for
   your workflow, and automatically **masked** if code ever prints it.

And don't confuse them with `.env`-style local untracked files:
secrets = vault (enforcement); untracked files = "gitignore and hope"
(convention). Three rings of exposure to keep straight:
**repo-tracked → repo-untracked → vault**. A committed
`${{ secrets.X }}` _reference_ is safe precisely because it's a pointer,
not the value.

## Service accounts: the CI agent shouldn't use _my_ key

OpenCode's console has dedicated **service accounts** ("machine principals
for CI and automations") — the generalizable pattern:

- One identity (and key) per environment: local machine keeps its personal
  key in `~/.local/share/opencode/auth.json`; CI gets its own key rotated
  into `gh secret set OPENCODE_API_KEY` — revoke/re-rotate one without
  touching the other, and console usage view itemizes spend per key.
- Cap the CI key's spend so a runaway agent loop can't drain the balance.
- If the provider offers **IP restrictions: leave them OFF for GitHub
  Actions** — runners come from Microsoft's ephemeral IP pools, any
  allowlist breaks every run.
- Rotation is cheap: create key v2 → `gh secret set` → observe one green
  run → deactivate v1. Cost of a mistake: one paste command.

## What is a "spike"?

"New term picked up mid-project" — a spike is a **little disposable experiment
whose ONLY deliverable is an answer** to one technical question, before
committing to build on top of it. The name comes from climbing: you hammer a
spike in to test the route before trusting it with the full climb.

- Cheap on purpose: ugly scripts in their own folder, no polish, no
  integration, no tests-lint-clean requirement.
- It produces a **decision**, not a feature — that's the deliverable ("post
  the answer as a comment", like #4 asked).
- The discipline is to kill it when it answered: integrate what was learned
  into the real code and delete the scaffolding eventually. Continuing to
  beautify a spike = procrastination with good lighting.

What it would have cost NOT to spike: integrating Autobee into the real
backend, two days in, and then discovering the grant flow doesn't fit an open
canvas — rewrite under deadline.

## How a no-server canvas lets strangers write (knock + auto-grant)

The r/place-we-want question: without a server, who "lets" a stranger paint?
The stack can't even ask a server, because there isn't one. The mechanism that
solves it (spike in `spike/autobee/`):

- **Reading is never gated.** Join an Autobee by key and you replicate the
  full view immediately — stranger or not. Only APPENDING is gated.
- **A grant is an op in the shared history, not a permission call.** A
  writable peer appends `{ addWriter: <writer-id> }`; every peer's `apply`
  replays it, reaches the same conclusion, and the new writer's local core
  joins the linearization. That's why there is no "central allowlist" to lose:
  the history IS the access list.
- **The auto-grant channel ("knock"):** peers send their `db.local.id` on a
  second Hyperswarm topic derived from the canvas key. Any writable peer that
  hears a knock appends the addWriter op by itself — zero manual steps, and
  works even if the original creator is gone (granted peers can grant too).
- **Same spirit as r/place's cooldown:** it's an honor system. The knock
  channel is unauthenticated by design (topic = hash of the canvas key —
  "having the key" is the identity).

Two details that came with Autobee 2.2.2:

- `db.discoveryKey` is the pointer for "find other peers"; `db.id` is the
  string shareable as a canvas key. The knock topic is derived from `db.id`.
- Two swarms are needed: a Hyperswarm connection doesn't carry the topic it
  was opened for, so canvas replication traffic and knock traffic live apart.

## Who found whom? (Hyperswarm discovery, in one breath)

`swarm.join(topic)` announces/finds peers for that topic via the Holepunch
DHT — a public "phone book + meeting point" that only ever learns where peers
are, never what peers say. Data flows peer↔peer directly once they connect.
The DHT just says "there's a peer behind that door"; Hypercore replication
(`db.replicate(conn)`) is what walks through it. That's why two people in
different countries sharing a canvas key behave exactly like two processes on
one machine: the mechanics don't know where they run.

#5 ("two peers paint one canvas") needs **independent peers, not separate
computers** — peers are "separate storage + identity", which fakes well:

- **Two instances, two profiles** (needs a ~5-line `electron/main.js`
  change before the app is ready): make `userData` path suffixable via a
  `--profile=two`-style argv/env flag, then `npm start` + `npm start -- --profile=two`
  = two peers with separate Hyperbees; Hyperswarm discovers its own
  peer over localhost. Bonus: three peers whenever you feel rich.
- **GitHub's runner is a free "second computer"** (headless): a script there
  can run a peer and assert replication — CI-level proof, no visuals.
- **The old Win10/4 GB laptop is a legit "real network" second peer**:
  Electron 40 supports Win10, this stack is OS-portable, same-LAN
  Hyperswarm discovery needs no port-forwarding. Its job is just "be
  peer #2 and paint" — 400–800 MB idle-ish, keep the browser closed.
  No OS reinstall needed; Linux would work (forge makers even ship
  deb/appimage/flatpak) but buys nothing for the test.
- What no rig replaces: whether it _looks_ right → human, i.e. the video
  demo layer.

## How OTA works: no version registry, just the head of a Hypercore

The "wait, what version do peers actually download?" question, end to end:

- **Version truth = `package.json#version` of the staged build.** The runtime
  gets your running version as an option and only applies an update if the
  staged one is **higher**. Forget `npm version patch` → peers see your new
  content and do nothing.
- **"Latest" is not a registry lookup.** The `pear://<key>` link is a Hyperdrive
  backed by an append-only Hypercore; latest = that core's current **length/tip**,
  learned by replicating from seeders. `pear stage` prints it
  (`^Latest: 1191`) plus a **versioned link** `pear://0.<length>.<key>`.
- **Staging ≠ releasing.** `pear stage` appends to the stage core but does **not**
  move the release pointer that provision/production clients poll — `pear
provision` (and `pear multisig commit` for production) does. **Release lines**
  are parallel `pear://` links (dev/staging/rc/prerelease/production); a build
  follows whichever one sits in its `upgrade` field.
- **The client cycle:** `PearRuntime({ upgrade, version })` swarms the drive's
  discovery key → core length advances → `update-scheduled` (random delay up to
  **1 hour** after a 60s boot grace — spreads the load so seeders don't get a
  thundering herd; `delay: 0` in dev) → `updating` (mirroring blocks, progress
  events) → `updated` → `applyUpdate()` atomically swaps the bundle on disk →
  relaunch. Without a `pear seed` on that link, none of it can download.

**The keys** (mixed these up constantly at first):

| Key                                              | Secret?                  | What it does                                             |
| ------------------------------------------------ | ------------------------ | -------------------------------------------------------- |
| `pear touch` keypair / `PEAR_PRIMARY_KEY`        | **yes**                  | signs every update to your link; _is_ your publish right |
| `pear://<key>` in `upgrade`                      | no (public)              | the app's address; what peers poll                       |
| multisig signing keys (`pear multisig keys get`) | yes (password-encrypted) | production quorum — e.g. 2-of-3 cosigners                |
| Apple/Windows certs                              | yes                      | OS code signing, unrelated to Pear                       |

- **Trust model:** signatures are verified while replicating, so a malicious
  seeder can withhold or serve garbage but never tamper — worst case = no
  update. Anyone can _copy_ your app and re-publish it **under their own key**;
  they just can't write to yours, so your users' `upgrade` never sees it. The
  real attack is a leaked primary key (→ push malicious OTA to everyone) or a
  phishing link; defense = secret hygiene, release lines, multisig quorum.
- **"I ran `pear touch` and saved nothing — am I cooked?"** No: the secret is
  stored _for you_ in the platform dir (`%APPDATA%\pear` on Windows). Only the
  public link needs remembering (it's in `package.json#upgrade` anyway). Check
  write access with `pear cores --all-cores` → `✔ writable`. It is
  **machine-bound**: lose that directory → mint a new link with `pear touch`
  and repoint `upgrade` (fine pre-users, painful after).

Sources: [Release pipeline](https://docs.pears.com/pear/explanation/deployment-releasing-apps-p2p) ·
[Pear OTA](https://docs.pears.com/pear/reference/pear/runtime/#updates) ·
[Troubleshoot desktop releases](https://docs.pears.com/pear/how-to/operate-an-app/manual-deployment/troubleshoot-desktop-releases) ·
[Primary key = write key](https://docs.pears.com/pear/how-to/operate-an-app/github-actions/publish-with-github-actions/#generate-and-store-the-primary-key)

---

# 🐛 Problems I found

## Pear commands print NOTHING (the silent sidecar saga)

> Symptom: `pear touch`, `pear versions`, even `pear touch --json` exit with code 0
> and **zero output**. No error, no link, nothing.

What was wrong on this machine (Windows), in order:

1. The old PearNote-era platform (`%APPDATA%\pear`) had OTA-updated its boot bundle,
   but the local `corestores` state was written by an older storage format — the
   sidecar crashed with `Unsupported version: 2` at boot.
2. After resetting `corestores`, the platform was half-old (June `current`/`checkout`)
   and half-new (October boot bundle) — the sidecar then exited cleanly _mid-boot_,
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
  handling" — the _existing_ handling lives inside the package, not in your file).
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

## `opencode github install` dies with "Failed to parse JSON" (Windows)

> Symptom: fresh `opencode github install` walks me into installing the GitHub
> app, then fails at the "Installing GitHub app" step with
> `Error: Unexpected error — Failed to parse JSON` and self-cancels.

- Not my network: `api.github.com` responds with proper JSON, and I'm on the
  latest opencode (v1.19.3). Looks like an installer bug (possibly the docs v2
  vs CLI v1 mismatch), not a config problem on this end.
- Curious residue: the installer **had already created** `.github/workflows/opencode.yml`
  before dying (`git status` showed untracked `.github/`) — the walk was partly
  done when it blew up.
- Lesson over "retry the lottery": the docs support **manual setup** (app +
  workflow + secrets by hand). Manual is three boring steps and now I understand
  each one — the installer's magic was hiding where GitHub App vs the workflow
  vs secrets each plug in. Manual beats magic when magic is flaky.

## The opencode GitHub App's post-install URL is a dead domain

> Symptom: after clicking through [github.com/apps/opencode-agent](https://github.com/apps/opencode-agent),
> the setup redirect goes to
> `opencode-slack-workerd-anomaly.sst-15d.workers.dev/github/setup?...` —
> browser shows `DNS_PROBE_FINISHED_NXDOMAIN`.

- NXDOMAIN = the DNS record doesn't exist — nobody can reach it, and the domain
  name itself (a leftover SST "slack" worker) smells like a stale App-manifest
  `setup_url`.
- Key insight: **the installation is recorded even though the post-install
  page dies** — GitHub registers the install regardless of the redirect.
- Rather than trust an App whose wiring we'd just watched fail, we switched the
  workflow to **`use_github_token: true`**: GitHub's built-in `GITHUB_TOKEN`
  instead of the App + an OIDC exchange to `api.opencode.ai`. Trade: give the
  workflow explicit `contents/pull-requests/issues: write` permissions. For a
  personal public repo that dependency-chain (App + token exchanger) was the
  flakier path anyway — and it removed `id-token: write` entirely.
- Status: candidate to file as a bug in [anomalyco/opencode](https://github.com/anomalyco/opencode/issues)
  (searched first — nobody has reported it yet).

## First agent run hit paused-at-timeout territory

> Observation: the #3 `/oc implement` run did ~25 min of genuinely productive
> verification (headless Bare smoke tests, restart-invariant checks) inside the
> agent step, with `timeout-minutes: 30` looming.

- Diagnosed via steps API, not vibes: "Set up job" 3s, "Checkout" 1s, the rest
  is the **agent step itself** — model-token time, by design of the
  `flash`-tier thoroughness.
- Takeaway that changed the config decision: **don't reach for `variant: high`
  to fix slowness** (that makes it slower); raise `timeout-minutes` instead.
  Model variant is a quality lever; the clock lever is the workflow guard.

# ❓ Questions (for the public — answered in chat, NOT here)

> Things I genuinely asked myself during this process. They're probably
> interesting to the reader too — left unanswered on purpose.

1. How does `pear://<key>` actually work?
2. At what point does an app in development get its own `pear://<key>`?
3. Does its `pear://<key>` change every time I update the app? NO
4. What happens to peers (users/clients) running a `pear://<key>` app when that app receives an update (OTA)?
5. I publish a version — but what version do peers actually download, and how does the Pear network know which one is the latest?
6. If someone copies my app, can they push an update to _my_ users without my approval? And this "secret key" — where is it supposed to live?
7. Does pear automatically include other libraries such as bare, hyperbee, hyperswarm...
