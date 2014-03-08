var co = require("co")
var Mocha = require("mocha")

Mocha.Runnable.call = function(self, title, test) {
  if (test && test.constructor.name == "GeneratorFunction") test = co(test)
  return Function.prototype.call.apply(Mocha.Runnable, arguments)
}
