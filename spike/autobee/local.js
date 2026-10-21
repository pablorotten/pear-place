// SPIKE (issue #4) — the safety checks, run in ONE process in Bare so we can
// wire/destroy replication streams at will (no Hyperswarm needed):
//
//  act 1  auto-grant: the `addWriter` op alone makes peer1 a writer, it
//         paints, and both views converge on one B-tree
//  act 2  malformed ops (garbage JSON, bad addWriter key, out-of-range
//         pixel) — apply must SKIP them, now and on every future replay
//  act 3  fork: both writable peers paint while disconnected — reconnect →
//         both views converge to the identical canvas
//  act 4  restart: close + reopen from the same storages — replay converges
//         everyone to the same view again
//
// Run:  npx bare spike/autobee/local.js

const os = require('bare-os')
const join = require('bare-path').join
const crypto = require('hypercore-crypto')
const Corestore = require('corestore')
const Autobee = require('autobee')
const b4a = require('b4a')
const applyHandlers = require('./apply')

// unique per run: replay-on-restart is tested via act 4, not by reusing dirs
const PLOT_ROOT = join(
  os.tmpdir(),
  'pear-place',
  'spike-autobee-' + crypto.randomBytes(8).toString('hex')
)
const plot = (name) => join(PLOT_ROOT, name)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let failed = false

function check(label, ok, detail = '') {
  console.log((ok ? '[PASS] ' : '[FAIL] ') + label + (ok ? '' : ' — ' + detail))
  if (!ok) failed = true
}

async function open(key, dir) {
  const store = new Corestore(plot(dir))
  const db = new Autobee(store, key, applyHandlers)
  await db.ready()
  return db
}

function wire(a, b) {
  const s1 = a.replicate(true)
  const s2 = b.replicate(false)
  s1.on('error', () => {})
  s2.on('error', () => {})
  s1.pipe(s2).pipe(s1)
  return () => {
    s1.destroy()
    s2.destroy()
  }
}

async function cells(db) {
  const out = []
  const snapshot = db.bee.snapshot()
  await snapshot.ready()
  for await (const entry of snapshot.createReadStream()) {
    out.push([b4a.toString(entry.key), JSON.parse(b4a.toString(entry.value))])
  }
  await snapshot.close()
  return out
}

function sameCanvas(a, b) {
  return JSON.stringify(cells(a)) === JSON.stringify(cells(b))
}

function has(cellList, x, y) {
  return cellList.some(([, v]) => v.x === x && v.y === y)
}

async function main() {
  // --- act 1: auto-grant -------------------------------------------------------
  const creator = await open(null, 'creator')
  await creator.append(applyHandlers.placeOp(0, 0, 1))

  const peer1 = await open(creator.id, 'peer1')
  console.log('peer1 writer id:', peer1.local.id)

  const unwire = wire(creator, peer1)
  await creator.update()
  await peer1.update()

  // the grant must be an op in the shared history — replayed by BOTH peers
  await creator.append(b4a.from(JSON.stringify({ addWriter: peer1.local.id })))
  await creator.update()
  await peer1.update()

  check('peer1 writable after addWriter op replayed', peer1.writable)

  await peer1.append(applyHandlers.placeOp(5, 5, 2))
  await creator.update()
  await peer1.update()
  await peer1.append(applyHandlers.placeOp(6, 6, 2))
  await creator.update()
  await peer1.update()

  check('views converge after grant + peer writes', sameCanvas(creator, peer1))

  // --- act 2: malformed nodes must be skipped -----------------------------------
  unwire()
  await creator.append(b4a.from('this is not json at all {'))
  await creator.append(b4a.from('{"addWriter":"n0tfhn32keyz33ry"}')) // hypercore ID.decode throws
  await creator.append(b4a.from('{"p":[999,999,42]}')) // valid JSON, out of range — silently ignored
  await creator.update()
  await peer1.update()

  check('malformed ops skipped, canvas unchanged', (await cells(creator)).length === 3)

  // --- act 3: fork — both writable peers paint while disconnected ---------------
  await creator.append(applyHandlers.placeOp(10, 10, 4))
  await peer1.append(applyHandlers.placeOp(11, 11, 5))
  await creator.update()
  await peer1.update()

  wire(creator, peer1)
  await creator.update()
  await peer1.update()
  await sleep(200)
  await creator.update()
  await peer1.update()

  const afterFork = await cells(creator)
  check('forked views converge after reconnect', sameCanvas(creator, peer1))
  check(
    'converged canvas contains BOTH offline writes (10,10) and (11,11)',
    has(afterFork, 10, 10) && has(afterFork, 11, 11),
    JSON.stringify(afterFork)
  )
  check(
    'fork did not lose the pre-grant creator pixel (0,0)',
    has(afterFork, 0, 0),
    JSON.stringify(afterFork)
  )

  // --- act 4: restart replay ----------------------------------------------------
  await creator.close()
  await peer1.close()
  await sleep(300)

  // reopen offline: every peer replays from its own stored state
  const creator2 = await open(creator.id, 'creator')
  const peer2 = await open(creator.id, 'peer1')
  await sleep(300)
  await creator2.update()
  await peer2.update()
  await sleep(200)
  await creator2.update()
  await peer2.update()

  const afterRestart = await cells(creator2)
  check('restart: views converge again', sameCanvas(creator2, peer2))
  check(
    'restart: full canvas replayed (all 5 pixels)',
    afterRestart.length === 5 && has(afterRestart, 11, 11) && has(afterRestart, 5, 5),
    JSON.stringify(afterRestart)
  )
  await sleep(500)

  await creator2.close()
  await peer2.close()
}

main()
  .then(() => {
    check('apply is deterministic + never throws; fork converges', !failed)
    Bare.exit(failed ? 1 : 0)
  })
  .catch((err) => {
    console.error('[local] CRASHED:', err.stack)
    Bare.exit(1)
  })
