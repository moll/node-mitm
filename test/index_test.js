var Sinon = require("sinon")
var Http = require("http")
var Https = require("https")
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
      this.mitm.requests.length.must.equal(1)
      this.mitm.requests[0].must.equal(req)
    })

    it("must save Https.request request", function() {
      var req = Https.request({host: "foo"})
      req.must.be.an.instanceof(ClientRequest)
      this.mitm.requests.length.must.equal(1)
      this.mitm.requests[0].must.equal(req)
    })

    it("must trigger request", function() {
      var onRequest = Sinon.spy()
      this.mitm.on("request", onRequest)
      var req = Http.request({host: "foo"})
      onRequest.callCount.must.equal(1)
      onRequest.firstCall.args[0].must.equal(req)
    })

    it("must trigger request after appending to requests", function() {
      var requests = this.mitm.requests
      this.mitm.on("request", function() { requests.length.must.equal(1) })
      Http.request({host: "foo"})
    })

    it("must allow setting headers", function*() {
      var req = Http.request({host: "foo"})
      req.setHeader("Content-Type", "application/json")
      req.end()
      req.getHeader("Content-Type").must.equal("application/json")
    })

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

  describe("serverResponse", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must respond with status, headers and body", function*() {
      var req = Http.request({host: "foo"})
      var res; req.on("response", function() { res = arguments[0] })
      req.end()
      yield process.nextTick

      var server = this.mitm.responses[0]
      server.statusCode = 442
      server.setHeader("Content-Type", "application/json")
      server.end("Hi!")

      res.statusCode.must.equal(442)
      res.headers["content-type"].must.equal("application/json")
      res.setEncoding("utf8")
      res.read().must.equal("Hi!")
    })
  })

  describe("requests", function() {
    it("must be empty", function() {
      var mitm = new Mitm
      mitm.requests.must.be.an.array()
      mitm.requests.must.be.empty()
    })
  })
})
