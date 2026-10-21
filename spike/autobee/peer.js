// SPIKE (issue #4) — app 2 of 2, in Bare, adapted from the official
// build-a-multiwriter-database-with-autobee guide (autobee pinned @2.2.2).
//
// Joins an existing canvas by key as a READ-ONLY peer, then — the thing this
// spike is actually testing — knocks with its writer id and waits for the
// auto-grant to arrive in shared history. When `writable` fires it paints a
// pixel with NO manual step anywhere.
//
// Run:  npx bare spike/autobee/peer.js <canvas-key>

const process = require('bare-process')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Autobee = require('autobee')
const goodbye = require('graceful-goodbye')
const applyHandlers = require('./apply')
const { knockTopic, knockMessage } = require('./knock')

const canvasKey = process.argv[2]
if (!canvasKey) throw new Error('provide a canvas key')

const swarm = new Hyperswarm()
const knock = new Hyperswarm()
goodbye(() => swarm.destroy())
goodbye(() => knock.destroy())

async function main() {
  const store = new Corestore('./spike-storage-peer')

  const db = new Autobee(store, canvasKey, applyHandlers)
  await db.ready()

  // db.local is this peer's own writer core; its id is what a writer needs
  console.log('writer id:', db.local.id)

  swarm.on('connection', (conn) => {
    conn.on('error', () => {})
    db.replicate(conn)
  })
  await swarm.join(db.discoveryKey).flushed()

  // knock: hand our writer id to any writable peer listening there
  knock.on('connection', (conn) => conn.write(knockMessage(db.local.id)))
  await knock.join(knockTopic(canvasKey)).flushed()

  // wait for topic lookups to settle before deciding we're read-only
  await swarm.flush()
  await db.update()

  if (!db.writable) {
    console.log('read-only — knocked, waiting for the auto-grant to replicate back')
    await new Promise((resolve, reject) => {
      db.once('writable', resolve)
      setTimeout(() => reject(new Error('never became writable')), 45000)
    })
  }

  console.log('now writable — painting pixel 20,20')
  await db.append(applyHandlers.placeOp(20, 20, 3))
  console.log('done — stranger painted with ZERO manual grants')

  await db.close()
  Bare.exit(0)
}

main().catch((err) => {
  console.error('[peer] FAILED:', err.stack)
  Bare.exit(1)
})
