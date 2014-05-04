// StreamWrap is tested via integration tests at Mitm class level by invoking
// functions on ClientRequest.
var DuplexStream = require("stream").Duplex
module.exports = StreamWrap

function StreamWrap() {
  DuplexStream.call(this)
  this.on("data", callOnRead.bind(this))
}

StreamWrap.prototype = Object.create(DuplexStream.prototype, {
  constructor: {value: StreamWrap, configurable: true, writeable: true}
})

var NODE_0_10 = !!process.version.match(/^v0\.10\./)

function callOnRead(data) {
  if (NODE_0_10) this.onread(data, 0, data.length)
  else this.onread(data.length, data)
}

StreamWrap.prototype.readStart = noop
StreamWrap.prototype.readStop = noop
StreamWrap.prototype.close = function(done) { done() }

StreamWrap.prototype._read = noop
StreamWrap.prototype._write = noop

// NOTE: Node v0.10 expects StreamWrap to return write request objects with a
// "oncomplete" and "cb" property. Node v0.11 expects it return an error
// instead.

StreamWrap.prototype.writeBuffer = function(req, data) {
  this.write(NODE_0_10 ? req : data)
  if (NODE_0_10) return {}
}

StreamWrap.prototype.writeUtf8String = function(req, data) {
  this.write(NODE_0_10 ? req : data, "utf8")
  if (NODE_0_10) return {}
}

StreamWrap.prototype.writeAsciiString = function(req, data) {
  this.write(NODE_0_10 ? req : data, "ascii")
  if (NODE_0_10) return {}
}

StreamWrap.prototype.writeUcs2String = function(req, data) {
  this.write(NODE_0_10 ? req : data, "ucs2")
  if (NODE_0_10) return {}
}

// Node v0.10 will use writeQueueSize to see if it should set write request's
// "cb" property or write more immediately.
if (NODE_0_10) StreamWrap.prototype.writeQueueSize = 0

function noop() {}
