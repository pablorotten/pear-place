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

## The keypair: where it's born, where it lives, what happens when the machine burns

> The link is public; the _secret_ is the publish right. And normal Pear setup
> binds that right to the machine — production exists to unbind it.

- **Born, not downloaded.** `pear touch` generates a fresh keypair out of thin
  air. The public half prints as the `pear://<key>` link (an address — safe to
  commit in `package.json#upgrade`). The private/write key is **never shown**:
  the CLI generates it and stores it itself.
- **Where it lives:** the Pear platform dir — `%APPDATA%\pear` on Windows.
  That folder _is_ the publish right. Verify ownership any time:
  `pear cores --all-cores` → `✔ writable`, or `pear info <link>` → `writable`.
- **Machine burns → the link is frozen, not destroyed.** The docs are blunt:
  "you cannot undelete the same keys from thin air". Recovery for a lost stage
  link: new `pear touch`, stage to it, repoint `upgrade`… except every deployed
  binary has the **old link baked into its package.json**, so installed users
  keep polling the dead line and must reinstall from the new link. Fine with
  zero users, painful after. (A provision link can be rebuilt from a live
  production drive instead — see the recover flow in the docs.)
- **Stage vs provision = two links, two touches.** Stage is the append-only
  core you sync builds into; provision is the lean snapshot peers poll. The
  tutorial mints one of each — `pear touch` doesn't even know or care about
  your project folder, cwd does not matter.
- **How production keeps the right alive:** detach it from any single machine.
  Two tiers:
  1. _You hold the key, machines borrow it._ Generate the primary/write key
     yourself (random 32 bytes), store it in a password manager / vault, and
     machines (laptop, CI) get it transiently via the `PEAR_PRIMARY_KEY`
     env var / GitHub repo secret. Laptop burns → nothing lost, a fresh
     machine restores full capability from the vault.
  2. _Multisig — the production answer._ Releases are signed by a **quorum**
     (e.g. 2-of-3) of password-encrypted keys (`pear multisig keys get`),
     each on a separate machine/person, backed up via `keys paths`. The
     production link is derived from the config alone (`publicKeys` +
     `quorum` + `namespace` in `pear.json`), so it's machine-independent by
     construction. Multisig drives are explicitly **not machine-bound**:
     write access = signing capability, so losing one (even two) keys still
     leaves a quorum of survivors who can keep producing releases forever.
- Mental model to keep: **stage link = disposable scaffolding; production
  durability = custody.** Either you personally hold the write key in a vault,
  or trust is distributed across a quorum. A machine-bound key is by definition
  a dev-time key.

