'use strict';
// Static instruction checks and deterministic authority checks, not live agent execution.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../../skills',p),'utf8');
const director=read('universal-ai-film-director/SKILL.md');
test('F11 explicit rights reporting across production and review',()=>{
 for(const phrase of ['production packet, final continuity review and delivery','provenance, intended use','UNKNOWN or UNVERIFIED','Unknown rights do not block planning-only work','never imply legal clearance'])assert.ok(director.includes(phrase),phrase);
 assert.match(read('film-video-production/SKILL.md'),/User-supplied assets are not automatically cleared/);
 assert.match(read('film-video-production/assets/shot-packet-template.md'),/Asset-rights status/);
 assert.match(read('film-continuity-qa/SKILL.md'),/outstanding rights\/consent issues/);
});
test('F12 separate final authorization fields including planning-only review',()=>{
 for(const phrase of ['Final production authorization summary','creative approval (exact revisions)','planning completion','actual media inspection','Production GO','provider execution authorization','publication authorization','remaining blockers','next required user decision','RECORDED_ONLY','never authorizes generation, spending or publication'])assert.ok(director.includes(phrase),phrase);
 assert.match(read('film-continuity-qa/SKILL.md'),/NOT_INSPECTED for document-only review/);
});
test('F12 deterministic robot-and-flower planning scenario: creative approvals leave authorization unchanged',()=>{
 const contracts=require('../../scripts/project-contracts.js'),authority=require('../../scripts/director-authority.js');
 let p=contracts.newProject('robot-and-flower-30s');
 const initial=structuredClone(p.authorization);
 for(const [gate,version] of [['script','SCREENPLAY-V1'],['visual_bible','VISUAL-BIBLE-V1'],['storyboard','STORYBOARD-V1']]){
  p=authority.proposeGate(p,{expected_revision:p.revision,gate,version,artifact_ref:'draft:'+gate,proposal_id:gate});
  p=authority.approveGate(p,{expected_revision:p.revision,proposal_id:gate,evidence:{actor:'USER',source_ref:'synthetic:robot-flower',quote:'I approve '+version+'.'}});
  assert.equal(p.gates[gate].approved,true);
 }
 assert.deepEqual(p.authorization,initial);
});
