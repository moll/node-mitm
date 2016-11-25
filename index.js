var _ = require("underscore")
var Net = require("net")
var Tls = require("tls")
var Http = require("http")
var Https = require("https")
var ClientRequest = Http.ClientRequest
var Socket = require("./lib/socket")
var TlsSocket = require("./lib/tls_socket")
var EventEmitter = require("events").EventEmitter
var InternalSocket = require("./lib/internal_socket")
var Stubs = require("./lib/stubs")
var slice = Function.call.bind(Array.prototype.slice)
var normalizeConnectArgs = Net._normalizeConnectArgs || Net._normalizeArgs
var createRequestAndResponse = Http._connectionListener
module.exports = Mitm

function Mitm() {
  if (!(this instanceof Mitm))
    return Mitm.apply(Object.create(Mitm.prototype), arguments).enable()

  this.stubs = new Stubs
  this.on("request", addCrossReferences)

  return this
}

Mitm.prototype.on = EventEmitter.prototype.on
Mitm.prototype.once = EventEmitter.prototype.once
Mitm.prototype.off = EventEmitter.prototype.removeListener
Mitm.prototype.addListener = EventEmitter.prototype.addListener
Mitm.prototype.removeListener = EventEmitter.prototype.removeListener
Mitm.prototype.emit = EventEmitter.prototype.emit

var NODE_0_10 = !!process.version.match(/^v0\.10\./)

Mitm.prototype.enable = function() {
  // Connect is called synchronously.
  var netConnect = this.tcpConnect.bind(this, Net.connect)
  var tlsConnect = this.tlsConnect.bind(this, Tls.connect)

  this.stubs.stub(Net, "connect", netConnect)
  this.stubs.stub(Net, "createConnection", netConnect)
  this.stubs.stub(Http.Agent.prototype, "createConnection", netConnect)
  this.stubs.stub(Tls, "connect", tlsConnect)

  if (NODE_0_10) {
    // Node v0.10 sets createConnection on the object in the constructor.
    this.stubs.stub(Http.globalAgent, "createConnection", netConnect)

    // This will create a lot of sockets in tests, but that's the current price
    // to pay until I find a better way to force a new socket for each
    // connection.
    this.stubs.stub(Http.globalAgent, "maxSockets", Infinity)
    this.stubs.stub(Https.globalAgent, "maxSockets", Infinity)
  }

  // ClientRequest.prototype.onSocket is called synchronously from
  // ClientRequest's constructor and is a convenient place to hook into new
  // ClientRequests.
  this.stubs.stub(ClientRequest.prototype, "onSocket", _.compose(
    ClientRequest.prototype.onSocket,
    this.request.bind(this)
  ))

  return this
}

Mitm.prototype.disable = function() {
  return this.stubs.restore(), this
}

Mitm.prototype.connect = function connect(orig, Socket, opts, done) {
  var sockets = InternalSocket.pair()
  var client = new Socket(_.defaults({handle: sockets[0]}, opts))

  this.emit("connect", client, opts)
  if (client.bypassed) {
    var socket = orig.call(this, opts, done)
    if (client.recording) {
      socket.on('data', this.emit.bind(this, 'record', opts))
    }
    return socket
  }

  var server = client.server = new Socket({handle: sockets[1]})
  this.emit("connection", server, opts)

  // Ensure connect is emitted in next ticks, otherwise it would be impossible
  // to listen to it after calling Net.connect or listening to it after the
  // ClientRequest emits "socket".
  setTimeout(client.emit.bind(client, "connect"))
  setTimeout(server.emit.bind(server, "connect"))

  return client
}

Mitm.prototype.tcpConnect = function(orig, opts, done) {
  var args = normalizeConnectArgs(slice(arguments, 1))
  opts = args[0]; done = args[1]

  // The callback is originally bound to the connect event in
  // Socket.prototype.connect.
  var client = this.connect(orig, Socket, opts, done)
  if (client.server == null) return client
  if (done) client.once("connect", done)

  return client
}

Mitm.prototype.tlsConnect = function(orig, opts, done) {
  var args = normalizeConnectArgs(slice(arguments, 1))
  opts = args[0]; done = args[1]

  var client = this.connect(orig, TlsSocket, opts, done)
  if (client.server == null) return client
  if (done) client.once("secureConnect", done)

  setTimeout(client.emit.bind(client, "secureConnect"))

  return client
}

Mitm.prototype.request = function request(socket) {
  if (!socket.server) return socket

  // Node >= v0.10.24 < v0.11 will crash with: «Assertion failed:
  // (!current_buffer), function Execute, file ../src/node_http_parser.cc, line
  // 387.» if ServerResponse.prototype.write is called from within the
  // "request" event handler. Call it in the next tick to work around that.
  var self = this
  if (NODE_0_10) {
    self = Object.create(this)
    self.emit = _.compose(process.nextTick, Function.bind.bind(this.emit, this))
  }

  createRequestAndResponse.call(self, socket.server)
  return socket
}

function addCrossReferences(req, res) { req.res = res; res.req = req }
