# Analysis Report: Media Browser

**Feature**: [/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/spec.md)  
**Branch**: `001-media-browser`  
**Date**: 2026-04-20  
**Analyzed Artifacts**:
- [/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/spec.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/spec.md)
- [/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/plan.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/plan.md)
- [/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/tasks.md](/Users/oberon/.openclaw/workspace/ClawFace/specs/001-media-browser/tasks.md)
- [/Users/oberon/.openclaw/workspace/ClawFace/.specify/memory/constitution.md](/Users/oberon/.openclaw/workspace/ClawFace/.specify/memory/constitution.md)

## Executive Summary

- **Critical**: 0
- **High**: 1
- **Medium**: 3
- **Low**: 0

The feature is directionally strong and constitutionally aligned, but there is one major implementation ambiguity and several medium-risk gaps that should ideally be resolved before coding begins. The most important unresolved issue is the acquisition strategy for source-first, cross-session media browsing: the artifacts assume a browser that can browse media broadly, but they do not yet specify how ClawFace will gather complete enough media data without either loading too much history or depending on a backend listing API that does not currently exist in the plan.

## Constitutional Compliance

### Result: PASS

No direct constitutional violations were found.

### Notes

- The plan and tasks respect the repo’s emphasis on maintainable seams over expanding current gravity wells.
- Validation requirements are explicitly carried through into the plan and tasks.
- UX consistency with the existing FileManager/FileManagerProvider interaction model is treated as a first-class requirement.
- The work is framed around testable helper/controller seams rather than clever one-off inline logic.

## Findings

### [HIGH] Cross-session media acquisition strategy is underspecified

**Where it appears**:
- Spec: broad source-first media browsing is implied by `FR-004`, `FR-005`, `FR-006`, and `US1`
- Plan: “Build source adapters from existing normalized shell/media data”
- Tasks: `T006` and `T011`

**Why this matters**:

The artifacts clearly want a browser that can show media beyond the currently open thread, but they do not yet define how ClawFace will obtain that data at acceptable cost. The current plan points at:
- `sessions.list`
- `sessions.preview`
- `chat.history`
- attachment shaping

However, these artifacts do not answer:
- whether `sessions.preview` is sufficient for media discovery
- whether the browser should load full history on demand per session/source
- whether it should rely on already-cached normalized history only
- whether a new backend listing path is required after all

Without that decision, `T006` can be implemented in materially different ways with different performance/completeness tradeoffs.

**Recommendation**:

Clarify the source acquisition strategy before implementation. For example:
- `All media` is built only from already-known/cached session data in v1, with explicit incompleteness accepted, or
- source roots are loaded on demand from per-session `chat.history`, with bounded pagination and caching rules, or
- the feature is split so `US1` initially scopes to currently selected session + recent session previews only

---

### [MEDIUM] The exact “reference/link” insertion format is still ambiguous

**Where it appears**:
- Spec clarification: “Insert as a reference/link”
- Plan section: “Add a reference-style chat insertion seam”
- Tasks: `T021`–`T024`

**Why this matters**:

The user-facing intent is clear, but the concrete authoring model is not. The artifacts do not yet define whether the inserted chat reference is:
- a visible markdown-style link
- a structured chip/token rendered in the composer
- a hidden app-level reference that serializes later
- a visible `MEDIA:`-style line or some softer user-facing variant

This is especially important because the current send path is attachment-oriented, while OpenClaw’s established media semantics strongly recognize real attachments and `MEDIA:` lines. Different teams could satisfy the same tasks with very different UX.

**Recommendation**:

Add one explicit design note before implementation:
- how the reference appears in the draft/composer
- what the user sees after insertion
- whether the sent message preserves that visible form or only uses it as an authoring affordance

---

### [MEDIUM] Provenance classification rules are not yet authoritative

**Where it appears**:
- Spec: `Generated`, `Uploaded`, `Session-linked` roots and artifact context
- Plan: source roots include `All media`, `Generated`, `Uploaded`, `Session-linked`
- Tasks: `T006`, `T011`, `T029`

**Why this matters**:

The artifacts assume source roots and provenance labels that may not fall out cleanly from current normalized data. The plan does not yet define:
- how “generated” is detected reliably
- how “uploaded” is distinguished from generic existing attachments
- whether “session-linked” is a root, a filter, or fallback metadata when other provenance is unavailable
- what precedence applies when an artifact qualifies for multiple categories

That creates a real drift risk between source-root derivation, artifact cards, and preview context.

**Recommendation**:

Add explicit provenance heuristics to the design docs or contract, including:
- classification precedence
- fallback behavior
- whether roots are mutually exclusive or overlapping views

---

### [MEDIUM] Remote portability is required, but helper-level test coverage is only implied

**Where it appears**:
- Spec: `FR-016`, `SC-003`
- Plan: remote/self-hosted portability is first-class
- Quickstart: manual remote/self-hosted validation
- Tasks: no task explicitly names portable render-ref regression cases

**Why this matters**:

The feature is intentionally built on existing portable media seams, which is good. But the current task list relies mostly on generic helper tests plus manual validation, and it does not explicitly require targeted unit coverage for:
- portable `renderRef` shaping
- remote-only image preview candidates
- source adapter behavior when only portable refs exist and local paths do not

Given how easy media/path regressions have been in this repo, this requirement probably deserves named coverage.

**Recommendation**:

Add explicit test tasks covering:
- source adapters that emit portable render refs
- preview helpers for remote/self-hosted image artifacts
- classification/selection behavior when local-only assumptions are unavailable

## Requirement Coverage Snapshot

### Well covered

- FileManager-style interaction model
- source-first browsing model
- image-first preview scope
- read-heavy, non-destructive v1 boundaries
- integration with existing media/runtime seams
- manual and automated validation gates

### Partially covered / needs tightening

- broad media discovery across sessions and sources
- exact chat reference insertion representation
- provenance classification rules
- explicit portability-focused helper regression coverage

## Artifact Alignment

### Strong alignment

- The spec, plan, and tasks all consistently treat the feature as:
  - source-first
  - image-first
  - read-heavy
  - selection-focused
  - FileManager-like rather than DAM-like

### Alignment risks

- The plan correctly identifies the send-path mismatch, but the tasks still allow multiple possible implementations because the visible insertion contract remains underspecified.
- The plan wants broad media roots, but the tasks do not yet force a concrete data acquisition strategy for cross-session completeness.

## Completeness Audit

### Complete enough to proceed

- No unresolved `NEEDS CLARIFICATION` markers remain.
- The feature has spec, plan, tasks, research, data model, quickstart, and boundary contract docs.
- The tasks are grouped by user story and support incremental delivery.

### Still incomplete in practice

- The design does not yet state the exact source acquisition policy for non-selected sessions.
- The design does not yet define the exact draft/UI shape of a media reference insertion.

## Recommendations

### Before implementation

1. Clarify the media acquisition strategy for cross-session/source browsing.
2. Clarify the exact user-visible draft/reference insertion format.
3. Add explicit provenance classification rules to one design artifact.
4. Add at least one explicit portability-focused helper test task.

### If you choose to proceed without remediation

- Keep `US1` scoped narrowly at first, ideally to data already available from cached/current session + recent normalized sources.
- Avoid promising full-library completeness in the first implementation.
- Treat `US2` as blocked on one small UX decision about the inserted reference form.
