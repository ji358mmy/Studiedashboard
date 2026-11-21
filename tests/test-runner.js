/*
 * Mini-testrunner zonder afhankelijkheden.
 * Werkt in de browser (tests.html) en in Node (run-tests.js).
 */
(function (root) {
  'use strict';
  var tests = [];

  function test(name, fn) { tests.push({ name: name, fn: fn }); }

  function fmt(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  var assert = {
    ok: function (v, msg) { if (!v) throw new Error(msg || 'Verwacht waar, kreeg ' + fmt(v)); },
    equal: function (a, b, msg) { if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'verwacht ' + fmt(b) + ', kreeg ' + fmt(a)); },
    deepEqual: function (a, b, msg) { if (fmt(a) !== fmt(b)) throw new Error((msg ? msg + ': ' : '') + 'verwacht ' + fmt(b) + ', kreeg ' + fmt(a)); },
    throwsNot: function (fn, msg) { try { fn(); } catch (e) { throw new Error((msg || 'Mag niet crashen') + ': ' + e.message); } }
  };

  function run(report) {
    var passed = 0, failed = 0;
    tests.forEach(function (t) {
      try {
        t.fn();
        passed++;
        report({ name: t.name, ok: true });
      } catch (e) {
        failed++;
        report({ name: t.name, ok: false, error: e && e.message ? e.message : String(e) });
      }
    });
    return { passed: passed, failed: failed, total: tests.length };
  }

  /** Nep-opslag die zich gedraagt als localStorage. */
  function memoryStorage(initial, opts) {
    var data = {};
    opts = opts || {};
    Object.keys(initial || {}).forEach(function (k) { data[k] = initial[k]; });
    return {
      _data: data,
      getItem: function (k) {
        if (opts.throwOnGet) throw new Error('SecurityError');
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem: function (k, v) {
        if (opts.quota) { var e = new Error('vol'); e.name = 'QuotaExceededError'; throw e; }
        data[k] = String(v);
      },
      removeItem: function (k) { delete data[k]; }
    };
  }

  var api = { test: test, assert: assert, run: run, memoryStorage: memoryStorage };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TR = api;
})(typeof self !== 'undefined' ? self : this);
