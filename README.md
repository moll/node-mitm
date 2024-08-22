Mitm.js
=======
[![NPM version][npm-badge]](https://www.npmjs.com/package/mitm)
[![Build status][build-badge]](https://github.com/moll/node-mitm/actions/workflows/node.yaml)

Mitm.js is a library for Node.js (and Io.js) to **intercept and mock** outgoing
network **TCP** and **HTTP** connections.  Mitm.js intercepts and gives you
a `Net.Socket` to communicate as if you were the remote server. For **HTTP
requests** it even gives you `Http.IncomingMessage` and `Http.ServerResponse`
— just like you're used to when writing Node.js servers.  Except there's no
actual server running, it's all just _In-Process Interception™_.

Intercepting connections and requests is **extremely useful to test and ensure
your code does what you expect**. Assert on request parameters and send back
various responses to your code without ever having to hit the real network.
**Fast as hell** and **a lot easier to develop with than external test
servers**.

Mitm.js works on all Node versions: ancient **v0.10**, **v0.11** and **v0.12** versions, previous and current LTS versions like **v4** to **v12** and the newest **v22** and beyond. For all it has **automated tests** to ensure it will stay that way.

I've developed Mitm.js on a need-to basis for testing [Monday
Calendar][monday]'s syncing, so if you find a use-case I haven't come across,
please fling me an [email][email], a [tweet][twitter] or [create an
issue][issues] on GitHub.

[npm-badge]: https://img.shields.io/npm/v/mitm.svg
[build-badge]: https://github.com/moll/js-j6pack/actions/workflows/node.yaml/badge.svg

### Tour
- Intercept both **TCP socket connections** (`Net.connect`) and **HTTP
  requests** (`Http.request` and `Https.request`).  

- Hooks to Node.js's network functions at a **very low level** with the goal of
  not having to patch existing classes and have everything behave as if bytes
  were arriving from the network.

- Does *not* have any kitchen sink features or yet another API to assert on
  intercepted connections.  
  That's a different responsibility handled better by assertion libraries
  (you'll do no better than to pick [Must.js][must] for that ;-).

- Use an **API you already know** to assert or respond to requests — Mitm.js
  gives you access to a vanilla `Net.Socket` to respond with:

  ```javascript
  mitm.on("connection", function(socket) { socket.write("Hello back!") })

  var socket = Net.connect(22, "example.org")
  socket.write("Hello!")
  socket.setEncoding("utf8")
  socket.on("data", console.log) // => "Hello back!"
  ```

- When you do **HTTP or HTTPS** requests, Mitm.js gives you both
  a `Http.IncomingMessage` and `Http.ServerResponse` to play the server with.
  That means you'll be using an **API you're already familiar with**
  rather than yet another idiosyncratic domain specific language.

  Mitm.js comes very handy to ensure your code makes requests with the
  appropriate parameters:
  ```javascript
  mitm.on("request", function(req, res) {
    req.headers.authorization.must.equal("OAuth DEADBEEF")
  })

  Http.get("http://example.org")
  ```

  It's also useful to see if your code behaves as you'd expect if everything is
  not `200 OK`:
  ```javascript
  mitm.on("request", function(req, res) {
    res.statusCode = 402
    res.end("Pay up, sugar!")
  })

  Http.get("http://example.org", function(res) {
    res.setEncoding("utf8")
    res.statusCode // => 402
    res.on("data", console.log) // => "Pay up, sugar!"
  })
  ```

  `Http.IncomingMessage` and `Http.ServerResponse` are the same objects
  you get when you write Node.js HTTP servers with `Net.Server` or use a library
  like [Express.js][express].

- **Bypass** interception selectively for some connections (such as your SQL
  server) and let them connect as usual.
  ```javascript
  mitm.on("connect", function(socket, opts) {
    if (opts.host == "sql.example.org" && opts.port == 5432) socket.bypass()
  })
  ```

- **Developed with automated tests**. Yeah, I know, why should one list this
  a feature when writing tests is just a sign of professionalism and respect
  towards other developers? But in a world where so many libraries and
  "production" software are released without *any* tests, I like to point out
  that I even write tests for testing libraries. ;-)

[must]: https://github.com/moll/js-must
[express]: http://expressjs.com


Installing
----------
```
npm install mitm
```

From v1.0.0 Mitm.js will follow [semantic versioning][semver], but until then,
breaking changes may appear between minor versions (the middle number).

[semver]: http://semver.org/


Using
-----
Require Mitm.js and invoke it as a function to both create an instance of `Mitm`
and enable intercepting:
```javascript
var Mitm = require("mitm")
var mitm = Mitm()
```

Mitm.js will then intercept all requests until you disable it:
```javascript
mitm.disable()
```

### Intercepting in tests
In tests, it's best to use the _before_ and _after_ hooks to enable and disable
intercepting for each test case:
```javascript
beforeEach(function() { this.mitm = Mitm() })
afterEach(function() { this.mitm.disable() })
```

### Intercepting TCP connections
After you've called `Mitm()`, Mitm.js will intercept and emit `connection` on
itself for each new connection.  
The `connection` event will be given a server side `Net.Socket` for you to reply
with:

```javascript
mitm.on("connection", function(socket) { socket.write("Hello back!") })

var socket = Net.connect(22, "example.org")
socket.write("Hello!")
socket.setEncoding("utf8")
socket.on("data", console.log) // => "Hello back!"
```

### Intercepting HTTP/HTTPS requests
After you've called `Mitm()`, Mitm.js will intercept and emit `request` on itself for each new HTTP or HTTPS request.  
The `request` event will be given a server side `Http.IncomingMessage` and
`Http.ServerResponse`.

For example, asserting on HTTP requests would look something like this:
```javascript
mitm.on("request", function(req, res) {
  req.headers.authorization.must.equal("OAuth DEADBEEF")
})

Http.get("http://example.org")
```

Responding to requests is just as easy and exactly like you're used to from
using Node.js HTTP servers (or from libraries like [Express.js][express]):
```javascript
mitm.on("request", function(req, res) {
  res.statusCode = 402
  res.end("Pay up, sugar!")
})

Http.get("http://example.org", function(res) {
  res.statusCode // => 402
  res.setEncoding("utf8")
  res.on("data", console.log) // => "Pay up, sugar!"
})
```

Please note that HTTPS requests are currently "morphed" into HTTP requests.
That's to save us from having to set up certificates and disable their
verification. But if you do need to test this, please ping me and we'll see if
we can get Mitm.js to support that.

#### Custom HTTP Methods
Unfortunately because [Node.js's web server doesn't seem to support custom HTTP methods](https://github.com/nodejs/node-v0.x-archive/issues/3192) (that is, ones beyond `require("http").METHODS`), Mitm.js doesn't support them out of the box either. The Node.js HTTP parser throws an error given a request with an unsupported method. However, as Mitm.js also supports intercepting at the TCP level, you could hook in your own HTTP parser. I've briefly alluded to it in [issue #63](https://github.com/moll/node-mitm/issues/63).

### Bypassing interception
You can bypass connections listening to the `connect` event on the Mitm instance
and then calling `bypass` on the given socket. To help you do
so selectively, `connect` is given the `options` object that was given to
`Net.connect`:

```javascript
mitm.on("connect", function(socket, opts) {
  if (opts.host == "sql.example.org" && opts.port == 5432) socket.bypass()
})
```

Bypassed connections do **not** emit `connection` or `request` events. They're
ignored by Mitm.js.

In most cases you don't need to bypass because by the time you call `Mitm` in
your tests to start intercepting, all of the long-running connections, such as
database or cache connections, are already made.

You might need to bypass connections you make to *localhost* when you're running
integration tests against the HTTP server you started in the test process, but
still want to intercept some other connections that this request might invoke.  
The following should suffice:

```javascript
mitm.on("connect", function(socket, opts) {
  if (opts.host == "localhost") socket.bypass()
})
```


Events
------
All events that Mitm will emit on an instance of itself (see [Using
Mitm.js](#using) for examples):

Event      | Description
-----------|------------
connect    | Emitted when a TCP connection is made.<br> Given the **client side** `Net.Socket` and `options` from `Net.connect`.
connection | Emitted when a TCP connection is made.<br> Given the **server side** `Net.Socket` and `options` from `Net.connect`.
request    | Emitted when a HTTP/HTTPS request is made.<br> Given the server side `Http.IncomingMessage` and `Http.ServerResponse`.


License
-------
Mitm.js is released under a *Lesser GNU Affero General Public License*, which
in summary means:

- You **can** use this program for **no cost**.
- You **can** use this program for **both personal and commercial reasons**.
- You **do not have to share your own program's code** which uses this program.
- You **have to share modifications** (e.g. bug-fixes) you've made to this
  program.

For more convoluted language, see the `LICENSE` file.


About
-----
**[Andri Möll][moll]** typed this and the code.  
[Monday Calendar][monday] supported the engineering work.

If you find Mitm.js needs improving, please don't hesitate to type to me now
at [andri@dot.ee][email] or [create an issue online][issues].

[email]: mailto:andri@dot.ee
[issues]: https://github.com/moll/node-mitm/issues
[moll]: http://themoll.com
[monday]: https://mondayapp.com
[twitter]: https://twitter.com/theml
