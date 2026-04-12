# OpenClaw Remote Media PR Handoff

This document is a handoff for the OpenClaw-side backend work needed to complete ClawFace ticket `2.3.1`.

ClawFace is already prepared to consume a gateway-side remote media read contract. The remaining gap is that OpenClaw does not yet expose a first-class gateway method for reading generated media/artifacts in remote deployments.

## Recommended PR Title

```text
feat(gateway): add media.read for remote media rendering
```

## Short PR Description

```text
Adds a first-class gateway `media.read` method so remote clients like ClawFace can resolve generated images without shared host volumes.

This keeps media loading inside OpenClaw’s existing managed media/workspace roots and reuses the current safe media loader instead of introducing a new file-read path.

The first cut is intentionally narrow:
- read-scoped operator method
- local/media-root reads only
- image-friendly base64 payload response
- no arbitrary remote URL proxying in this initial contract

This unblocks remote ClawFace image rendering for generated media while preserving OpenClaw’s existing local media safety constraints.
```

## Problem Statement

Today ClawFace can render generated images when:

- OpenClaw runs on the same host
- or a container shares the media directory with the host

It still has a portability gap when OpenClaw is running remotely and the desktop app cannot access the backend filesystem directly.

ClawFace already has a remote resolution path that probes gateway methods such as:

- `media.read`
- `artifact.read`
- `artifacts.read`
- `files.read`

But OpenClaw does not currently expose any of those read methods. That means the frontend side is ready, but the backend contract is still missing.

## Goal

Add a safe, first-class OpenClaw gateway method that lets remote clients request media bytes for generated images and similar managed outputs.

## Non-Goals For This First PR

- No generic arbitrary filesystem read API
- No arbitrary `http(s)` fetch proxying
- No full artifact registry redesign
- No new public HTTP endpoint unless it is needed later as a follow-up

This should be the smallest backend contract that makes remote image rendering work.

## Recommended Contract

### Method Name

```text
media.read
```

### Scope

`operator.read`

### Accepted Params

Support a few shape variants so existing ClawFace probing works without extra coordination:

```ts
type MediaReadParams = {
  path?: string;
  filePath?: string;
  mediaPath?: string;
  source?: string;
  uri?: string;
  agentId?: string;
};
```

Normalization rules:

- accept the first non-empty string among `path`, `filePath`, `mediaPath`, `source`, `uri`
- accept `MEDIA:/path/to/file.png` style values
- accept `file://...` values if the existing loader already handles them
- accept relative paths only when they can be resolved against the target agent workspace

### Response Shape

Prefer a simple payload that ClawFace already understands:

```ts
type MediaReadResult = {
  ok: true;
  data: string; // base64
  mimeType?: string;
  fileName?: string;
};
```

This works with the current ClawFace extractor because it already understands `data` plus `mimeType`.

If desired, returning `dataUrl` in addition to `data` is also fine, but not required.

### Error Behavior

Use existing gateway error shapes:

- `INVALID_REQUEST` for missing/invalid params
- `INVALID_REQUEST` for disallowed paths or unsupported references
- `UNAVAILABLE` for unexpected loader/read failures

## Security / Safety Model

The method should stay intentionally narrow.

Allowed:

- OpenClaw-managed media roots
- OpenClaw-managed workspace roots
- agent-scoped workspace-relative media references

Not allowed in the first cut:

- arbitrary `http://` or `https://` passthrough
- arbitrary host filesystem access outside managed roots
- turning this into a generic file-exfiltration API

The easiest safe implementation is to reuse:

- `src/media/web-media.ts`
- `src/media/local-roots.ts`

Specifically:

- `loadWebMediaRaw(...)`
- `getAgentScopedMediaLocalRoots(...)`

## Suggested Implementation Plan

### 1. Add the handler

Create:

```text
src/gateway/server-methods/media.ts
```

Suggested shape:

- validate and normalize the incoming reference
- load config with `loadConfig()`
- resolve the effective agent id
- compute allowed roots with `getAgentScopedMediaLocalRoots(cfg, agentId)`
- resolve workspace dir with `resolveAgentWorkspaceDir(cfg, agentId)`
- call `loadWebMediaRaw(reference, { localRoots, workspaceDir })`
- return `{ data: buffer.toString("base64"), mimeType, fileName }`

