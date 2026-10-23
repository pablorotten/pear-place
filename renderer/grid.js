// The canvas state, in its purest form: 10,000 cells, one byte each.
// 0 = white, 1 = black. Index = y * SIZE + x.
// The board is fed by the backend (Autobee view, workers/main.js): clicks are
// delegated via onClick — the backend is the source of truth, and each
// `placed` batch (the update(view, changes) diff, local or remote) repaints
// exactly those cells. The grid never rescans itself for a change.

export const SIZE = 100

const COLORS = ['#ffffff', '#000000']
const WHITE = 0
const BLACK = 1

export function createGrid(canvas, size = SIZE, { onAction } = {}) {
  const ctx = canvas.getContext('2d')
  const cells = new Uint8Array(size * size)

  const index = (x, y) => y * size + x

  function drawCell(x, y) {
    ctx.fillStyle = COLORS[cells[index(x, y)]]
    ctx.fillRect(x, y, 1, 1)
  }

  function paint(x, y, color = BLACK) {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    cells[index(x, y)] = color
    drawCell(x, y)
  }

  function draw() {
    ctx.fillStyle = COLORS[WHITE]
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < cells.length; i++) {
      // white cells are already painted — draw only the pixels someone placed
      if (cells[i] !== WHITE) {
        drawCell(i % size, Math.floor(i / size))
      }
    }
  }

  // mousedown, not click: the browser's `click` event only fires for the LEFT
  // button — right clicks never reach onClick at all. mousedown fires for both.
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size)
    // left button paints black, right button paints white (context menu is
    // guarded away below); anything else (middle) does nothing
    const color = event.button === 0 ? BLACK : event.button === 2 ? WHITE : undefined
    if (color === undefined) return
    if (onAction) onAction(x, y, color)
    else paint(x, y, color)
  })
  // the right-click action above only works if the browser menu stays shut
  canvas.addEventListener('contextmenu', (event) => event.preventDefault())

  draw()
  return { cells, paint, draw, size }
}
