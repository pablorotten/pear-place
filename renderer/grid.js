// The canvas state, in its purest form: 10,000 cells, one byte each.
// 0 = white, 1 = black. Index = y * SIZE + x.
// The board is fed by the backend (Hyperbee persisted, workers/main.js):
// clicks are delegated via onClick — the backend is the source of truth,
// and every `placed` event (local or, later, from peers) repaints here.

export const SIZE = 100

const COLORS = ['#ffffff', '#000000']
const WHITE = 0
const BLACK = 1

export function createGrid(canvas, size = SIZE, { onClick } = {}) {
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

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size)
    if (onClick) onClick(x, y)
    else paint(x, y)
  })

  draw()
  return { cells, paint, draw, size }
}
