var _ = require("underscore")
var Sinon = require("sinon")
var Net = require("net")
var Tls = require("tls")
var Http = require("http")
var Https = require("https")
var Semver = require("semver")
var Transform = require("stream").Transform
var IncomingMessage = Http.IncomingMessage
var ServerResponse = Http.ServerResponse
var ClientRequest = Http.ClientRequest
var EventEmitter = require("events").EventEmitter
var Mitm = require("..")
var NODE_0_10 = Semver.satisfies(process.version, ">= 0.10 < 0.11")
var newBuffer = Buffer.from || function(d, enc) { return new Buffer(d, enc) }

describe("Mitm", function() {
  beforeEach(function() { Mitm.passthrough = false })

  it("must return an instance of Mitm when called as a function", function() {
    var mitm = Mitm()
    mitm.must.be.an.instanceof(Mitm)
    mitm.disable()
  })

  function mustConnect(module) {
    describe("as connect", function() {
      it("must return an instance of Net.Socket", function() {
        var socket = module.connect({host: "foo", port: 80})
        socket.must.be.an.instanceof(Net.Socket)
      })

      it("must return an instance of Net.Socket given port", function() {
        module.connect(80).must.be.an.instanceof(Net.Socket)
      })

      it("must return an instance of Net.Socket given port and host",
        function() {
        module.connect(80, "10.0.0.1").must.be.an.instanceof(Net.Socket)
      })

      it("must emit connect on Mitm", function() {
        var onConnect = Sinon.spy()
        this.mitm.on("connect", onConnect)
        var opts = {host: "foo"}
        var socket = module.connect(opts)

        onConnect.callCount.must.equal(1)
        onConnect.firstCall.args[0].must.equal(socket)
        onConnect.firstCall.args[1].must.equal(opts)
      })

      it("must emit connect on Mitm with options object given host and port",
        function() {
        var onConnect = Sinon.spy()
        this.mitm.on("connect", onConnect)
        var socket = module.connect(9, "127.0.0.1")

        onConnect.callCount.must.equal(1)
        onConnect.firstCall.args[0].must.equal(socket)
        onConnect.firstCall.args[1].must.eql({host: "127.0.0.1", port: 9})
      })

      it("must emit connection on Mitm", function() {
        var onConnection = Sinon.spy()
        this.mitm.on("connection", onConnection)
        var opts = {host: "foo"}
        var socket = module.connect(opts)

        onConnection.callCount.must.equal(1)
        onConnection.firstCall.args[0].must.be.an.instanceof(Net.Socket)
        onConnection.firstCall.args[0].must.not.equal(socket)
        onConnection.firstCall.args[1].must.equal(opts)
      })

      it("must emit connect on socket in next ticks", function(done) {
        var socket = module.connect({host: "foo"})
        socket.on("connect", done.bind(null, null))
      })

      it("must call back on connect given callback", function(done) {
        module.connect({host: "foo"}, done.bind(null, null))
      })

      it("must call back on connect given port and callback", function(done) {
        module.connect(80, done.bind(null, null))
      })

      // This was a bug found on Apr 26, 2014 where the host argument was taken
      // to be the callback because arguments weren't normalized to an options
      // object.
      it("must call back on connect given port, host and callback",
        function(done) {
        module.connect(80, "localhost", done.bind(null, null))
      })

      // The "close" event broke on Node v12.16.3 as the
      // InternalSocket.prototype.close method didn't call back if
      // the WritableStream had already been closed.
      it("must emit close on socket if ended immediately", function(done) {
        this.mitm.on("connection", function(socket) { socket.end() })
        var socket = module.connect({host: "foo"})
        socket.on("close", done.bind(null, null))
      })

      it("must emit close on socket if ended in next tick", function(done) {
        this.mitm.on("connection", function(socket) {
          process.nextTick(socket.end.bind(socket))
        })

        var socket = module.connect({host: "foo"})
        socket.on("close", done.bind(null, null))
      })

      it("must intercept 127.0.0.1", function(done) {
        var server; this.mitm.on("connection", function(s) { server = s })
        var client = module.connect({host: "127.0.0.1"})
        server.write("Hello")

        client.setEncoding("utf8")
        client.on("data", function(data) { data.must.equal("Hello") })
        client.on("data", done.bind(null, null))
      })

      describe("when bypassed", function() {
        beforeEach(function() { this.sinon = Sinon.sandbox.create() })
        afterEach(function() { this.sinon.restore() })

        it("must not intercept", function(done) {
          this.mitm.on("connect", function(client) { client.bypass() })

          module.connect({host: "127.0.0.1", port: 9}).on("error", function(err) {
            err.must.be.an.instanceof(Error)
            err.message.must.include("ECONNREFUSED")
            done()
          })
        })

        it("must call original module.connect", function() {
          this.mitm.disable()

          var connect = this.sinon.spy(module, "connect")
          var mitm = Mitm()
          mitm.on("connect", function(client) { client.bypass() })

          try {
            module.connect({host: "127.0.0.1", port: 9}).on("error", noop)
            connect.callCount.must.equal(1)
            connect.firstCall.args[0].must.eql({host: "127.0.0.1", port: 9})
          }
          // Working around Mocha's context bug(s) and poor design decision
          // with a manual `finally`.
          finally { mitm.disable() }
        })

        it("must not call back twice on connect given callback",
          function(done) {
          this.mitm.on("connect", function(client) { client.bypass() })

          var onConnect = Sinon.spy()
          var client = module.connect({host: "127.0.0.1", port: 9}, onConnect)

          client.on("error", process.nextTick.bind(null, function() {
            onConnect.callCount.must.equal(0)
            done()
          }))
        })

        it("must not emit connection", function() {
          this.mitm.on("connect", function(client) { client.bypass() })
          var onConnection = Sinon.spy()
          this.mitm.on("connection", onConnection)
          module.connect({host: "127.0.0.1", port: 9}).on("error", noop)
          onConnection.callCount.must.equal(0)
        })
      })
    })
  }

  describe("Net.connect", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    mustConnect(Net)

    if (!NODE_0_10)
    it("must not return an instance of Tls.TLSSocket", function() {
      var client = Net.connect({host: "foo", port: 80})
      client.must.not.be.an.instanceof(Tls.TLSSocket)
    })

    it("must not set the encrypted property", function() {
      Net.connect({host: "foo"}).must.not.have.property("encrypted")
    })

    it("must not set the authorized property", function() {
      Net.connect({host: "foo"}).must.not.have.property("authorized")
    })

    it("must not emit secureConnect on client", function(done) {
      var client = Net.connect({host: "foo"})
      // Let Mocha raise an error when done called twice.
      client.on("secureConnect", done.bind(null, null))
      done()
    })

    it("must not emit secureConnect on server", function(done) {
      var server; this.mitm.on("connection", function(s) { server = s })
      Net.connect({host: "foo"})
      // Let Mocha raise an error when done called twice.
      server.on("secureConnect", done.bind(null, null))
      done()
    })

    describe("Socket", function() {
      describe(".prototype.write", function() {
        it("must write to client from server", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          server.write("Hello ☺️")

          client.setEncoding("utf8")
          client.on("data", function(data) { data.must.equal("Hello ☺️") })
          client.on("data", done.bind(null, null))
        })

        it("must write to client from server in the next tick", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})

          var ticked = false
          client.once("data", function() { ticked.must.be.true(); done() })
          server.write("Hello")
          ticked = true
        })

        it("must write to server from client", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello ☺️")

          server.setEncoding("utf8")
          process.nextTick(function() { server.read().must.equal("Hello ☺️") })
          process.nextTick(done)
        })

        it("must write to server from client in the next tick", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})

          var ticked = false
          server.once("data", function() { ticked.must.be.true(); done() })
          client.write("Hello")
          ticked = true
        })

        // Writing binary strings was introduced in Node v0.11.14.
        // The test still passes for Node v0.10 and newer v0.11s, so let it be.
        it("must write to server from client given binary", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "binary")

          server.setEncoding("binary")
          process.nextTick(function() { server.read().must.equal("Hello") })
          process.nextTick(done)
        })

        // Writing latin1 strings was introduced in v6.4.
        // https://github.com/nodejs/node/commit/28071a130e2137bd14d0762a25f0ad83b7a28259
        if (Semver.satisfies(process.version, ">= 6.4"))
        it("must write to server from client given latin1", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "latin1")

          server.setEncoding("latin1")
          process.nextTick(function() { server.read().must.equal("Hello") })
          process.nextTick(done)
        })

        it("must write to server from client given a buffer", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write(newBuffer("Hello", "binary"))

          process.nextTick(function() {
            assertBuffers(server.read(), newBuffer("Hello", "binary"))
            done()
          })
        })

        it("must write to server from client given a UTF-8 string",
          function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "utf8")

          process.nextTick(function() {
            assertBuffers(server.read(), newBuffer("Hello", "binary"))
            done()
          })
        })

        it("must write to server from client given a ASCII string",
          function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "ascii")

          process.nextTick(function() {
            assertBuffers(server.read(), newBuffer("Hello", "binary"))
            done()
          })
        })

        it("must write to server from client given a UCS-2 string",
          function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "ucs2")

          process.nextTick(function() {
            assertBuffers(
              server.read(),
              newBuffer("H\u0000e\u0000l\u0000l\u0000o\u0000", "binary")
            )

            done()
          })
        })
      })

      describe(".prototype.end", function() {
        it("must emit end when closed on server", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          server.end()
          client.on("end", done)
        })
      })

      describe(".prototype.ref", function() {
        it("must allow calling on client", function() {
          Net.connect({host: "foo"}).ref()
        })

        it("must allow calling on server", function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          Net.connect({host: "foo"})
          server.ref()
        })
      })

      describe(".prototype.unref", function() {
        it("must allow calling on client", function() {
          Net.connect({host: "foo"}).unref()
        })

        it("must allow calling on server", function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          Net.connect({host: "foo"})
          server.unref()
        })
      })

      describe(".prototype.pipe", function() {
        // To confirm https://github.com/moll/node-mitm/issues/47 won't become
        // an issue.
        it("must allow piping to itself", function(done) {
          this.mitm.on("connection", function(server) {
            server.pipe(new Upcase).pipe(server)
          })

          var client = Net.connect({host: "foo"})
          client.write("Hello")

          client.setEncoding("utf8")
          client.on("data", function(data) { data.must.equal("HELLO") })
          client.on("data", done.bind(null, null))
        })
      })

      // Bug report from Io.js v3 days:
      // https://github.com/moll/node-mitm/issues/26
      describe(".prototype.destroy", function() {
        it("must emit end when destroyed on server", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          server.destroy()
          client.on("end", done)
        })
      })
    })
  })

  describe("Net.createConnection", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must be equal to Net.connect", function() {
      Net.createConnection.must.equal(Net.connect)
    })
  })

  describe("Tls.connect", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    mustConnect(Tls)

    if (!NODE_0_10)
    it("must return an instance of Tls.TLSSocket", function() {
      Tls.connect({host: "foo", port: 80}).must.be.an.instanceof(Tls.TLSSocket)
    })

    if (!NODE_0_10)
    it("must return an instance of Tls.TLSSocket given port", function() {
      Tls.connect(80).must.be.an.instanceof(Tls.TLSSocket)
    })

    if (!NODE_0_10)
    it("must return an instance of Tls.TLSSocket given port and host",
      function() {
      Tls.connect(80, "10.0.0.1").must.be.an.instanceof(Tls.TLSSocket)
    })

    it("must emit secureConnect in next ticks", function(done) {
      var socket = Tls.connect({host: "foo"})
      socket.on("secureConnect", done.bind(null, null))
    })

    it("must emit secureConnect after connect in next ticks", function(done) {
      var socket = Tls.connect({host: "foo"})

      socket.on("connect", function() {
        socket.on("secureConnect", done.bind(null, null))
      })
    })

    it("must not emit secureConnect on server", function(done) {
      var server; this.mitm.on("connection", function(s) { server = s })
      Tls.connect({host: "foo"})
      // Let Mocha raise an error when done called twice.
      server.on("secureConnect", done.bind(null, null))
      done()
    })

    it("must call back on secureConnect", function(done) {
      var connected = false

      var client = Tls.connect({host: "foo"}, function() {
        connected.must.be.true()
        done()
      })

      client.on("connect", function() { connected = true })
    })

    it("must set encrypted true", function() {
      Tls.connect({host: "foo"}).encrypted.must.be.true()
    })

    it("must set authorized true", function() {
      Tls.connect({host: "foo"}).authorized.must.be.true()
    })
  })

  function mustRequest(request) {
    describe("as request", function() {
      it("must return ClientRequest", function() {
        request({host: "foo"}).must.be.an.instanceof(ClientRequest)
      })

      it("must emit connect on Mitm", function() {
        var onConnect = Sinon.spy()
        this.mitm.on("connect", onConnect)
        request({host: "foo"})
        onConnect.callCount.must.equal(1)
      })

      it("must emit connect on Mitm after multiple connections", function() {
        var onConnect = Sinon.spy()
        this.mitm.on("connect", onConnect)
        request({host: "foo"})
        request({host: "foo"})
        request({host: "foo"})
        onConnect.callCount.must.equal(3)
      })

      it("must emit connection on Mitm", function() {
        var onConnection = Sinon.spy()
        this.mitm.on("connection", onConnection)
        request({host: "foo"})
        onConnection.callCount.must.equal(1)
      })

      it("must emit connection on Mitm after multiple connections", function() {
        var onConnection = Sinon.spy()
        this.mitm.on("connection", onConnection)
        request({host: "foo"})
        request({host: "foo"})
        request({host: "foo"})
        onConnection.callCount.must.equal(3)
      })

      it("must emit request on Mitm", function(done) {
        var client = request({host: "foo"})
        client.end()

        this.mitm.on("request", function(req, res) {
          req.must.be.an.instanceof(IncomingMessage)
          req.must.not.equal(client)
          res.must.be.an.instanceof(ServerResponse)
          done()
        })
      })

      it("must emit request on Mitm after multiple requests", function(done) {
        request({host: "foo"}).end()
        request({host: "foo"}).end()
        request({host: "foo"}).end()
        this.mitm.on("request", _.after(3, done.bind(null, null)))
      })

      it("must emit socket on request in next ticks", function(done) {
        var client = request({host: "foo"})
        client.on("socket", done.bind(null, null))
      })

      // https://github.com/moll/node-mitm/pull/25
      it("must emit connect after socket event", function(done) {
        var client = request({host: "foo"})

        client.on("socket", function(socket) {
          socket.on("connect", done.bind(null, null))
        })
      })

      describe("when bypassed", function() {
        it("must not intercept", function(done) {
          this.mitm.on("connect", function(client) { client.bypass() })
          request({host: "127.0.0.1"}).on("error", function(err) {
            err.must.be.an.instanceof(Error)
            err.message.must.include("ECONNREFUSED")
            done()
          })
        })

        it("must not emit request", function(done) {
          this.mitm.on("connect", function(client) { client.bypass() })
          var onRequest = Sinon.spy()
          this.mitm.on("request", onRequest)
          request({host: "127.0.0.1"}).on("error", function(_err) {
            onRequest.callCount.must.equal(0)
            done()
          })
        })
      })
    })
  }

  describe("via Http.request", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    mustRequest(Http.request)
  })

  describe("via Https.request", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    mustRequest(Https.request)

    // https://github.com/moll/node-mitm/pull/25
    it("must emit secureConnect after socket event", function(done) {
      var client = Https.request({host: "foo"})

      client.on("socket", function(socket) {
        socket.on("secureConnect", done.bind(null, null))
      })
    })
  })

  describe("via Http.Agent", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    mustRequest(function(opts) {
      return Http.request(_.extend({agent: new Http.Agent}, opts))
    })

    it("must support keep-alive", function(done) {
      var client = Http.request({
        host: "foo",
        agent: new Http.Agent({keepAlive: true})
      })

      client.end()

      this.mitm.on("request", function(_req, res) {
        res.setHeader("Connection", "keep-alive")
        res.end()
      })

      // Just waiting for response is too early to trigger:
      // TypeError: socket._handle.getAsyncId is not a function in _http_client.
      client.on("response", function(res) {
        res.on("data", noop)
        res.on("end", done)
      })
    })
  })

  describe("via Https.Agent", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    mustRequest(function(opts) {
      return Https.request(_.extend({agent: new Https.Agent}, opts))
    })
  })

  describe("IncomingMessage", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must have URL", function(done) {
      Http.request({host: "foo", path: "/foo"}).end()

      this.mitm.on("request", function(req) {
        req.url.must.equal("/foo")
        done()
      })
    })

    it("must have headers", function(done) {
      var req = Http.request({host: "foo"})
      req.setHeader("Content-Type", "application/json")
      req.end()

      this.mitm.on("request", function(req) {
        req.headers["content-type"].must.equal("application/json")
        done()
      })
    })

    it("must have body", function(done) {
      var client = Http.request({host: "foo", method: "POST"})
      client.write("Hello")

      this.mitm.on("request", function(req, _res) {
        req.setEncoding("utf8")
        req.on("data", function(data) { data.must.equal("Hello"); done() })
      })
    })

    it("must have a reference to the ServerResponse", function(done) {
      Http.request({host: "foo", method: "POST"}).end()
      this.mitm.on("request", function(req, res) { req.res.must.equal(res) })
      this.mitm.on("request", done.bind(null, null))
    })
  })

  describe("ServerResponse", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must respond with status, headers and body", function(done) {
      this.mitm.on("request", function(_req, res) {
        res.statusCode = 442
        res.setHeader("Content-Type", "application/json")
        res.end("Hi!")
      })

      Http.request({host: "foo"}).on("response", function(res) {
        res.statusCode.must.equal(442)
        res.headers["content-type"].must.equal("application/json")
        res.setEncoding("utf8")
        res.once("data", function(data) { data.must.equal("Hi!"); done() })
      }).end()
    })

    it("must have a reference to the IncomingMessage", function(done) {
      Http.request({host: "foo", method: "POST"}).end()
      this.mitm.on("request", function(req, res) { res.req.must.equal(req) })
      this.mitm.on("request", done.bind(null, null))
    })

    describe(".prototype.write", function() {
      it("must make clientRequest emit response", function(done) {
        var req = Http.request({host: "foo"})
        req.end()
        this.mitm.on("request", function(_req, res) { res.write("Test") })
        req.on("response", done.bind(null, null))
      })

      // Under Node v0.10 it's the writeQueueSize that's checked to see if
      // the callback can be called.
      it("must call given callback", function(done) {
        Http.request({host: "foo"}).end()
        this.mitm.on("request", function(_req, res) { res.write("Test", done) })
      })
    })

    describe(".prototype.end", function() {
      it("must make ClientRequest emit response", function(done) {
        var client = Http.request({host: "foo"})
        client.end()
        this.mitm.on("request", function(_req, res) { res.end() })
        client.on("response", done.bind(null, null))
      })

      // In an app of mine Node v0.11.7 did not emit the end event, but
      // v0.11.11 did. I'll investigate properly if this becomes a problem in
      // later Node versions.
      it("must make IncomingMessage emit end", function(done) {
        var client = Http.request({host: "foo"})
        client.end()
        this.mitm.on("request", function(_req, res) { res.end() })

        client.on("response", function(res) {
          res.on("data", noop)
          res.on("end", done)
        })
      })
    })
  })

  _.each({
    on: EventEmitter.prototype.on,
    once: EventEmitter.prototype.once,
    off: EventEmitter.prototype.removeListener,
    addListener: EventEmitter.prototype.addListener,
    removeListener: EventEmitter.prototype.removeListener,
    emit: EventEmitter.prototype.emit
  }, function(to, from) {
    describe(".prototype." + from, function() {
      it("must be an alias to EventEmitter.prototype", function() {
        Mitm.prototype.must.have.property(from, to)
        Mitm.prototype[from].must.be.a.function()
      })
    })
  })
})

function Upcase() { Transform.call(this, arguments) }

Upcase.prototype = Object.create(Transform.prototype, {
  constructor: {value: Upcase, configurable: true, writeable: true}
})

Upcase.prototype._transform = function(chunk, _enc, done) {
  done(null, String(chunk).toUpperCase())
}

function assertBuffers(a, b) {
  if (a.equals) a.equals(b).must.be.true()
  else a.toString("utf8").must.equal(b.toString("utf8"))
}

function noop() {}
