var _ = require("underscore")
var Net = require("net")
var Tls = require("tls")
var Http = require("http")
var Https = require("https")
var ClientRequest = Http.ClientRequest
var ServerResponse = Http.ServerResponse
var Concert = require("concert")
var StreamWrap = require("./lib/stream_wrap")
var PipeStreamWrap = require("./lib/pipe_stream_wrap")
var Stubs = require("./lib/stubs")
var slice = Array.prototype.slice
var normalizeConnectArgs = Net._normalizeConnectArgs
module.exports = Mitm

function Mitm() {
  if (!(this instanceof Mitm))
    return Mitm.apply(Object.create(Mitm.prototype), arguments).enable()

  this.stubs = new Stubs
  return this
}

_.extend(Mitm.prototype, Concert)

var NODE_0_10 = !!process.version.match(/^v0\.10\./)

Mitm.prototype.enable = function() {
  // Connect is called synchronously.
  var netConnect = connect.bind(this)
  this.stubs.stub(Net, "connect", netConnect)
  this.stubs.stub(Net, "createConnection", netConnect)
  this.stubs.stub(Http.Agent.prototype, "createConnection", netConnect)

  if (NODE_0_10) {
    // Node v0.10 sets createConnection on the object in the constructor.
    this.stubs.stub(Http.globalAgent, "createConnection", netConnect)

    // This will create a lot of sockets in tests, but that's the current price
    // to pay until I find a better way to force a new socket for each
    // connection.
    this.stubs.stub(Http.globalAgent, "maxSockets", Infinity)
    this.stubs.stub(Https.globalAgent, "maxSockets", Infinity)
  }

  // Fake a regular, non-SSL socket for now as TLSSocket requires more mocking.
  this.stubs.stub(Tls, "connect", _.compose(authorize, netConnect))

  // ClientRequest.prototype.onSocket is called synchronously.
  var onSocket = decontextify(onRequest.bind(this))
  onSocket = _.compose(onSocket, ClientRequest.prototype.onSocket)
  this.stubs.stub(ClientRequest.prototype, "onSocket", onSocket)

  return this
}

function connect(opts, done) {
  var args = normalizeConnectArgs(arguments), opts = args[0], done = args[1]
  var socket = new Net.Socket(_.defaults({handle: new StreamWrap}, opts))

  // The callback is originally bound to the connect event in
  // Socket.prototype.connect.
  if (done) socket.once("connect", done)

  // Trigger connect in the next tick, otherwise it would be impossible to
  // listen to it after calling Net.connect.
  process.nextTick(socket.emit.bind(socket, "connect"))

  return this.trigger("connect", socket), socket
}

function authorize(socket) {
  return socket.authorized = true, socket
}

function onRequest(req) {
  var res = req.server = new ServerResponse(req)

  // Request's socket event will be emitted after the socket is created in
  // Agent.prototype.createConnection and then passed over to
  // ClientRequest.prototype.onSocket for processing on the next tick.
  req.once("socket", assignSocket.bind(null, req, res))

  this.trigger("request", req, res)
}

Mitm.prototype.disable = function() {
  return this.stubs.restore(), this
}

function assignSocket(req, res) {
  var socket = new Net.Socket({handle: new PipeStreamWrap(req.socket._handle)})
  socket.emit("connect")
  res.assignSocket(socket)
}

function decontextify(fn, self) {
  return function() {
    Array.prototype.unshift.call(arguments, this)
    return fn.apply(self, arguments)
  }
}
