// Ticket #3 smoke check, headless: the SAME backend code the desktop app
// runs, executed directly in Bare with no UI at all.
//
//  1. open a canvas in a known storage dir, place some squares, close it
//  2. reopen the same storage — placements must still be there
//
// Run with: npm run smoke   (= `bare backend/smoke.js`)

const join = require('bare-path').join
const goodbye = require('graceful-goodbye')
const createCanvas = require('./canvas')
const { persistent } = require('bare-storage')

// deterministic storage so every run exercises "relaunch and read back"
const storage = join(persistent(), 'pear-place', 'smoke')

// safety net so the bee is never left locked if we exit early
let current = null
goodbye(async () => {
  if (current) await current.close()
})

const squares = [
  [1, 1],
  [2, 2],
  [9, 9],
  [50, 50],
  [99, 99]
]

function byPosition(a, b) {
  return a.y * 100 + a.x - (b.y * 100 + b.x)
}

async function main() {
  console.log('[smoke] storage:', storage)

  // --- act 1: the app places squares, then closes -----------------------------
  const writer = await createCanvas(storage)
  current = writer

  const painted = []
  for (const [x, y] of squares) {
    const placed = await writer.place(x, y, 1)
    if (placed === null) throw new Error('place() rejected a valid cell')
    painted.push(placed)
  }

  // painting white over a cell must overwrite it, not pile up duplicates
  await writer.place(1, 1, 0)
  painted[0] = { x: 1, y: 1, color: 0 }

  await writer.close()
  current = null
  console.log('[smoke] canvas closed after painting', squares.length, 'cells')

  // --- act 2: relaunch on the same storage ------------------------------------
  const reader = await createCanvas(storage)
  current = reader
  const survived = await reader.placements()
  await reader.close()
  current = null

  const expected = painted.slice().sort(byPosition)
  const actual = survived.slice().sort(byPosition)

  if (actual.length !== 5) {
    throw new Error('expected 5 placements after relaunch, got ' + actual.length)
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i]
    const e = expected[i]
    if (a.x !== e.x || a.y !== e.y || a.color !== e.color) {
      throw new Error('expected ' + JSON.stringify(e) + ', got ' + JSON.stringify(a))
    }
  }

  console.log('[smoke] OK —', actual.length, 'placements survived close + relaunch:')
  for (const { x, y, color } of actual) console.log('[smoke]  cell', x + ',' + y, '=> color', color)
}

main().then(
  () => Bare.exit(0),
  (err) => {
    console.error('[smoke] FAILED:', err.message)
    Bare.exit(1)
  }
)
