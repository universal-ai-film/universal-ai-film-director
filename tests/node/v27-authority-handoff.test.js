'use strict';
// Synthetic regression statements derived from owner-reported Windows cases.
// These tests exercise deterministic helpers, not live agents or authentication.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.V27_RUNTIME_ROOT||path.resolve(__dirname,'../../scripts');
const contracts=require(path.join(root,'project-contracts.js'));
const authority=require(path.join(root,'director-authority.js'));
const user=quote=>({actor:'USER',source_ref:'synthetic:v27',quote});
const pending=()=>authority.proposeGate(contracts.newProject('v27'),{expected_revision:1,gate:'script',version:'SCREENPLAY-V1',artifact_ref:'draft:script',proposal_id:'P1'});
const locked=(id='SHOT-01')=>{const p=contracts.newProject('v27');p.shots.push({id,revision:1,state:'LOCKED',approved_asset:'asset:original',continuity_refs:[],issues:[]});return p;};
const approve=(api,p,quote)=>api.approveGate(p,{expected_revision:p.revision,proposal_id:'P1',evidence:user(quote)});
const unlock=(api,p,quote)=>api.proposeLockedShotRevision(p,{expected_revision:p.revision,shot_id:p.shots[0].id,source_revision:1,new_revision:2,authorization_ref:'U1',evidence:user(quote),reason:'repair'});
const permission=(api,p,quote,kind='publication',scope='publication')=>api.recordPermission(p,{expected_revision:p.revision,permission:kind,scope,grant_id:'G1',evidence:user(quote)});
const proposal=(p,origin,stage)=>({contract_version:'2.0',project_id:p.project_id,request_id:'R1',origin,stage,input_revision:p.revision,status:'PROPOSED',proposed_artifact:{id:'A1',kind:'draft',revision:1},provenance:{kind:'AGENT_DRAFT',evidence_ref:null},required_authorization:[]});
function outcome(p,run,accept){const before=structuredClone(p);if(accept){const n=run();assert.deepEqual(n.authorization,p.authorization);}else assert.throws(run);assert.deepEqual(p,before);}
for(const [quote,accept] of [['I approve SCREENPLAY-V1.',true],['I approve nothing yet.',false],['I approve VISUAL-BIBLE-V1 instead.',false],['I approve only after revision.',false],['No',false]])
 test('Windows F06: '+quote,()=>{const p=pending();outcome(p,()=>approve(authority,p,quote),accept);});
for(const [quote,accept] of [['Unlock SHOT-01.',true],['Do not unlock SHOT-01.',false],['Unlock SHOT-010.',false],['Change all shots',false]])
 test('Windows F07: '+quote,()=>{const p=locked();outcome(p,()=>unlock(authority,p,quote),accept);});
for(const [quote,accept] of [['I authorize publication.',true],['I do not authorize publication.',false],['No',false]])
 test('Windows F08: '+quote,()=>{const p=contracts.newProject('v27');outcome(p,()=>permission(authority,p,quote),accept);});
for(const [origin,stage,accept] of [['film-storytelling','script',true],['film-storytelling','sound',false],['film-sound-direction','sound',true],['film-continuity-qa','script',false],['unknown-specialist','script',false]])
 test('Windows F09: '+origin+'/'+stage,()=>{const p=contracts.newProject('v27'),q=proposal(p,origin,stage);if(accept)assert.equal(contracts.validateProposal(p,q),true);else assert.throws(()=>contracts.validateProposal(p,q));assert.equal(p.proposals.length,0);});
for(const quote of ['I approve the screenplay','I approve screenplay V1','I approve','yes','Approved.','Approved by me','Yes, I approve','Yes. I approve','I confirm screenplay V1','I approve SCREENPLAY-V1!'])
 test('F06 compatible explicit approval: '+quote,()=>assert.equal(approve(authority,pending(),quote).gates.script.approved,true));
for(const quote of ['I do not approve SCREENPLAY-V1','I approve SCREENPLAY-V10','I approve VISUAL-BIBLE-V1','I approve screenplay V2','I approve screenplay and Visual Bible','I approve SCREENPLAY-V1 if revised','I approve SCREENPLAY-V1, but wait','Do I approve SCREENPLAY-V1?','She said I approve SCREENPLAY-V1','I might approve SCREENPLAY-V1','I approve SCREENPLAY-V1 unless changed'])
 test('F06 rejects unsafe scope: '+quote,()=>assert.throws(()=>approve(authority,pending(),quote)));
test('F06 generic approval requires exactly one pending proposal; named scope stays valid',()=>{
 let p=pending();p=authority.proposeGate(p,{expected_revision:p.revision,gate:'visual_bible',version:'VISUAL-BIBLE-V1',artifact_ref:'draft:visual',proposal_id:'P2'});
 for(const quote of ['yes','I approve','Approved','I confirm'])assert.throws(()=>approve(authority,p,quote));
 assert.equal(approve(authority,p,'I approve the screenplay').gates.script.approved,true);
 p=approve(authority,p,'I approve SCREENPLAY-V1');
 p=authority.approveGate(p,{expected_revision:p.revision,proposal_id:'P2',evidence:user('I approve the Visual Bible')});
 assert.equal(p.gates.visual_bible.approved,true);
});
test('F06 a bare version shared across pending gates is ambiguous',()=>{
 let p=authority.proposeGate(contracts.newProject('v27'),{expected_revision:1,gate:'script',version:'V1',artifact_ref:'script:1',proposal_id:'P1'});
 p=authority.proposeGate(p,{expected_revision:p.revision,gate:'visual_bible',version:'V1',artifact_ref:'visual:1',proposal_id:'P2'});
 assert.throws(()=>approve(authority,p,'I approve V1'));
 assert.equal(approve(authority,p,'I approve screenplay V1').gates.script.approved,true);
});
for(const quote of ['Do not unlock SHOT-01','Never repair SHOT-01','Unlock SHOT-01 if needed','Unlock SHOT-01 and SHOT-02','Unlock SHOT-01 or SHOT-02','Unlock SHOT-01 after revision','Unlock XSHOT-01','Unlock shot-01','Unlock SHOT-01_extra','Unlock SHOT-01?','I allow SHOT-01','I allow repair of SHOT-01 only, but wait'])
 test('F07 rejects unsafe scope: '+quote,()=>assert.throws(()=>unlock(authority,locked(),quote)));
