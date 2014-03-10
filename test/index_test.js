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
  })

  describe("clientRequest", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must have server property with ServerResponse", function() {
      var req = Http.request({host: "foo"})
      req.server.must.be.an.instanceof(ServerResponse)
    })
  })

  describe("serverResponse", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must respond with status, headers and body", function*() {
      var req = Http.request({host: "foo"})
      var res; req.on("response", function() { res = arguments[0] })
      req.end()
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
  })

  describe(".prototype.length", function() {
    it("must be zero", function() {
      new Mitm().length.must.equal(0)
    })
  })

  describe(".prototype.clear", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must remove requests", function*() {
      Http.request({host: "1.example.com"}).end()
      Http.request({host: "2.exapmle.com"}).end()
      this.mitm.must.have.property(0)
      this.mitm.must.have.property(1)

      this.mitm.clear()
      this.mitm.must.not.have.property(0)
      this.mitm.must.not.have.property(1)
    })

    it("must set length to zero", function*() {
      Http.request({host: "1.example.com"}).end()
      Http.request({host: "2.exapmle.com"}).end()
      this.mitm.length.must.equal(2)

      this.mitm.clear()
      this.mitm.length.must.equal(0)
    })
  })
})