Important note:

- `loadWebMediaRaw` currently accepts `http(s)` URLs as well as local paths
- for this first gateway method, explicitly reject `http(s)` references before passing into the loader
- that keeps the contract local-only and avoids accidentally introducing a remote fetch proxy

### 2. Register the method

Update:

```text
src/gateway/server-methods.ts
src/gateway/server-methods-list.ts
```

Add:

- `mediaHandlers`
- `"media.read"`

### 3. Classify the method

Update:

```text
src/gateway/method-scopes.ts
```

Add `media.read` to the `READ_SCOPE` group.

This will also keep the method classification tests honest.

### 4. Add tests

Add something like:

```text
src/gateway/server-methods/media.test.ts
```

Recommended test cases:

1. reads an image from an allowed managed media root
2. returns base64 plus mime type
3. resolves a relative path against the agent workspace when `agentId` is provided
4. rejects missing params
5. rejects disallowed paths outside allowed roots
6. rejects `http(s)` references in this first cut

Also update:

```text
src/gateway/method-scopes.test.ts
```

to assert:

- `media.read` is listed
- `media.read` is classified
- `media.read` is authorized with `operator.read`

## Suggested Implementation Sketch

This is intentionally high-level rather than copy-paste code:

```ts
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import { loadWebMediaRaw } from "../../media/web-media.js";
import { getAgentScopedMediaLocalRoots } from "../../media/local-roots.js";
import type { GatewayRequestHandlers } from "./types.js";

function normalizeMediaReadReference(params: Record<string, unknown>): string | null {
  const candidates = [
    params.path,
    params.filePath,
    params.mediaPath,
    params.source,
    params.uri,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export const mediaHandlers: GatewayRequestHandlers = {
  "media.read": async ({ params, respond }) => {
    const reference = normalizeMediaReadReference(params);
    if (!reference) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "media.read requires a media path"));
      return;
    }
    if (/^https?:\/\//i.test(reference)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "media.read only supports local media references"));
      return;
    }

    try {
      const cfg = loadConfig();
      const requestedAgentId = typeof params.agentId === "string" && params.agentId.trim() ? params.agentId.trim() : resolveDefaultAgentId(cfg);
      const localRoots = getAgentScopedMediaLocalRoots(cfg, requestedAgentId);
      const workspaceDir = resolveAgentWorkspaceDir(cfg, requestedAgentId);
      const media = await loadWebMediaRaw(reference, {
        localRoots,
        workspaceDir,
      });
      respond(true, {
        data: media.buffer.toString("base64"),
        mimeType: media.contentType,
        fileName: media.fileName,
      });
    } catch (error) {
      // map allowlist/validation failures to INVALID_REQUEST
      // map unexpected loader failures to UNAVAILABLE
    }
  },
};
```

## Files Expected To Change In OpenClaw

- `src/gateway/server-methods/media.ts`
- `src/gateway/server-methods.ts`
- `src/gateway/server-methods-list.ts`
- `src/gateway/method-scopes.ts`
- `src/gateway/server-methods/media.test.ts`
- `src/gateway/method-scopes.test.ts`

## Validation Checklist

Minimum:

- targeted Vitest for the new handler
- method classification tests

Recommended before opening or updating the PR:

- `pnpm check`
- `pnpm test`
- `pnpm build`

Because this adds a new exposed gateway surface, it should be treated as a real contract change rather than a private implementation detail.

## Follow-Up Work After This PR

Once `media.read` exists in OpenClaw:

1. validate ClawFace against a truly remote OpenClaw instance with no shared volume
2. confirm generated images resolve over gateway RPC without reload hacks
3. optionally add an HTTP endpoint later if a browser-only client needs it
4. optionally add `artifact.read` later if OpenClaw moves toward first-class artifact ids instead of raw paths

## Why This Is The Right First Cut

This is the smallest backend change that:

- unblocks the community remote-install story
- stays inside OpenClaw’s existing media safety boundaries
- matches ClawFace’s already-landed remote media resolver
- avoids overcommitting to a broader artifact API too early

That makes it a good standalone OpenClaw PR and a clean second half of ClawFace ticket `2.3.1`.
