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

- The whole swarm is clicking
- Each peer appends clicks to its own **Hypercore**
- Here's the magic:
- Each peer's **Autobee** merges the different Hypercores into a single order
- Every peer does the merge locally
- All of them end up with the same result
- and therefore the same canvas
- Peers keep sharing and merging logs, constantly.

## OTA

### Classic system

- I ship a new version of the app — Pear Place 1.0.2
- In the classic way
- I just push the update to the marketplace
- And that central server distribute it to every user"