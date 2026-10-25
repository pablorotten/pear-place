# Video script (~3 min)

## Summary

- **The idea:** r/place, but without server: peers paint one shared canvas, nothing to host or hack.
- **Client-Server vs P2P:**
  - Pros:
    - No server to maintain or pay for
    - No single point of failure / censorship point
    - Backend runs everywhere — no ops
    - Scales with adoption — each new peer brings bandwidth/storage instead of load
  - Cons:
    - No central authority — moderation is on the swarm
    - Data exists only while some peer hosts it
    - Slower sync than a single HTTP round-trip
    - Cold start — first paint needs at least one peer online
- **Live on two computers:** 
  - Install from a `pear://` link.
  - Demo how 2 computers are linked
- **How it works: follow one click.** Trace the workflow of a user clicking a pixel and how that click syncs to the other peer: renderer → worker → append to own log → Hyperswarm replication → same `apply()` on every peer → diff back to the UI.
- **Updates?: OTA (over the air) — updates from the same `pear://` link, no download page.**

## What is 🍐/place?
### First, let's talk about r/place?

- Do you remember r/place?
- That was a thing in 2023
- A virtual world war where million of people joined
- And suddently... it stopped
- The gameplay was very simple
- A shared canvas with all the users
- Find a spot
- And paint some pixels

### So what I did?

- So... I cloned it
- But... it's p2p, NO server
- And it's called Pear Place

### No server?

- Let's take a look how classic r/place works
- The canvas, it's in a centralize server
- Users, tell the server "hey, I clicked here"
- And then the server updates the canvas for everyone
- As you can see... the server is crucial here...
  
- And in Pear Place We shut it down
- Users are the server: and we call them peers





------- BELOW THIS LINE DON'T EDIT -------




1. App seeder:
```sh
pear seed pear://0.3.zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto
```
Holds the app bytes on the swarm — no server, just a peer. Runs from anywhere; the stats table shows announced.
1. Install from the swarm:
   ```sh
   pear install pear://0.3.zjzce1h7ukxcu7oqmojosby9qb3mxjfsgb97yx493jjjfxyqrpto
   ```
No download page, no store — the app is pulled from peers.
1. Launch: Start menu → PearPlace. (Dev-cert SmartScreen dialog may appear once.)
2. Canvas seeder, run live from the project folder (C:\Users\pablo\DEV\projects\pear-place):
   ```sh
   npm run seed (repo ships the demo key)
   # OR
   npx bare seeder/ a4xu9rqb1h9ybnpabs1pbengd8aonu6ks95mpyiattskdgt5d7zy
   ```

## Pros & cons, expanded

### Pros

**No server to maintain or pay for.**
There is no machine running this app for you. Nothing to maintain, nothing to pay for — no hosting bill, no infrastructure bill.

**Backend runs everywhere — no ops.**
Normally a backend means ops work: provisioning servers, deployments, monitoring, patching, someone on-call when it falls over at 3 a.m. All of that is gone: the backend runs on every peer that's online — the deployment is a link, and running it is somebody else's machine, by choice.

**Scales with adoption — each new peer brings bandwidth/storage instead of load.**
On a server, every new user is load. On the swarm, every new peer brings its own bandwidth and its own storage — the more people use it, the stronger it gets.

**No single point of failure / censorship point.**
No machine can crash and kill the canvas, and there is no door to knock on to shut it down. To censor it, you would have to censor everyone.

### Cons

**No central authority — moderation is on the swarm.**
Nobody is in charge. Moderation lives on the swarm, not in an office — for better and for worse.

**Cheaters are harder to catch — no cop in the middle.**
On a server, catching bots is a bug you patch: one cop in one place, watching every click. Here there is no cop: every peer is its own judge — and a hacked peer can judge wrong on purpose. What still works is the gate every peer runs in consensus: rules live inside `apply()`, so placements that break the cooldown or the format are ignored by everyone else. The trick is honesty — while the honest majority follows the rule, the canvas stays clean. The cost is trust: you cannot reliably tell a bot from a human, and one person can pretend to be many. In p2p, cheating is not a bug to patch — it is someone lying, and all you can do is make sure the majority does not listen.

**Data exists only while some peer hosts it.**
The canvas is not in a cloud. It exists only while at least one peer is hosting it — that is exactly why the seeder exists.

**Slower sync than a single HTTP round-trip.**
Syncing is peer-to-peer replication, not one HTTP call to a server. A pixel takes a couple of seconds to reach the other screen, not milliseconds.

**Cold start — first paint needs at least one peer online.**
The very first painter needs at least one peer already hosting the canvas. If nobody is on, there is nothing there — and nothing to paint.

## What if...

### There's a temporary desync between peers and 2 different branches of the canvas meet?

