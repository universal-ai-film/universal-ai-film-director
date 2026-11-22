'use strict';
// Deterministic authoring/ledger logic, NOT authentication, filesystem persistence,
// provider execution, media inspection or a substitute for reviewing user intent.
const {validateProject}=require('./project-contracts.js');
const clone=x=>structuredClone(x);
const ok=x=>typeof x==='string'&&x.trim().length>0;
const fail=msg=>{throw new Error(msg)};
const gateNames=new Set(['script','visual_bible','storyboard']);
const permissionKinds=new Set(['production_go','provider_job','publication']);
const getLedger=(p,key)=>Array.isArray(p[key])?p[key]:[];
function checkRevision(p,revision) {
 validateProject(p);
 if(revision!==p.revision)fail('Stale project revision; reload current checkpoint');
}
function evidenceOfUser(e) {
 if(!e||e.actor!=='USER'||!ok(e.source_ref)||!ok(e.quote))fail('Explicit USER evidence with source_ref and quote required');
 return clone({actor:'USER',source_ref:e.source_ref,quote:e.quote});
}
// Deliberately bounded statement grammar, not natural-language understanding.
// Unknown wording must be clarified; never accept a matching keyword in a sentence.
const cleanStatement = q => q.trim().replace(/[.!]$/, '').trim().replace(/\s+/g,' ');
const statement = q => cleanStatement(q).toLowerCase();
const unsafeClause = q => /\b(?:no|not|never|nothing|if|unless|until|after|before|once|when|provided|pending|subject|maybe|perhaps|instead|except|but|and|or|all)\b|[?;]|[‘’"]|\b(?:don\'t|can\'t|won\'t)\b/i.test(q);
const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const gateAliases={script:'(?:screenplay|script)',visual_bible:'visual[ _-]bible',storyboard:'storyboard'};
function scopeIsApproval(e,proposal,pendingCount) {
 const text=statement(e.quote);
 if(unsafeClause(text))return false;
 const match=/^(?:yes[,. ]+)?(?:i approve|i confirm|approved by me|approved|approve|confirmed)(?: (.+))?$/.exec(text);
 if(!match)return text==='yes'&&pendingCount===1;
 if(!match[1])return pendingCount===1;
 const target=match[1].replace(/^the /,'');
 // Exact proposal version, or a gate alias optionally followed by its version suffix.
 const version=statement(proposal.version);
 const suffix=version.match(/(?:^|[-_ ])(v\d+(?:\.\d+)*)$/)?.[1];
 return target===version&&(!/^v\d+(?:\.\d+)*$/.test(version)||pendingCount===1) || new RegExp('^'+gateAliases[proposal.gate]+(suffix?'(?:[-_ ]'+escapeRE(suffix)+')?':'')+'$').test(target);
}
function scopeIsUnlock(e,shotId) {
 const match=/^(?:(?:i )?(?:allow|authorize|authorise) (?:the )?)?(?:unlock|revise|replace|change|repair|modify)(?: of)? ([a-z0-9_-]+)(?: only)?$/i.exec(cleanStatement(e.quote));
 return !!match&&match[1]===shotId;
}
function scopeIsPermission(e,permission,scope) {
 if(unsafeClause(e.quote)||unsafeClause(scope))return false;
 const match=/^(?:(?:i )?(?:authorize|authorise|allow|approve)|go ahead with|you may) (.+)$/i.exec(cleanStatement(e.quote));
 if(!match)return false;
 const actions={production_go:'(?:production[ _-]go|production)',provider_job:'(?:video generation|generation|provider[ _-]job)',publication:'(?:publication|publishing|publish)'};
 const action=actions[permission],target=cleanStatement(scope);
 // An unqualified action only covers that same action scope. A narrower scope
 // must appear exactly after "of" or "for"; preserve identifier case as well.
 const purpose=new RegExp('^'+action+'(?: (?:of|for) (.+))?$','i').exec(match[1]);
 if(!purpose)return false;
 return purpose[1]!==undefined ? purpose[1]===target : new RegExp('^'+action+'$','i').test(target);
}
function proposeGate(p,{expected_revision,gate,version,artifact_ref,proposal_id}) {
 checkRevision(p,expected_revision);
 if(!gateNames.has(gate)||!ok(version)||!ok(artifact_ref)||!ok(proposal_id))fail('Invalid gate proposal');
 if(p.gates[gate].approved)fail('Previously approved gate requires a separate scoped revision workflow');
 if(getLedger(p,'gate_proposals').some(x=>x.proposal_id===proposal_id))fail('Duplicate gate proposal ID');
 if(getLedger(p,'gate_proposals').some(x=>x.gate===gate&&x.status==='PENDING'))fail('Resolve existing pending gate proposal first');
 const n=clone(p);
 n.gate_proposals=getLedger(n,'gate_proposals');
 n.gate_proposals.push({proposal_id,gate,version,artifact_ref,status:'PENDING',created_revision:p.revision});
 n.revision++;return n;
}
function approveGate(p,{expected_revision,proposal_id,evidence}) {
 checkRevision(p,expected_revision);
 const q=getLedger(p,'gate_proposals').find(x=>x.proposal_id===proposal_id&&x.status==='PENDING');
 if(!q)fail('No exact pending proposal to approve');
 const e=evidenceOfUser(evidence);
 // A bare yes is only meaningful if exactly one item is pending overall.
 if(/^yes[.!]?$/i.test(e.quote.trim())&&getLedger(p,'gate_proposals').filter(x=>x.status==='PENDING').length!==1)
  fail('Ambiguous yes with multiple pending gates');
 if(!scopeIsApproval(e,q,getLedger(p,'gate_proposals').filter(x=>x.status==='PENDING').length))fail('Ambiguous user reply; explicit approval needed');
 const order=['script','visual_bible','storyboard'];
 const index=order.indexOf(q.gate);
 if(index>0 && !p.gates[order[index-1]].approved)fail('Earlier user approval gate is missing');
 const n=clone(p);n.gate_proposals=getLedger(n,'gate_proposals');
 const item=n.gate_proposals.find(x=>x.proposal_id===proposal_id);
 item.status='APPROVED';item.approved_evidence=e;
 n.gates[q.gate]={approved:true,version:q.version,evidence:e.source_ref};
 n.approval_ledger=getLedger(n,'approval_ledger');
 n.approval_ledger.push({kind:'GATE',gate:q.gate,proposal_id,version:q.version,artifact_ref:q.artifact_ref,evidence:e});
 n.revision++;return n;
}
function proposeLockedShotRevision(p,{expected_revision,shot_id,source_revision,new_revision,authorization_ref,evidence,reason}) {
 checkRevision(p,expected_revision);
 if(!ok(shot_id)||!Number.isInteger(source_revision)||!Number.isInteger(new_revision)||new_revision<=source_revision||!ok(reason)||!ok(authorization_ref))fail('Invalid scoped revision');
 const source=p.shots.find(s=>s.id===shot_id&&s.revision===source_revision);
 if(!source||source.state!=='LOCKED')fail('Only an existing LOCKED shot can be revised through scoped unlock');
 if(p.shots.some(s=>s.id===shot_id&&s.revision===new_revision))fail('New shot revision already exists');
 const e=evidenceOfUser(evidence);
 if(!scopeIsUnlock(e,shot_id))
  fail('Scoped user authorization must explicitly identify affected shot');
 if(getLedger(p,'unlock_ledger').some(x=>x.authorization_ref===authorization_ref))fail('Duplicate authorization reference');
 const n=clone(p);n.unlock_ledger=getLedger(n,'unlock_ledger');
 n.unlock_ledger.push({authorization_ref,shot_id,source_revision,new_revision,reason,evidence:e});
 n.shots.push({id:shot_id,revision:new_revision,parent_revision:source_revision,state:'PROPOSED',
  continuity_refs:clone(source.continuity_refs),issues:[reason]});
 n.revision++;return n;
}
function recordPermission(p,{expected_revision,permission,scope,grant_id,evidence}) {
 checkRevision(p,expected_revision);
 if(!permissionKinds.has(permission)||!ok(scope)||!ok(grant_id))fail('Permission kind, scope and grant ID required');
 const e=evidenceOfUser(evidence);
 if(!scopeIsPermission(e,permission,scope))
  fail('Explicit permission statement required');
 if(getLedger(p,'permission_ledger').some(x=>x.grant_id===grant_id))fail('Duplicate permission grant ID');
 const n=clone(p);n.permission_ledger=getLedger(n,'permission_ledger');
 n.permission_ledger.push({grant_id,permission,scope,evidence:e,status:'RECORDED_ONLY'});
 // Intentional: grants document a user's statement. This library never changes
 // operational flags, invokes providers, connects accounts or publishes media.
 n.revision++;return n;
}
function resolveGraphRef(ref,nodes) {
 if(!ok(ref))return null;
 const canonical=nodes.filter(n=>n&&['shot','audio','anchor'].includes(n.kind)&&ok(n.id)).map(n=>({key:n.kind+':'+n.id,id:n.id}));
 if(canonical.some(n=>n.key===ref))return ref;
 const matches=canonical.filter(n=>n.id===ref);
 return matches.length===1?matches[0].key:null;
}
function inspectDependencyGraph(p) {
 const issues=[];
 if(!p.dependency_graph)return issues;
 const ids=new Set();
 for(const [i,node] of p.dependency_graph.nodes.entries()) {
  if(!node||!['shot','audio','anchor'].includes(node.kind)||!ok(node.id)) {
   issues.push({code:'INVALID_DEPENDENCY_NODE',index:i});continue;
  }
  const key=node.kind+':'+node.id;
  if(ids.has(key))issues.push({code:'DUPLICATE_DEPENDENCY_NODE',node_id:key});
  ids.add(key);
 }
 for(const [i,edge] of p.dependency_graph.edges.entries()) {
  if(!edge||!ok(edge.from)||!ok(edge.to)) {
   issues.push({code:'INVALID_DEPENDENCY_EDGE',index:i});continue;
  }
  if(!resolveGraphRef(edge.from,p.dependency_graph.nodes))issues.push({code:'MISSING_DEPENDENCY_ENDPOINT',index:i,endpoint:edge.from,side:'from'});
  if(!resolveGraphRef(edge.to,p.dependency_graph.nodes))issues.push({code:'MISSING_DEPENDENCY_ENDPOINT',index:i,endpoint:edge.to,side:'to'});
 }
 return issues;
}
function inspectApprovalLedger(p) {
 const issues=[];
 const ledger=getLedger(p,'approval_ledger');
 const proposals=getLedger(p,'gate_proposals');
 for(const gate of ['script','visual_bible','storyboard']) {
  const state=p.gates[gate];
  if(!state.approved)continue;
  const entries=ledger.filter(x=>x&&x.kind==='GATE'&&x.gate===gate);
  if(entries.length!==1) {
   issues.push({code:entries.length?'AMBIGUOUS_GATE_APPROVAL':'MISSING_GATE_APPROVAL_LEDGER',gate});
   continue;
  }
  const item=entries[0];
  if(item.version!==state.version||!item.evidence||item.evidence.source_ref!==state.evidence)
   issues.push({code:'GATE_APPROVAL_MISMATCH',gate});
  if(!item.evidence||item.evidence.actor!=='USER'||!ok(item.evidence.source_ref)||!ok(item.evidence.quote))
   issues.push({code:'INVALID_GATE_EVIDENCE',gate});
  const proposal=proposals.find(x=>x&&x.proposal_id===item.proposal_id&&x.gate===gate);
  if(!proposal||proposal.status!=='APPROVED'||proposal.version!==item.version||proposal.artifact_ref!==item.artifact_ref)
   issues.push({code:'GATE_PROPOSAL_MISMATCH',gate});
 }
 return issues;
}
// Read-only conservative impact report: graph edges are not assumed to encode
// propagation direction. Both endpoints are flagged for human reconciliation.
function inspectPendingShotRevisions(p) {
 const graph=p.dependency_graph;
 return p.shots.filter(s=>s.state==='PROPOSED'&&Number.isInteger(s.parent_revision)).map(s=>{
  const source=p.shots.find(x=>x.id===s.id&&x.revision===s.parent_revision&&x.state==='LOCKED');
  const neighbors=new Set();
  if(graph&&Array.isArray(graph.edges))for(const edge of graph.edges){
   if(!edge)continue;
   const from=resolveGraphRef(edge.from,graph.nodes),to=resolveGraphRef(edge.to,graph.nodes);
   if(from==='shot:'+s.id&&to)neighbors.add(to);
   if(to==='shot:'+s.id&&from)neighbors.add(from);
  }
  neighbors.delete('shot:'+s.id);
  return {shot_id:s.id,proposed_revision:s.revision,source_revision:s.parent_revision,
   source_locked:!!source,source_asset_ref:source?.approved_asset||null,
   related_node_ids:[...neighbors].sort(),requires_review:true};
 });
}
function inspectCheckpoint(p) {
 validateProject(p);
 const issues=[],g=['script','visual_bible','storyboard'];
 const next=g.find(x=>!p.gates[x].approved);
 if(next)issues.push('Missing approval: '+next);
 const locked=p.shots.filter(s=>s.state==='LOCKED').map(s=>({id:s.id,revision:s.revision,asset_ref:s.approved_asset}));
 const pending=getLedger(p,'gate_proposals').filter(x=>x.status==='PENDING').map(x=>({proposal_id:x.proposal_id,gate:x.gate,version:x.version}));
 const unresolved_issues=inspectDependencyGraph(p);
 const approval_integrity_issues=inspectApprovalLedger(p);
 const pending_shot_revisions=inspectPendingShotRevisions(p);
 if(pending_shot_revisions.length)issues.push('Pending scoped shot revisions require review: '+pending_shot_revisions.length);
 if(unresolved_issues.length)issues.push('Unresolved dependency graph issues: '+unresolved_issues.length);
 if(approval_integrity_issues.length)issues.push('Approval integrity issues: '+approval_integrity_issues.length);
 return {project_id:p.project_id,revision:p.revision,phase:p.phase,locked,pending,issues,unresolved_issues,approval_integrity_issues,pending_shot_revisions,
 next_safe_action:approval_integrity_issues.length?'Resolve approval integrity issues before continuing planning':next?'Resolve '+next+' approval':unresolved_issues.length?'Resolve dependency graph issues before continuing planning':pending_shot_revisions.length?'Review pending scoped shot revisions and related dependencies before continuing planning':'Continue planning only; verify separate permissions before any production or provider execution',
 provider_execution_performed:false,media_inspected:false,persisted:false};
}
function restoreCheckpoint(json) {
 let p;
 try{p=JSON.parse(json)}catch{fail('Invalid checkpoint JSON')}
 validateProject(p);
 return clone(p); // no implicit upload, saved file, provider access or approval
}
module.exports={proposeGate,approveGate,proposeLockedShotRevision,recordPermission,inspectCheckpoint,restoreCheckpoint};
