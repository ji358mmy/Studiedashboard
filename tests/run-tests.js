#!/usr/bin/env node
/*
 * Draait alle tests in de terminal (alleen nodig als je Node.js hebt).
 * Gebruik: node tests/run-tests.js
 * Zonder Node: open tests/tests.html in je browser.
 */
'use strict';
var TR = require('./test-runner.js');
require('./core.test.js');

var result = TR.run(function (r) {
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : '\n      ' + r.error));
});
console.log('\n' + result.passed + ' van ' + result.total + ' tests geslaagd' + (result.failed ? ', ' + result.failed + ' mislukt' : '') + '.');
process.exit(result.failed ? 1 : 0);
