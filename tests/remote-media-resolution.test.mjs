import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadRemoteMediaResolutionModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/remote-media-resolution.ts"));
}

test("pickRemoteMediaReadMethods prioritizes artifact/media read methods and keeps defaults as fallback", () => {
  const { pickRemoteMediaReadMethods } = loadRemoteMediaResolutionModule();

  const result = pickRemoteMediaReadMethods(
    new Set(["chat.send", "workspace.file.read", "artifact.read", "media.read"]),
  );

  assert.deepEqual(result.slice(0, 3), ["workspace.file.read", "artifact.read", "media.read"]);
  assert.equal(result.includes("artifacts.read"), false);
  assert.equal(result.includes("files.read"), false);
});

test("pickRemoteMediaReadMethods does not invent RPC methods when the gateway advertises unrelated methods", () => {
  const { pickRemoteMediaReadMethods } = loadRemoteMediaResolutionModule();

  assert.deepEqual(pickRemoteMediaReadMethods(new Set(["chat.send", "sessions.list"])), []);
});

test("buildRemoteMediaReadParamVariants covers path-like and artifact-like request shapes", () => {
  const { buildRemoteMediaReadParamVariants } = loadRemoteMediaResolutionModule();

  const result = buildRemoteMediaReadParamVariants("artifact://generated/123");
  const asKeys = result.map((entry) => Object.keys(entry).sort().join(","));

  assert.ok(result.some((entry) => entry.source === "artifact://generated/123"));
  assert.ok(result.some((entry) => entry.artifact === "artifact://generated/123"));
  assert.ok(result.some((entry) => entry.artifactPath === "artifact://generated/123"));
  assert.ok(result.some((entry) => entry.artifact === "artifact://generated/123" && entry.encoding === "base64"));
  assert.equal(result.some((entry) => entry.path === "artifact://generated/123"), false);
  assert.equal(new Set(asKeys.map((key, index) => `${key}:${JSON.stringify(result[index])}`)).size, result.length);
});

test("buildRemoteMediaReferenceCandidates preserves remote artifact refs and skips already renderable sources", () => {
  const { buildRemoteMediaReferenceCandidates } = loadRemoteMediaResolutionModule();

  const result = buildRemoteMediaReferenceCandidates({
    sourcePath: "artifact://images/generated-123",
    sourceCandidates: [
      "artifact://images/generated-123",
      "https://example.test/image.png",
      "data:image/png;base64,AAAA",
      "MEDIA:/tmp/generated.png",
    ],
    localFilePath: "/tmp/generated.png",
  });

  assert.deepEqual(result, ["artifact://images/generated-123", "/tmp/generated.png"]);
});

test("extractRenderableImageSourceFromUnknown unwraps nested urls and base64 payloads", () => {
  const { extractRenderableImageSourceFromUnknown } = loadRemoteMediaResolutionModule();
  const base64Payload = Buffer.from("fake-image-payload".repeat(4)).toString("base64");

  assert.equal(
    extractRenderableImageSourceFromUnknown(
      { ok: true, result: { mediaUrl: "https://example.test/generated.png" } },
      "/tmp/generated.png",
    ),
    "https://example.test/generated.png",
  );

  assert.equal(
    extractRenderableImageSourceFromUnknown(
      { payload: { image_base64: base64Payload } },
      "/tmp/generated.png",
    ),
    `data:image/png;base64,${base64Payload}`,
  );
});

test("toGatewayHttpBaseCandidates prefers the most specific HTTP base before falling back to origin", () => {
  const { toGatewayHttpBaseCandidates } = loadRemoteMediaResolutionModule();

  assert.deepEqual(toGatewayHttpBaseCandidates("wss://gateway.example.com/control/ws"), [
    "https://gateway.example.com/control/ws",
    "https://gateway.example.com/control",
    "https://gateway.example.com",
  ]);
});

test("buildGatewayRemoteMediaUrlCandidates emits media and compatibility endpoints without duplicates", () => {
  const { buildGatewayRemoteMediaUrlCandidates } = loadRemoteMediaResolutionModule();

  const result = buildGatewayRemoteMediaUrlCandidates(
    "wss://gateway.example.com/control/ws",
    "artifact://images/generated-123",
  );

  assert.ok(
    result.includes(
      "https://gateway.example.com/control/ws/__claw/media/read?artifact=artifact%3A%2F%2Fimages%2Fgenerated-123",
    ),
  );
  assert.ok(
    result.includes(
      "https://gateway.example.com/control/ws/__claw/artifacts/read?artifact=artifact%3A%2F%2Fimages%2Fgenerated-123",
    ),
  );
  assert.equal(new Set(result).size, result.length);
  assert.ok(result.length <= 18);
});

test("buildGatewayRemoteMediaUrlCandidates prioritizes compatibility path probes for path-like references", () => {
  const { buildGatewayRemoteMediaUrlCandidates } = loadRemoteMediaResolutionModule();

  const result = buildGatewayRemoteMediaUrlCandidates(
    "wss://gateway.example.com/control/ws",
    "/tmp/generated-image.png",
  );

  assert.deepEqual(result.slice(0, 3), [
    "https://gateway.example.com/control/ws/__claw/local-image?path=%2Ftmp%2Fgenerated-image.png",
    "https://gateway.example.com/control/ws/__claw/media/read?path=%2Ftmp%2Fgenerated-image.png",
    "https://gateway.example.com/control/ws/__claw/media/read?filePath=%2Ftmp%2Fgenerated-image.png",
  ]);
  assert.ok(result.length <= 18);
});
