const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'director packed '));
try {
 const npm=process.env.npm_execpath;
 assert.ok(npm,'run using npm run pack-test');
 function run(args,cwd){const r=spawnSync(process.execPath,[npm,...args],{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
 const packed=JSON.parse(run(['pack','--json','--pack-destination',root],process.cwd()))[0];
 run(['install','--offline','--ignore-scripts','--omit=dev','--no-audit','--no-fund',path.join(root,packed.filename)],root);
 const pkg=path.join(root,'node_modules','director-typescript-spike');
 assert.ok(!fs.existsSync(path.join(root,'node_modules','typescript')));
 const out=spawnSync(process.execPath,[path.join(pkg,'dist','cli.js'),'doctor'],{cwd:root,encoding:'utf8'});
 assert.equal(out.status,0,out.stderr);assert.deepEqual(JSON.parse(out.stdout),{value:'hello',production_go:false});
} finally {fs.rmSync(root,{recursive:true,force:true});}
