var Sinon = require("sinon")
var Net = require("net")
var Http = require("http")
var Https = require("https")
var Tls = require("tls")
var IncomingMessage = Http.IncomingMessage
var ServerResponse = Http.ServerResponse
var ClientRequest = Http.ClientRequest
var Mitm = require("..")
var intercept = Mitm

describe("Mitm", function() {
  beforeEach(function() { Mitm.passthrough = false })

  it("must return an instance of Mitm when called as a function", function() {
    var mitm = intercept()
    mitm.must.be.an.instanceof(Mitm)
    mitm.disable()
  })

  describe("Socket", function() {
    beforeEach(function() { this.mitm = intercept() })
    afterEach(function() { this.mitm.disable() })

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

  describe("Net.connect", function() {
    beforeEach(function() { this.mitm = intercept() })
    afterEach(function() { this.mitm.disable() })
    beforeEach(function() { this.sinon = Sinon.sandbox.create() })
    afterEach(function() { this.sinon.restore() })

    function connect() { return Net.connect.apply(this, arguments) }

    it("must return an instance of Socket", function() {
      connect({host: "foo", port: 80}).must.be.an.instanceof(Net.Socket)
    })

    it("must return an instance of Socket given port", function() {
      connect(80).must.be.an.instanceof(Net.Socket)
    })

    it("must return an instance of Socket given port and host", function() {
      connect(80, "10.0.0.1").must.be.an.instanceof(Net.Socket)
    })

    it("must emit connect on Mitm", function() {
      var onConnect = Sinon.spy()
      this.mitm.on("connect", onConnect)
      var socket = connect({host: "foo"})
      onConnect.callCount.must.equal(1)
      onConnect.firstCall.args[0].must.equal(socket)
    })

    it("must emit connection on Mitm", function() {
      var onConnection = Sinon.spy()
      this.mitm.on("connection", onConnection)
      var socket = connect({host: "foo"})
      onConnection.callCount.must.equal(1)
      onConnection.firstCall.args[0].must.be.an.instanceof(Net.Socket)
      onConnection.firstCall.args[0].must.not.equal(socket)
    })

    it("must emit connect on socket in next tick", function(done) {
      var socket = connect({host: "foo"})
      var onConnect = Sinon.spy()
      socket.on("connect", onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    it("must call on connect given callback", function(done) {
      var onConnect = Sinon.spy()
      connect({host: "foo"}, onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    it("must call on connect given port and callback", function(done) {
      var onConnect = Sinon.spy()
      connect(80, onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    // This was a bug found on Apr 26, 2014 where the host argument was taken
    // to be the callback because arguments weren't normalized to an options
    // object.
    it("must call on connect given port, host and callback", function(done) {
      var onConnect = Sinon.spy()
      connect(80, "localhost", onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    it("must not set authorized property", function() {
      Net.connect({host: "foo"}).must.not.have.property("authorized")
    })
  })

  describe("Net.createConnection", function() {
    it("must be equal to Net.connect", function() {
      Net.createConnection.must.equal(Net.connect)
    })
  })

  describe("Tls.connect", function() {
    beforeEach(function() { this.mitm = intercept() })
    afterEach(function() { this.mitm.disable() })

    it("must set authorized property", function() {
      Tls.connect({host: "foo"}).authorized.must.be.true()
    })
  })

  function mustRequest(request) {
    describe("as a requester", function() {
      beforeEach(function() { this.mitm = intercept() })
      afterEach(function() { this.mitm.disable() })

      it("must return ClientRequest", function() {
        Http.request({host: "foo"}).must.be.an.instanceof(ClientRequest)
      })

      it("must emit connect on Mitm", function() {
        var onConnect = Sinon.spy()
        this.mitm.on("connect", onConnect)
        Http.request({host: "foo"})
        onConnect.callCount.must.equal(1)
      })

      it("must emit connection on Mitm", function() {
        var onConnection = Sinon.spy()
        this.mitm.on("connection", onConnection)
        Http.request({host: "foo"})
        onConnection.callCount.must.equal(1)
      })

      it("must emit request on Mitm", function(done) {
        var client = Http.request({host: "foo"})
        client.end()

        this.mitm.on("request", function(req, res) {
          req.must.be.an.instanceof(IncomingMessage)
          req.must.not.equal(client)
          res.must.be.an.instanceof(ServerResponse)
          done()
        })
      })
    })
  }

  describe("via Http.request", function() {
    mustRequest(function() { return Http.request.apply(this, arguments) })
  })

  describe("via Https.request", function() {
    mustRequest(function() { return Https.request.apply(this, arguments) })
  })

  describe("IncomingMessage", function() {
    beforeEach(function() { this.mitm = intercept() })
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
    beforeEach(function() { this.mitm = intercept() })
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
          res.on("data", function() {})
          res.on("end", done)
        })
      })
    })
  })
})
