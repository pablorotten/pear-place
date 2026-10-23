# App updates via OTA

When you release a new version of your app... how is it distributed?

## Prerequisites

- The [stage link](https://docs.pears.com/p2p/getting-started/build-a-peer-to-peer-chat/ship/#touch-set-the-upgrade-link-and-seed) of your app when you did `pear touch` shipping your app: `pear://<stage-link>`  shipped your app. This is also called `<target-link>`
  - 

## Code changes

Do your changes in the code. Then Run the app locally and test the changes:
```sh
npm start
```

Update the version in `package.json` and `package-lock.json `
```json
{
  "name": "your-app",
  "productName": "Your App",
  "version": "1.0.3",
  "upgrade": "pear://zjzce1h7...
  ...
```

And finally, commit your changes

## Build

Build the app and the installer
```sh
# Compile the app
npm run make
# Generate the installer outside the repo folder
cd ..
pear build --package=.\your-app\package.json --win32-x64-app .\your-app\out\YourApp-win32-x64\YourApp.msix --target your-app-1.0.3
```

This creates exactly 2 files:
- `package.json` with current version
- `YourApp.msix` the app installer 

## Release

Save the installer and package files INTO the `Hyperdrive`, so they can be shared in the P2P network

```sh
pear stage --dry-run pear://<stage-link> your-app-1.0.3
# If shows only the 2 files it's OK
# + /package.json (+2.8kB)
# + /by-arch/win32-x64/app/YourApp.msix (+171.4MB)
pear stage pear://<stage-link> your-app-1.0.3
```

The command will generate a [verlink](https://docs.pears.com/pear/reference/pear/cli/#pear-stage-link-dir) with the format: `pear://<fork>.<length>.<key>`

Something like:
```
* Staging pear-place

[  pear://hchzzy6ggkgcx3x7o...  ]
pear://0.5.hchzzy6ggkgcx3x7o...
```

And finally the [production release](https://docs.pears.com/pear/reference/pear/cli/#production-releases). 

pear provision <source-verlink> <target-link> <production-verlink>

`pear provision <stage-verlink> <provision-link> <prev-production-verlink>`
     → moves the release pointer on the public `zjzce1h` line. **Without
     provision the release never triggers.** Third arg = the CURRENT
     production verlink to sync against (`pear://0.0.<provision-key>` is the
     bootstrap placeholder when production doesn't exist yet — the tutorial
     names it, later releases pass the live tip, e.g. `pear://0.3.zjzce1h…`).
  7. 🌰 **Seed the line(s) your clients ACTUALLY poll** — release-side logic
     says "seed the provision link", but the CLIENT-SIDE trap (this release
     bit for real, see the stranded-clients note below): seeds must cover
     every link a live install is still polling, not just the head.
     - `pear seed pear://zjzce1h…` — serves the provision line: future
       installs, and every snapshot whose `upgrade` points at it (the
       corrected one we fixed).
     - `pear seed pear://hchzzy…` — serves the stage line: the escape hatch
       for snapshots provisioned BEFORE the `upgrade` repoint fix (our
       installed 0.3s poll it found the v1.0.1 tip and applied itself).
     - keep `npm run seed` alive the whole time (canvas seeder — same host,
       two different payloads).
     "Stage works anywhere; serving does not" — if `pear seed --json` says
     `firewalled: true` + `upload.totalBytes: 0`, nobody can download the
     update. Note: `Firewalled: true` also shows in the docs' healthy sample
     output while peers are 0 — peers connecting is the real evidence.
  8. After provisioning, machine A's installed app should also pull it.
      (`pear build`/stage/provision/seed change NO repo files — nothing to
      commit here; the tip lives on the stage keypair, not in git.)
  9. 🔑 **COMMIT POINT 2 — if the OTA cycle needed a fix along the way**
      (README corrections, update-UI tweaks): commit right after it works,
      before re-staging, so the story clean-up rides the next stage.
      Machine A self-update alone doesn't earn a commit.

- **🌰 The stranded-clients lesson (v1.0.1's actual debugging):** an
  installed snapshot is stuck polling whatever `upgrade` link *its own*
  package.json was provisioned with. Restaging + reprovisioning corrects
  the FUTURE of that line but strands peers already running an old
  snapshot — the only way an already-running peer can move is an update
  served on the very line its stale snapshot points at. Symptom of the
  trap: `pear seed <provision-link>` happy and healthy, both installed
  apps at Peers 0 forever, updater silent on every relaunch. Diagnosis
  that cracked it: `pear dump pear://0.3.zjzce1h… <tmpdir>` and read the
  snapshot's OWN package.json — `upgrade` still the stage link
  (`hchzzy…`, plan.md's Gotcha 2, never rolled to the deployed
  install-tree). Fix: seed the stale line (`pear seed pear://hchzzy…`)
  and the 0.3s pull v1.0.1 from `0.5.hchzzy…`, apply, relaunch into the
  corrected bundle → re-anchor to `zjzce1h…`. Release flow won't miss
  this kind of hole in the future: before calling an OTA done, dump the
  runnings' broadest-installed snapshot, read its upgrade, seed THAT
  line too if it differs from the provision link.

- **On machine B (a real peer, never reinstalled anything):**
  - Watch the runtime cycle: `update-scheduled` → `updating` → `updated` →
    `applyUpdate` → relaunch. **Relaunching is the reliable trigger** — a
    fresh boot check is immediate; only the post-append check has a delay.
  - After relaunch, the three signals: title reads `🍐/place v1.0.1`,
    window is bigger, canvas intact (`place/<key>` lives under userData —
    `fsx.swap`/`addPackage` never touch storage).
  - Trigger it mid-painting, no reinstall, canvas readable after relaunch —
    only then close issue #14.
  - Machine B runs packaged → production ~1h appends delay applies there;
    the dev `delay: 0` shortcut is for dev runs with updates enabled, not
    for machine B. Relaunch app to shortcut the wait.
  - 🔑 **COMMIT POINT 3 — the release proof.** Machine B confirmed the OTA →
    merge the PR / push, close #14. This is the real "done": version v1.0.1
    landed over the air on a machine that never reinstalled anything.
