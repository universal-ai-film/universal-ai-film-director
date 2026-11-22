import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = mkdtempSync(join(tmpdir(), 'director package '));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Invoke via npm run test:package');
function run(command, args, cwd) {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || String(r.error));
  return r.stdout;
}
try {
  const info = JSON.parse(run(process.execPath, [npm, 'pack', '--json', '--pack-destination', root], process.cwd()))[0];
  assert.ok(info.files.some(f => f.path === 'dist/cli.js'));
  assert.ok(!info.files.some(f => /^(src|tests|node_modules)\//.test(f.path)));
  writeFileSync(join(root, 'package.json'), '{"private":true}');
  run(process.execPath, [npm, 'install', '--offline', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', join(root, info.filename)], root);
  const bin = join(root, 'node_modules', '.bin', 'director');
  assert.ok(!existsSync(join(root, 'node_modules', 'typescript')));
  const output = process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/s', '/c', 'node_modules\\.bin\\director.cmd doctor'], root)
    : run(bin, ['doctor'], root);
  const report = JSON.parse(output);
  assert.equal(report.runtime_stage, 'foundation');
  assert.equal(report.production_go, false);
  console.log('Installed CLI launcher passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
