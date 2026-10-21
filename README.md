# 🍐/place (pear-place)

A p2p [r/place](https://www.reddit.com/r/place/) clone. Anyone can paint one shared pixel canvas, and there is no server: the canvas _is_ the network.

Built with [Pear](https://pear.run) · [How canvases work](./ARCHITECTURE.md)

## Run it: two peers paint one canvas

There is no server. Peers join a canvas by its **key** — the app ships with the
demo canvas key (`shared/canvas-key.js`), and a headless peer hosts the canvas
when the desktop app is closed.

```sh
# terminal 1: headless peer hosting the demo canvas (shares history + grants)
npm run demo -- <canvas-key from shared/canvas-key.js>

# terminal 2: peer one — a desktop window
npm start

# terminal 3: peer two — an INDEPENDENT instance (own storage + writer identity)
npm run start:two
```

Paint in peer one: within a couple of seconds the pixel appears in peer two —
and the other way around. Both windows show the same canvas key in the status
line; each repaint is the Autobee `update(view, changes)` diff reaching the
renderer, never a rescan of the grid.

### Run your own canvas

```sh
npm run demo -- --exit       # mint a canvas, print the key, stop
# paste the printed key into shared/canvas-key.js (DEMO_CANVAS_KEY) and rebuild
```

Only appending is gated: anyone with the key can read the canvas immediately,
and any writable peer auto-grants newcomers (the knock channel). See
[ARCHITECTURE.md](./ARCHITECTURE.md) for why that works with no server.

Project board: https://github.com/users/pablorotten/projects/7/views/1
