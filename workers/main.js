const PearRuntime = require('pear-runtime')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const goodbye = require('graceful-goodbye')
const FramedStream = require('framed-stream')
const path = require('bare-path')
const dir = require('bare-storage')
const { isBareKit } = require('which-runtime')
const createCanvas = require('../backend/canvas')

// mobile doesn't have the executable path (argv[0])
// and the worker entry path (argv[1]) in the workers argv's
// ... to reuse the same worker in all platforms this logic is needed
const argv = (index) => Bare.argv[index + (isBareKit ? 0 : 2)]

const updaterConfig = {
  updates: argv(0) !== 'false',
  version: argv(1),
  upgrade: argv(2),
  name: argv(3),
  dir: argv(4) || dir.persistent(), // argv[4] is undefined in mobile
  app: argv(5), // argv[5] is undefined in mobile
  // update checks spread up to 1h after a drive append in production (the
  // installed app path only exists in packaged builds = not dev); dev runs
  // delay 0 so an OTA test lands immediately instead of ~30 min from now
  delay: argv(5) ? undefined : 0
}

const pipe = new FramedStream(Bare.IPC)
const store = new Corestore(path.join(updaterConfig.dir, 'pear-runtime', 'corestore'))
const swarm = new Hyperswarm()
const pear = new PearRuntime({ ...updaterConfig, swarm, store })

// --- the canvas (ticket #5): one Autobee, replicated peer-to-peer ------------
// The desktop app always joins the demo canvas by key (shared/canvas-key.js);
// with no key in there yet it creates its own and the worker prints the key
// once to paste back. The same backend factory also runs headless under
// `bare seeder/` (the durable host) and `bare backend/smoke.p2p.js`.
const { DEMO_CANVAS_KEY } = require('../shared/canvas-key.js')
let canvas = null
let canvasStreamed = false // renderer said hello -> send it the stored canvas

// a storage dir hosts exactly one canvas (see backend/canvas.js): a dir's
// writer core is minted for the canvas first seen there, so the app derives
// its dir from the canvas key — switching keys means switching dirs
createCanvas(
  path.join(updaterConfig.dir, 'place', DEMO_CANVAS_KEY || 'self'),
  DEMO_CANVAS_KEY
).then(
  (c) => {
    canvas = c
    console.log('canvas open:', c.key, 'writable:', c.writable)
    // every apply cycle reports ONLY the cells that changed (the diff), local
    // paints and remote paints alike — the renderer repaints exactly those
    c.onPlacements((placements) => {
      if (canvasStreamed) pipe.write(JSON.stringify({ type: 'canvas:placed', placements }))
    })
    c.onWritable((writable) => {
      if (canvasStreamed) pipe.write(JSON.stringify({ type: 'canvas:info', writable }))
    })
    if (canvasStreamed) sendCanvasGrid()
  },
  (err) => {
    console.log('canvas failed to open:', err.message)
  }
)

function sendCanvasGrid() {
  if (!canvas) return
  canvas
    .placements()
    .then((placements) => {
      console.log('canvas streamed:', placements.length, 'placements')
      return pipe.write(
        JSON.stringify({
          type: 'canvas:grid',
          key: canvas.key,
          writable: canvas.writable,
          placements
        })
      )
    })
    .catch((err) => console.log('canvas read failed:', err.message))
}

pear.updater.on('error', (err) => pipe.write('updater-error ' + err.message))

if (updaterConfig.updates !== false) {
  swarm.on('connection', (connection) => store.replicate(connection))
  swarm.join(pear.updater.drive.core.discoveryKey, {
    client: true,
    server: false
  })
}

pear.updater.on('update-scheduled', (delay) => pipe.write('update-scheduled ' + delay))
pear.updater.on('updating', () => pipe.write('updating'))
pear.updater.on('updated', () => pipe.write('updated'))
pear.on('minver-required', () => pipe.write('minver-required')) // for mobile store update notification

goodbye(async () => {
  if (canvas) await canvas.close()
  await swarm.destroy()
  await pear.close()
  await store.close()
})

pipe.on('data', async (data) => {
  const message = data.toString()
  if (message === 'pear:applyUpdate') {
    try {
      await pear.ready()
      await pear.updater.applyUpdate()
      pipe.write('pear:updateApplied')
    } catch (err) {
      pipe.write('pear:updateFailed ' + err.message)
    }
    return
  }

  try {
    const msg = JSON.parse(message)
    if (msg.type === 'ping') {
      pipe.write(JSON.stringify({ type: 'pong', time: new Date().toISOString() }))
      return
    }
    if (msg.type === 'hello') {
      // renderer is listening: stream the stored canvas its way
      canvasStreamed = true
      sendCanvasGrid()
      return
    }
    if (msg.type === 'canvas:place' && canvas) {
      const placed = await canvas.place(msg.x, msg.y, msg.color)
      if (placed === null) console.log('canvas:place rejected', msg.x, msg.y)
      return
    }
  } catch (err) {
    console.log('bad pipe message:', err.message)
  }
})

pipe.write('Hello from worker')
