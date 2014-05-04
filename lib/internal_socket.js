var DuplexStream = require("stream").Duplex
module.exports = InternalSocket

var NODE_0_10 = !!process.version.match(/^v0\.10\./)
if (!NODE_0_10) var Uv = process.binding("uv")

// InternalSocket is created for both the client side and the server side.
// Sockets write to this via write*String functions. The
// WritableStream.prototype.write function is just used internally by
// InternalSocket.
//
// Writes from the client side will be ignored for now.
// Writes from the server side, via PipeStreamWrap, will be pushed to its
// target via ReadableStream.prototype.push. Those writes will then be drained
// to the "onread" function assigned by a Socket.
function InternalSocket(remote) {
  DuplexStream.call(this)
  if (remote) this.remote = remote
  this.on("finish", onFinish)
  return this
}

InternalSocket.prototype = Object.create(DuplexStream.prototype, {
  constructor: {value: InternalSocket, configurable: true, writeable: true}
})

InternalSocket.pair = function() {
  var a = Object.create(InternalSocket.prototype)
  var b = Object.create(InternalSocket.prototype)
  return InternalSocket.call(a, b), InternalSocket.call(b, a)
}

function sendData(data) {
  if (NODE_0_10) this.onread(data, 0, data.length)
  else this.onread(data.length, data)
}

function sendEof() {
  if (!this.onread) return
  if (NODE_0_10) process._errno = "EOF", this.onread(null, 0, 0)
  else this.onread(Uv.UV_EOF)
}

function onFinish() {
  process.nextTick(sendEof.bind(this.remote))
}

InternalSocket.prototype.readStart = function() {
  this.on("data", sendData.bind(this))
}

InternalSocket.prototype.readStop = function() {
  this.removeAllListeners("data")
}

InternalSocket.prototype.close = InternalSocket.prototype.end

InternalSocket.prototype._read = noop

InternalSocket.prototype._write = function(data, encoding, done) {
  this.remote.push(data, encoding)
  done()
}

// NOTE: Node v0.10 expects InternalSocket to return write request objects with
// a "oncomplete" and "cb" property. Node v0.11 expects it return an error
// instead.

InternalSocket.prototype.writeBuffer = function(req, data) {
  this.write(NODE_0_10 ? req : data)
  if (NODE_0_10) return {}
}

InternalSocket.prototype.writeUtf8String = function(req, data) {
  this.write(NODE_0_10 ? req : data, "utf8")
  if (NODE_0_10) return {}
}

InternalSocket.prototype.writeAsciiString = function(req, data) {
  this.write(NODE_0_10 ? req : data, "ascii")
  if (NODE_0_10) return {}
}

InternalSocket.prototype.writeUcs2String = function(req, data) {
  this.write(NODE_0_10 ? req : data, "ucs2")
  if (NODE_0_10) return {}
}

// Node v0.10 will use writeQueueSize to see if it should set write request's
// "cb" property or write more immediately.
if (NODE_0_10) InternalSocket.prototype.writeQueueSize = 0

function noop() {}
