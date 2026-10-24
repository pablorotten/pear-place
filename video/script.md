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
- **Updates?:** With OTA (Over The Air) new features cost no download page, a version staged onto the same `pear://` link propagates to running peers (`pear-runtime-updater`).

## Pros & cons, expanded (spoken)

### Pros

**No server to maintain or pay for.**
"There is no server. Sounds like marketing until you unwrap it: there is no machine running this app for you. Nothing to maintain, nothing to pay for — no hosting bill, no infrastructure bill."

**Backend runs everywhere — no ops.**
"Normally a backend means ops work: provisioning servers, deployments, monitoring, patching, someone on-call when it falls over at 3 a.m. Here all of that is gone. The backend runs on every peer that's online — the deployment is a link, and running it is somebody else's machine, by choice."

**Scales with adoption — each new peer brings bandwidth/storage instead of load.**
"And it scales the other way around. On a server, every new user is load. Here, every new peer brings its own bandwidth and its own storage. The more people use it, the stronger it gets."

**No single point of failure / censorship point.**
"There is no single point of failure. No machine can crash and kill the canvas, and there is no door to knock on to shut it down. To censor it, you would have to censor everyone."

### Cons

**Cold start — first paint needs at least one peer online.**
"Finally, a cold start: the very first painter needs at least one peer already hosting the canvas. If nobody is on, there is nothing there — and nothing to paint."

**No central authority — moderation is on the swarm.**
"That power cut cuts both ways: nobody is in charge. Moderation lives on the swarm, not in an office — for better and for worse."

**Cheaters are harder to catch — no cop in the middle.**
"On a server, catching bots is a bug you patch: one cop in one place, watching every click. Here there is no cop. Every peer is its own judge — and a hacked peer can judge wrong on purpose. What still works is the gate every peer runs in consensus: rules live inside `apply()`, so placements that break the cooldown or the format are ignored by everyone else. The trick is honesty — while the honest majority follows the rule, the canvas stays clean. The cost is trust: you cannot reliably tell a bot from a human, and one person can pretend to be many. In p2p, cheating is not a bug to patch — it is someone lying, and all you can do is make sure the majority does not listen."

**Data exists only while some peer hosts it.**
"The canvas is not in a cloud. It exists only while at least one peer is hosting it — and that is exactly why the seeder exists."

**Slower sync than a single HTTP round-trip.**
"Syncing is peer-to-peer replication, not one HTTP call to a server. A pixel takes a couple of seconds to reach the other screen, not milliseconds."

**Cold start — first paint needs at least one peer online.**
"Finally, a cold start: the very first painter needs at least one peer already hosting the canvas. If nobody is on, there is nothing there — and nothing to paint."

## What if...

### There's a temporary desync between peers and 2 different branches of the canvas meet?

"Paint while you're offline — your clicks sit in your own log. Come back online, and every peer pulls that log, runs the same merge, and your pixels land on every screen in one burst. Nobody decides to accept them; the math does. A 'branch' is really just a log the others haven't seen yet — and the moment two logs meet, causality decides the one merged order, identically on every peer. Even two strangers painting the same pixel 'at the same time' resolve to the same winner everywhere — deterministically."

## How it works (spoken)

We don't save the canvas — we save the history of every click. The canvas is **derived** from that history.

Each peer stores its clicks in its own append-only log — a **Hypercore**. **Autobee** takes all those logs and derives one shared map from them — a **Hyperbee** — the same on every peer:
```js
const db = new Autobee(store, canvasKey, makeHandlers({ onPlacements: emitPlacements }))
await db.ready()
```

1. Open the app
2. Every peer running pear-note are like a bee, and we all belong to the same swarm. With **Hyperswarm** we find each other (via the DHT). Now we are connected
```js
swarm.on('connection', (conn) => { db.replicate(conn) })  // pipe with every peer, forever
await swarm.join(db.discoveryKey).flushed()  // meet peers by hash of the key
```
3. Through the pipes, I catch up: I download the other peers' logs (**Hypercores**) and draw the latest canvas.
4. Now I can start drawing, I click a pixel.
5. My click is one append to my own log. Also known as **Hypercode**
```js
async function place(x, y, color = 1) {
  ...
  await db.append(placeOp(x, y, color))
  return { x, y, color }
}
```
6. Everyone is clicking, I am not the only one. We need to share our hypercores to know where each one clicked and have the same canvas. So the bees are constantly sending their hypercores.
7. And here is where the magic happens. Even there isnt' any central authority and all the peers receive the hypercores asnycronously in a different order
8. Each peer **Autobee** is smart enought to merge the hypercores and linearizes them into ONE shared order, deterministically. 
```js
async function apply(nodes, view, host) { ... }  // Autobee calls me with THE merged order
async function update(view, changes)    { ... }  // ...and after — I compute the diff
```
9. After **Autobee** job, all the swarm have exactly the same canvas.
```js
for await (const diff of after.createDiffStream(before)) { ... }  // just the changed cells
onPlacements(placements)  // → worker → renderer: grid.paint(x, y, color)
// before/after = the view checked out at the old & new heads of this apply cycle
```
10.  No server anywhere: only logs, pipes, and the same smart merge running everywhere.

