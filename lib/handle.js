module.exports = Handle

function Handle() {}

Handle.prototype.readStart = function() {}
Handle.prototype.readStop = function() {}
Handle.prototype.close = function() {}

Handle.prototype.write = function(chunk) {
  this.onread(Buffer.byteLength(chunk), chunk)
}
