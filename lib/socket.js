var Net = require("net")
module.exports = Socket

function Socket() { Net.Socket.apply(this, arguments) }

Socket.prototype = Object.create(Net.Socket.prototype, {
  constructor: {value: Socket, configurable: true, writeable: true}
})

Socket.prototype.bypass = function() {
  this.bypassed = true
}

// iojs ssl implementation needs this,
// see https://github.com/moll/node-mitm/pull/23
// WHY? I dunno. You do? Contact us!
Socket.prototype.getSession = function() {}
