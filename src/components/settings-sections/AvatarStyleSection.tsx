import type { CSSProperties } from "react";
import type { UiSettings } from "../../lib/ui-settings.ts";
import {
  AVATAR_PROFILES,
  resolveAvatarSpriteSrc,
  type AvatarProfile,
} from "../../lib/avatar-profile.ts";

type AvatarStyleSectionProps = {
  selectedProfileId: UiSettings["avatarProfileId"];
  onSelectProfile: (profileId: UiSettings["avatarProfileId"]) => void;
};

type AvatarPreviewStyle = CSSProperties & {
  "--avatar-image": string;
  "--avatar-frames": number;
};

function resolvePreviewStyle(profile: AvatarProfile): AvatarPreviewStyle {
  const spriteUrl = resolveAvatarSpriteSrc(profile, window.location.href);
  return {
    "--avatar-image": `url("${spriteUrl}")`,
    "--avatar-frames": profile.columns,
  };
}

export function AvatarStyleSection(props: AvatarStyleSectionProps) {
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">Avatar Style</h3>
      </div>
      <div className="avatar-style-options" role="radiogroup" aria-label="Avatar style">
        {AVATAR_PROFILES.map((profile) => {
          const selected = profile.id === props.selectedProfileId;
          return (
            <button
              key={profile.id}
              type="button"
              className={`avatar-style-option${selected ? " is-selected" : ""}`}
              onClick={() => props.onSelectProfile(profile.id)}
              role="radio"
              aria-checked={selected}
              aria-label={`${profile.name} avatar style`}
            >
              <span
                className="animated-avatar avatar-style-preview"
                data-avatar-state={profile.thumbnailState}
                data-avatar-animated="false"
                style={resolvePreviewStyle(profile)}
                aria-hidden="true"
              >
                <span className="animated-avatar-sprite" aria-hidden="true" />
              </span>
              <span className="avatar-style-copy">
                <span className="avatar-style-name">{profile.name}</span>
                <span className="avatar-style-description">{profile.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
