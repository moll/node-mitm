var Mitm = require('../');
var mitm = Mitm();

mitm.on('connect', function(socket) {
  // this solves the issue
  // socket._handle.unref = function() {};
  console.log('got socket')
});

mitm.on('request', function(req, res) {
  console.log('got request');
  res.statusCode = 200;
  res.end('YEAH')
});

var http = require('http');

var req = http.request({
  protocol: 'http:',
  host: 'www.google.com',
  agent: new http.Agent({
    keepAlive: true
  })
});

req.end();
