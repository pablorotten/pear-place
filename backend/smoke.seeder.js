// Ticket #6 smoke check, headless: the seeder keeps the canvas up after the
// creator is gone — and keeps grant power across restarts.
//
//  1. a creator mints a canvas; the seeder joins it BY KEY: read-only →
//     knock → auto-grant. The creator then CLOSES (creator gone)
//  2. the seeder restarts on the same storage: its grant lives in shared
//     history, so it must come back writable with zero ceremony
//  3. a brand-new peer joins the resumed seeder by key → granted → paints
//     → and reads the first act's pixel back: it received the full canvas,
//     hosted by the seeder alone
//
// That is the ticket's done-when, minus the desktop app: creator closes →
// seeder running → fresh peer joins by key → gets the full canvas and paints.
//
// Run with: npm run smoke:seeder   (= `bare backend/smoke.seeder.js`)

const fs = require('bare-fs')
const join = require('bare-path').join
const goodbye = require('graceful-goodbye')
const { persistent } = require('bare-storage')
const createCanvas = require('./canvas')

// wipe storage every run: the acts paint fixed cells, so stale state from a
// previous run would already be in every view and nothing would "arrive"
const base = join(persistent(), 'pear-place', 'smoke-seeder')
const dirCreator = join(base, 'creator')
const dirSeeder = join(base, 'seeder')
const dirForeign = join(base, 'foreign')
const dirFresh = join(base, 'fresh')

let canvases = []
goodbye(async () => {
  for (const canvas of canvases) await canvas.close()
})

const GRANT_TIMEOUT = 30000 // first join: DHT lookup + knock + grant roundtrip
const PAINT_TIMEOUT = 15000 // connected peers: should be far under the 2s budget

function waitFor(listenerApi, test, what, timeout) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(what + ' — timed out after ' + timeout + 'ms'))
    }, timeout)
    const off = listenerApi((batch) => {
      const hit = batch.find(test)
      if (!hit) return
      cleanup()
      resolve({ hit, ms: Date.now() - started })
    })

    function cleanup() {
      clearTimeout(timer)
      off()
    }
  })
}

async function waitWritable(canvas, what) {
  if (canvas.writable) return
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off()
      reject(new Error(what))
    }, GRANT_TIMEOUT)
    const off = canvas.onWritable((writable) => {
      if (!writable) return
      clearTimeout(timer)
      off()
      resolve()
    })
  })
}

async function main() {
  for (const dir of [dirCreator, dirSeeder, dirForeign, dirFresh]) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  console.log('[smoke:seeder] storage:', base)

  // --- act 1: the creator mints, the seeder joins by key and gets granted -----
  const creator = await createCanvas(dirCreator)
  canvases.push(creator)
  if (creator.writable !== true) throw new Error('creator should be writable from birth')
  console.log('[smoke:seeder] creator minted canvas', creator.key)

  const seeder = await createCanvas(dirSeeder, creator.key)
  canvases.push(seeder)
  const grantStart = Date.now()
  await waitWritable(seeder, 'seeder never became writable (auto-grant flow failed)')
  console.log('[smoke:seeder] seeder granted write access in', Date.now() - grantStart, 'ms')

  const seen = waitFor(
    seeder.onPlacements,
    (p) => p.x === 3 && p.y === 4 && p.color === 1,
    'creator(3,4) never reached the seeder',
    PAINT_TIMEOUT
  )
  const placed = await creator.place(3, 4, 1)
  if (placed === null) throw new Error('creator place() rejected a valid cell')
  await seen
  console.log('[smoke:seeder] creator painted (3,4) — the seeder hosts it too')

  await creator.close() // ← the creator goes offline for the rest of the run
  canvases = canvases.filter((c) => c !== creator)

  // --- act 2: the seeder restarts — its grant must live in shared history -----
  const seederKey = seeder.key
  await seeder.close()
  canvases = canvases.filter((c) => c !== seeder)

  const resumed = await createCanvas(dirSeeder, seederKey)
  canvases.push(resumed)
  if (resumed.key !== seederKey) throw new Error('reopened storage resumed a different canvas')
  if (resumed.writable !== true) {
    throw new Error('resumed seeder is read-only — its grant did not survive the restart')
  }
  console.log('[smoke:seeder] seeder resumed canvas', resumed.key, '— writable again, no ceremony')

  // --- act 3: a fresh peer joins the resumed seeder alone ----------------------
  const fresh = await createCanvas(dirFresh, seederKey)
  canvases.push(fresh)
  const grant2Start = Date.now()
  await waitWritable(fresh, 'fresh peer never became writable (no grant power left?)')
  console.log('[smoke:seeder] fresh peer granted write access in', Date.now() - grant2Start, 'ms')

  // the full canvas arrived, not just the new op: act 1's pixel is in the view
  const inherited = await fresh.get(3, 4)
  if (inherited === null || inherited.color !== 1) {
    throw new Error('fresh peer did not receive the full canvas from the seeder alone')
  }

  const painted = await fresh.place(7, 8, 1)
  if (painted === null) throw new Error('fresh peer place() rejected a valid cell despite grant')
  const seenBySeeder = waitFor(
    resumed.onPlacements,
    (p) => p.x === 7 && p.y === 8 && p.color === 1,
    'fresh peer(7,8) never reached the resumed seeder',
    PAINT_TIMEOUT
  )
  await seenBySeeder

  await resumed.close()
  await fresh.close()
  canvases = canvases.filter((c) => c !== resumed && c !== fresh)
  console.log('[smoke:seeder] creator gone, seeder hosting, fresh peer painted the full canvas')

  // --- act 4: storage discipline — a dir hosts exactly one canvas -------------
  // (the app hit this in the wild: its dir was minted for the old demo canvas,
  // the re-minted one crashed it at first append). The dir above belongs to
  // seederKey: a foreign join must be refused EARLY — naming its owner — and
  // the owner itself must keep resuming the same dir without ceremony.
  const foreign = await createCanvas(dirForeign)
  canvases.push(foreign)

  let refused = null
  try {
    await createCanvas(dirSeeder, foreign.key)
  } catch (err) {
    refused = err
  }
  if (refused === null) throw new Error('joining a foreign canvas into a used dir must fail')
  if (!refused.message.includes(seederKey)) {
    throw new Error('refusal must name the dir-owner canvas key, got: ' + refused.message)
  }
  console.log('[smoke:seeder] refused:', refused.message)

  const owner = await createCanvas(dirSeeder, seederKey)
  canvases.push(owner)
  if (owner.key !== seederKey) throw new Error('owner canvas must keep resuming its own dir')
  if (owner.writable !== true) throw new Error('owner canvas must resume writable, no ceremony')
  await owner.close()
  await foreign.close()
  canvases = []
  console.log(
    '[smoke:seeder] OK — creator gone, seeder hosting, fresh peer painted the full canvas'
  )
}

main().then(
  () => Bare.exit(0),
  (err) => {
    console.error('[smoke:seeder] FAILED:', err.message)
    Bare.exit(1)
  }
)
