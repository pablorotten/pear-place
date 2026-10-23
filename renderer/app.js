import { createGrid, SIZE } from './grid.js'

const bridge = window.bridge
const decoder = new TextDecoder('utf-8')

// every paint comes from the worker's messages: the full stored canvas
// (canvas:grid, on hello) or a batch of changed cells (canvas:placed — the
// update(view, changes) diff, local paints AND replicated remote paints)
const status = document.getElementById('status')
const canvasInfo = { key: null, writable: null }

function statusText(nPixelsLoaded) {
  const key = canvasInfo.key ? canvasInfo.key.slice(0, 8) + '…' : 'open…'
  const access =
    canvasInfo.writable === null
      ? ''
      : canvasInfo.writable
        ? ' · writable'
        : ' · read-only — knocking for write access'
  const pixels = nPixelsLoaded === null ? '' : ' · ' + nPixelsLoaded + ' pixels'
  return SIZE + 'x' + SIZE + ' · canvas ' + key + pixels + access + ' · no server — peers replicate'
}

const grid = createGrid(document.getElementById('place'), SIZE, {
  onAction: (x, y, color) => {
    bridge.writeWorkerIPC(workers.main, JSON.stringify({ type: 'canvas:place', x, y, color }))
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
    // first grid means the peers delivered: drop the loading screen
    document.getElementById('loading').classList.add('hide')
    canvasInfo.key = parsed.key
    canvasInfo.writable = parsed.writable
    status.innerText = statusText(parsed.placements.length)
    for (const placement of parsed.placements) grid.paint(placement.x, placement.y, placement.color)
    return
  }
  if (parsed && parsed.type === 'canvas:placed') {
    // diff-sized batches only: repaint exactly the cells that moved
    for (const placement of parsed.placements) grid.paint(placement.x, placement.y, placement.color)
    return
  }
  if (parsed && parsed.type === 'canvas:info') {
    canvasInfo.writable = parsed.writable
    status.innerText = statusText(null)
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
