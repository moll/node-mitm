## Unreleased
- Removes the [Underscore.js](https://underscorejs.org) dependency in favor of just inlining two rewritten helper functions.
- Fixes possible double emitting on Node v19+ due to its global HTTP agent enabling keep-alive.

## 1.7.2 (May 1, 2021)
- Increases the upper-bound on [Underscore.js](https://underscorejs.org) dependency to v1.13 (inclusive).  
  Thanks, [Martin Caruso](https://github.com/mcaruso85), for the heads-up.

## 1.7.1 (Jun 13, 2020)
- Fixes one test for Node v12.4.
- Fixes the socket "close" event on Node v12.16.3.

## 1.7.0 (Jan 30, 2019)
- Adds compatibility with Node v10.15.1.

## 1.6.0 (Jan 26, 2019)
- Adds compatibility with Node v11.8.

## 1.5.0 (Nov 29, 2018)
- Adds compatibility with Node v11.1.
- Adds compatibility with Node v11.2.

## 1.4.0 (Sep 17, 2018)
- Adds Node v8.12, Node v9 and Node v10 support.  
  Thanks to [Andreas Lind](https://github.com/papandreou) for help in debugging! Also thanks to him for providing [mitm-papandreou](https://www.npmjs.com/package/mitm-papandreou) while Mitm.js-proper incorporated his fixes.

## 1.3.3 (Sep 16, 2017)
- Fixes `getAsyncId` error on Node v8 when using an `Http.Agent` with the `keepAlive` option.

## 1.3.2 (Nov 10, 2016)
- Adds compatibility with Node v7.  
  Thanks, [Eric Hacke](https://github.com/ehacke), for the help!

## 1.3.1 (Sep 6, 2016)
- Fixes calling `Socket.prototype.ref` and `Socket.prototype.unref` on the returned client and server sockets.  
  Thanks, [Vincent Voyer](http://function.fr), for the help!

## 1.3.0 (Aug 17, 2016)
- Adds compatibility with Node v6.4.  
  Thanks to [Andreas Lind](https://github.com/papandreou)!

## 1.2.1 (Mar 30, 2016)
- Fixes writing to sockets returned by Mitm by postponing writing until the next
  tick. Brings it in line with Node's behavior.  
  Thanks, [Maarten Winter](https://github.com/mwoc), for the help!
- Fixes listening to the `connect` event after `socket` is emitted on
  `ClientRequest`.  
  Thanks, [Maarten Winter](https://github.com/mwoc), for the help!
- Fixes intercepting TLS connections to properly emit the `secureConnect` event
  and given a callback, bind it to `secureConnect` rather than `connect`.

## 1.2.0 (Sep 1, 2015)
- Adds Io.js v3 support. Io.js v2.4.0 worked previously  
  Thanks, [Vincent Voyer](http://function.fr), for the help!

## 1.1.0 (Apr 25, 2015)
- Returns an instance of `Tls.TLSSocket` from `Tls.connect`.  
  The returned socket has both `encrypted` and `authorized` set.  
  Thanks to [Andreas Lind](https://github.com/papandreou) for the initial
  `encrypted` property patch!

  On Node v0.10 `Tls.connect` will just return a `Net.Socket` with the
  `encrypted` and `authorized` properties set.

## 1.0.3 (Jan 26, 2015)
- Adds `Mitm.prototype.addListener` to look more like an EventEmitter.  
  Thanks to [Alex Wolfe](https://github.com/alexkwolfe)!

## 1.0.2 (Nov 23, 2014)
- Fixes tests by locking Mocha to v0.18.  
  For more info on Mocha's ill-behavior, see
  [#1195](https://github.com/mochajs/mocha/issues/1195).

## 1.0.1 (Nov 23, 2014)
- Fixes bypassing TLS connections.  
  Thanks to [Roman Shtylman](https://github.com/defunctzombie)!

## 1.0.0 (Sep 29, 2014)
- Adds compatibility with Node v0.11.14.

## 0.5.1 (May 28, 2014)
- Fixes `Mitm.prototype.off` to remove bound events with
  (`mitm.off("request", listener)`).

## 0.5.0 (May 19, 2014)
- Adds bypass functionality to not intercept a particular outgoing connection
  and let it connect as usual.  
  Let a connection happen by calling `bypass` on the socket object given to the
  `connect` event:

  ```javascript
  var mitm = Mitm()
  mitm.on("connect", function(socket) { socket.bypass() })
  Net.connect({host: "example.org", port: 25})
  ```

- Emits `connect` and `connection` on Mitm with the _options_ object given to
  `Net.connect`.  
  You can use that with the above bypass functionality to bypass selectively:

  ```javascript
  mitm.on("connect", function(socket, opts) {
    if (opts.host == "sql.example.org" && opts.port = 5432) socket.bypass()
  })
  ```

## 0.4.1 (May 4, 2014)
- Adds [Travis CI](https://travis-ci.org) badge to the README.

## 0.4.0 (May 4, 2014)
- Adds support for Node v0.10.24 and up.
- Adds the `connection` event to Mitm to get the remote `Net.Socket`. You can
  use this to intercept and test any TCP code.  
  If you need the client side socket for any reason, listen to `connect` on
  Mitm.

- Replaces the `Http.ClientRequest` given to the `request` event on Mitm with
  a proper `Http.IncomingMessage` — just like a regular Node server would
  receive.  
  This ensures the requests you make are properly parseable according to HTTP
  specs (assuming Node.js itself is implemented according to spec) and also lets
  you assert on the content of `POST` requests.

  ```javascript
  var mitm = Mitm()
  Http.request({host: "x.org"}).end()
  mitm.on("request", function(req) { req.headers.host.must.equal("x.org") })
  ```

- Replaces [Concert.js](https://github.com/moll/js-concert) with Node's
  EventEmitter for now as I was not sure the extra features were required.  
  Remember kids, _if in doubt, leave it out_.

## 0.3.0 (Apr 26, 2014)
- Adds support for calling `Net.connect` with `port` and `host` arguments.

## 0.2.0 (Apr 19, 2014)
- Does not store requests on an instance of `Mitm` any longer.
- Adds `socket` event to `Mitm`.
- Updated to work with Node v0.11.12.

## 0.1.337 (Mar 11, 2014)
- First private release.
