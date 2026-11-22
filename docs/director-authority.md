# Director authority and checkpoint contract

The Director is an **assistant to the creative owner**. The user chooses the idea and approves screenplay, Visual Bible, storyboard, locked-asset changes, paid generation and publication. Specialist agents contribute **PROPOSED** work only. Even when the Director makes routine creative/technical recommendations, it cannot forge user intent or claim rendered media.

## Deterministic library

`scripts/director-authority.js` implements pure, in-memory authoring operations:

- `proposeGate`: creates one pending, version-specific screenplay/Visual Bible/storyboard proposal without approving it
- `approveGate`: consumes an exact pending proposal plus caller-supplied USER message evidence and rejects stale, missing or ambiguous cases
- `proposeLockedShotRevision`: preserves the original locked record and creates a new PROPOSED revision only with a shot-specific user authorization quote
- `recordPermission`: logs explicit, separately scoped user statements about production GO, provider jobs or publication. **Does not execute a job or enable a provider flag**
- `inspectCheckpoint` / `restoreCheckpoint`: examine or recover an existing JSON checkpoint while preserving references and reporting limits honestly

The library does **not** authenticate that the supplied quote actually came from the user. The embedding agent/app must obtain real conversation evidence; code cannot infer approvals from invented text. These records are a **verification aid**, not digital signatures, server persistence or a live authorization system.

## Worked example

A fictional test project has screenplay revision SCRIPT-V1 pending. The Director may ask "Do you approve SCREENPLAY-V1?" and, after the real user confirms, record the exact message reference. This does **not** approve Visual Bible or storyboard.

If a user says "Change all shots", it is insufficient authority to modify shot S01_SH08 without a shot-specific clarification. When the user authorizes "repair S01_SH08 only", the original LOCKED revision stays intact; the repaired candidate is PROPOSED.

With no user-supplied clip, any report of repeated frames is a USER_REPORT rather than direct observation. A recorded intention to generate a clip does not itself generate, retrieve or inspect it.

## Boundaries

- No network, provider calls, account access, credit spending, persistence or publication
- No replacement of source assets or mass unlock
- No auto-execution of recorded permission grants; operational flags remain false
- No assumptions about the availability of actual video or audio
- Current v2 contracts are kept in `contracts/`; historic v1 resides at its Git release tag, not in duplicate version folders

## Offline acceptance

```bash
node --test tests/node/director-authority.test.js
node --test tests/node/*.test.js
```

These tests use synthetic approval messages as negative/positive fixtures. Live-agent invocation and provider-backed media remain untested. All approval and checkpoint changes must still be reviewed against the actual user transcript in the chosen host.

## V2.2 scoped revision recovery inspection

`inspectCheckpoint` reports `pending_shot_revisions` for proposed revisions with a `parent_revision`. Each entry identifies the original locked revision (if still present), its recorded approved asset reference, and neighboring dependency-graph node IDs. Neighbors are conservatively reported in **both** edge directions: the graph does not currently define a reliable change-propagation direction. These are review candidates, **not** automatic invalidations or permission to change assets.

When all earlier approval and dependency-integrity gates are clear, pending scoped revisions cause the next safe action to request human reconciliation. Preserve the locked source and approval ledger, check whether each related shot, audio cue or anchor actually needs a new proposal, and obtain any required user authorization separately. Checkpoint inspection neither verifies asset files nor grants production or publication permissions.

## Dependency reference compatibility (V2.2)

Dependency graph nodes retain `{kind,id}` and edges retain `{from,to}`. Use **`kind:id`** in new edge references (for example `shot:SH03`, `audio:CUE03`, `anchor:CHILD-01`). Existing bare-ID edges remain readable only when exactly one node has that ID. Ambiguous bare references fail closed; do not guess the kind. Checkpoint revision-impact neighbors are returned in canonical form. Directed edges continue to describe downstream repair impact in the audio planner; checkpoint recovery reports directly adjacent nodes in both directions for conservative human review. This is a compatibility rule, not an approval or automatic asset invalidation.

