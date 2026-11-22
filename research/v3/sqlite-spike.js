'use strict';
// Synthetic research only. Never use for production or untrusted workspaces.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
function safePath(root, name) {
  assert(/^[a-zA-Z0-9_-]+\.db$/.test(name), 'unsafe filename');
  const base = fs.realpathSync(root);
  const file = path.join(base, name);
  if (fs.existsSync(file) || (() => { try { fs.lstatSync(file); return true; } catch(e) { if(e.code !== 'ENOENT') throw e; return false; } })()) {
    assert(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink(), 'unsafe file');
  }
  return file;
}
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function fingerprint(v) { return createHash('sha256').update(canonical(v)).digest('hex'); }
function open(root, name) {
  const file = safePath(root,name);
  const existing = fs.existsSync(file);
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL');
    if (existing) {
      assert.equal(db.prepare('PRAGMA user_version').get().user_version,1,'unsupported database');
      assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
      db.prepare('SELECT revision,value FROM state WHERE id=1').get();
    } else {
      db.exec("BEGIN IMMEDIATE; CREATE TABLE state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, value TEXT NOT NULL); INSERT INTO state VALUES(1,0,''); CREATE TABLE audit(command TEXT PRIMARY KEY, digest TEXT NOT NULL, revision INTEGER UNIQUE NOT NULL); PRAGMA user_version=1; COMMIT");
    }
    return db;
  } catch(e) { db.close(); throw e; }
}
function snapshot(db) {
  return { ...db.prepare('SELECT revision,value FROM state WHERE id=1').get(), history: db.prepare('SELECT command,digest,revision FROM audit ORDER BY revision').all().map(x=>({...x})), production_go:false };
}
function mutate(db, request, fail=false) {
  const {command,expected,value}=request;
  assert(typeof command==='string' && command.length>0 && Number.isSafeInteger(expected) && expected>=0 && typeof value==='string','invalid command');
  const digest=fingerprint(request);
  db.exec('BEGIN IMMEDIATE');
  try {
    const prior=db.prepare('SELECT digest,revision FROM audit WHERE command=?').get(command);
    if(prior) { assert.equal(prior.digest,digest,'command conflict'); db.exec('COMMIT'); return prior.revision; }
    const result=db.prepare('UPDATE state SET revision=revision+1,value=? WHERE id=1 AND revision=?').run(value,expected);
    assert.equal(Number(result.changes),1,'stale revision');
    db.prepare('INSERT INTO audit VALUES(?,?,?)').run(command,digest,expected+1);
    if(fail) throw Error('injected rollback');
    db.exec('COMMIT'); return expected+1;
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
function exportState(db) { return JSON.stringify({version:1,...snapshot(db)}); }
function importState(db, raw) {
  const p=JSON.parse(raw);
  assert(p.version===1 && p.production_go===false && !('grants' in p) && typeof p.value==='string' && Number.isSafeInteger(p.revision) && p.revision>=0 && Array.isArray(p.history) && p.history.length===p.revision,'invalid package');
  assert(p.history.every((h,i)=>typeof h.command==='string' && h.command.length>0 && /^[a-f0-9]{64}$/.test(h.digest) && h.revision===i+1),'invalid history');
  db.exec('BEGIN IMMEDIATE');
  try {
    assert.equal(snapshot(db).revision,0,'target not empty');
    db.prepare('UPDATE state SET revision=?,value=? WHERE id=1').run(p.revision,p.value);
    for(const h of p.history) db.prepare('INSERT INTO audit VALUES(?,?,?)').run(h.command,h.digest,h.revision);
    db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); throw e; }
}
module.exports={safePath,open,snapshot,mutate,exportState,importState,fingerprint};
