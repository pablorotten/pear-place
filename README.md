# 🍐/place (pear-place)

A p2p [r/place](https://www.reddit.com/r/place/) clone. Anyone can paint one shared pixel canvas, and there is no server: the canvas _is_ the network.

Built with [Pear](https://pear.run) · [How canvases work](./ARCHITECTURE.md)

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

Project board: https://github.com/users/pablorotten/projects/7/views/1
