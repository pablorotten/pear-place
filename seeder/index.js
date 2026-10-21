// The seeder: the creator closes their app, the canvas stays up.
//
// The same backend the desktop app runs (backend/canvas.js — Autobee +
// Hyperswarm), headless in Bare: no renderer, no Electron, no Pear APIs.
// One thin entry, two modes (see ARCHITECTURE.md):
//
//   bare seeder/              → create-or-resume YOUR canvas: mint the key on
//                               the first run, pick up where you left off after
//   bare seeder/ <canvas-key> → join + host someone's canvas by key
//
// Hosting is durable because write access lives in shared history, not in any
// one process: the first time the seeder joins a canvas it is read-only and
// knocks for its grant (backend/knock.js). Once granted, its writer core is
// part of the canvas — kill the seeder, start it again, it comes back writable
// with zero ceremony and holds grant power: newcomers that knock get
// auto-granted even if the original creator has been offline for hours.
//
//   bare seeder/ --exit                → print the canvas key and stop (minting)
//   bare seeder/ <key> -s <dir>        → host a canvas with a custom storage dir

const join = require('bare-path').join
const goodbye = require('graceful-goodbye')
const { arg, command, flag, summary } = require('paparam')
const { persistent } = require('bare-storage')
const createCanvas = require('../backend/canvas')

const cmd = command(
  'seeder',
  summary('headless canvas host — the same backend the desktop app runs'),
  arg('[canvasKey]', 'join this canvas (omit: create-or-resume your own)'),
  flag('--storage|-s [dir]', 'storage dir (default: under the Bare persistent dir)'),
  flag('--exit', 'print the canvas key and stop')
)
cmd.parse(Bare.argv.slice(2))

const canvasKey = cmd.args.canvasKey || null
const storage = cmd.flags.storage || join(persistent(), 'pear-place', 'seeder', canvasKey || 'self')

let current = null
goodbye(async () => {
  if (current) await current.close()
})

async function main() {
  console.log('[seeder] storage:', storage)

  const canvas = await createCanvas(storage, canvasKey)
  current = canvas

  if (canvasKey) {
    console.log('[seeder] hosting canvas', canvas.key)
  } else {
    console.log('[seeder] canvas key:', canvas.key)
    console.log('[seeder] → paste this into shared/canvas-key.js (DEMO_CANVAS_KEY)')
  }

  canvas.onWritable((writable) => {
    if (writable) console.log('[seeder] writable — grant power held: newcomers are auto-granted')
    else console.log('[seeder] read-only — knocking for write access')
  })
  canvas.onPlacements((placements) => {
    for (const { x, y, color } of placements) {
      console.log('[seeder] pixel', x + ',' + y, '=> color', color)
    }
  })

  if (cmd.flags.exit) {
    await canvas.close()
    current = null
    Bare.exit(0)
  }
  // otherwise: stay alive and host (this process IS a peer)
}

main().catch((err) => {
  console.error('[seeder] FAILED:', err.message)
  if (canvasKey) console.error('[seeder] is the canvas key correct?', canvasKey)
  Bare.exit(1)
})
