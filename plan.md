# 🧠 THE PLAN

## 🛣️ The road

```
              START
                │
                ▼
     ╔══════════════════════╗
     ║ ☁️  THE PROBLEM       ║  r/place: millions painted ONE canvas —
     ║  a canvas no one     ║  but a corporation owned the server. every
     ║  owns                ║  "place" since needs a backend that can die.
     ╚══════════╦═══════════╝  pear-place: the canvas IS the network.
                │
                ▼
     ╔══════════════════════╗
     ║ 🧱  LEVEL 1 · APP     ║  opens + works on my machine. no network yet.
     ║     runs locally     ║  win: grid paints; pixels survive restart 📌
     ╚══════════╦═══════════╝  (hyperbee) · backend verified headless in Bare
                │
                ▼
     ╔══════════════════════╗
     ║ 📡  LEVEL 2 · P2P     ║  two peers sync. there is NO server —
     ║     goes peer-to-peer║  the "backend" is the app itself.
     ║                      ║  win: pixel placed on peer A appears on 📌
     ╚══════════╦═══════════╝  peer B, joined only by canvas key
                │
                ▼
     ╔══════════════════════╗
     ║ 🚀  LEVEL 3 · SHIP    ║  someone installs it from my link
     ║     distribute + OTA  ║  and I push a new version over the air.
     ║                      ║  win: friend installs via pear:// link; 📌
     ╚══════════╦═══════════╝  v1.1 (new palette) lands OTA, live
                │
                ▼
     ╔══════════════════════╗
     ║ 📣  THE LAUNCH THREAD ║  5–7 posts telling the story
     ║     tell the story    ║  win: "there is no server" — 7 posts, 📌
     ╚══════════╦═══════════╝  zero Pear knowledge assumed
                │
                ▼
     ╔══════════════════════╗
     ║ 🎬  THE WALKTHROUGH   ║  2–3 min video: problem → demo → how
     ║     show the story    ║  win: 2-peer + OTA demo recorded 📌
     ╚══════════╦═══════════╝
                │
                ▼
            ✅  SUBMIT  (repo + YouTube + thread links — Fri Oct 23)
```

## 🍐 THE APP: pear-place

**One app, three levels:**

- **L1 — runs:** empty grid renders, I place pixels locally, they survive a restart (Hyperbee).
- **L2 — p2p:** two peers join the same canvas by key → a pixel placed on one appears on the
  other. No server anywhere — Hypercore replication _is_ the backend.
- **L3 — ship:** install from a `pear://` link → I release v1.1 (new palette) → it lands OTA
  mid-session on the other machine.

**Architecture (Bare first):**

- `backend/` — pure JS, zero UI imports, runs in **Bare**:
  **Autobee** (multi-writer Hyperbee: each peer appends placements to its own core,
  Autobee linearizes them into one canvas view — official how-to exists) +
  **Hyperswarm** (peer discovery + replication).
- `app/` — Electron shell from `hello-pear-electron`: the grid canvas UI, talks to the backend.
- `seeder/` — tiny CLI entry that runs the **same** backend headless in Bare → hosts the
  canvas when the creator is offline. _This is the shareable-backend extra-points proof._

**Fixed choices:** 100×100 grid · ~16-color palette · join-by-key (demo key in README) ·
client-side cooldown (1 px / 5 s, honor system) · merge = Autobee's linearized order
(fallback if Autobee fights back: per-peer cores replicated via a swarm topic, merged
deterministically — same UX, slightly more code to explain).

**The one genuinely hard part (spike it first thing on day 3):** multi-writer access —
how peers get write access to the canvas (Autobase apply/grant flow). If the grant dance
isn't smooth for an open canvas, fall back to the deterministic-merge pattern above.

## Releasing

### Cleanup and prepare the repo (rebrand + SDK) — DONE 21/oct

- [x] Windows SDK 10.0.22621 installed (winget) — makeappx/signtool needed for the .msix
- [x] `forge.config.js`: pin `windowsKitVersion: getWindowsKitVersion() ?? '10.0.22621.0'`
      (the manifest-derived one, 19045.0, will never exist as an SDK bin dir) +
      flatpak `appId: 'com.pablodevrel.PearPlace'` (prefix = our own domain, reversed)
- [x] `package.json`: `name: pear-place` · `productName: PearPlace` (no space — clean exe/paths) ·
      description / MIT license / author filled in
- [x] `flatpak/`: both files renamed to `com.pablodevrel.PearPlace.*` (git mv) +
      id/name/launchable/command/entrypoint + holepunchto screenshot removed