Paint while offline — clicks sit in the local log. Come back online, and every peer pulls that log, runs the same merge, and the pixels land on every screen in one burst. Nobody decides to accept them; the math does. A "branch" is really just a log the others haven't seen yet — the moment two logs meet, causality decides the one merged order, identically on every peer. Even two peers painting the same pixel "at the same time" resolve to the same winner everywhere, deterministically.

## How it works

We don't save the canvas — we save the history of every click. The canvas is **derived** from that history.

Each peer stores its clicks in its own append-only log — a **Hypercore**. **Autobee** takes all those logs and derives one shared map from them — a **Hyperbee** — the same on every peer:

1. Open the app.
2. Every peer running PearPlace holds the same canvas; together they form one swarm. **Hyperswarm** peers find each other via the DHT.
   ```js
   swarm.on('connection', (conn) => { db.replicate(conn) })  // pipe with every peer, forever
   await swarm.join(db.discoveryKey).flushed()  // meet peers by hash of the key
   ```
3. The other peers' canvas is downloaded and drawn on screen.
4. The user clicks a pixel.
5. The click is one append to the peer's own log — a **Hypercore**.
   ```js
   async function place(x, y, color = 1) {
     ...
     await db.append(placeOp(x, y, color))
     return { x, y, color }
   }
   ```
6. A **Hypercore** is a line of events — it registers every local change.
7. Everyone is clicking. Peers share their hypercores constantly to know where each one clicked and hold the same canvas.
8. There is no central authority, and all the peers receive the hypercores asynchronously, in a different order.
9. Each peer's **Autobee** merges the hypercores and linearizes them into ONE shared order, deterministically.
   ```js
   async function apply(nodes, view, host) { ... }  // Autobee calls me with THE merged order
   async function update(view, changes)    { ... }  // ...and after — the diff
   ```
10. After Autobee's job, the whole swarm has exactly the same canvas.
   ```js
   for await (const diff of after.createDiffStream(before)) { ... }  // just the changed cells
   onPlacements(placements)  // → worker → renderer: grid.paint(x, y, color)
   // before/after = the view checked out at the old & new heads of this apply cycle
   ```
11. No server anywhere: only logs, pipes, and the same smart merge running everywhere.

## How updates spread

An update — even a heavy one — is just data appended to the app's own log:

1. The app is served from a **Hyperdrive** — a peer-to-peer filesystem, like git: the current version is a snapshot of the drive, and a release is just committing new files on top. No "new installer" gets packaged — new data is appended to the app's history.
2. Every release flows through **the same two links**, minted once with `pear touch`:
   - **Stage link** — private, the writer's own, where builds are pushed.
   - **Provision link** — public, lives in the app (`package.json#upgrade`), never changes. Fresh installs and updates all come from it.

   ```json
   { "productName": "PearPlace", "version": "1.0.2", "upgrade": "pear://zjzce1h..." }
   ```
3. The release ceremony is always the same:
   ```sh
   npm version patch && npm run make && pear build ...  # build the new payload
   pear stage pear://<stage-link> <dir>     # returns the versioned link for this release
   pear provision <verlink> <provision-link> ...  # publishing — the ship moment
   pear seed <provision-link>               # stay online so peers can download it
   ```
4. `pear provision` publishes the new version on the provision link. Every running PearPlace polls that link with the embedded **`pear-runtime-updater`** (inside the app from the very first install). It sees the drive grew and announces the update in the UI — "Update ready".
5. The peer downloads the new version **from the swarm, from other peers** — same as the first install. It mirrors the app byte-for-byte, stages it locally, shows progress.
6. `applyUpdate()` — the app swaps its own drive and restarts. Packaged builds do this automatically after the updater's randomized delay; dev mode runs with `updates: false`.
7. No server here either: the update is seeded the same as the canvas — a release is a peer with the new bytes, the swarm distributes it, the updater only points at a key.

### Who serves the update — the honest model

- **Writing** stays with the developer: only the provision key can append a new version. Identity of authorship is a feature — strangers can't publish a v1.0.2 with a keylogger in the app.
- **Distribution** is p2p: connections are bi-directional, so any peer holding the blocks serves them to peers connected at that moment.
- **Availability** is never automatic: replication requires a live source, so every release needs at least one willing seeder. Three roles split the work:
  - **Founder seeder** — the guaranteed, always-on source the developer runs (`pear seed <provision-link>`). This is the one remaining dev duty.
  - **Opportunistic relays** — every peer that already has the release passes blocks to connected peers while online, then stops. A bandwidth amplifier, not an availability guarantee.
  - **Blind peers** — a third-party service that keeps the keys (`pear info`) available without ever decrypting them; no personal machine has to stay on.
- Without any seeder the update exists in principle but nobody can download it — keys persist forever, bytes don't.
- Server-world comparison: every peer whose app needs updates subtracts from the vendor's bandwidth forever. In Pear, every peer that *has* the release offsets it.
