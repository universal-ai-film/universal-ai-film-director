#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';

function main(args: readonly string[]): number {
  if (args.length !== 1 || args[0] !== 'doctor') {
    console.error('Usage: director doctor');
    return 2;
  }
  const db = new DatabaseSync(':memory:');
  try {
    const row = db.prepare('SELECT sqlite_version() AS version').get();
    if (typeof row !== 'object' || row === null || !('version' in row) || typeof row.version !== 'string') {
      throw new Error('Invalid SQLite capability response');
    }
    console.log(JSON.stringify({
      schema_version: 1,
      runtime_stage: 'foundation',
      node: process.versions.node,
      sqlite: row.version,
      persistent_projects: false,
      production_go: false
    }));
    return 0;
  } finally {
    db.close();
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : 'Runtime diagnostic failed');
  process.exitCode = 1;
}
