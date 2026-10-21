// SPIKE (issue #4): handlers shared by every Autobee peer — copied verbatim
// between the writer app and the peer app, because both must derive the SAME
// view from the SAME nodes.
//
// Two rules the issue pins down, both enforced here:
//  1. apply is deterministic: the linearized node order is the only input,
//     so every peer (and every restart) replays to the same B-tree.
//  2. apply never throws. A node replays on every peer forever, including
//     after restart — a malformed one (bad JSON, a hostile peer) must be
//     skipped, not crash the drain.

const b4a = require('b4a')
const { SIZE } = require('../../shared/canvas-size')

const KEY_PREFIX = 'p:'

module.exports = { apply, update, placeOp }

async function apply(nodes, view, host) {
  for (const node of nodes) {
    try {
      const op = JSON.parse(b4a.toString(node.value))

      if (op.addWriter) {
        await host.addWriter(op.addWriter)
        continue
      }

      // a pixel placement: { p: [x, y, color] } — overwrite-safe like r/place
      if (op.p === undefined) continue
      const [x, y, color] = op.p
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue

      const batch = view.write()
      batch.tryPut(b4a.from(KEY_PREFIX + (y * SIZE + x)), b4a.from(JSON.stringify({ x, y, color })))
      await batch.flush()
    } catch (err) {
      console.error('[apply] skipping malformed node:', err.message)
    }
  }
}

// Autobae has no view-changed event; this handler is the post-apply hook.
// entries.length is our canvas-placed-cells counter for the spike.
async function update(view) {
  let cells = 0
  for await (const _ of view.createReadStream()) cells++
  console.log('[view]', cells, 'cells painted')
}

function placeOp(x, y, color) {
  return b4a.from(JSON.stringify({ p: [x, y, color] }))
}
