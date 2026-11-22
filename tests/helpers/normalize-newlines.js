'use strict';

// Use for semantic text checks only. Byte comparisons must read the original data.
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

module.exports = { normalizeNewlines };
