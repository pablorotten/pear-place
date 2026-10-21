// The creator/host of the demo canvas — headless in Bare, no UI, no Electron.
// It runs the SAME backend the desktop app runs (backend/canvas.js): Autobee +
// Hyperswarm, joinable by key. The real polished CLI lives in ticket #6
// (`seeder/`); this exists so #5 can demo and mint the key it commits.
//
// Where the demo canvas lives (creator mode): its own storage dir under the
// Bare persistent dir — run it again later and it RESUMES the same canvas.
//
//   npm run demo            → create-or-resume, print the key, host forever
//   npm run demo -- --exit  → same, but print the key and stop (for minting)
//   npm run demo -- <key>   → join + host an existing canvas (read-only until
//                             a writable peer grants via the knock channel)
//
// Why host mode matters: the key only NAMES the canvas; the original writer
// core lives on this disk. While this process runs, new peers can join, get
// granted, and pull history — even with the creator's app closed.

const join = require('bare-path').join
const goodbye = require('graceful-goodbye')
const { persistent } = require('bare-storage')
const createCanvas = require('./canvas')

const storage = join(persistent(), 'pear-place', 'demo')
const args = Bare.argv.slice(2)
const exitAfterPrinting = args.includes('--exit')
const canvasKey = args.find((arg) => !arg.startsWith('--')) || null

let current = null
goodbye(async () => {
  if (current) await current.close()
})

async function main() {
  console.log('[demo] storage:', storage)
  const canvas = await createCanvas(storage, canvasKey)
  current = canvas

  if (canvasKey) {
    console.log('[demo] hosting canvas', canvas.key, '(read-only until granted)')
  } else {
    console.log('[demo] canvas key:', canvas.key)
    console.log('[demo] → paste this into shared/canvas-key.js (DEMO_CANVAS_KEY)')
  }
  console.log('[demo] peers can join by this key; each new writer is auto-granted')

  canvas.onWritable((writable) => console.log('[demo] writable:', writable))
  canvas.onPlacements((placements) => {
    for (const { x, y } of placements) console.log('[demo] pixel', x + ',' + y)
  })

  if (exitAfterPrinting) {
    await canvas.close()
    current = null
    Bare.exit(0)
  }
  // otherwise: stay alive and host (this process IS a peer)
}

main().catch((err) => {
  console.error('[demo] FAILED:', err.stack)
  Bare.exit(1)
})
