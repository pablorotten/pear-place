// The ONE deterministic program every peer runs — promoted from the issue #4
// spike (spike/autobee/apply.js) and adapted to the issue #5 storage shape:
// the view stores a placement per cell as key = "x,y" → value = color.
//
// Two rules carried over from the spike, both enforced here:
//  1. apply is deterministic: the linearized node order is the only input,
//     so every peer (and every restart) replays to the same B-tree.
//  2. apply never throws. A node replays on every peer forever, including
//     after restart — a malformed one (bad JSON, a hostile peer) must be
//     skipped, not crash the drain.
//
// The `update` handler is where the UI learns about changes: Autobee calls it
// after each apply cycle with (view, changes), where changes records the view
// head BEFORE and AFTER the cycle. We diff exactly that range and emit only
// the cells that moved — readers included, because the view rebuilds locally
// on every peer, read-only or not. No rescanning the whole grid, ever.

const b4a = require('b4a')
const { SIZE } = require('../shared/canvas-size')

// the op appended to a peer's writer core: { p: [x, y, color] } — overwrite
// safe like r/place: painting white over a cell overwrites its entry
function placeOp(x, y, color) {
  return b4a.from(JSON.stringify({ p: [x, y, color] }))
}

// 'x,y' ↔ buffer, the view's storage format (issue #5: key = "x,y" → color)
function cellKey(x, y) {
  return b4a.from(x + ',' + y)
}

function parseCellKey(buf) {
  const [x, y] = b4a.toString(buf).split(',')
  return { x: Number(x), y: Number(y) }
}

function parseColor(buf) {
  return JSON.parse(b4a.toString(buf))
}

async function apply(nodes, view, host) {
  for (const node of nodes) {
    try {
      const op = JSON.parse(b4a.toString(node.value))

      // the grant dance: { addWriter } / { removeWriter } ops ARE the ACL
      if (op.addWriter) {
        await host.addWriter(op.addWriter)
        continue
      }
      if (op.removeWriter) {
        await host.removeWriter(op.removeWriter)
        continue
      }

      // a pixel placement
      if (op.p === undefined) continue
      const [x, y, color] = op.p
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue

      const batch = view.write()
      batch.tryPut(cellKey(x, y), b4a.from(JSON.stringify(color)))
      await batch.flush()
    } catch (err) {
      console.error('[apply] skipping malformed node:', err.message)
    }
  }
}

// makeHandlers({ onPlacements }) → the Autobee handlers object for one canvas.
// onPlacements receives an array of { x, y, color } — the diff of THIS apply
// cycle, nothing more (called on local paints AND on replicated remote paints).
function makeHandlers({ onPlacements }) {
  async function update(view, changes) {
    const change = changes.get('view')
    if (!change || !change.from || !change.to) return
    if (change.from.length === change.to.length) return // nothing reached the view

    // two throwaway views pinned to the before/after heads of the view core,
    // then a shallow diff between them — O(changed cells), not O(canvas)
    const before = view.checkout({ length: change.from.length })
    const after = view.checkout({ length: change.to.length })

    const placements = []
    for await (const diff of after.createDiffStream(before)) {
      // left = current (after), right = previous (before)
      const entry = diff.left || diff.right
      const { x, y } = parseCellKey(entry.key)
      // our apply never deletes — but if a cell ever vanished, it's white
      const color = diff.left ? parseColor(diff.left.value) : 0
      placements.push({ x, y, color })
    }

    if (placements.length > 0) onPlacements(placements)
  }

  return { apply, update }
}

module.exports = { makeHandlers, placeOp, cellKey, parseCellKey, parseColor }
