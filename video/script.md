# Video script (~3 min)

## Summary

- **The idea:** r/place, but NO server: peers paint one shared canvas. Nothing to host, nothing to hack.
- **Client-Server vs P2P:**
  - Pros:
    - No server to maintain or pay for
    - No single point of failure or censorship point
    - Backend runs everywhere, no ops
    - Scales with adoption: each new peer brings bandwidth and storage, not load
  - Cons:
    - No central authority: moderation is on the swarm
    - Data exists only while some peer hosts it
    - Slower sync than a single HTTP round-trip
    - Cold start: first paint needs at least one peer online
- **Live on two computers:**
  - Install from a `pear://` link.
  - Show 2 computers syncing live.
- **How it works: follow one click.** From the click to the other screen: renderer → worker → own log → Hyperswarm replication → same `apply()` on every peer → diff back to the UI.
- **Updates: OTA, over the air, from the same `pear://` link. No download page.**

## What is 🍐/place?
### First, let's talk about r/place

- Do you remember r/place?
- It blew up in 2023
- A virtual world war where millions joined
- And suddenly... it stopped
- The gameplay was very simple
- One shared canvas for everyone
- Find a spot
- And paint some pixels

### So what did I do?

- So... I cloned it
- But... it's p2p, NO server
- And it's called Pear Place

### No server?

- Let's look at how classic r/place works
- The canvas lives on one centralized server
- Users tell the server, "hey, I clicked here"
- And then the server updates the canvas for everyone
- As you can see... the server is crucial here...

- And in Pear Place, we shut it down
- Users ARE the server. We call them peers

## 🍐/place in action

- First, the seeder
- This is the initial peer sharing the canvas. 
- **the birth of 🍐/place**
- And here comes the first user, our first peer
- Right we have 🍐/place running on my desktop
- And left another copy running on my laptop
- Watch: what I paint on the computer on the right
- shows up on the laptop on the left.
- All of this without a central server
- The canvas belongs to everyone, and to no one at the same time

## How does it work?

### Receiving the canvas

- Let's start from the beginning
- I open Pear Place for the very first time
- My canvas is empty
- How do I join the Pear Place network?
- I ask **Hyperswarm** to join the swarm, using the canvas key of Pear Place
- Let me explain this...
- The peers using the app are bees in the same swarm, and the key is the entrance
- I'm in. Now we're connected
- The peers send me the canvas, because remember: there is only **ONE**

### Clicking on the canvas

- Now I can start painting
- But where are my clicks stored? Where's the database?
- There is no database. 
- Every click goes into **my own** append-only log
- Two coordinates and a color, nothing else.
- That log is called **Hypercore**
- Conceptually, it's like a ledger, not a database


- I click a pixel
- A click is just two coordinates and a color
- It goes into my **Hypercore** log
- A **Hypercore** is a line of events
------- BELOW THIS LINE DON'T EDIT -------



3. A **Hypercore** is a line of events — it registers every local change.
4. Everyone is clicking. Peers share their hypercores constantly to know where each one clicked and hold the same canvas.
5. There is no central authority, and all the peers receive the hypercores asynchronously, in a different order.
6. Each peer's **Autobee** merges the hypercores and linearizes them into ONE shared order, deterministically.
   ```js
   async function apply(nodes, view, host) { ... }  // Autobee calls me with THE merged order
   async function update(view, changes)    { ... }  // ...and after — the diff
   ```
7.  After Autobee's job, the whole swarm has exactly the same canvas.
   ```js
   for await (const diff of after.createDiffStream(before)) { ... }  // just the changed cells
   onPlacements(placements)  // → worker → renderer: grid.paint(x, y, color)
   // before/after = the view checked out at the old & new heads of this apply cycle
   ```
8.  No server anywhere: only logs, pipes, and the same smart merge running everywhere.

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
