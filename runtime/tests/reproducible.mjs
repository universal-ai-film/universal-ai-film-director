import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const npm = process.env.npm_execpath;
assert.ok(npm);
function build() {
  rmSync('dist', { recursive: true, force: true });
  const result = spawnSync(process.execPath, [npm, 'run', 'build'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const files = readdirSync('dist', { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name)).sort();
  return files.map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]);
}
const first = build();
assert.ok(first.length > 0);
assert.deepEqual(build(), first);
console.log('Two clean builds produced identical file hashes');
