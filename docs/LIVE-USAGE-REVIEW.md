# Live Usage Review

## Purpose

This document is the concrete review packet for ClawFace after the recent runtime/session visibility and tool-heavy thread UX work.

The goal is to validate the product from actual usage on the authoritative macOS development machine instead of continuing to guess at polish slices from static code review alone.

## Authoritative environment

Use the real active macOS development machine as the source of truth for this review.

Why:
- `make build` on macOS is the authoritative renderer validation path for this repo
- the Linux container remains subject to the known Rollup optional-package issue
- there is no reliable local browser on the container host for a faithful renderer review pass

Known container blocker observed during this review attempt:
- Vite dev server failed because `@rollup/rollup-linux-arm64-gnu` was missing on the container host

## Review goals

Validate whether the recent slices actually improved:
- current-session runtime legibility in the shell
- background-session activity legibility in the sidebar
- tool outcome clarity
- lifecycle error attachment to relevant tool activity
- thread scanability in tool-heavy conversations
- dense multi-tool burst readability

## Review method

Use real interaction flows, not just static screenshots.

For each scenario below:
1. perform the scenario in the app
2. note what felt clear vs unclear
3. capture a screenshot or short screen recording when something felt off
4. classify the issue as one of:
   - wording / semantics
   - hierarchy / emphasis
   - density / spacing
   - grouping / chronology
   - state mismatch / correctness
   - animation / transition noise

## Scenarios to test

### 1. Idle session baseline
Goal:
- verify the shell does not feel noisy when nothing is happening

Questions:
- is current-session status obvious but calm?
yes
- does the header feel informative without stealing attention?
yes
- do inactive tool-heavy threads still read cleanly?
yes

### 2. Session loading and switching
Goal:
- verify shell-level runtime visibility during navigation

Questions:
- is `Loading session` vs `Switching session` easy to distinguish?
yes
- does the shell make it obvious which session is active now?
yes
- do sidebar unread/working states remain believable while switching?
yes

### 3. Background session activity
Goal:
- verify sidebar usefulness without opening every session

Questions:
- are `Current`, `Working`, and `New activity` easy to understand at a glance?
yes
- does unread activity win over working when both are true in a way that feels correct?
yes
- does the sidebar feel too busy when multiple sessions are active?
no

### 4. Simple single-tool success
Goal:
- verify the common case feels light and readable

Questions:
- does the flattened single-tool presentation feel like a natural thread step?
yes
- is the tool-to-assistant handoff visually clear?
yes
- does the row give enough information without expansion?
yes

### 5. Single-tool failure
Goal:
- verify failures are visible and trustworthy

Questions:
- does the failed tool read as failed before expansion?
yes
- is the error copy understandable?
yes
- does the relationship between tool failure and any system error message feel redundant, complementary, or confusing?
yes

### 6. Multi-tool success burst
Goal:
- verify group hierarchy in a busy but successful step

Questions:
- does the multi-tool header summarize the group well enough?
yes
- do completed rows feel appropriately quieter?
yes
- is there still too much repeated summary text?
no

### 7. Multi-tool mixed outcome burst
Goal:
- verify failure/running work keeps priority inside dense groups

Questions:
- do failed/running rows stand out first?
yes
- is the group-level tone accurate and helpful?
yes
- do succeeded rows still provide enough context after compaction?
yes

### 8. Tool activity followed by streaming assistant reply
Goal:
- verify grouping between tool work and assistant continuation

Questions:
- does the assistant follow-up feel attached to the tool work above it?
yes
- does the grouping treatment help or feel decorative?
yes
- does streaming after tools still read cleanly while text is changing?
yes

### 9. Lifecycle/run error attached to tool work
Goal:
- verify run/lifecycle failure linkage actually improves clarity

Questions:
- when a run fails after or during tool activity, does the relevant tool card now tell the truth?
yes
- is the tool card enough on its own, or is the separate system error still doing most of the work?
yes
- does anything feel incorrectly attributed to the wrong tool?
no

## What to capture

For each issue found, record:
- scenario
- short description
- why it matters
- screenshot / clip reference
- severity:
  - low = polish annoyance
  - medium = slows understanding
  - high = likely to confuse or mislead
- suspected category:
  - wording
  - hierarchy
  - density
  - grouping
  - correctness

## Likely next-slice candidates to validate or reject

These are hypotheses, not commitments:
- collapsed summaries may still be too verbose in some dense bursts
- system error messages may still duplicate rather than complement failed tool cards
- multi-tool groups may still want one more pass on internal spacing hierarchy
- sidebar activity may become too visually busy when several sessions are active simultaneously

## Exit criteria

This live review is complete when:
- the major recent slices have been exercised in realistic flows
- issues are captured as concrete findings, not vague vibes
- the next ticket can be chosen from observed usage instead of abstract speculation
