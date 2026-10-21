// The auto-grant channel, promoted from the issue #4 spike (spike/autobee/).
//
// Problem: a stranger that joins the canvas by key is read-only, and the
// grant (`addWriter` op) must be APPENDED by a writable peer. The guide's
// manual flow (copy writer id, type `add <id>`) can't scale to an open
// canvas, so: peers knock on a second Hyperswarm topic derived from the
// canvas key and hand over their writer id. Every writable peer that hears
// a knock appends the addWriter op automatically — zero manual steps.
//
// Unauthenticated by design (matches r/place's honor-system cooldown): the
// topic is derivable from the canvas key, so "knocking" = "having the key".
//
// Why a SECOND swarm: a Hyperswarm connection does not carry the topic it
// was opened for, so canvas replication traffic and knock traffic live apart.

const crypto = require('hypercore-crypto')
const b4a = require('b4a')

const SALT = b4a.from('pear-place:knock:')

// topic = deterministic generichash of the canvas key string (z32), 32 bytes
function knockTopic(canvasKey) {
  return crypto.hash([SALT, b4a.from(canvasKey)])
}

function knockMessage(writerId) {
  return b4a.from('knock:' + writerId)
}

// 'knock:<z32 writer id>' | null
function parseKnock(data) {
  const message = b4a.toString(data)
  if (!message.startsWith('knock:')) return null
  return message.slice(6)
}

module.exports = { knockTopic, knockMessage, parseKnock }
