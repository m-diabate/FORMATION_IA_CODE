import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Calc = require('../engine.js');
const { cases } = require('./cases.js');

for (const item of cases(Calc)) {
  test(item.name, () => {
    try {
      item.fn();
    } catch (error) {
      assert.fail(error.message);
    }
  });
}
