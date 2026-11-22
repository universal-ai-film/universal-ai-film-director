import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}
test('doctor reports only current foundation capabilities', () => {
  const result = run('doctor');
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.schema_version, 1);
  assert.equal(value.runtime_stage, 'foundation');
  assert.equal(value.node, process.versions.node);
  assert.match(value.sqlite, /^\d+\.\d+\.\d+$/);
  assert.equal(value.persistent_projects, false);
  assert.equal(value.production_go, false);
});
test('unknown, missing and extra arguments fail closed', () => {
  for (const args of [[], ['generate'], ['doctor', 'extra']]) {
    const result = run(...args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage:/);
  }
});
