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

    it("must trigger connect", function() {
      var onSocket = Sinon.spy()
      this.mitm.on("connect", onSocket)
      var socket = Net.connect({host: "foo"})
      onSocket.callCount.must.equal(1)
      onSocket.firstCall.args[0].must.equal(socket)
    })

    it("must trigger connect on socket in next tick", function(done) {
      var socket = Net.connect({host: "foo"})
      var onSocket = Sinon.spy()
      socket.on("connect", onSocket)
      process.nextTick(function() { onSocket.callCount.must.equal(1) })
      process.nextTick(done)
    })

    it("must call given callback on connect", function(done) {
      var onSocket = Sinon.spy()
      var socket = Net.connect({host: "foo"}, onSocket)
      process.nextTick(function() { onSocket.callCount.must.equal(1) })
      process.nextTick(done)
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

    it("must allow setting headers", function*() {
      var req = Http.request({host: "foo"})
      req.setHeader("Content-Type", "application/json")
      req.end()
      req.getHeader("Content-Type").must.equal("application/json")
    })

    // Without process.nextTick writes won't throw an error if
    // the handle object lacks the necessary write functions.
    it("must allow writing with a buffer", function*() {
      var req = Http.request({host: "foo"})
      req.write(new Buffer("Hello"))
      yield process.nextTick
    })

    it("must allow writing with a UTF-8 string", function*() {
      var req = Http.request({host: "foo"})
      req.write("Hello")
      yield process.nextTick
    })

    it("must allow writing with an ASCII string", function*() {
      var req = Http.request({host: "foo"})
      req.write("Hello", "ascii")
      yield process.nextTick
    })

    it("must allow writing with an UCS-2 string", function*() {
      var req = Http.request({host: "foo"})
      req.write("Hello", "ucs2")
      yield process.nextTick
    })

    it("must have server property with ServerResponse", function() {
      var req = Http.request({host: "foo"})
      req.server.must.be.an.instanceof(ServerResponse)
    })
  })

  describe("incomingMessage", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must set authorized property for HTTPS", function*() {
      var req = Https.request({host: "foo"})
      var res; req.on("response", function() { res = arguments[0] })
      yield process.nextTick

      req.server.end()
      res.client.authorized.must.be.true()
    })

    it("must not set authorized property for HTTP", function*() {
      var req = Http.request({host: "foo"})
      var res; req.on("response", function() { res = arguments[0] })
      yield process.nextTick

      req.server.end()
      res.client.must.not.have.property("authorized")
    })
  })

  describe("serverResponse", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must respond with status, headers and body", function*() {
      var req = Http.request({host: "foo"})
      var res; req.on("response", function() { res = arguments[0] })
      yield process.nextTick

      req.server.statusCode = 442
      req.server.setHeader("Content-Type", "application/json")
      req.server.end("Hi!")

      res.statusCode.must.equal(442)
      res.headers["content-type"].must.equal("application/json")
      res.setEncoding("utf8")
      res.read().must.equal("Hi!")
    })

    describe(".write", function() {
      it("must make clientRequest emit response", function*() {
        var req = Http.request({host: "foo"})
        var response = Sinon.spy()
        req.on("response", response)
        yield process.nextTick

        response.callCount.must.equal(0)
        req.server.write("Test")
        response.callCount.must.equal(1)
      })
    })

    describe(".end", function() {
      it("must make clientRequest emit response", function*() {
        var req = Http.request({host: "foo"})
        var response = Sinon.spy()
        req.on("response", response)
        yield process.nextTick

        response.callCount.must.equal(0)
        req.server.end()
        response.callCount.must.equal(1)
      })

      // In an app of mine Node v0.11.7 did not emit the end event, but
      // v0.11.11 did. I'll investigate properly if this becomes a problem in
      // later Node versions.
      it("must make incomingMessage emit end", function*() {
        var req = Http.request({host: "foo"})
        yield process.nextTick

        var end = Sinon.spy()
        req.on("response", function(res) {
          res.on("data", function() {})
          res.on("end", end)
        })

        end.callCount.must.equal(0)
        req.server.end()
        yield process.nextTick
        end.callCount.must.equal(1)
      })
    })
  })
})
