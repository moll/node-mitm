var Net = require("net")
var Tls = require("tls")
var Socket = require("./socket")
module.exports = TlsSocket

function TlsSocket() { Socket.apply(this, arguments) }

// Node v0.10 has no TLSSocket and uses a private ClearTextStream instance.
TlsSocket.prototype = Object.create((Tls.TLSSocket || Net.Socket).prototype, {
  constructor: {value: TlsSocket, configurable: true, writeable: true}
})

Object.keys(Socket.prototype).forEach(function(key) {
  TlsSocket.prototype[key] = Socket.prototype[key]
})

TlsSocket.prototype.encrypted = true
TlsSocket.prototype.authorized = true

// Iojs v3 HTTPS/SSL implementation depends on a session.
// Not sure whether returning null breaks anything.
// https://github.com/nodejs/node/blob/291b310e219023c4d93b216b1081ef47386f8750/lib/_tls_wrap.js#L607
TlsSocket.prototype.getSession = function() { return null }
