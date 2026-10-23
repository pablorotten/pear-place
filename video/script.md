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

We don't store the information in a DB, we store it in a log we share with all the peers.

This log is called **Hypercore** and is managed by **Autobee**:
```js
const db = new Autobee(store, canvasKey, makeHandlers({ onPlacements: emitPlacements }))
await db.ready()
```

1. Open the app.
2. It joins the swarm — finds peers holding the canvas, by the hash of the key.
3. It opens a pipe with each one (this lasts the whole session).
4. Through the pipes, my log grows: I download the other peers' logs, and mine gets shared out.
5. I merge all the logs I have — Autobee, deterministic, same result everywhere.
6. From the merged timeline I derive the canvas — and I draw it. (Late joiner? I fast-forward through history and draw the latest version.)
7. I click a pixel.
8. My click is one append to my own log — instant, local, shared out the open pipes immediately.
```js
async function place(x, y, color = 1) {
  ...
  await db.append(placeOp(x, y, color))
  return { x, y, color }
}
```
9. Their clicks keep arriving the same way — async, maybe out of order, doesn't matter.
10. The merge runs again on every peer — same rules, same order, same result.
11. The diff flies to the screen — my pixel appears. On mine and theirs, same moment.
12. No server anywhere: only logs, pipes, and the same merge running everywhere.

