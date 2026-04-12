import React from "react";
import type { ParsedPathPrefixMappings } from "../../lib/path-prefix-mappings.ts";

type PathPrefixMappingsSectionProps = {
  pathPrefixMappingsText: string;
  parsedPathPrefixMappings: ParsedPathPrefixMappings;
  dockerMappingsExample: string;
  onPathPrefixMappingsTextChange: (value: string) => void;
};

export function PathPrefixMappingsSection(props: PathPrefixMappingsSectionProps) {
  return (
    <section className="setting-card">
      <div className="setting-head">
        <h3 className="setting-title">Path Prefix Mappings</h3>
        <button
          type="button"
          onClick={() => props.onPathPrefixMappingsTextChange(props.dockerMappingsExample)}
          className="ui-btn ui-btn-light section-reset-btn"
        >
          Use Docker Example
        </button>
      </div>
      <div className="setting-fields">
        <label className="field-block">
          <span className="field-label">
            Map backend/container path prefixes to local filesystem prefixes.
          </span>
          <textarea
            value={props.pathPrefixMappingsText}
            onChange={(e) => props.onPathPrefixMappingsTextChange(e.target.value)}
            className="ui-input path-mapping-textarea"
            rows={6}
            spellCheck={false}
            placeholder={props.dockerMappingsExample}
          />
          <span className="field-hint">
            One mapping per line using <code>source =&gt; target</code>. Blank lines and{" "}
            <code>#</code> comments are ignored.
          </span>
          <span className="field-hint">
            Active mappings: {props.parsedPathPrefixMappings.mappings.length}
            {props.parsedPathPrefixMappings.invalidLines.length > 0
              ? ` · Invalid lines ignored: ${props.parsedPathPrefixMappings.invalidLines.length}`
              : ""}
          </span>
          <span className="field-hint">
            Example: <code>/home/node/.openclaw/media =&gt; ~/.openclaw/media</code>
          </span>
        </label>
      </div>
    </section>
  );
}
