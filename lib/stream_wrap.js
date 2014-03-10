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

StreamWrap.prototype.readStart = noop
StreamWrap.prototype.readStop = noop
StreamWrap.prototype.close = function(done) { done() }

StreamWrap.prototype._read = noop
function callOnRead(data) { this.onread(Buffer.byteLength(data), data) }

// Write functions used by net.js in createWriteReq.
StreamWrap.prototype._write = noop

StreamWrap.prototype.writeBuffer = function(req, data) {
  this.write(data)
}

StreamWrap.prototype.writeUtf8String = function(req, data) {
  this.write(data, "utf8")
}

StreamWrap.prototype.writeAsciiString = function(req, data) {
  this.write(data, "ascii")
}

StreamWrap.prototype.writeUcs2String = function(req, data) {
  this.write(data, "ucs2")
}

function noop() {}
