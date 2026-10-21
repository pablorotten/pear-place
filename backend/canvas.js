// The canvas "backend": one shared Autobee + Hyperswarm, zero UI imports.
// Runs anywhere — the Pear worker inside the Electron app, or headless `bare`
// (see demo.js and smoke.js). No Electron, no Pear APIs in here.
//
// One path, no branches (see ARCHITECTURE.md):
//   createCanvas(dir)          → no key: CREATE a canvas and own it
//   createCanvas(dir, key)     → key given: JOIN that canvas by key
//
// What makes it p2p (there is no server):
//   - every peer appends placements to its OWN writer core (db.local)
//   - Autobee linearizes every writer's ops into one shared view
//   - peers find each other on the swarm topic = db.discoveryKey (a hash of
//     the canvas key — the key itself is never broadcast)
//   - joining strangers are read-only until a writable peer auto-grants them
//     (backend/knock.js); the grant is just another op in shared history

const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const Autobee = require('autobee')
const b4a = require('b4a')
const { SIZE } = require('../shared/canvas-size.js')
const { makeHandlers, placeOp, cellKey, parseCellKey, parseColor } = require('./apply')
const { knockTopic, knockMessage, parseKnock } = require('./knock')

const REKNOCK_EVERY = 5000 // joiner re-knocks until some writable peer grants
const APPLY_TICK = 1000 // belt-and-braces linearize pass, like the spike

module.exports = async function createCanvas(dir, canvasKey = null) {
  const store = new Corestore(dir)
  await store.ready()

  const placementsListeners = new Set()
  const writableListeners = new Set()

  const db = new Autobee(store, canvasKey, makeHandlers({ onPlacements: emitPlacements }))
  await db.ready()

  function emitPlacements(placements) {
    for (const listener of placementsListeners) listener(placements)
  }
  function emitWritable(writable) {
    for (const listener of writableListeners) listener(writable)
  }

  // --- the network: two swarms (a connection doesn't carry its topic) ---------

  // replication: db.replicate (NOT store.replicate — that one skips the
  // wakeup stream that makes new remote ops trigger an apply cycle)
  const swarm = new Hyperswarm()
  swarm.on('connection', (conn) => {
    conn.on('error', () => {}) // peers hang up mid-replication all the time
    const stream = db.replicate(conn)
    stream.on('error', () => {})
    if (stream !== conn) conn.on('close', () => stream.destroy())
  })
  // the topic is a hash of the canvas key: peers meet by hash, then verify
  await swarm.join(db.discoveryKey).flushed()

  // the knock channel: strangers hand over their writer id, writable peers
  // auto-grant them by appending an addWriter op into shared history
  const knock = new Hyperswarm()
  const granted = new Set()
  knock.on('connection', (conn) => {
    conn.on('error', () => {}) // knock peers hang up too — same phantom reset
    // read-only peers knock on EVERY knock connection (in- and outbound)
    if (!db.writable) {
      try {
        conn.write(knockMessage(db.local.id))
      } catch {}
    }
    conn.on('data', async (data) => {
      const writerId = parseKnock(data)
      if (writerId === null || granted.has(writerId) || !db.writable) return
      granted.add(writerId)
      console.log('[canvas] knock heard — auto-granting', writerId)
      try {
        await db.append(b4a.from(JSON.stringify({ addWriter: writerId })))
      } catch (err) {
        console.error('[canvas] auto-grant failed:', err.message)
      }
    })
  })
  await knock.join(knockTopic(db.id)).flushed()

  // --- joiner lifecycle: knock until some writable peer grants us -------------

  // the knock discovery is already live (joined above); a missed first knock
  // gets retried by re-refreshing the lookup until 'writable' fires
  const knockDiscovery = knock.status(knockTopic(db.id))
  if (!db.writable) {
    console.log('[canvas] joined read-only — knocking for write access')
    const reknock = setInterval(() => {
      if (db.writable) return
      knockDiscovery.refresh({ client: true, server: true }).catch(() => {})
    }, REKNOCK_EVERY)
    db.on('writable', () => clearInterval(reknock))
  }

  db.on('writable', () => emitWritable(true))

  // keep linearizing arrivals the wakeup stream might have missed (spike lesson)
  const tick = setInterval(() => db.update().catch(() => {}), APPLY_TICK)

  // --- the canvas API ----------------------------------------------------------

  async function place(x, y, color = 1) {
    x = Math.floor(x)
    y = Math.floor(y)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null
    if (color !== 0 && color !== 1) return null
    if (!db.writable) return null
    await db.append(placeOp(x, y, color))
    return { x, y, color }
  }

  async function get(x, y) {
    const entry = await db.view.get(cellKey(x, y))
    if (entry === null) return null
    return { x, y, color: parseColor(entry.value) }
  }

  async function placements() {
    const all = []
    for await (const entry of db.view.createReadStream()) {
      const { x, y } = parseCellKey(entry.key)
      all.push({ x, y, color: parseColor(entry.value) })
    }
    return all
  }

  function onPlacements(listener) {
    placementsListeners.add(listener)
    return () => placementsListeners.delete(listener)
  }

  function onWritable(listener) {
    writableListeners.add(listener)
    listener(db.writable) // current truth first, changes after
    return () => writableListeners.delete(listener)
  }

  async function close() {
    clearInterval(tick)
    await knock.destroy()
    await swarm.destroy()
    await db.close()
    await store.close()
  }

  return {
    place,
    get,
    placements,
    onPlacements,
    onWritable,
    close,
    size: SIZE,
    key: db.id, // THE shareable invite (see ARCHITECTURE.md)
    get writable() {
      return db.writable
    }
  }
}
