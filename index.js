var _ = require("underscore")
var Net = require("net")
var Tls = require("tls")
var Http = require("http")
var ClientRequest = Http.ClientRequest
var ServerResponse = Http.ServerResponse
var Stream = require("stream")
var Concert = require("concert")
var StreamWrap = require("./lib/stream_wrap")
var PipeStreamWrap = require("./lib/pipe_stream_wrap")
var slice = Array.prototype.slice
module.exports = Mitm

function Mitm() {
  if (!(this instanceof Mitm))
    return Mitm.apply(Object.create(Mitm.prototype), arguments).enable()

  return this.reset()
}

_.extend(Mitm.prototype, Concert)

Mitm.prototype.enable = function() {
  this.origNetConnect = Net.connect
  this.origTlsConnect = Tls.connect
  this.origAgentRequest = Http.Agent.prototype.request

  Net.connect = _.wrap(Net.connect, this.connect.bind(this, Http))
  Net.createConnection = Net.connect
  Http.Agent.prototype.createConnection = Net.connect

  var request = bind2(this.request, this)
  Http.Agent.prototype.request = _.wrap(Http.Agent.prototype.request, request)

  // TLS's Agent has its own createConnection which calls Tls.connect.
  Tls.connect = _.wrap(Tls.connect, this.connect.bind(this, Tls))

  return this
}

Mitm.prototype.request = function(agent, orig, opts, done) {
  // Disable pooling as it's simpler to fake responses when you can do so in any
  // order.
  opts.agent = false
  var req = orig.apply(agent, slice.call(arguments, 2))
  var res = new ServerResponse(req)
  req.respond = respond.bind(req)
  req.once("socket", assignSocket.bind(null, req, res))

  this.requests.push(req)
  this.responses.push(res)
  this.trigger("request", req, res)

  return req
}

// Connect when called by Agent.prototype.createSocket is really called in
// the context of the Agent, but that's not so when called by Https's Agent.
Mitm.prototype.connect = function(Http, orig, opts, done) {
  opts.handle = new StreamWrap
  // Fake a regular, non-SSL socket for now as Https.TLSSocket requires more
  // mocking.
  var socket = new Net.Socket(opts)
  socket.handle = opts.handle

  // Connect is originally bound to the the callback in
  // Socket.prototype.connect.
  if (done) socket.once("connect", done)
  socket.emit("connect")

  return socket
}

Mitm.prototype.reset = function() {
  this.requests = []
  this.responses = []
  return this
}

Mitm.prototype.disable = function() {
  Net.connect = this.origNetConnect
  Net.createConnection = Net.connect
  Http.Agent.prototype.createConnection = Net.connect
  Http.Agent.prototype.request = this.origAgentRequest
  Tls.connect = this.origTlsConnect

  return this.reset()
}

function assignSocket(req, res) {
  var socket = new Net.Socket({handle: new PipeStreamWrap(req.socket.handle)})
  socket.emit("connect")
  res.assignSocket(socket)
}

function respond(status, headers, body) {
  var resp = []
  // No Keep-Alive support in HTTP/1.0. ;-)
  resp.push("HTTP/1.0 " + status + " " + Http.STATUS_CODES[status])
  for (var header in headers) resp.push(header + ": " + headers[header])
  resp.push("")
  resp.push(body)

  this.socket.handle.push(resp.join("\n"))
  this.socket.handle.push(null)
}

function bind2(fn, self) {
  return function() {
    Array.prototype.unshift.call(arguments, this)
    return fn.apply(self, arguments)
  }
}
