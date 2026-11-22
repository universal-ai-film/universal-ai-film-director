import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
export interface Snapshot { readonly value: string; readonly production_go: false }
export function probe(file: string, legacyPath: string): Snapshot {
 const requireLegacy = createRequire(resolve(legacyPath));
 const legacy: unknown = requireLegacy(resolve(legacyPath));
 if (typeof legacy !== 'object' || legacy === null || !('fingerprint' in legacy) || typeof legacy.fingerprint !== 'function') throw Error('legacy contract');
 const digest: unknown = legacy.fingerprint({value:'hello'});
 if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw Error('legacy output');
 const db = new DatabaseSync(file);
 try {
  db.exec('CREATE TABLE IF NOT EXISTS state(value TEXT); DELETE FROM state; BEGIN');
  db.prepare('INSERT INTO state VALUES (?)').run('hello');
  db.exec('COMMIT; BEGIN');
  db.prepare('UPDATE state SET value=?').run('discard');
  db.exec('ROLLBACK');
 } finally { db.close(); }
 const reopened = new DatabaseSync(file);
 try {
  const row = reopened.prepare('SELECT value FROM state').get();
  if (typeof row?.value !== 'string') throw Error('invalid row');
  return {value:row.value,production_go:false};
 } finally { reopened.close(); }
}