## V2.7 authority and handoff integrity (F06–F09)

Authority helpers accept a bounded, full-statement grammar. Approval keywords inside
negative, conditional, quoted or unrelated statements do not establish approval.
Named gate approvals must match the pending gate and, when supplied, its exact
version. Screenplay/script and Visual Bible spelling aliases remain supported.
Generic replies (`yes`, `I approve`, `approved`, `I confirm`) require exactly one
pending gate proposal. Unknown wording requires clarification; these checks are
neither complete natural-language understanding nor authentication of USER identity.

Scoped unlock requires a complete shot identifier in a direct instruction such as
`Unlock SHOT-01` or `I allow repair of S01_SH08 only`. It preserves the locked source,
its asset and parent lineage, adding only a PROPOSED candidate. Multiple targets,
substring IDs, negative statements and conditional instructions are refused.
Permission records must match both the permission purpose and scope. For example,
`I authorize video generation of S01_SH01 only` records a provider-job intention
for scope `S01_SH01 only`; `I authorize publication` records publication scope
`publication`. A narrower scope must appear explicitly after `of` or `for`; an
unqualified statement cannot silently authorize a caller-selected shot. Evidence is
copied into the ledger. All three operational flags remain false.

### Audited specialist output responsibilities

`stage` describes the proposed output responsibility, not whichever phase the
project currently occupies. A review of an earlier artifact is a `review` handoff;
it does not make QA the author of a `script` proposal. All handoffs remain PROPOSED.

| Specialist | Allowed stages | Audited responsibility |
| --- | --- | --- |
| film-storytelling | script, review | Screenplay, dialogue/narration and narrative quality review |
| film-visual-direction | visual_bible, review | Visual Bible, identity anchors and visual consistency review |
| film-cinematography | storyboard, generator, review | Timed shot design, generator-friendly visual plans and camera/timing review |
| film-video-production | generator, generate, review, delivery | Generator packets, generation job planning/evidence, export QA and delivery metadata |
| film-sound-direction | sound, review, delivery | Cue sheets, dubbing/repairs, sync review and final audio/export checks |
| film-continuity-qa | sound, review, delivery | Audio repair proposals, continuity/repair review and full export evidence review |

Audit sources: all six specialist `SKILL.md` files and their
`references/worked-example.md`; cinematography's shot-plan guidance; sound's
`references/audio-direction.md`; QA's `references/postproduction.md`; video
production's export-QA guidance; `docs/architecture.md`; canonical handoff and
Project Bible schemas; existing contract, orchestration and schema-validation
fixtures. No existing fixture used an incompatible specialist/stage pair. The old
orchestration fixture's generic sentence `I approve this synthetic test proposal`
was replaced with supported `I approve`; it still approves its sole pending gate.
Runtime and JSON Schema enforce the same matrix; tests cover all 48 pairs and all
seven installed runtimes. A new responsibility outside this table requires an
explicit contract review, rather than accepting any allowed stage independently.

### Regression evidence and limits

On Linux with Node.js 24.22.3, the 17 synthetic helper cases derived from the
owner's Windows observations reproduced the previous 9 PASS / 8 FAIL result
against main `56dd9c6d70b19266beb5f78488f8566ad9fca924`. The corrected helpers pass
all 17. The complete suite passes 427/427, including 122 new regression tests for
authority scope, immutable assets, ledger isolation, stage compatibility and
installed-runtime behavior. Schema-instance validation additionally exercises all
48 pairs directly and through Project Bible references.

These are deterministic local regressions, not a new Windows or live-agent run.
They do not verify specialist agent independence, persistent Project Bible storage,
actual media inspection or provider execution. Earlier Phase 3 deferred items stay
deferred. F10 is unchanged: downstream propagation belongs to `previewRepairImpact`,
while checkpoint inspection deliberately reports adjacent dependencies. V2.7 stays
HOLD pending the remaining roadmap and explicit owner release approval.
