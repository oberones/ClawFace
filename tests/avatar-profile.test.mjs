import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTsModuleLoader } from "./helpers/load-ts-module.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadAvatarProfileModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/avatar-profile.ts"));
}

function loadAvatarStateModule() {
  const loader = createTsModuleLoader();
  return loader.loadModule(path.join(repoRoot, "src/lib/avatar-state.ts"));
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("avatar profile registry defines three unique bundled profiles", () => {
  const { AVATAR_PROFILES, DEFAULT_AVATAR_PROFILE_ID } = loadAvatarProfileModule();

  assert.equal(AVATAR_PROFILES.length, 3);
  assert.equal(AVATAR_PROFILES[0].id, DEFAULT_AVATAR_PROFILE_ID);
  assert.equal(new Set(AVATAR_PROFILES.map((profile) => profile.id)).size, AVATAR_PROFILES.length);

  for (const profile of AVATAR_PROFILES) {
    assert.match(profile.spriteSrc, /^avatars\/clawface-[a-z-]+\.png$/);
    assert.equal(profile.frameSize, 24);
    assert.equal(profile.columns, 4);
    assert.equal(profile.rows, 10);
    assert.equal(typeof profile.name, "string");
    assert.ok(profile.name.length > 0);
  }
});

test("avatar profile ids normalize invalid values to the default", () => {
  const {
    AVATAR_PROFILES,
    DEFAULT_AVATAR_PROFILE_ID,
    normalizeAvatarProfileId,
  } = loadAvatarProfileModule();

  for (const profile of AVATAR_PROFILES) {
    assert.equal(normalizeAvatarProfileId(profile.id), profile.id);
  }
  assert.equal(normalizeAvatarProfileId(""), DEFAULT_AVATAR_PROFILE_ID);
  assert.equal(normalizeAvatarProfileId("missing-profile"), DEFAULT_AVATAR_PROFILE_ID);
  assert.equal(normalizeAvatarProfileId(null), DEFAULT_AVATAR_PROFILE_ID);
  assert.equal(normalizeAvatarProfileId(undefined), DEFAULT_AVATAR_PROFILE_ID);
});

test("getAvatarProfile returns selected valid profiles and default fallback", () => {
  const {
    AVATAR_PROFILES,
    DEFAULT_AVATAR_PROFILE_ID,
    getAvatarProfile,
  } = loadAvatarProfileModule();

  for (const profile of AVATAR_PROFILES) {
    assert.equal(getAvatarProfile(profile.id).id, profile.id);
  }
  assert.equal(getAvatarProfile("unknown").id, DEFAULT_AVATAR_PROFILE_ID);
});

test("all avatar profiles can represent every avatar state", () => {
  const {
    AVATAR_PROFILES,
    AVATAR_PROFILE_STATE_ORDER,
  } = loadAvatarProfileModule();
  const { AVATAR_STATE_LABELS } = loadAvatarStateModule();

  assert.deepEqual(
    [...AVATAR_PROFILE_STATE_ORDER].sort(),
    Object.keys(AVATAR_STATE_LABELS).sort(),
  );
  for (const profile of AVATAR_PROFILES) {
    assert.equal(profile.rows, AVATAR_PROFILE_STATE_ORDER.length);
    assert.ok(AVATAR_PROFILE_STATE_ORDER.includes(profile.thumbnailState));
  }
});

test("avatar profile assets exist with shared sprite-sheet dimensions", () => {
  const { AVATAR_PROFILES } = loadAvatarProfileModule();

  for (const profile of AVATAR_PROFILES) {
    const assetPath = path.join(repoRoot, "public", profile.spriteSrc);
    assert.ok(fs.existsSync(assetPath), `${profile.spriteSrc} should exist`);
    assert.deepEqual(readPngSize(assetPath), {
      width: profile.frameSize * profile.columns,
      height: profile.frameSize * profile.rows,
    });
  }
});
