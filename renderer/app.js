import { createGrid, SIZE } from './grid.js'

const bridge = window.bridge
const decoder = new TextDecoder('utf-8')

// every paint comes from the worker's messages: either the full stored canvas
// (canvas:grid, after relaunch) or one placement the Hyperbee accepted
// (canvas:placed — local today, from peers in level 4)
const grid = createGrid(document.getElementById('place'), SIZE, {
  onClick: (x, y) => {
    bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'canvas:place', x, y }))
  }
})

// --- OTA update flow (from the hello-pear tutorial, kept for level 3) --------

document.getElementById('v').innerText += bridge.pkg().version

function showUpdateReady() {
  document.getElementById('v').innerText = 'Update ready!'
  const btn = document.getElementById('update-btn')
  btn.style.display = 'inline-block'
  btn.onclick = async () => {
    btn.disabled = true
    btn.innerText = 'Updating...'
    try {
      await bridge.applyUpdate()
      await bridge.appAfterUpdate()
    } catch (err) {
      document.getElementById('v').innerText = 'Update failed: ' + err.message
      btn.style.display = 'none'
    }
  }
}

function onWorkerUpdaterEvent(name) {
  if (name === 'updating') {
    document.getElementById('v').innerText = 'UPDATING...'
    return
  }
  if (name === 'updated') showUpdateReady()
}

// --- the Pear worker ( PearRuntime OTA internals run there ) -----------------

const workers = {
  main: '/workers/main.js'
}

bridge.startWorker(workers.main)
let sentHello = false

const offWorkerStdout = bridge.onWorkerStdout(workers.main, (data) => {
  console.log('worker stdout', '[', workers.main, ']:', decoder.decode(data))
})

const offWorkerStderr = bridge.onWorkerStderr(workers.main, (data) => {
  console.error('worker stderr', '[', workers.main, ']:', decoder.decode(data))
})

const offWorkerIpc = bridge.onWorkerIPC(workers.main, (data) => {
  const message = decoder.decode(data)
  console.log('worker ipc', '[', workers.main, ']:', message)
  onWorkerUpdaterEvent(message)
  let parsed
  try {
    parsed = JSON.parse(message)
  } catch {
    parsed = null
  }

  if (parsed && parsed.type === 'canvas:grid') {
    const status = document.getElementById('status')
    status.innerText =
      SIZE +
      'x' +
      SIZE +
      ' · backed by Hyperbee · ' +
      parsed.placements.length +
      ' stored placements loaded'
    for (const placement of parsed.placements) grid.paint(placement.x, placement.y, placement.color)
    return
  }
  if (parsed && parsed.type === 'canvas:placed') {
    grid.paint(parsed.x, parsed.y, parsed.color)
    return
  }

  if (!sentHello) {
    sentHello = true
    bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'hello' }))
  }
})

const offWorkerExit = bridge.onWorkerExit(workers.main, (code) => {
  console.log('Worker exited with code', code)
  offWorkerStdout()
  offWorkerStderr()
  offWorkerIpc()
  offWorkerExit()
})
