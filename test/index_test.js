var Sinon = require("sinon")
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

  describe(".prototype.request", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must save Http.request request", function() {
      var req = Http.request({host: "foo"})
      req.must.be.an.instanceof(ClientRequest)
      this.mitm.length.must.equal(1)
      this.mitm[0].must.equal(req)
    })

    it("must save Https.request request", function() {
      var req = Https.request({host: "foo"})
      req.must.be.an.instanceof(ClientRequest)
      this.mitm.length.must.equal(1)
      this.mitm[0].must.equal(req)
    })

    it("must trigger request", function() {
      var onRequest = Sinon.spy()
      this.mitm.on("request", onRequest)
      var req = Http.request({host: "foo"})
      onRequest.callCount.must.equal(1)
      onRequest.firstCall.args[0].must.equal(req)
    })

    it("must trigger request after appending to self", function() {
      this.mitm.on("request", function(req) {
        this.length.must.equal(1)
        this[0].must.equal(req)
      }, this.mitm)
      Http.request({host: "foo"})
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

      this.mitm[0].server.end()
      res.client.authorized.must.be.true()
    })

    it("must not set authorized property for HTTP", function*() {
      var req = Http.request({host: "foo"})
      var res; req.on("response", function() { res = arguments[0] })
      yield process.nextTick

      this.mitm[0].server.end()
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

      var server = this.mitm[0].server
      server.statusCode = 442
      server.setHeader("Content-Type", "application/json")
      server.end("Hi!")

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
        this.mitm[0].server.write("Test")
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
        this.mitm[0].server.end()
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
        this.mitm[0].server.end()
        yield process.nextTick
        end.callCount.must.equal(1)
      })
    })
  })

  describe(".prototype.length", function() {
    it("must be zero", function() {
      new Mitm().length.must.equal(0)
    })
  })

  describe(".prototype.clear", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must remove requests and set length to zero", function*() {
      Http.request({host: "1.example.com"})
      Http.request({host: "2.example.com"})
      this.mitm.length.must.equal(2)
      this.mitm.must.have.property(0)
      this.mitm.must.have.property(1)

      this.mitm.clear()
      this.mitm.length.must.equal(0)
      this.mitm.must.not.have.property(0)
      this.mitm.must.not.have.property(1)
    })
  })
})
