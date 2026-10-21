// SPIKE (issue #4) — app 1 of 2, in Bare, adapted from the official
// build-a-multiwriter-database-with-autobee guide (autobee pinned @2.2.2).
//
// Creates the Autobee, announces it on Hyperswarm, paints a pixel, and — the
// thing this spike is actually testing — AUTO-GRANTS: whenever a peer knocks
// with its writer id, this app appends the addWriter op itself. No
// `add <id>` terminal step.
//
// Run:   npx bare spike/autobee/writer.js             (create)
//   or   npx bare spike/autobee/writer.js <canvas-key>   (resume as seeder)

const process = require('bare-process')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Autobee = require('autobee')
const b4a = require('b4a')
const goodbye = require('graceful-goodbye')
const applyHandlers = require('./apply')
const { knockTopic, parseKnock } = require('./knock')

// canvas vs knock traffic needs two swarms: a hyperswarm connection does not
// carry the topic it was opened for
const swarm = new Hyperswarm()
const knock = new Hyperswarm()
goodbye(() => swarm.destroy())
goodbye(() => knock.destroy())

const canvasKey = process.argv[2]

async function main() {
  const store = new Corestore(canvasKey ? './spike-storage-peer' : './spike-storage-writer')

  const db = new Autobee(store, canvasKey || null, applyHandlers)
  await db.ready()

  // db.replicate, not store.replicate: it also registers the wakeup stream.
  // error swallowers: peers come and go constantly on an open canvas — a peer
  // disconnecting mid-replication reads as a phantom ECONNRESET, never fatal
  swarm.on('connection', (conn) => {
    conn.on('error', () => {})
    const stream = db.replicate(conn)
    stream.on('error', () => {})
    if (stream !== conn) conn.on('close', () => stream.destroy())
  })
  const discovery = swarm.join(db.discoveryKey)
  await discovery.flushed()

  const granted = new Set()

  knock.on('connection', (conn) => {
    conn.on('error', () => {}) // knock peers hang up too — same phantom reset
    conn.on('data', async (data) => {
      const writerId = parseKnock(data)
      if (writerId === null || granted.has(writerId) || !db.writable) return
      granted.add(writerId)
      console.log('knock received — auto-granting', writerId)
      try {
        await db.append(b4a.from(JSON.stringify({ addWriter: writerId })))
      } catch (err) {
        console.error('auto-grant failed:', err.message)
      }
    })
  })

  await knock.join(knockTopic(db.id)).flushed()

  console.log('canvas key:', db.id)
  console.log('auto-grant ON — knocking peers become writers')

  // genesis: paint a pixel so the canvas exists (creator role only)
  if (!canvasKey) await db.append(applyHandlers.placeOp(50, 50, 1))

  // keep linearizing slow mode arrivals
  setInterval(() => db.update().catch(() => {}), 1000)
}

main().catch((err) => {
  console.error('[writer] FAILED:', err.stack)
  Bare.exit(1)
})
