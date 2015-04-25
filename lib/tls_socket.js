var Net = require("net")
var Tls = require("tls")
var Socket = require("./socket")
module.exports = TlsSocket

function TlsSocket() { Socket.apply(this, arguments) }

// Node v0.10 has no TLSSocket and uses a private ClearTextStream instance.
TlsSocket.prototype = Object.create((Tls.TLSSocket || Net.Socket).prototype, {
  constructor: {value: TlsSocket, configurable: true, writeable: true}
})

Object.keys(Socket.prototype).map(function(key) {
  TlsSocket.prototype[key] = Socket.prototype[key]
})

TlsSocket.prototype.encrypted = true
TlsSocket.prototype.authorized = true
