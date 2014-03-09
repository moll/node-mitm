var StreamWrap = require("./stream_wrap")
module.exports = PipeStreamWrap

function PipeStreamWrap(target) {
  StreamWrap.call(this)
  this.target = target
}

PipeStreamWrap.prototype = Object.create(StreamWrap.prototype, {
  constructor: {value: PipeStreamWrap, configurable: true, writeable: true}
})

PipeStreamWrap.prototype._write = function(data, encoding, done) {
  this.target.push(data, encoding)
  done()
}
