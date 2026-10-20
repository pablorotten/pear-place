# How pear-place works

## One canvas = one key

A canvas is an [Autobee](https://docs.pears.com/p2p/reference/building-blocks/autobee/):
a multi-writer Hyperbee. Each peer appends its placements to its **own** local
Hypercore, and Autobee linearizes those cores into **one view** every peer derives
identically. There is no server — the "backend" is this replication.

```
Peer A core ─┐
Peer B core ─┼─▶ Autobee linearizes ─▶ one shared canvas view
Peer C core ─┘
```

## How peers find each other

From the canvas key you derive a `discoveryKey` (a hash of the key). That hash is
the **topic** peers join in the Hyperswarm DHT: "who else cares about this topic?"
The key itself is never broadcast — peers connect by the hash, then replicate and
verify against the real key.

## Creator vs joiner

- **Creator:** whoever starts without a key creates a canvas (a fresh Autobee) and
  holds the original writer core.
- **Joiner:** everyone else passes the canvas key and replicates the whole canvas.

The code is one path: **no key → create and print it · key given → join.**

## The invite is the key

The demo canvas key lives in the [README](./README.md) — installing the app and
having the key are the same act. Anyone can also start their own canvas with the
same code: run it once without a key and you hold a new one.

## Naming ≠ hosting

The key only _names_ the canvas; the original writer core lives on the disk of
whoever created it. If that peer goes offline, new joiners find peers but can't
fetch history. That's what the **seeder** is for: the same backend, headless in
Bare, hosting the canvas when the creator's app is closed.

## In the app

`backend/` takes an optional canvas key:

- `bare seeder/` → creates a canvas, prints its key (creator/seeder mode)
- `bare seeder/ <key>` → joins an existing canvas

The desktop app ships with the demo canvas key as its default.
