// The canvas "backend": placements persisted in a Hyperbee, usable from any
// runtime — the Pear worker inside the Electron app, or headless `bare`.
// No UI, no Electron, no Pear APIs in here: just corestore + hyperbee.

const Corestore = require('corestore')
const Hyperbee = require('hyperbee')
const { SIZE } = require('../shared/canvas-size.js')

const KEY_PREFIX = 'p:'
const KEY_ENCODING = 'utf-8'
const VALUE_ENCODING = 'json'

// the whole canvas is one bee: key = "p:<index>" (index = y * SIZE + x),
// value = { x, y, color }. White (0) is just a color: painting over a cell
// overwrites its entry, nothing is ever deleted.
module.exports = async function createCanvas(dir) {
  const store = new Corestore(dir)
  await store.ready()

  const core = store.get({ name: 'canvas' })
  const bee = new Hyperbee(core, { keyEncoding: KEY_ENCODING, valueEncoding: VALUE_ENCODING })
  await bee.ready()

  const listeners = new Set()

  function key(x, y) {
    return KEY_PREFIX + y * SIZE + x
  }

  // grabs a placement from "p:<idx>" — cells is "x, y, color" or {}
  function unpack(entry) {
    if (entry === null) return null
    const { x, y, color } = entry.value
    return { x, y, color }
  }

  async function place(x, y, color = 1) {
    x = Math.floor(x)
    y = Math.floor(y)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null
    if (color !== 0 && color !== 1) return null
    await bee.put(key(x, y), { x, y, color })
    const placement = { x, y, color }
    for (const listener of listeners) listener(placement)
    return placement
  }

  async function get(x, y) {
    return unpack(await bee.get(key(x, y)))
  }

  // every placed cell so far, snapped from the bee's latest version
  async function placements() {
    const all = []
    const snapshot = bee.snapshot()
    try {
      await snapshot.ready()
      const stream = snapshot.createReadStream()
      for await (const entry of stream) all.push(unpack(entry))
    } finally {
      await snapshot.close()
    }
    return all
  }

  function onChange(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  async function close() {
    await bee.close()
    await store.close()
  }

  return { place, get, placements, onChange, close, size: SIZE }
}
