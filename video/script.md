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
