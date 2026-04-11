import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadMediaPathUtilsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/media-path-utils.ts"));
}

test("normalizeMediaPathCandidate prefers the most specific generated image path in mixed text", () => {
  const { normalizeMediaPathCandidate } = loadMediaPathUtilsModule();

  assert.equal(
    normalizeMediaPathCandidate(
      "Saved monkey-gangster.png to /Users/oberon/.openclaw/media/monkey-gangster---9a215da3-f375-43df-881c-7b746f28737d.png",
    ),
    "/Users/oberon/.openclaw/media/monkey-gangster---9a215da3-f375-43df-881c-7b746f28737d.png",
  );
});

test("preferSpecificImagePathCandidates drops bare filenames when a concrete media path is available", () => {
  const { preferSpecificImagePathCandidates } = loadMediaPathUtilsModule();

  assert.deepEqual(
    preferSpecificImagePathCandidates(
      [
        "monkey-gangster.png",
        "/Users/oberon/.openclaw/media/monkey-gangster---9a215da3-f375-43df-881c-7b746f28737d.png",
      ],
      (value) => value.toLowerCase().endsWith(".png"),
    ),
    ["/Users/oberon/.openclaw/media/monkey-gangster---9a215da3-f375-43df-881c-7b746f28737d.png"],
  );
});
