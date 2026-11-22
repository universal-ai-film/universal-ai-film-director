'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNewlines } = require('../helpers/normalize-newlines.js');

const lf = '---\nname: fixture\ndescription: Example skill\n---\n\n';
const crlf = '---\r\nname: fixture\r\ndescription: Example skill\r\n---\r\n\r\n';

test('LF and CRLF skill text retain the same frontmatter and character count', () => {
  const body = 'x'.repeat(8999 - lf.length);
  for (const header of [lf, crlf]) {
    assert.equal(normalizeNewlines(header + body), lf + body);
    assert.equal(normalizeNewlines(header + body).length, 8999);
    assert.equal(normalizeNewlines(header + body + 'x').length, 9000);
  }
});

test('newline normalization preserves standalone carriage returns', () => {
  assert.equal(normalizeNewlines('a\rb\r\nc\n'), 'a\rb\nc\n');
});
