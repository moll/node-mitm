## Unreleased
- Adds support for Node v0.10.24.
- Adds the `connection` event to Mitm to get the remote `Net.Socket`. You can
  use this to intercept and test any TCP code.  
  If you need the client side socket for any reason, listen to `connect` on
  Mitm.

## 0.3.0 (Apr 26, 2014)
- Adds support for calling `Net.connect` with `port` and `host` arguments.

## 0.2.0 (Apr 19, 2014)
- Does not store requests on an instance of `Mitm` any longer.
- Adds `socket` event to `Mitm`.
- Updated to work with Node v0.11.12.

## 0.1.337 (Mar 11, 2014)
- First private release.
