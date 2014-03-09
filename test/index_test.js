var Http = require("http")
var Https = require("https")
var ClientRequest = Http.ClientRequest
var Mitm = require("..")

describe("Mitm", function() {
  beforeEach(function() { Mitm.passthrough = false })

  it("must return an instance of Mitm if called as a function", function() {
    Mitm().must.be.an.instanceof(Mitm)
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

  describe("clientRequest.respond", function() {
    beforeEach(function() { this.mitm = Mitm() })
    afterEach(function() { this.mitm.disable() })

    it("must respond with status, headers and body", function*() {
      var req = Http.request({host: "foo"})
      req.end()
      yield process.nextTick

      var res; req.on("response", function() { res = arguments[0] })
      this.mitm.requests[0].respond(442, {"Content-Type": "text/html"}, "Hi!")

      res.statusCode.must.equal(442)
      res.headers.must.eql({"content-type": "text/html"})
      res.setEncoding("utf8")
      res.read().must.equal("Hi!")
    })

    it("must respond to Https.request", function*() {
      var req = Https.request({host: "foo"})
      req.end()
      yield process.nextTick

      var res; req.on("response", function() { res = arguments[0] })
      this.mitm.requests[0].respond(442, {"Content-Type": "text/html"}, "Hi!")

      res.statusCode.must.equal(442)
      res.headers.must.eql({"content-type": "text/html"})
      res.setEncoding("utf8")
      res.read().must.equal("Hi!")
    })
  })

  describe("requests", function() {
    it("must be empty", function() {
      new Mitm().requests.must.be.an.array()
      new Mitm().requests.must.be.empty()
    })
  })
})
