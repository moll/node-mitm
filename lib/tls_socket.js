var Tls = require("tls")
var Socket = require("./socket")
module.exports = TlsSocket

function TlsSocket() { Socket.apply(this, arguments) }

TlsSocket.prototype = Object.create(Tls.TLSSocket.prototype, {
  constructor: {value: TlsSocket, configurable: true, writeable: true}
})

Object.keys(Socket.prototype).map(function(key) {
  TlsSocket.prototype[key] = Socket.prototype[key]
})

TlsSocket.prototype.encrypted = true
TlsSocket.prototype.authorized = true
