var _ = require("underscore")
var Net = require("net")
var Tls = require("tls")
var Http = require("http")
var Https = require("https")
var ClientRequest = Http.ClientRequest
var ServerResponse = Http.ServerResponse
var Socket = Net.Socket
var Concert = require("concert")
var InternalSocket = require("./lib/internal_socket")
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

  // ClientRequest.prototype.onSocket is called synchronously from
  // ClientRequest's consturctor and is a convenient place to hook into new
  // ClientRequests.
  var onSocket = decontextify(onRequest.bind(this))
  onSocket = _.compose(ClientRequest.prototype.onSocket, onSocket)
  this.stubs.stub(ClientRequest.prototype, "onSocket", onSocket)

  return this
}

Mitm.prototype.disable = function() {
  return this.stubs.restore(), this
}

function connect(opts, done) {
  var args = normalizeConnectArgs(arguments), opts = args[0], done = args[1]
  var internalSocket = InternalSocket.pair()
  var client = new Socket(_.defaults({handle: internalSocket}, opts))
  var server = client.server = new Socket({handle: internalSocket.remote})

  // The callback is originally bound to the connect event in
  // Socket.prototype.connect.
  if (done) client.once("connect", done)

  // Trigger connect in the next tick, otherwise it would be impossible to
  // listen to it after calling Net.connect.
  process.nextTick(client.emit.bind(client, "connect"))
  process.nextTick(server.emit.bind(server, "connect"))

  this.trigger("connect", client)
  this.trigger("connection", server)

  return client
}

function authorize(socket) {
  return socket.authorized = true, socket
}

function onRequest(req, socket) {
  // AssignSocket is called synchronously from Net.Server's new connection
  // handler in http.js.
  var res = req.server = new ServerResponse(req)

  // NOTE: Node v0.10 expects the server socket to be set after the client
  // socket is set. Node v0.11 works both ways.
  req.on("socket", res.assignSocket.bind(res, socket.server))

  return this.trigger("request", req, res), socket
}

function decontextify(fn, self) {
  return function() {
    Array.prototype.unshift.call(arguments, this)
    return fn.apply(self, arguments)
  }
}
