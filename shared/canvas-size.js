// The canvas dimensions for the BACKEND side (CJS require in Bare/worker).
// The renderer (ESM in the browser) can't require CJS, so it keeps its own
// SIZE in renderer/grid.js — if you change one, change both.
module.exports = { SIZE: 100 }