Source: [Troubleshoot desktop releases — Recovering from lost write access](https://docs.pears.com/pear/how-to/operate-an-app/manual-deployment/troubleshoot-desktop-releases/#recovering-from-lost-write-access) ·
[Ship your app — touch, upgrade link, seed](https://docs.pears.com/p2p/getting-started/build-a-peer-to-peer-chat/ship/#touch-set-the-upgrade-link-and-seed) ·
[Publish with GitHub Actions — generate and store the primary key](https://docs.pears.com/pear/how-to/operate-an-app/github-actions/publish-with-github-actions/#generate-and-store-the-primary-key)

## Anatomy of `%APPDATA%\pear`: which folder holds what (and moving keys to another PC)

> `\corestores` holds the keys; everything else is re-downloadable runtime state.

One `pear touch` writes **both halves at once**: the public link to stdout
(what you paste anywhere), and the secret straight into the platform dir —
never printed, never a plain-text file. Digging in:

| Folder                    | What lives there                                                                                | Replaceable?                |
| ------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------- |
| `corestores\platform\db\` | **The write keys** for everything minted with `pear touch`, kept in a Corestore (LevelDB vault) | ❌ only irreplaceable piece |
| `by-dkey\<hash>\`         | Cache of apps _executed_ (`pear run`-style): boot bundle, checkout, prebuilds — no secrets      | ✅ re-downloads             |
| `pear\db\`                | Pear's internal state (links, prefs)                                                            | ✅                          |
| `bin\`, `current\`, `gc\` | The runtime itself                                                                              | ✅                          |

So "everything I've run with Pear" is **not** here — executed apps are just
cached copies under `by-dkey`. What makes a machine an _owner_ is `corestores`
alone. Backing up keys = copying that one folder.

- **The build-time override holds only the public half.** `forge.config.js`
  allows an env var (`UPGRADE_KEY`) to replace `package.json#upgrade` at make
  time — but that var is the public link, not a secret. The write key is
  resolved implicitly by the CLI from local storage; you never touch it as
  text. (No `.env` loader here on purpose: `npm pkg set upgrade=...` covers
  the change-the-link case, and real env vars cover the CI case.)
- **Keys travel between machines** — they're crypto material, not
  hardware-bound. Restore the folder at the same path on the new PC, then
  verify: `pear info <link>` → `writable: true` means it landed; `false` = it
  didn't.
- **The trap:** overwriting an existing `corestores` with a foreign one
  **destroys that machine's own keys**. There is **no official merge
  command** for two corestores. Real options:
  1. one machine per release line (zero risk, zero steps);
  2. keep N named copies and swap the active folder before publishing;
  3. multisig — the production answer already noted above: writes become a
     quorum of signing keys, machine-independent by construction.
- And the backup itself **contains the secret keys** — handle it like a
  wallet, not a README.

Source: [Ship your app](https://docs.pears.com/p2p/getting-started/build-a-peer-to-peer-chat/ship/#touch-set-the-upgrade-link-and-seed) ·
[Troubleshoot desktop releases](https://docs.pears.com/pear/how-to/operate-an-app/manual-deployment/troubleshoot-desktop-releases/#recovering-from-lost-write-access)

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

## Warm peer vs cold peer: what actually happens on a first-ever open

The confusion that ate an afternoon (all three witnesses ran the SAME code;
only their storage dirs differed):

|                 | warm peer (T2)                                        | cold peer (a fresh instance)                                   |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| storage dir     | joined this canvas in a previous run                  | **empty** — first contact ever                                 |
| writer identity | its grant is already in shared history                | **no grant yet** — must knock and wait                         |
| on open         | boot finds the grant → **writable instantly** → syncs | **read-only**, knocks, pulls the entire history block by block |

A cold peer's boot is a 3-step handshake, each waiting on DHT discovery:
**find peers → get granted (knock) → download everything.** Until the grant
replicates back, its clicks are `canvas:place rejected`; until the download
finishes, its canvas renders dot-by-dot and looks "broken" next to a warm
window. A reopen doesn't lose anything (it resumes its storage) and warm
starts are fast — that part is timing, not corruption.

**THE MAIN TAKEAWAY (design decision recorded):** if you start a new
instance fresh, it should **wait until it receives the latest shared canvas
before allowing the user to click and paint**. Never let someone contribute
to a canvas they can't fully see. Today the app only gates on writability;
the "caught up" half is missing — gate `canvas:place` until writable AND the
initial grid has streamed, and show a "joining…" state meanwhile.

### The 3-terminal test that shows it all

Three terminals, one script, all three roles visible at once:

```sh
# T1 — the seeder: npm run seed
# T2 — a warm peer:   npm start
# T3 — a cold peer:   npm run start:fresh
```

Why T1 (`npm run seed`) exists: the seeder is the **headless host** — the
same backend with no window, holding **grant power**. T2 and T3 are already
granted writers (their grants live in shared history), so T1 is the peer
that: hosts the canvas when all windows are closed, hears every newcomer's
knock and auto-grants them, and serves the full history to cold joins.
Without it, a canvas whose windows are all closed is offline.

What's happening per terminal while you paint:

- **T1** prints every pixel it hosts (`[seeder] pixel x,y`) — the live
  heartbeat of the canvas, plus `knock heard — auto-granting …` whenever a
  newcomer joins. It paints NOTHING itself; it's the network's memory.
- **T2 (warm)**: opens with the full canvas already in its view (it is
  `canvas streamed: N placements` on boot) and paints immediately. Every
  click diff (`canvas:placed`) is the Autobee `update(view, changes)` diff
  reaching the renderer — its paint lands on T1 within ~1s.
- **T3 (cold, fresh profile)**: the newcomer dance, visible in order — joins
  **read-only**, paints are `rejected` at first, knocks until SOME writable
  peer grants it, then the canvas history streams in block by block (the
  "different dots" effect: its first `canvas:placed` batches are the whole
  backfill, not your clicks). Once settled, it paints and syncs like T2.

The two visual beats that prove the network is the backend, in order:

1. close T2's window (and every other window) — reopen any of them: the
   canvas is intact, hosted by T1 alone;
2. close T1 too — everything dies silently (the canvas lives on disk, not
   online). Restart T1: its grant is IN shared history, so it prints
   `writable — grant power held` instantly with zero ceremony. That is
   issue #6's whole point in one Ctrl+C.

## Why "outbound works, inbound stalls" is a thing (the stalled backfill)

The real head-scratcher of the day: a cold peer could PAINT (its pixels
reached the seeder) but stopped RECEIVING — for a full minute nothing new
arrived from the other windows. Fixed only by restarting that one instance.
Not cache, not "wait longer":

- **Outbound is a push**: appending your own writer core triggers announce +
  replication toward connected peers — it just works.
- **Inbound is a pull**: history arrives because _your side_ requests blocks
  when peers announce what they have. If the grant lands MID-boot (knock →
  grant while the history pull is still running), that request/wakeup cycle
  can end up satisfied-early: peers stop offering old blocks, your side
  stops asking, and the **backfill starves** — while pushes keep flowing.
- Restarting = restarting the request cycle: fresh boot re-announces, peers
  re-offer, full pull. Everything converged the second time.

Rule of thumb that separates the two failure shapes seen today: **partial
canvas + rejected clicks on a first-ever open = slow/stalled handshake**;
**a previously-synced warm peer going silent = real bug** (see problems
below).

## One storage dir = one canvas (`STORAGE_CONFLICT` teeth)

Switching a session's canvas key inside the SAME storage dir crashes at the
first append: `STORAGE_CONFLICT: Core is already register to group <hash>`
— because Autobee keeps the dir's writer core under the fixed name `'local'`
and pins every core to exactly ONE canvas group. Joining canvas B where
canvas A's writer lives reuses A's core and hypercore refuses the new group.
(Identified by decoding the printed hash — it was the OLD demo canvas's
discoveryKey.)

Fixes shipped: every consumer derives its dir **per canvas key** (app:
`place/<key>`, seeder: `seeder/<key>`), and `backend/canvas.js` refuses a
keyed join into a dir that already hosts another canvas — early, with the
owner's key in the message, instead of a cryptic crash later. Autobee
stamps the owner as `referrer` user-data on the writer core (both join and
create mode), which is what makes the guard cheap.

## pwsh eats `--` when passing args to npm/npx

`npm run x -- --flag` and `npx cmd -- --flag` silently DROP the args in
PowerShell (npm even warns `Unknown cli config`). Through `cmd /c` the same
command forwards fine. Symptoms are nasty: a "mint" command that doesn't
exit, or an app that "joins a canvas" by minting its own instead. Fix: put
the args inside package.json scripts ("storage is passed from the script")
or run through `cmd /c`.

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

## Stage link vs provision link: the two `pear://` keys I kept mixing up

> "Why is the link in `package.json` different from the one `pear touch` printed?" —
> because they're TWO different lines, and only one of them is public.

- **`pear://hchzzy6gg…` = the STAGE line (my private line).** It's the append-only
  Hypercore I sync every build into. Its write key lives in `%APPDATA%\pear\corestores`
  — I can publish here, nobody else can. It is never shared: anyone holding the link
  could _read_ it, i.e. see my whole dev history including the embarrassing versions.
- **`pear://zjzce1h…` = the PROVISION line (the public one).** Fresh keypair, second
  `pear touch`. `pear provision <stage-verlink> <it> <boot-verlink>` copies the content
  from stage onto it, **compacted** — only the final files, append-cruft deleted, leaner
  drive for distribution. This is the link users' builds poll via `upgrade`.
- Kitchen model: **stage = the kitchen, provision = the serving window.** Same dish,
  different doors. Customers never walk into the kitchen.
- The cycle, forever after: stage the build into the hchzzy line, then provision it into the zjzce line.
- Verlink gotcha: `pear provision` prints the provisioned drive as a versioned
  link `pear://0.<length>.<key>` (fork + length + key) - a snapshot address.
  Peers still poll the bare zjzce link via `upgrade`; the versioned form
  is the address of one snapshot. Third arg while bootstrapping is the
  placeholder `pear://0.0.<provision-key>` until a multisig drive exists.
- The touch's keypair is minted from nothing; a new `pear touch` mints a NEW line, so
  a second touch was REQUIRED, no "reuse the stage link for provision" — each line is
  its own keypair, which is the point (independent trust rings).

Source: [Deploy your application — Step 6 Provision](https://docs.pears.com/pear/how-to/operate-an-app/manual-deployment/deployment/#6-provision)

## The key is the line, not the app — corestore ≠ private

> What `pear touch` ACTUALLY creates, said correctly this time.

- `pear touch` mints a **keypair**. The public half IS a new (empty until
  first stage) hypercore's identity — that's what the `pear://` key encodes.
  The private half is stored in my local corestore.
- I can share the public key freely — **what stays private is the private
  (write) key**, not the corestore itself: other peers download the same
  blocks into their own corestores. Blocks are public; the append key is not.
- I put the provision link in `package.json#upgrade` to say: updates for this
  app come from this line. **Anyone holding the private key of that line can
  release updates.** The app itself is identified by name/version (what's in
  the files); the key identifies the distribution line, and the trust
  contract is simply "updates are valid because their signer holds the key
  the installed app polls."
- Corestore = the local librarian: it holds BOTH my write keys AND replicas
  of other drives' blocks. Hypercore = the signed log itself; Corestore = a
  folder that stores/opens/replicates many of them.

## Production: who seeds when I sleep?

> "A provisioned app is 'in the network' — so is it uploaded somewhere?" No.
> There is no somewhere: bytes on disk, DHT for discovery, peers for the rest.

- **"On the Pear network" = "held by an online machine".** The DHT only matches
  addresses; the app files travel peer-to-peer. If the only disk holding them
  is asleep, the swarm has no one to ask and `pear install` hangs.
- The production answer = **paid uptime for the distributor, not servers of logic**:
  1. a small VPS (or two, spread around) running
     `pear seed pear://zjzce1h…` under systemd — a read-only server with NO
     privileged write key, its whole job is "hold + announce".
  2. the runtime already spreads OTA checks up to 1h with a random delay, so
     brief seeder blips get absorbed.
  3. community mirrors are free extras — anyone can seed without special rights;
     same for the canvas, any granted/unprivileged peer can serve reads.
- Canvas seeding is a **separate** online-peer question: `seeder/` is the
  always-on peer for the Hyperbee canvas. Same rule, both kinds of data:
  **>= 1 online peer holding the bytes, or it's offline.**

---

## No server ≠ no one online: who must be in the network for a canvas to work

> "The app opened fine but I can't click anything — `joined read-only —
> knocking for write access`, 0 pixels, every click `rejected`." That's not a
> bug — that's the p2p model's cold start. A canvas is a live network, and
> today the network was empty.

**The chain of "who is on the network":**

- **The canvas state (placement history) lives on the DISKS of the peers
  that have it — nowhere else.** Concretely on this machine: the seeder's
  `~/AppData/Roaming/pear-place/seeder/self` (the owner — where the canvass
  writer core + its grant live) and each app instance's own copy under
  `<tmpdir>\pear\PearPlace\place\<canvas-key>`. No server anywhere; the repo
  is only the code.
- **To read:** replicate from seeders online — with zero peers you get an
  empty view and must wait until someone joins.
- **To write:** the knock needs an online peer **with grant power** to hear
  it and grant you (and every peer has to be online for new appends to
  propagate).
- **If nobody holding the data is online: the canvas exists but is
  offline** — the app knocks into the void forever (today's symptom) and,
  as recorded above, closing everything = everything dies silently.

**Why the "seeder" exists as a separate shell:** `npm run seed` is literally
the same backend running without UI — "the peer that's always there":

| Scenario                     | Who runs something | How the canvas stays alive                                    |
| ---------------------------- | ------------------ | ------------------------------------------------------------- |
| Dev / 2 peers                | me                 | the 3-terminal story: seeder + app(s)                          |
| Assessment demo              | me, during video   | seeder on the old 2nd machine = the "always-on" one            |
| Production                   | someone, ALWAYS    | a small VPS with `pear seed` / the seeder — _the_ "server" of the p2p system, except it's just another peer with no special powers |

**The nuance for the pitch/architecture story:** there is no central
authority. The seeder is "just another writer whose grant is in shared
history". IfPear goes down, ANY granted peer can hear knocks and auto-grant
fresh arrivals (the knock channel is open to every writable peer), and every
peer can hold the full copy. Nothing in the backend depends on a single
host — only on **at least one peer holding the data being online.**

**Where to host that always-on peer** (asked for Vercel/GitHub — the seeder
is a long-lived process holding Hyperswarm sockets, which decides for me):

| Place             | Verdict | Why                                                                       |
| ----------------- | ------- | ------------------------------------------------------------------------- |
| Vercel            | ❌ no   | serverless/edge: ephemeral functions, no persistent TCP sockets           |
| GitHub Actions    | 🟡 semi | ephemeral runners — a job can seed up to ~6h and re-trigger on schedule; fine fordemo windows, gaps between jobs kill it |
| Small VPS / RPi / | ✅ yes  | persistent process + stable IP = exactly what the docs prescribe          |

- VPS recipe:
  `git clone` + `npm i --ignore-scripts=true` → `npx bare seeder/` (canvas
  host) → `npx pear seed pear://<link>` (OTA binary host) → keep alive with
  a systemd unit or tmux. Hyperswarm does NAT/discovery, so the VPS needs no
  port forwarding.
  - GH Actions sketch: `schedule: */30 * * * *` job running
  `timeout 1700 npx bare seeder/` — works for demos, not for always-on.
- For the video: a good narrative beat — "no server means no corporate
  backend, it means _neighbors that are switched on_" + demo the pain
  (canvas offline when everyone closes) vs the fix (seeder on a VPS/2nd
  machine → canvas comes back to life).
- Production-grade pointer straight from the docs: "In production, run
  `pear seed` on at least one always-online machine (a small VPS works) so
  updates keep flowing while developer laptops sleep."

Source: [Ship your app — seeding](https://docs.pears.com/p2p/getting-started/build-a-peer-to-peer-chat/ship/) ·
[Deploy over-the-air updates](https://docs.pears.com/p2p/getting-started/build-a-peer-to-peer-chat/update/) —
plus this session's own cold-start read-only experiment.


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

## A warm peer went GHOST: appended locally, invisible to the swarm

> Symptom: T2 (`npm start`, default profile) painted fine and streamed its
> own diffs, but the seeder's log never showed its pixels and its view grew
> while everyone else's didn't (T2 had 122 placements; seeder + T3 had 104).
> Its own writer even granted a brand-new joiner that knocked — an alive,
> functioning peer — while it received NOTHING itself.

- The discs told the story: T2's dir held ~18 "ghost pixels" that existed
  nowhere else. Later, joining its dir from a plain `bare` process worked
  perfectly (its ops replicated, a fresh host converged in ~10s). So the
  writer, the storage, and the network path were all healthy.
- Conclusion: the app worker's swarms went **dark mid-session** — zero peer
  connections, silently. Outbound was cached in the view; inbound obviously
  can't happen. The scariest part is there was no error anywhere.
- Recovery that worked: wipe BOTH app instance canvas dirs
  (`%TEMP%\pear\HelloPear\place` and `...\profiles\two\place`) while
  everything is closed — history survived on the seeder + in the network,
  the apps rejoined empty, knocked, got granted, and pulled everything back.
- Suspected trigger (unproven): this dir had seen TWO canvases (pre/post
  re-mint) plus the storage-switch fix mid-flight — stale dir state.
  Not reproducible after the per-key storage fix + wipes.

Hardening candidates born from this + the stalled backfill: a connection/
writable watchdog that surfaces "I can see peers / I am Alone" somewhere
visible, and a "joining…" UI state (see learning section above). Never let
a peer be dark AND quiet.

## `pear install` on a foreign machine: 0x800B0109 (untrusted root)

> Symptom: `pear install pear://0.3.zjzce1h…` on the OTHER computer dies with
> `error 0x800B0109: The root certificate of the signature in the app package
> or bundle must be trusted.`

- Not a Pear problem — **Windows refuses to run packages signed by a root it
  doesn't trust.** Our msix is signed with the self-signed dev cert
  (`CN=Pablo`). The dev machine trusts it because it minted it AND imported
  it; a fresh machine trusts only public roots.
- Fix, one-time per machine (public half only, safe to share):
  1. On the signing machine, export the cert:
     ```sh
     Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
       Where-Object Subject -match "CN=Pablo" |
       Export-Certificate -FilePath PearPlace-dev.cer
     ```
     (empty result → look in `LocalMachine\My` or `LocalMachine\TrustedPeople`)
  2. Copy the `.cer` to the target machine → double-click →
     **Local Machine** → **Trusted Root Certification Authorities**.
  3. Retry `pear install`.
- Mental slot: **Pear write key ≠ Windows code-sign cert.** The Pear keypair
  guards OTA authenticity inside the swarm; the msix signature guards "is this
  an installer Windows will let run". Two independent trust rings, both live
  on the dev machine.
- Production aside: a proper OID code-signing cert (DigiCert/Certum etc.)
  chains to public roots, so end users never do step 2. For the assessment:
  importing the dev cert on the test machine is the accepted dogfooding move.

## First install + first paint: the two-seeders confusion (bit me back to back)

> Beat 1: `pear install pear://0.3.zjzce1h…` worked **on my own machine** —
> after the cert import. Beat 2: the freshly-installed app opened, canvas
> joined, and every click said `canvas:place rejected` — while "seeding".
> Both "failures" were me seeding the WRONG thing.

- **There are two seeders.** `pear seed <app-link>` serves the **binary**
  (the msix that `pear install` fetches). `npm run seed` (bare `seeder/`)
  hosts the **canvas** (Hyperbee placements + grant power for knocks). Same
  shape — a peer serving content it holds — completely different payloads.
- The symptom vocabulary now reads instantly:
  - `error 0x800B0109` during install → Windows trust ring, not Pear:
    `Import-Certificate ...\LocalMachine\Root` (admin) then retry.
  - app opens, `joined read-only — knocking`, clicks rejected → the **canvas**
    seeder is missing. Start `npm run seed`; knock gets granted; writable.
  - `pear install` hangs before printing anything → the **binary** seeder is
    missing (`pear seed pear://zjzce1h…`).
- Also learned: **signing ≠ trusting** even on the signing machine. Forge
  signed the msix with `CN=Pablo`, but that cert still had to be imported
  into this machine's own `Trusted Root Certification Authorities` before
  Windows would run the package. The private-key cert in `My` is not a
  trust anchor; the `.cer` (public half) imported into `Root` is.
- Both seeders run side-by-side happily: `pear seed` in one terminal and
  `npm run seed` in another = app distributable + canvas alive.

## Follow one click: how a paint syncs across peers (the whole trace)

> The best 3-min explanation of the app is the life of ONE click. Five code
> stops, two libraries, zero servers. This is the trace to script the video
> from (and the answer to "where's the sync logic?").

- **Stop 1 — the click is a wish, not a paint** (renderer/app.js:25):
  `onClick → bridge.writeWorkerIPC({ type: 'canvas:place', x, y })`. The window
  owns no canvas; it just posts a message to the Pear worker.
- **Stop 2 — the worker routes it** (workers/main.js:129):
  `if (msg.type === 'canvas:place') await canvas.place(msg.x, msg.y)`. One line
  — and proof the backend is shared: no Electron APIs, pure core string.
- **Stop 3 — a paint is an append** (backend/canvas.js:119):
  `await db.append(placeOp(x, y, color))`. And the library story is one line
  earlier (canvas.js:42): `db = new Autobee(store, canvasKey, makeHandlers(...))`
  — Autobee owns the writer core (made by Corestore) AND the Hyperbee view.
  The snap: `place()` returns instantly with `{x,y,color}` — it has NOT painted
  anything yet; it wrote a log entry.
- **Stop 4 — the logs travel, never the canvas** (backend/canvas.js:56-64):
  two Hyperswarm lines: `swarm.join(db.discoveryKey)` (meet by hash of the key —
  the key itself is never broadcast) and `db.replicate(conn)` on connection
  (swap log entries, made by Autobee, not Corestore — the wakeup stream is why).
- **Stop 5 — same program, other side** (backend/apply.js:47):
  `apply(nodes, view, host)` replays the ONE linearized order into the view;
  every peer derives the same pixels independently. Then the diff leaves:
  `makeHandlers().update(view, changes)` (apply.js:92) checks out the view
  before/after heads, `createDiffStream` → `onPlacements` → workers/main.js:51
  → `{type:'canvas:placed', placements}` → renderer/app.js:94 `grid.paint(...)`.
- **The loop closes**: the pixel I painted comes back through 5 stops and 2
  peers in ~1s — `canvas:placed` fires for my OWN clicks too (the local append
  goes through the same apply), so there is exactly one code path for
  local-and-remote paints. That single-path property is the video's money shot.
- **Concurrency question to be ready for**: two peers click the same cell
  "simultaneously" — there is no simultaneity after Autobee: both ops enter
  the shared order, `tryPut` overwrites (place is overwrite-safe like
  r/place), and the later op in the linearized order wins — identically on
  every peer. Brief flicker while ops are mid-flight; no permanent
  disagreement, because disagreement would require two different orders.

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

## Deleting seeder storage: which folder is disposable, which one is the canvas itself

Where the canvas physically lives on my machine: `bare-storage` persistent dir
→ `C:\Users\pablo\AppData\Roaming\pear-place\seeder\self` (the canvas I minted)
or `...\seeder\<canvas-key>` (a copy of someone else's canvas I joined). Inside:
binary Hypercore logs (oplog/tree/bitfield), no JSON snapshot - the "current
canvas" is *derived* from the log every time (that's why `apply()` can run on
every peer with the same result).

Serving ≠ uploading: when the seeder runs it just announces "I have this key"
on the DHT and serves blocks **from the local disk**. Every peer keeps its own
complete copy; the key is only the address. Delete the folder = this machine
quietly stops being a host for it.

The asymmetry that matters before hitting delete:

- `seeder\<key>` (a canvas I joined) → **disposable**. Re-running the seeder
  with the key knocks, re-downloads from any live host, and the grant comes
  back from shared history (no ceremony). Only a problem if nobody else is
  hosting: then there is nothing to download - I sit on an empty canvas.
- `seeder\self` (canvas I minted) → **the original writer core lives here**,
  keypair included. Deleting mints a different canvas with a NEW key on the
  next bare seeder/ run: the old key never comes back from my machine. Other
  peers holding copies can keep it alive a while longer, but the moment
  nobody hosts it, the canvas is dead for everyone - peers join by key,
  find no seeder, see an empty canvas forever.

One-liner: joined folders are copies, `self` is the disk the canvas lives on.
Deleting `self` is "throwing out the server's drive" - except in p2p nobody
warns you that you *were* the server.

## Offline writes: no fork survives the reunion (why "branching" is impossible here)

> Scenario: p1 paints offline, disconnects, everyone else keeps painting, the
> seeder restarts with 0 peers on the network... then p1 reconnects. What
> happens to p1's writes that "nobody has"?

The mental block to kill first: **the DHT stores no data - it's a phonebook,
not a warehouse.** Nothing of the canvas exists "on the network" when zero
processes are running. Data travels only between live processes; it lives on
disks only. So a restarted seeder serves its local copy and waits - nothing
new arrives until some holder reconnects.

Why a "branch" can never exist in the final state:

- There is no single shared log to fork. p1 never wrote to THE canvas log -
  it appended to **its own Hypercore** (private, append-only), so offline
  clicks are history, just in a log only p1 holds yet. N writers = N logs.
- On reconnect, peers exchange each writer's core; **Autobee linearizes**
  all logs by causality (who knew what when - encoded in the logs, no wall
  clock, no vote). Every peer computes the SAME merged order, then the same
  view - p1's pixels simply appear on every screen in one ordered burst.
- Same-pixel tiebreaks are deterministic too: two concurrent writes to one
  (x,y) both enter history, linearization orders them identically on every
  peer - one wins, everyone agrees who. No referee; math did it.
- Who can serve my canvas: any process replicating MY discovery key (that's
  what blind peering is - a generic repeater that holds my cores without
  understanding them). A Keet peer holds Keet's keys, not mine - the swarm
  does not speak app-names, it speaks keys.

Git analogy: git where merge conflicts don't exist - branches are just logs
not yet synchronized, and synchronization IS the merge.

Video beat (shot idea): paint 10 pixels offline -> reconnect -> the other
screen blinks and they land in one ordered burst.

One-liner: he painted with the lights off - and when he came back online,
every screen in the swarm blinked and his pixels landed. Nobody decided to
accept them. The math did.
