module.exports = Stubs

function Stubs() {}

Stubs.prototype = Object.create(Array.prototype)

Stubs.prototype.stub = function(obj, prop, value) {
  this.push([obj, prop, obj[prop]])
  obj[prop] = value
}

Stubs.prototype.restore = function() {
  var stub
  while (stub = this.pop()) stub[0][stub[1]] = stub[2]
}
