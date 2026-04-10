import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadPathPrefixMappingsModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/path-prefix-mappings.ts"));
}

test("parsePathPrefixMappingsText ignores comments, invalid lines, and duplicates", () => {
  const { parsePathPrefixMappingsText } = loadPathPrefixMappingsModule();
  const parsed = parsePathPrefixMappingsText(`
# Docker example
/home/node/.openclaw/media => ~/.openclaw/media
invalid line
/home/node/.openclaw/media => ~/.openclaw/media
/home/node/.openclaw/workspace -> ~/.openclaw/workspace/
  `);

  assert.deepEqual(parsed.invalidLines, ["invalid line"]);
  assert.deepEqual(parsed.mappings, [
    {
      sourcePrefix: "/home/node/.openclaw/workspace",
      targetPrefix: "~/.openclaw/workspace",
    },
    {
      sourcePrefix: "/home/node/.openclaw/media",
      targetPrefix: "~/.openclaw/media",
    },
  ]);
});

test("applyPathPrefixMappings expands home prefixes and prefers the most specific source prefix", () => {
  const { applyPathPrefixMappings, parsePathPrefixMappingsText } = loadPathPrefixMappingsModule();
  const { mappings } = parsePathPrefixMappingsText(`
/home/node/.openclaw => ~/.openclaw
/home/node/.openclaw/media => ~/.openclaw/media
  `);

  assert.equal(
    applyPathPrefixMappings("/home/node/.openclaw/media/monkey.png", {
      homeDir: "/Users/oberon",
      mappings,
    }),
    "/Users/oberon/.openclaw/media/monkey.png",
  );
  assert.equal(
    applyPathPrefixMappings("/home/node/.openclaw/workspace/project/file.txt", {
      homeDir: "/Users/oberon",
      mappings,
    }),
    "/Users/oberon/.openclaw/workspace/project/file.txt",
  );
});
