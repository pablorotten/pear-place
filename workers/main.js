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
  app: argv(5) // argv[5] is undefined in mobile
}

const pipe = new FramedStream(Bare.IPC)
const store = new Corestore(path.join(updaterConfig.dir, 'pear-runtime', 'corestore'))
const swarm = new Hyperswarm()
const pear = new PearRuntime({ ...updaterConfig, swarm, store })

// --- the canvas (ticket #3): placements persisted in Hyperbee ----------------
// Own storage dir, separate from Pear's OTA updater corestore above. The same
// backend/canvas factory runs headless under `bare backend/smoke.js`.
let canvas = null
let canvasStreamed = false // renderer said hello -> send it the stored canvas

createCanvas(path.join(updaterConfig.dir, 'place')).then(
  (c) => {
    canvas = c
    console.log('canvas open:', c.size + 'x' + c.size, 'placements live')
    // future peers' placements (level 4) flow through the same listener
    c.onChange((placed) => {
      if (canvasStreamed) pipe.write(JSON.stringify({ type: 'canvas:placed', ...placed }))
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
      return pipe.write(JSON.stringify({ type: 'canvas:grid', placements }))
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
