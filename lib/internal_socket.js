var DuplexStream = require("stream").Duplex
module.exports = InternalSocket

var NODE_0_10 = !!process.version.match(/^v0\.10\./)
if (!NODE_0_10) var Uv = process.binding("uv")

/**
 * Sockets write to InternalSocket via write*String functions. The
 * WritableStream.prototype.write function is just used internally by
 * InternalSocket to queue data before pushing it to the other end via
 * ReadableStream.prototype.push. The receiver will then forward it to its
 * owner Socket via the onread property.
 *
 * InternalSocket is created for both the client side and the server side.
 */
function InternalSocket(remote) {
  DuplexStream.call(this)
  if (remote) this.remote = remote

  // End is for ReadableStream.prototype.push(null).
  // Finish is for WritableStream.prototype.end.
  this.on("data", readData.bind(this))
  this.on("end", readEof.bind(this))
  this.on("finish", this._write.bind(this, null, null, noop))

  return this.pause(), this
}

InternalSocket.prototype = Object.create(DuplexStream.prototype, {
  constructor: {value: InternalSocket, configurable: true, writeable: true}
})

InternalSocket.pair = function() {
  var a = Object.create(InternalSocket.prototype)
  var b = Object.create(InternalSocket.prototype)
  return [InternalSocket.call(a, b), InternalSocket.call(b, a)]
}

function readData(data) {
  if (NODE_0_10) this.onread(data, 0, data.length)
  else this.onread(data.length, data)
}

function readEof() {
  if (!this.onread) return
  if (NODE_0_10) process._errno = "EOF", this.onread(null, 0, 0)
  else this.onread(Uv.UV_EOF)
}

// ReadStart may be called multiple times.
//
// Node v0.11's ReadableStream.prototype.resume and ReadableStream.prototype.pause return
// self. InternalSocket's API states that they should return error codes
// instead.
//
// Node v0.11.13 called ReadableStream.prototype.read(0) synchronously, but
// v0.11.14 does it in the next tick. For easier sync use, call it here.
InternalSocket.prototype.readStart = function() { this.resume(); this.read(0) }
InternalSocket.prototype.readStop = function() { this.pause() }
InternalSocket.prototype.close = InternalSocket.prototype.end

InternalSocket.prototype._read = noop

InternalSocket.prototype._write = function(data, encoding, done) {
  var remote = this.remote
  process.nextTick(function() { remote.push(data, encoding); done() })
}

// NOTE: Node v0.10 expects InternalSocket to return write request objects with
// a "oncomplete" and "cb" property. Node v0.11 expects it return an error
// instead.

// those two ones are expected in 0.10
InternalSocket.prototype.unref = function() {}
InternalSocket.prototype.ref = function() {}

// InternalSocket.prototype.writeBinaryString was introduced in Node v0.11.14.
InternalSocket.prototype.writeBinaryString = function(req, data) {
  this.write(data, "binary")
}

InternalSocket.prototype.writeLatin1String = function(req, data) {
  this.write(data, "latin1")
}

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
