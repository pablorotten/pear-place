# 📩 Assessment brief (official)

> Paste the email/instructions from Tether here **verbatim** when it arrives.
> This file is committed (public) — keep it clean and exact.

**Received:** 2026-10-19
**Deadline (5 days):** 2026-10-23 (Friday, 5 days counting today as day 1)

---

## Raw instructions

Technical Content Creator — Pear / Bare / P2P Take-Home Task

Overview

Anyone can build an app and hand it to the world as a pear:// link.
Distribution must be 100% decentralized — updates included.

1. Build the app

Using the Pear documentation, build a functional, real-world P2P application.

Make it something a real person would keep installed — an offline-first standup board for a distributed team, a file-sharing app for a film crew, a release-notes feed users subscribe to by key. Get creative with your app's functionality. Start from one of the official templates: hello-pear-electron or hello-pear-bare.

Requirements

- Built on Pear. The app installs from a pear:// link. Use the pear CLI to build, stage, and release it.
- The app uses Holepunch building blocks. For example: Hyperswarm, Hyperbee, Hyperdrive, or Autobee.
- P2P OTA updates. The app updates over the air using pear-runtime-updater.
- Bare first. The app's decentralized backend runs in Bare (see pear-runtime).

One of the strengths of the Holepunch stack is that backend code can be shared across releases of the same app — mobile, desktop, and CLI. Earn extra points by writing a backend that is genuinely shareable.

2. Write a short "Launch thread" (X/Twitter style, 5–7 posts) announcing your app to a developer audience. Assume the reader has never heard of Pear, Bare, or Holepunch.

3. Video Walkthrough
Record a 2-3 mins short video presentation demonstrating the app in action (no face shown needed). Explain the specific problem it solves and walk through your technical implementation.

---

## Deliverables

- [ ] Functional p2p app (Pear + Holepunch, decentralized distribution + OTA updates)
- [ ] 5–7 post launch thread for X/Twitter (developer audience)
- [ ] 2–3 minute walkthrough video (no face cam): problem → demo → how

## Submission format

Reply to the email with three links:

1. Repo URL (public).
2. Walkthrough video URL (YouTube).
3. Launch thread URL (X post).

## Required tech / constraints (must-do)

- **Pear app** — installs from a `pear://` link; built, staged and released with the `pear` CLI.
- **Holepunch building blocks** — e.g. Hyperswarm, Hyperbee, Hyperdrive, Autobase.
- **P2P OTA updates** — via `pear-runtime-updater`.
- **Bare first** — the decentralized backend runs in Bare (see `pear-runtime`).
- **Official template** — start from `hello-pear-electron` or `hello-pear-bare`.
- **Shareable backend** — backend code should be reusable across releases and platforms
  (mobile / desktop / CLI); this earns extra points.
- **Thread** — 5–7 posts, developer audience, assume no prior knowledge of Pear/Bare/Holepunch.
- **Video** — 2–3 minutes, no face needed, explain the problem, demo, and implementation.

## Freedom (I choose)

- App concept and domain (brief suggests: standup board, film-crew file sharing,
  release-notes feed subscribed by key).
- Which of the two official templates (Electron vs Bare).
- Data model, sync model, UI, and how the backend is framed as shareable.

## Decision (locked 2026-10-20, day 2)

- **App:** `pear-place` 🍐 — a p2p r/place: strangers paint one shared pixel canvas,
  and there is no server — the canvas *is* the network.
- **Template:** `hello-pear-electron` (a canvas needs a real UI; the backend still
  runs in Bare).
- **Stack:** Hypercore + Hyperbee via **Autobee** (multi-writer canvas view),
  Hyperswarm (discovery/replication), Electron shell, headless CLI seeder in Bare.

## Coverage check — every requirement → a checkpoint on the road

| # | Requirement | Where it happens | Planned day |
|---|---|---|---|
| 1 | Built on Pear, installs from a `pear://` link | Level 3 — stage & release with the `pear` CLI | Day 4 |
| 2 | Holepunch building blocks | Hyperbee (L1 persistence) · Hypercore + Hyperswarm (L2 sync) · Autobee (multi-writer merge) | Days 2–4 |
| 3 | P2P OTA updates via `pear-runtime-updater` | Level 3 — release v1.1 while a peer is running | Day 4 |
| 4 | Bare first — backend runs in Bare | `backend/` is a pure-JS module, runnable headless in Bare (verified from Level 1 on) | Day 2 |
| 5 | Shareable backend (extra points) | Same `backend/` powers the desktop app *and* a CLI seeder hosting the canvas | Day 4 |
| 6 | "A real person would keep installed" | Fun + offline-first; carried by the thread & video story | Day 5 |
| 7 | Launch thread (5–7 posts) | 📣 checkpoint | Day 5 |
| 8 | Video walkthrough (2–3 min) | 🎬 checkpoint — recorded right after Level 3 lands | Day 4 |
| 9 | Submission — repo / video / thread links | ✅ submit | Day 5 |

## Scoring criteria (if stated)

No numeric rubric stated. Signals from the brief:

- Functional, real-world app someone would keep installed.
- Meaningful use of the Holepunch stack, not a toy wrapper.
- Genuine decentralized distribution **and** OTA updates.
- Bare-first architecture; genuinely shareable backend = extra points.
- Clear teaching for developers who have never heard of Pear, Bare, or Holepunch.
