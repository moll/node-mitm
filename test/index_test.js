var _ = require("underscore")
var Sinon = require("sinon")
var Net = require("net")
var Tls = require("tls")
var Http = require("http")
var Https = require("https")
var IncomingMessage = Http.IncomingMessage
var ServerResponse = Http.ServerResponse
var ClientRequest = Http.ClientRequest
var EventEmitter = require("events").EventEmitter
var Mitm = require("..")
var NODE_0_10 = !!process.version.match(/^v0\.10\./)

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

      it("must emit connect with options object given host and port",
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

      it("must emit connect on socket in next tick", function(done) {
        var socket = module.connect({host: "foo"})
        var onConnect = Sinon.spy()
        socket.on("connect", onConnect)
        process.nextTick(function() { onConnect.callCount.must.equal(1) })
        process.nextTick(done)
      })

      it("must call back on connect given callback", function(done) {
        var onConnect = Sinon.spy()
        module.connect({host: "foo"}, onConnect)
        process.nextTick(function() { onConnect.callCount.must.equal(1) })
        process.nextTick(done)
      })

      it("must call back on connect given port and callback", function(done) {
        var onConnect = Sinon.spy()
        module.connect(80, onConnect)
        process.nextTick(function() { onConnect.callCount.must.equal(1) })
        process.nextTick(done)
      })

      // This was a bug found on Apr 26, 2014 where the host argument was taken
      // to be the callback because arguments weren't normalized to an options
      // object.
      it("must call back on connect given port, host and callback",
        function(done) {
        var onConnect = Sinon.spy()
        module.connect(80, "localhost", onConnect)
        process.nextTick(function() { onConnect.callCount.must.equal(1) })
        process.nextTick(done)
      })

      it("must intercept 127.0.0.1", function() {
        var server; this.mitm.on("connection", function(s) { server = s })
        var client = module.connect({host: "127.0.0.1"})
        server.write("Hello")
        client.setEncoding("utf8")
        client.read().must.equal("Hello")
      })

      describe("when bypassed", function() {
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
          this.mitm = Mitm()
          this.mitm.on("connect", function(client) { client.bypass() })

          module.connect({host: "127.0.0.1", port: 9}).on("error", noop)
          connect.callCount.must.equal(1)
          connect.firstCall.args[0].must.eql({host: "127.0.0.1", port: 9})
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
    beforeEach(function() { this.sinon = Sinon.sandbox.create() })
    afterEach(function() { this.sinon.restore() })
    afterEach(function() { this.mitm.disable() })

    mustConnect(Net)

    if (!NODE_0_10)
    it("must not return an instance of Tls.TLSSocket", function() {
      var socket = Net.connect({host: "foo", port: 80})
      socket.must.not.be.an.instanceof(Tls.TLSSocket)
    })

    it("must not set the encrypted property", function() {
      Net.connect({host: "foo"}).must.not.have.property("encrypted")
    })

    it("must not set the authorized property", function() {
      Net.connect({host: "foo"}).must.not.have.property("authorized")
    })

    describe("Socket", function() {
      describe(".prototype.write", function() {
        it("must write to client side from server side", function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          server.write("Hello")
          client.setEncoding("utf8")
          client.read().must.equal("Hello")
        })

        it("must write to server side from client side", function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello")
          server.setEncoding("utf8")
          server.read().must.equal("Hello")
        })

        // Writing binary strings was introduced in Node v0.11.14.
        // The test still passes for Node v0.10 and newer v0.11s, so let it be.
        it("must write to server side from client side given binary",
          function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "binary")
          server.setEncoding("binary")
          server.read().must.equal("Hello")
        })

        it("must write to server side from client side given a buffer",
          function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write(new Buffer("Hello"))
          server.setEncoding("utf8")
          server.read().must.equal("Hello")
        })

        it("must write to server side from client side given a UTF-8 string",
          function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "utf8")
          server.setEncoding("utf8")
          server.read().must.equal("Hello")
        })

        it("must write to server side from client side given a ASCII string",
          function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "ascii")
          server.setEncoding("utf8")
          server.read().must.equal("Hello")
        })

        it("must write to server side from client side given a UCS-2 string",
          function() {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          client.write("Hello", "ucs2")
          server.setEncoding("ucs2")
          server.read().must.equal("H\u0000e\u0000l\u0000l\u0000o\u0000")
        })
      })

      describe(".prototype.end", function() {
        it("must emit end when closed on server side", function(done) {
          var server; this.mitm.on("connection", function(s) { server = s })
          var client = Net.connect({host: "foo"})
          server.end()
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
    beforeEach(function() { this.sinon = Sinon.sandbox.create() })
    afterEach(function() { this.sinon.restore() })
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

    it("must set encrypted true", function() {
      Tls.connect({host: "foo"}).encrypted.must.be.true()
    })

    it("must set authorized true", function() {
      Tls.connect({host: "foo"}).authorized.must.be.true()
    })
  })

  function mustRequest(request) {
    describe("as a requester", function() {
      beforeEach(function() { this.mitm = Mitm() })
      afterEach(function() { this.mitm.disable() })

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

      it("must emit request on Mitm after multiple requests", function(done){
        request({host: "foo"}).end()
        request({host: "foo"}).end()
        request({host: "foo"}).end()
        this.mitm.on("request", _.after(3, done.bind(null, null)))
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
          request({host: "127.0.0.1"}).on("error", function(err) {
            onRequest.callCount.must.equal(0)
            done()
          })
        })
      })
    })
  }

  describe("via Http.request", function() {
    mustRequest(Http.request)
  })

  describe("via Https.request", function() {
    mustRequest(Https.request)
  })

  describe("via Http.Agent", function() {
    mustRequest(function(opts) {
      return Http.request(_.extend({agent: new Http.Agent}, opts))
    })
  })

  describe("via Https.Agent", function() {
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

      this.mitm.on("request", function(req, res) {
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
      this.mitm.on("request", function(req, res) {
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
        this.mitm.on("request", function(req, res) { res.write("Test") })
        req.on("response", done.bind(null, null))
      })

      // Under Node v0.10 it's the writeQueueSize that's checked to see if
      // the callback can be called.
      it("must call given callback", function(done) {
        Http.request({host: "foo"}).end()
        this.mitm.on("request", function(req, res) { res.write("Test", done) })
      })
    })

    describe(".prototype.end", function() {
      it("must make ClientRequest emit response", function(done) {
        var client = Http.request({host: "foo"})
        client.end()
        this.mitm.on("request", function(req, res) { res.end() })
        client.on("response", done.bind(null, null))
      })

      // In an app of mine Node v0.11.7 did not emit the end event, but
      // v0.11.11 did. I'll investigate properly if this becomes a problem in
      // later Node versions.
      it("must make IncomingMessage emit end", function(done) {
        var client = Http.request({host: "foo"})
        client.end()
        this.mitm.on("request", function(req, res) { res.end() })

        client.on("response", function(res) {
          res.on("data", noop)
          res.on("end", done)
        })
      })
    })
  })

  describe(".prototype.addListener", function() {
    it("must be an alias to EventEmitter.prototype.addListener", function() {
      Mitm.prototype.addListener.must.equal(EventEmitter.prototype.addListener)
    })
  })

  describe(".prototype.off", function() {
    it("must be an alias to EventEmitter.prototype.removeListener", function() {
      Mitm.prototype.off.must.equal(EventEmitter.prototype.removeListener)
    })
  })
})

function noop() {}
