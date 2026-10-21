// Ticket #5 smoke check, headless: the SAME backend the desktop app runs —
// two REAL peers with separate storage and identity, connected over real
// Hyperswarm discovery — in one Bare process, no UI anywhere.
//
//  1. peer A creates a canvas (creator, writable from birth)
//  2. peer B joins by A's key → read-only → knocks → A auto-grants
//  3. A paints → the pixel must reach B through the update(view, changes)
//     diff, not a rescan — measured, with the issue's <2s budget reported
//  4. B paints → must reach A the same way (sync is bidirectional)
//
// Run with: npm run smoke:p2p   (= `bare backend/smoke.p2p.js`)

const fs = require('bare-fs')
const join = require('bare-path').join
const goodbye = require('graceful-goodbye')
const { persistent } = require('bare-storage')
const createCanvas = require('./canvas')

// wipe storage every run: smoke paints fixed cells, so stale state from a
// previous run would already be in both views and nothing would "arrive"
const base = join(persistent(), 'pear-place', 'smoke-p2p')
const dirA = join(base, 'a')
const dirB = join(base, 'b')

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

async function main() {
  for (const dir of [dirA, dirB]) fs.rmSync(dir, { recursive: true, force: true })
  console.log('[smoke:p2p] storage:', base)

  // --- act 1: A creates --------------------------------------------------------
  const a = await createCanvas(dirA)
  canvases.push(a)
  if (a.writable !== true) throw new Error('creator should be writable from birth')
  console.log('[smoke:p2p] A created canvas', a.key)

  // --- act 2: B joins by key ---------------------------------------------------
  const b = await createCanvas(dirB, a.key)
  canvases.push(b)

  const grantStart = Date.now()
  if (!b.writable) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off()
        reject(new Error('B never became writable (auto-grant flow failed)'))
      }, GRANT_TIMEOUT)
      const off = b.onWritable((writable) => {
        if (!writable) return
        clearTimeout(timer)
        off()
        resolve()
      })
    })
  }
  console.log('[smoke:p2p] B granted write access in', Date.now() - grantStart, 'ms')

  // --- act 3: A paints → B receives ---------------------------------------------
  const toB = waitFor(
    b.onPlacements,
    (p) => p.x === 12 && p.y === 34 && p.color === 1,
    'A(12,34) never reached B',
    PAINT_TIMEOUT
  )
  const placedA = await a.place(12, 34, 1)
  if (placedA === null) throw new Error('A place() rejected a valid cell')
  const leg1 = await toB
  console.log(
    '[smoke:p2p] A → B:',
    leg1.ms,
    'ms (budget 2000ms',
    leg1.ms < 2000 ? 'OK' : 'OVER',
    ')'
  )

  // --- act 4: B paints → A receives (bidirectional) ------------------------------
  const toA = waitFor(
    a.onPlacements,
    (p) => p.x === 56 && p.y === 78 && p.color === 1,
    'B(56,78) never reached A',
    PAINT_TIMEOUT
  )
  const placedB = await b.place(56, 78, 1)
  if (placedB === null) throw new Error('B place() rejected a valid cell despite grant')
  const leg2 = await toA
  console.log(
    '[smoke:p2p] B → A:',
    leg2.ms,
    'ms (budget 2000ms',
    leg2.ms < 2000 ? 'OK' : 'OVER',
    ')'
  )

  // --- act 5: read it back from B's view ------------------------------------------
  const seen = await b.get(12, 34)
  if (seen === null || seen.color !== 1) throw new Error('B get(12,34) wrong after replication')

  if (leg1.ms >= 2000 || leg2.ms >= 2000) {
    console.log('[smoke:p2p] WARNING: latency over the 2s budget — flat network day?')
  }

  await a.close()
  await b.close()
  canvases = []
  console.log('[smoke:p2p] OK — two peers, one canvas, pixels flowed both ways')
}

main().then(
  () => Bare.exit(0),
  (err) => {
    console.error('[smoke:p2p] FAILED:', err.message)
    Bare.exit(1)
  }
)
