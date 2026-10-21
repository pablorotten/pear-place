// THE demo canvas key — the invite (see ARCHITECTURE.md). Every desktop app
// joins this canvas by default: installing the app and having the key are the
// same act. The canvas is hosted by the seeder (`npm run seed`), whose storage
// dir holds the original writer core — a restarted seeder comes back writable
// on its own, and any writable peer can host in its place.
//
// Minted with the seeder at level 3 start (issue #6): `npx bare seeder/ --exit`,
// key pasted here. The seeder's storage dir is not in the repo.
//
// null = no demo canvas yet — the app then creates its own and the worker
// prints the key to paste here (see README · Run your own canvas).

module.exports = { DEMO_CANVAS_KEY: 'a4xu9rqb1h9ybnpabs1pbengd8aonu6ks95mpyiattskdgt5d7zy' }