for(const id of ['S01_SH08','SH08','SHOT-01'])test('F07 preserves immutable source and lineage: '+id,()=>{
 const p=locked(id),n=unlock(authority,p,'I allow repair of '+id+' only');
 assert.deepEqual(n.shots[0],p.shots[0]);assert.equal(n.shots[1].state,'PROPOSED');assert.equal(n.shots[1].parent_revision,1);assert.equal(n.shots[1].approved_asset,undefined);assert.deepEqual(n.authorization,p.authorization);
});
for(const quote of ['I authorize publication if approved','I authorize publication after revision','I authorize generation','I allow nothing','Do I authorize publication?','I authorize publication, but wait','I never authorize publication','I authorize publication for SHOT-010','I authorize publication for SHOT-01 and SHOT-02'])
 test('F08 rejects unsafe permission: '+quote,()=>assert.throws(()=>permission(authority,contracts.newProject('v27'),quote)));
test('F08 matching caller scope cannot smuggle conditional or negative intent',()=>{
 for(const scope of ['SHOT-01 if approved','SHOT-01 after revision','not SHOT-01','SHOT-01 and SHOT-02','SHOT-01 unless canceled','SHOT-01 when approved','SHOT-01 provided approval','SHOT-01 subject to approval'])
  assert.throws(()=>permission(authority,contracts.newProject('v27'),'I authorize publication for '+scope,'publication',scope));
});
test('F08 purpose and exact scope are bound to copied ledger evidence',()=>{
 const p=contracts.newProject('v27'),e=user('I authorize video generation of S01_SH01 only');
 const n=authority.recordPermission(p,{expected_revision:p.revision,permission:'provider_job',scope:'S01_SH01 only',grant_id:'G1',evidence:e});
 e.quote='tampered';assert.equal(n.permission_ledger[0].evidence.quote,'I authorize video generation of S01_SH01 only');
 assert.equal(n.permission_ledger[0].status,'RECORDED_ONLY');assert.deepEqual(n.authorization,p.authorization);
 assert.throws(()=>permission(authority,p,'I authorize video generation of S01_SH010 only','provider_job','S01_SH01 only'));
 assert.throws(()=>permission(authority,p,'I authorize publication for SHOT-01','publication','SHOT-02'));
 assert.throws(()=>permission(authority,p,'I authorize publication for shot-01','publication','SHOT-01'));
 assert.throws(()=>permission(authority,p,'I authorize video generation of S01_SH01 only','publication','S01_SH01 only'));
 for(const kind of ['production_go','provider_job','publication']){
  const action={production_go:'production GO',provider_job:'video generation',publication:'publication'}[kind];
  assert.deepEqual(permission(authority,p,'I authorize '+action,kind,action).authorization,p.authorization);
 }
});
// Expected responsibilities derived from all six SKILL.md and worked examples.
const matrix={
 'film-storytelling':['script','review'],
 'film-visual-direction':['visual_bible','review'],
 'film-cinematography':['storyboard','generator','review'],
 'film-video-production':['generator','generate','review','delivery'],
 'film-sound-direction':['sound','review','delivery'],
 'film-continuity-qa':['sound','review','delivery']
};
const stages=['script','visual_bible','storyboard','sound','generator','generate','review','delivery'];
for(const [origin,allowed] of Object.entries(matrix))for(const stage of stages)
 test('F09 matrix: '+origin+'/'+stage,()=>{
  const p=contracts.newProject('v27'),q=proposal(p,origin,stage),before=structuredClone(q);
  if(allowed.includes(stage)){const n=contracts.recordProposal(p,q);assert.deepEqual(n.gates,p.gates);assert.deepEqual(n.authorization,p.authorization);}
  else assert.throws(()=>contracts.recordProposal(p,q),/Incompatible/);
  assert.deepEqual(q,before);assert.equal(p.proposals.length,0);
 });
if(!process.env.V27_RUNTIME_ROOT){
 test('F09 schema matrix matches tested runtime responsibilities',()=>{
  const schema=require('../../contracts/handoff.schema.json');
  assert.deepEqual(Object.fromEntries(schema.allOf.map(rule=>[rule.if.properties.origin.const,rule.then.properties.stage.enum])),matrix);
 });
 for(const skill of ['universal-ai-film-director',...Object.keys(matrix)])test('installed runtime enforces authority/handoff integrity: '+skill,()=>{
  const api=require('../../skills/'+skill+'/scripts/runtime.js'),p=api.newProject('v27');
  for(const [origin,allowed] of Object.entries(matrix))for(const stage of stages){
   const q=proposal(p,origin,stage);if(allowed.includes(stage))assert.equal(api.validateProposal(p,q),true);else assert.throws(()=>api.validateProposal(p,q));
  }
  if(api.approveGate){assert.throws(()=>approve(api,pending(),'I approve nothing yet.'));assert.throws(()=>unlock(api,locked(),'Do not unlock SHOT-01.'));assert.throws(()=>permission(api,p,'I do not authorize publication.'));}
 });
}
