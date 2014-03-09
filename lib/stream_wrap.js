// StreamWrap is tested via integration tests at Mitm class level by invoking
// functions on ClientRequest.
module.exports = StreamWrap

function StreamWrap() {}

StreamWrap.prototype.push = function(chunk) {
  this.onread(Buffer.byteLength(chunk), chunk)
}

StreamWrap.prototype.readStart = noop
StreamWrap.prototype.readStop = noop
StreamWrap.prototype.close = noop

// Write functions used by net.js in createWriteReq.
StreamWrap.prototype.writeBuffer = noop

function noop() {}
