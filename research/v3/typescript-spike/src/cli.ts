#!/usr/bin/env node
import { probe } from './core.js';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
function main(): void {
 if(process.argv[2] !== 'doctor' || !process.argv[1]) { console.error('usage: doctor'); process.exitCode=2; return; }
 const root=mkdtempSync(join(tmpdir(),'director ts '));
 try { console.log(JSON.stringify(probe(join(root,'test.db'),join(dirname(process.argv[1]),'../legacy/sqlite-spike.cjs')))); }
 finally { rmSync(root,{recursive:true,force:true}); }
}
try { main(); } catch(error: unknown) { console.error(error instanceof Error ? error.message : 'unknown error'); process.exitCode=1; }
