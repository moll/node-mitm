var Sinon = require("sinon")
var Net = require("net")
var Http = require("http")
var Https = require("https")
var ServerResponse = Http.ServerResponse
var ClientRequest = Http.ClientRequest
var Mitm = require("..")

describe("Mitm", function() {
  beforeEach(function() { Mitm.passthrough = false })

  it("must return an instance of Mitm when called as a function", function() {
    var mitm = Mitm()
    mitm.must.be.an.instanceof(Mitm)
    mitm.disable()
  })

  describe("via Net.connect", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })
    beforeEach(function() { this.sinon = Sinon.sandbox.create() })
    afterEach(function() { this.sinon.restore() })

    it("must return socket", function() {
      this.sinon.spy(Net, "Socket")
      var socket = Net.connect({host: "foo", port: 80})

      socket.must.be.an.instanceof(Net.Socket)
      Net.Socket.callCount.must.equal(1)
      Net.Socket.args[0][0].host.must.equal("foo")
      Net.Socket.args[0][0].port.must.equal(80)
    })

    it("must return socket given port", function() {
      this.sinon.spy(Net, "Socket")
      var socket = Net.connect(80)

      socket.must.be.an.instanceof(Net.Socket)
      Net.Socket.callCount.must.equal(1)
      Net.Socket.args[0][0].port.must.equal(80)
      Net.Socket.args[0][0].must.not.have.property("host")
    })

    it("must return socket given port and host", function() {
      this.sinon.spy(Net, "Socket")
      var socket = Net.connect(80, "10.0.0.1")

      socket.must.be.an.instanceof(Net.Socket)
      Net.Socket.callCount.must.equal(1)
      Net.Socket.args[0][0].port.must.equal(80)
      Net.Socket.args[0][0].host.must.equal("10.0.0.1")
    })

    it("must trigger connect", function() {
      var onSocket = Sinon.spy()
      this.mitm.on("connect", onSocket)
      var socket = Net.connect({host: "foo"})
      onSocket.callCount.must.equal(1)
      onSocket.firstCall.args[0].must.equal(socket)
    })

    it("must trigger connect on socket in next tick", function(done) {
      var socket = Net.connect({host: "foo"})
      var onConnect = Sinon.spy()
      socket.on("connect", onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    it("must call on connect given callback", function(done) {
      var onConnect = Sinon.spy()
      var socket = Net.connect({host: "foo"}, onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    it("must call on connect given port and callback", function(done) {
      var onConnect = Sinon.spy()
      var socket = Net.connect(80, onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })

    // This was a bug found on Apr 26, 2014 where the host argument was taken
    // to be the callback because arguments weren't normalized to an options
    // object.
    it("must call on connect given port, host and callback", function(done) {
      var onConnect = Sinon.spy()
      var socket = Net.connect(80, "localhost", onConnect)
      process.nextTick(function() { onConnect.callCount.must.equal(1) })
      process.nextTick(done)
    })
  })

  describe("via Net.createConnection", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must trigger connect", function() {
      var onSocket = Sinon.spy()
      this.mitm.on("connect", onSocket)
      var socket = Net.createConnection({host: "foo"})
      onSocket.callCount.must.equal(1)
      onSocket.firstCall.args[0].must.equal(socket)
    })
  })

  describe("via Http.request", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must return ClientRequest", function() {
      Http.request({host: "foo"}).must.be.an.instanceof(ClientRequest)
    })

    it("must trigger connect", function() {
      var onSocket = Sinon.spy()
      this.mitm.on("connect", onSocket)
      Http.request({host: "foo"})
      onSocket.callCount.must.equal(1)
    })

    it("must trigger request", function() {
      var onRequest = Sinon.spy()
      this.mitm.on("request", onRequest)
      var req = Http.request({host: "foo"})
      onRequest.args[0][0].must.equal(req)
      onRequest.args[0][1].must.be.an.instanceof(ServerResponse)
    })
  })

  describe("via Https.request", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must return ClientRequest", function() {
      Https.request({host: "foo"}).must.be.an.instanceof(ClientRequest)
    })

    it("must trigger connect", function() {
      var onSocket = Sinon.spy()
      this.mitm.on("connect", onSocket)
      Https.request({host: "foo"})
      onSocket.callCount.must.equal(1)
    })

    it("must trigger request", function() {
      var onRequest = Sinon.spy()
      this.mitm.on("request", onRequest)
      var req = Https.request({host: "foo"})
      onRequest.args[0][0].must.equal(req)
      onRequest.args[0][1].must.be.an.instanceof(ServerResponse)
    })
  })

  describe("clientRequest", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must allow setting headers", function() {
      var req = Http.request({host: "foo"})
      req.setHeader("Content-Type", "application/json")
      req.end()
      req.getHeader("Content-Type").must.equal("application/json")
    })

    // Without process.nextTick writes won't throw an error if
    // the handle object lacks the necessary write functions.
    it("must allow writing with a buffer", function(done) {
      var req = Http.request({host: "foo"})
      req.write(new Buffer("Hello"))
      process.nextTick(done)
    })

    it("must allow writing with a UTF-8 string", function(done) {
      var req = Http.request({host: "foo"})
      req.write("Hello")
      process.nextTick(done)
    })

    it("must allow writing with an ASCII string", function(done) {
      var req = Http.request({host: "foo"})
      req.write("Hello", "ascii")
      process.nextTick(done)
    })

    it("must allow writing with an UCS-2 string", function(done) {
      var req = Http.request({host: "foo"})
      req.write("Hello", "ucs2")
      process.nextTick(done)
    })

    it("must have server property with ServerResponse", function() {
      var req = Http.request({host: "foo"})
      req.server.must.be.an.instanceof(ServerResponse)
    })
  })

  describe("incomingMessage", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must set authorized property for HTTPS", function(done) {
      var req = Https.request({host: "foo"})
      req.server.end()

      req.on("response", function(res) {
        res.client.authorized.must.be.true()
        done()
      })
    })

    it("must not set authorized property for HTTP", function(done) {
      var req = Http.request({host: "foo"})
      req.server.end()

      req.on("response", function(res) {
        res.client.must.not.have.property("authorized")
        done()
      })
    })
  })

  describe("serverResponse", function() {
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
      })
    })

    describe(".write", function() {
      it("must make clientRequest emit response", function(done) {
        var req = Http.request({host: "foo"})
        var response = Sinon.spy()
        req.server.write("Test")
        req.on("response", function() { done() })
      })

      // Under Node v0.10 it's the writeQueueSize that's checked to see if
      // the callback can be called.
      it("must call given callback", function(done) {
        var req = Http.request({host: "foo"})
        var response = Sinon.spy()
        req.server.write("Test", done)
      })
    })

    describe(".end", function() {
      it("must make clientRequest emit response", function(done) {
        var req = Http.request({host: "foo"})
        req.server.end()
        req.on("response", done.bind(null, null))
      })

      // In an app of mine Node v0.11.7 did not emit the end event, but
      // v0.11.11 did. I'll investigate properly if this becomes a problem in
      // later Node versions.
      it("must make incomingMessage emit end", function(done) {
        var req = Http.request({host: "foo"})
        req.server.end()

        req.on("response", function(res) {
          res.on("data", function() {})
          res.on("end", done)
        })
      })
    })
  })
})
