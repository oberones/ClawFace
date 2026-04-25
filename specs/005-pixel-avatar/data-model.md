# Data Model: Pixel-Art Session Avatar

## AvatarState

Normalized visual state rendered by the avatar.

Values:

- `idle`
- `thinking`
- `streaming`
- `tool-running`
- `success`
- `serious`
- `caution`
- `warning`
- `approval-needed`
- `disconnected`

Validation rules:

- `disconnected` covers disconnected, pairing-required, and unrecoverable gateway error states unless a more specific visual split is later introduced.
- `warning` covers explicit blocked, denied, guardrail, or failed/error final outcomes.
- `success`, `serious`, and `caution` are final-response presentation states only and must come from explicit local signals, not assistant text classification.

## AvatarFinalOutcome

Optional local final-response outcome input.

Values:

- `success`
- `serious`
- `caution`
- `blocked`
- `denied`
- `error`
- `none`

Validation rules:

- `blocked`, `denied`, and `error` map to `warning`.
- `none` cannot produce a mood state by itself.
- Free-form response text must not be parsed to create this value.

## AvatarSignalSnapshot

Pure helper input assembled from existing frontend state.

Fields:

- `connectionStatus`: existing `ConnectionStatus`
- `approvalNeeded`: boolean
- `activeToolCount`: number
- `thinking`: boolean
- `streaming`: boolean
- `finalOutcome`: `AvatarFinalOutcome`

Validation rules:

- `activeToolCount` must be treated as `0` when missing, negative, or not finite.
- `streaming` should mean response text is currently arriving or non-empty stream text is active.
- `thinking` should mean the assistant is preparing before response text is available.
- Snapshot must represent the active session only.

## AvatarProfile

Mapping from normalized state to sprite sheet row/frame metadata.

Fields:

- `imageUrl`: public sprite sheet URL
- `frameWidth`: CSS pixel width of each logical frame
- `frameHeight`: CSS pixel height of each logical frame
- `states`: map of `AvatarState` to row index, frame count, duration, and static frame index

Validation rules:

- MVP ships exactly one default profile.
- Each MVP state must have a static frame.
- Animation duration must avoid rapid flashing.

## AvatarMotionMode

Effective motion behavior.

Values:

- `animated`
- `static`

Derivation:

- `static` when `UiSettings.enableAnimations` is false.
- `static` when `prefers-reduced-motion: reduce` applies.
- `animated` only when both app settings and user agent motion preference allow motion.

## State Transition Rules

Priority order:

1. Disconnected, pairing-required, or gateway error
2. Approval needed
3. Explicit warning/blocked/denied/error final outcome
4. Active tool running
5. Thinking
6. Streaming/responding
7. Caution final outcome
8. Serious final outcome
9. Success final outcome
10. Idle

Session switch rule:

- A newly selected session immediately receives a fresh snapshot. Transient final states from the previous session must not continue into the new active session.
