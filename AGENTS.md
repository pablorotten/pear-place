# AGENTS.md

Context for any AI assistant opened in this repo. Read this first, then read
`assessment.md` (the official brief — filled in once the assessment lands)
and `plan.md` (the picture + reasoning) before responding.

## What this is

A **technical assessment for Tether** (Developer Relations / Technical Content
Creator). Three deliverables that are really **one story in three acts**:

1. A **functional p2p app** built on **Pear + the Holepunch stack** (Hypercore,
   Hyperbee, Hyperdrive, Bare), including **decentralized distribution and
   over-the-air (OTA) updates**.
2. A **5–7 post launch thread** for X/Twitter aimed at developers.
3. A **2–3 minute walkthrough video** (no face cam needed): problem → demo → how.

Time budget: **5 days** from when the assessment lands.

## The road (see plan.md for the full picture)

One app leveling up — not three products:

- **Level 1 — App runs:** opens, works locally on one machine. No network.
- **Level 2 — App goes p2p:** syncs data between peers. There is **no server**;
  the "backend" is the app replicating over Hypercore.
- **Level 3 — Distribute + OTA:** another peer installs it from a link, and a new
  version propagates over the air.
- Then: **launch thread** → **walkthrough video** → **submit**.

Context: the author previously built **PearNote** (`../PearNote`) — this app is an
evolution of that learning, not a from-scratch new idea.

## Tech & conventions

- **Language:** JavaScript / TypeScript on **Node.js** (production-level, clean, explained).
- **Stack:** Pear runtime + Holepunch modules (Hypercore / Hyperbee / Hyperdrive / Bare).
- App shell: TBD (Electron / React Native / Bare) — confirm before assuming.
- Prefer the idiomatic Pear/Holepunch patterns over generic Node patterns.
- Code should be **readable and teachable** — it doubles as content for the thread/video.

## Repo rules

- This repo is **public** (it is part of the submission). Keep it presentable.
- License: **MIT**.
- **Commit early, commit often**, with messages that tell the story (the history is read).
- **Never commit or push unless explicitly asked.**
- `plan.md` is **gitignored** (personal notes) — do not commit it.
- `assessment.md` is **NOT ignored** — it holds the official brief and IS committed.
  Keep the raw instructions there verbatim.
- The README is a **deliverable**: treat it as a developer tutorial, not boilerplate.