- [x] `build/AppxManifest.xml`: `Identity Name="PearPlace"` · exe `app\PearPlace.exe` ·
      **`Publisher="CN=Pablo"`** (matches the dev-cert subject — derived from package.json
      `author`; do NOT change author without aligning this or Windows kills OTA)
- [x] `pear.json`: `namespace: "pablorotten/pear-place"` (multisig placeholders untouched)
- [x] `agent_docs/`: storage refs updated (PearPlace; old orphan dirs = harmless)
- [x] Verification: `npm run lint` green ✔ · `npm run make` green ✔
      → **`out\PearPlace-win32-x64\PearPlace.msix` (171 MB, signed) reusable for the first ship**

### Start releasing (Pear pipeline: touch → build → stage → provision)

- [x] 1. `pear touch` → stage link `pear://hchzzy6gg…` (write key lives in
     `%APPDATA%\pear\corestores` — nothing secret goes to git; **backup copied?** still to decide where)
- [x] 2. `npm pkg set upgrade=pear://<stage-link>` — package.json now points at OUR link
- [x] 3. Dry-run (lesson learned): staging `.` from the repo root = leak (.git, plan.md,
     node_modules — stage does NOT respect .gitignore). The correct shape is staging a
     **deployment dir**, not the repo. Moved down below as the real flow.
- [x] 4. `npm run make` → distributable ready (see block above)
- [x] 5. `cd ..` (OUTSIDE the repo) → `pear build` ✔ **Build complete!**
      `pear build --package=.\pear-place\package.json --win32-x64-app .\pear-place\out\PearPlace-win32-x64\PearPlace.msix --target pear-place-1.0.0`
     → deployment dir `pear-place-1.0.0` (only /package.json + /by-arch/…)
- [x] 6. `pear stage --dry-run pear://hchzzy6gg… .\pear-place-1.0.0`
      → diff verificado: exactamente `/package.json (+2.8kB)` + `/by-arch/win32-x64/app/PearPlace.msix (+171.4MB)`, cero leaks
- [x] 7. `pear stage pear://hchzzy6gg… .\pear-place-1.0.0` → **Staging complete!**
      `^Latest: 3` · versioned link `pear://0.3.hchzzy6ggkgcx3x7owogtwg5pyohqyc74eoixd4i6ztzog3x8jmy`
      (capturado 21/oct; este tip es lo que poll-ean los peers. Pendiente: registrarlo en comentario de #12/#14)
- [x] 8. `pear info <link>` ✔
      `writable: true` · `name: pear-place` · `version 1.0.0` · `productName: PearPlace` ·
      `length: 3` · `blobs.byteLength: 171428064` · verlink = `pear://0.3.hchzzy6gg…`
- [x] 9. Boot check — `npm start`: window opens, no updater errors (dev runs `--no-updates`, the
     link only has to be valid — and it now is, ours)
- [x] 10. Provision link:
```sh
pear touch
pear provision --dry-run pear://0.3.hchzzy6ggkgcx3x7owogtwg5pyohqyc74eoixd4i6ztzog3x8jmy pear://zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto pear://0.0.zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto
pear provision pear://0.3.hchzzy6ggkgcx3x7owogtwg5pyohqyc74eoixd4i6ztzog3x8jmy pear://zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto pear://0.0.zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto
```
DONE 22/oct: provisioned verlink `pear://0.3.zjzce1hukx…`; `upgrade` repointed at the bare
provision link + rebuild ✔ (fresh signed `.msix` 22-Oct 0:50).
Gotcha 1: forge system check failed on a broken `Roaming\npm` npm shim (its user agent is
`npm/undefined`) → skipped via `~/.skip-forge-system-check` (npm 11 is allowlisted anyway; remove
the file when the shim is repaired).
Gotcha 2: the provisioned drive still carries the OLD package.json (upgrade=stage link) —
expected; re-stage catches it on the v1.1 OTA cycle in #14.
- [x] 11. Commit/PR with the versioned link in the body, closes #12 (repo rule: never commit
      without asking — confirm before doing it)

Risks / decisions already taken

- The public link lives in git (package.json/README) — it's public by design; only the write
  key is secret and NEVER touches the repo.
- One link now (stage only) and provision/OTA v1.1 in #14 — as planned; the pipeline above is
  written in its full form (stage→provision).
- The Event Viewer message (AppxPackaging/Operational) is how you diagnose `SignerSign() failed`
  — what resolved the 0x8007000B was making manifest CN = cert CN.
- (legacy from the original plan removed — replaced by this real checklist)
