'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {spawnSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const s=require('../../research/v3/sqlite-spike');
const modulePath=require.resolve('../../research/v3/sqlite-spike');
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'director sqlite '));
 const db=s.open(root,'project.db'); t.after(()=>{try{db.close()}catch{} fs.rmSync(root,{recursive:true,force:true});});
 return {root,db};
}
const req=(command='one',expected=0,value='hello')=>({command,expected,value});
test('availability and versions',()=>{console.log(process.platform,process.version);const db=new DatabaseSync(':memory:');console.log(db.prepare('select sqlite_version() as version').get());db.close()});
test('reopen committed data',t=>{const {root,db}=fixture(t);s.mutate(db,req());const before=s.snapshot(db);db.close();const reopened=s.open(root,'project.db');try{assert.deepEqual(s.snapshot(reopened),before)}finally{reopened.close()}});
test('rollback state and audit',t=>{const {db}=fixture(t);const before=s.snapshot(db);assert.throws(()=>s.mutate(db,req(),true),/rollback/);assert.deepEqual(s.snapshot(db),before)});
test('concurrent connection bounded contention and no lost update',t=>{const {root,db}=fixture(t);const other=s.open(root,'project.db');try{db.exec('BEGIN IMMEDIATE');const start=Date.now();assert.throws(()=>s.mutate(other,req()),/locked|busy/i);assert.ok(Date.now()-start<5000);db.exec('ROLLBACK');s.mutate(db,req());assert.throws(()=>s.mutate(other,req('two')),/stale/);s.mutate(other,req('two',1));assert.equal(s.snapshot(db).revision,2)}finally{other.close()}});
test('stale revision rejected',t=>{const {db}=fixture(t);s.mutate(db,req());const before=s.snapshot(db);assert.throws(()=>s.mutate(db,req('two')),/stale/);assert.deepEqual(s.snapshot(db),before)});
test('abrupt process exit rolls back uncommitted data',t=>{const {root,db}=fixture(t);s.mutate(db,req());const before=s.snapshot(db);db.close();const child=spawnSync(process.execPath,['-e', 'const s=require(process.argv[1]);const d=s.open(process.argv[2],"project.db");d.exec("BEGIN IMMEDIATE; UPDATE state SET revision=99; DELETE FROM audit");process.exit(17)',modulePath,root],{timeout:10000});assert.equal(child.status,17, String(child.stderr));const reopened=s.open(root,'project.db');try{assert.deepEqual(s.snapshot(reopened),before)}finally{reopened.close()}});
test('duplicate canonical request and conflicting payload',t=>{const {db}=fixture(t);assert.equal(s.mutate(db,req()),1);assert.equal(s.mutate(db,{value:'hello',expected:0,command:'one'}),1);assert.throws(()=>s.mutate(db,req('one',0,'changed')),/conflict/);assert.equal(s.snapshot(db).history.length,1)});
test('corrupt and unsupported databases not overwritten',t=>{const {root}=fixture(t);for(const name of ['bad.db','future.db']){const p=path.join(root,name);if(name==='bad.db')fs.writeFileSync(p,'not sqlite');else{const d=new DatabaseSync(p);d.exec('PRAGMA user_version=99');d.close()}const before=fs.readFileSync(p);assert.throws(()=>s.open(root,name));assert.deepEqual(fs.readFileSync(p),before)}});
test('portable import and no active grants',t=>{const {root,db}=fixture(t);s.mutate(db,req());const target=s.open(root,'target.db');try{const raw=s.exportState(db);assert.throws(()=>s.importState(target,JSON.stringify({...JSON.parse(raw),grants:[]})));assert.throws(()=>s.importState(target,JSON.stringify({...JSON.parse(raw),production_go:true})));s.importState(target,raw);assert.deepEqual(s.snapshot(target),s.snapshot(db))}finally{target.close()}});
test('read-only snapshot leaves state and existing export unchanged',t=>{const {root,db}=fixture(t);const p=path.join(root,'export.json');fs.writeFileSync(p,s.exportState(db));const before=fs.readFileSync(p);const state=s.snapshot(db);s.snapshot(db);assert.deepEqual(s.snapshot(db),state);assert.deepEqual(fs.readFileSync(p),before)});
test('native paths and traversal rejection',t=>{const {root}=fixture(t);for(const n of ['../x.db','..\\x.db','C:\\x.db','/x.db','a/b.db'])assert.throws(()=>s.safePath(root,n));assert.equal(s.safePath(root,'project.db'),path.join(fs.realpathSync(root),'project.db'))});
test('symlink rejected when host permits creation',t=>{const {root}=fixture(t);try{fs.symlinkSync(path.join(root,'project.db'),path.join(root,'link.db'),'file')}catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('host prohibits symlink creation');return}throw e}assert.throws(()=>s.open(root,'link.db'),/unsafe/)});
test('SQL values parameterized',t=>{const {db}=fixture(t);const value="'; DROP TABLE state; --";s.mutate(db,req(value,0,value));assert.equal(s.snapshot(db).value,value);assert.equal(s.snapshot(db).history.length,1)});
