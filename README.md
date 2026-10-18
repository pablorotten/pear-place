# {APP NAME}

> One-line pitch: A p2p {what it does} that {why it matters}, built on Pear and the Holepunch stack — no servers, no accounts, no middlemen.

---

## 🤔 The problem

{Describe the pain in 2–4 sentences. Who feels it? Why do the usual apps fail them?}

## 💡 What it does

- {Capability 1}
- {Capability 2}
- {Capability 3}

## 🧠 Why p2p / why Pear

{Explain the "no server" angle plainly. e.g. data lives with the user, works offline,
nobody can switch it off, peers talk directly to peers.}

## 🏗️ How it's built

| Layer          | Tech                                       |
| -------------- | ------------------------------------------ |
| Runtime & ship | [Pear](https://pear.run)                   |
| Data / storage | Hypercore · Hyperbee · Hyperdrive          |
| Backend (p2p)  | Hypercore replication — there is no server |
| App shell      | {Electron / React Native / Bare}           |
| Language       | JavaScript / TypeScript on Node.js         |

## 🚇 Architecture

```
        ┌──────────────┐      p2p (no server)      ┌──────────────┐
        │  Peer A app  │ ◀───────────────────────▶ │  Peer B app  │
        │  (your app)  │   Hypercore replication   │  (your app)  │
        └──────┬───────┘                           └──────┬───────┘
               │ local Hyperbee/Hyperdrive                │
               ▼                                          ▼
  [ your data, on your disk ]                  [ their data, on theirs ]
```

## 🚀 Getting started

```bash
# Install the Pear runtime (once):
npm i -g pear

# Clone and run:
git clone <this-repo-url>
cd tether-assessment
npm install
pear run .
```

## 🛰️ Distribution & OTA

{Pear apps ship peer-to-peer. Explain how someone gets your app from a link,
and how you push a new version over the air without them reinstalling.}

```bash
# Stage & release a new version (fill in once wired):
# pear stage .
# pear release .
```

## 🗺️ Roadmap

- [ ] App runs locally (Level 1)
- [ ] App syncs with a peer over p2p (Level 2)
- [ ] Decentralized distribution + over-the-air updates (Level 3)
- [ ] Launch thread + walkthrough video

## 🙌 Feedback

Built as a technical assessment for Tether. Issues and ideas welcome.

## 📄 License

[MIT](./LICENSE) © 2026 Pablo
