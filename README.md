# 🍐/place (pear-place)

<p align="center">
  <img src="assets/logo.png" alt="PearPlace logo" width="256">
</p>

A p2p [r/place](https://www.reddit.com/r/place/) clone. Anyone can paint one shared pixel canvas, and there is no server: the canvas _is_ the network.

Built with [Pear](https://pear.run) · [How canvases work](./ARCHITECTURE.md)

- Stage key: pear://hchzzy6ggkgcx3x7owogtwg5pyohqyc74eoixd4i6ztzog3x8jmy
- Provision key: pear://zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto

## Run it: the canvas outlives its creator

There is no server. Peers join a canvas by its **key** — the app ships with the
demo canvas key (`shared/canvas-key.js`) — and the canvas is hosted by whoever
is running: the desktop app when it is open, the **seeder** when it is not.

```sh
# terminal 1: the seeder — a headless host in Bare, no window
npm run seed

# terminal 2: peer one — a desktop window
npm start

# terminal 3: peer two — an INDEPENDENT instance (own storage + writer identity)
npm run start:two
```

Paint in peer one: within a couple of seconds the pixel appears in peer two —
and the other way around. Both windows show the same canvas key in the status
line; each repaint is the Autobee `update(view, changes)` diff reaching the
renderer, never a rescan of the grid.

Now close both windows. The seeder keeps the canvas up: a brand-new peer can
still join by the key, receive the full canvas, and paint — the seeder holds
**grant power** and auto-grants newcomers (the knock channel). On a machine
that never minted this canvas, host it the same way (invoke the bare CLI
directly so the key reaches the seeder — npm eats arguments after `--` on some
shells):

```sh
npx bare seeder/ <canvas-key from shared/canvas-key.js>
```

The first join is read-only — the seeder knocks and waits for a writable peer
to grant it. Once granted, that grant lives in the shared history: kill the
process, start it again, and it comes back writable with zero ceremony.

### Run your own canvas

```sh
npx bare seeder/ --exit      # mint a canvas, print the key, stop
# paste the printed key into shared/canvas-key.js (DEMO_CANVAS_KEY) and rebuild
```

Only appending is gated: anyone with the key can read the canvas immediately,
and any writable peer auto-grants newcomers (the knock channel). See
[ARCHITECTURE.md](./ARCHITECTURE.md) for why that works with no server.

## Install the app from the p2p network (any Windows machine)

The app is distributed as a `pear://` link — no store, no download page. The
package (an `.msix` signed with a self-signed dev cert) sits on the swarm; a
seeder must be online for the bytes to exist.

```sh
# 0. once, on the machine that holds the app (until a VPS takes over):
pear seed pear://zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto

# 1. on the machine installing: install Pear from https://install.pears.com
# 2. trust the dev signing cert (public half only — shipped in this repo)
Invoke-WebRequest -Uri https://raw.githubusercontent.com/pablorotten/pear-place/main/PearPlace-dev.cer -OutFile PearPlace-dev.cer
Import-Certificate -FilePath .\PearPlace-dev.cer -CertStoreLocation Cert:\LocalMachine\Root
#    (one-time, needs an admin shell — self-signed root, no CA vouching)

# 3. install the app from the swarm
pear install pear://0.3.zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto
```

Then open **PearPlace** from the Start menu. Updates propagate **over the
air**: when a new version is staged+provisioned onto that same link, installed
apps pick it up without reinstalling.

> Why the cert step: Windows verifies the msix signature against anchors it
> trusts. Our dev cert is self-signed, so each machine imports its public half
> once — until the app ships with a code-signing cert from a public CA.

### First paint needs the canvas alive (p2p ≠ storage in the cloud)

Two different seeders, both needed, both just peers:

| Seeder                    | Serves                        | Run with                          |
| ------------------------- | ----------------------------- | --------------------------------- |
| the **binary** seeder     | the app installer (`.msix`)   | `pear seed pear://zjzce1h…`       |
| the **canvas** seeder     | placements + write grants     | `npm run seed`                    |

If the window opens and clicks say `rejected`, the canvas seeder isn't
running — start `npm run seed` and the knock gets an answer.

Project board: https://github.com/users/pablorotten/projects/7/views/1