var DuplexStream = require("stream").Duplex
var Semver = require("semver")
var uniqueId = 0
var NO_ERROR = 0
var STREAM_STATE
var STREAM_BYTES_READ
var NODE_VERSION = process.version
exports = module.exports = InternalSocket
exports.pair = pair

var NODE_0_10 = Semver.satisfies(NODE_VERSION, ">= 0.10 < 0.11")
var NODE_10_AND_LATER = Semver.satisfies(NODE_VERSION, ">= 10")
var NODE_11_1_AND_LATER = Semver.satisfies(NODE_VERSION, ">= 11.1")
var NODE_11_2_AND_LATER = Semver.satisfies(NODE_VERSION, ">= 11.2")
var NODE_10_15_1_AND_MAJOR = Semver.satisfies(NODE_VERSION, ">= 10.15.1 < 11")
if (!NODE_0_10) var UV_EOF = process.binding("uv").UV_EOF

if (NODE_11_1_AND_LATER) {
  STREAM_STATE = process.binding("stream_wrap").streamBaseState
  STREAM_BYTES_READ = process.binding("stream_wrap").kReadBytesOrError
}

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
  this.id = ++uniqueId

  // The "end" event follows ReadableStream.prototype.push(null).
  this.on("data", readData.bind(this))
  this.on("end", readEof.bind(this))

  // The "finish" event follows  WritableStream.prototype.end.
  //
  // There's WritableStream.prototype._final for processing before "finish" is
  // emitted, but that's only available in Node v8 and later.
  this.on("finish", this._write.bind(this, null, null, noop))

  return this.pause(), this
}

InternalSocket.prototype = Object.create(DuplexStream.prototype, {
  constructor: {value: InternalSocket, configurable: true, writeable: true}
})

// Node v0.11's ReadableStream.prototype.resume and
// ReadableStream.prototype.pause return self. InternalSocket's API states that
// they should return error codes instead.
//
// Node v0.11.13 called ReadableStream.prototype.read(0) synchronously, but
// v0.11.14 does it in the next tick. For easier sync use, call it here.
InternalSocket.prototype.readStart = function() { this.resume() }
InternalSocket.prototype.readStop = function() { this.pause() }

InternalSocket.prototype._read = noop
InternalSocket.prototype.ref = noop
InternalSocket.prototype.unref = noop

// Node v8 added "getAsyncId".
InternalSocket.prototype.getAsyncId = function() { return this.id }

InternalSocket.prototype._write = function(data, encoding, done) {
  var remote = this.remote
  process.nextTick(function() { remote.push(data, encoding); done() })
}

// Node v10 requires writev to be set on the handler because, while
// WritableStream expects _writev, internal/stream_base_commons.js calls
// req.handle.writev directly. It's given a flat array of data+type pairs.
if (NODE_10_AND_LATER) InternalSocket.prototype.writev = function(_req, data) {
  for (var i = 0; i < data.length; ++i) this._write(data[i], data[++i], noop)
  return NO_ERROR
}

// NOTE: Node v0.10 expects InternalSocket to return write request objects with
// a "oncomplete" and "cb" property. Node v0.11 expects it return an error
// instead. Node v10 expects it to return an error code.

// InternalSocket.prototype.writeBinaryString was introduced in Node v0.11.14.
InternalSocket.prototype.writeBinaryString = function(_req, data) {
  this.write(data, "binary")
  if (NODE_10_AND_LATER) return NO_ERROR
}

// InternalSocket.prototype.writeLatin1String was introduced in Node v6.4.
InternalSocket.prototype.writeLatin1String = function(_req, data) {
  this.write(data, "latin1")
  if (NODE_10_AND_LATER) return NO_ERROR
}

InternalSocket.prototype.writeBuffer = function(req, data) {
  /* eslint consistent-return: 0 */
  this.write(NODE_0_10 ? req : data)
  if (NODE_0_10) return {}
  else if (NODE_10_AND_LATER) return NO_ERROR
}

InternalSocket.prototype.writeUtf8String = function(req, data) {
  /* eslint consistent-return: 0 */
  this.write(NODE_0_10 ? req : data, "utf8")
  if (NODE_0_10) return {}
  else if (NODE_10_AND_LATER) return NO_ERROR
}

InternalSocket.prototype.writeAsciiString = function(req, data) {
  /* eslint consistent-return: 0 */
  this.write(NODE_0_10 ? req : data, "ascii")
  if (NODE_0_10) return {}
  else if (NODE_10_AND_LATER) return NO_ERROR
}

InternalSocket.prototype.writeUcs2String = function(req, data) {
  /* eslint consistent-return: 0 */
  this.write(NODE_0_10 ? req : data, "ucs2")
  if (NODE_0_10) return {}
  else if (NODE_10_AND_LATER) return NO_ERROR
}

// While it seems to have existed since Node v0.10, Node v11.2 requires
// "shutdown". AFAICT, "shutdown" is for shutting the writable side down and
// hence the use of WritableStream.prototype.end and waiting for the "finish"
// event.
if (
  NODE_11_2_AND_LATER ||
  NODE_10_15_1_AND_MAJOR
) InternalSocket.prototype.shutdown = function(req) {
  this.once("finish", req.oncomplete.bind(req, NO_ERROR, req.handle))
  this.end()

  // Note v11.8 requires "shutdown" to return an error value, with "1"
  // indicating a "synchronous finish" (as per Node's net.js) and "0"
  // presumably success.
  return 0
}

// I'm unsure of the relationship between InternalSocket.prototype.shutdown and
// InternalSocket.prototype.close.
InternalSocket.prototype.close = function(done) {
  if (!this._writableState.finished) this.end(done)
  else if (done) done()
}

// Node v0.10 will use writeQueueSize to see if it should set write request's
// "cb" property or write more immediately.
if (NODE_0_10) InternalSocket.prototype.writeQueueSize = 0

function pair() {
  var a = Object.create(InternalSocket.prototype)
  var b = Object.create(InternalSocket.prototype)
  return [InternalSocket.call(a, b), InternalSocket.call(b, a)]
}

function readData(data) {
  if (NODE_0_10) return void this.onread(data, 0, data.length)
  if (!NODE_11_1_AND_LATER) return void this.onread(data.length, data)

  // A system written not in 1960 that passes arguments to functions through
  // _global_ mutable data structures…
  STREAM_STATE[STREAM_BYTES_READ] = data.length
  this.onread(data)
}

function readEof() {
  if (this.onread == null) return
  if (NODE_0_10) { process._errno = "EOF"; this.onread(null, 0, 0); return }
  if (!NODE_11_1_AND_LATER) return void this.onread(UV_EOF)

  STREAM_STATE[STREAM_BYTES_READ] = UV_EOF
  this.onread()
}

function noop() {}
