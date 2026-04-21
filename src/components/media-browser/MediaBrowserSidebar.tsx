import React from "react";
import { BrowserBreadcrumbs } from "../browser-shell/BrowserBreadcrumbs.tsx";
import { BrowserRootTabs } from "../browser-shell/BrowserRootTabs.tsx";
import { MediaBrowserEntryCard } from "./MediaBrowserEntryCard.tsx";
import type {
  MediaArtifact,
  MediaBrowserFilterState,
  MediaBrowserSortKey,
  MediaSourceRoot,
} from "../../lib/media-browser-items.ts";

export type MediaBrowserSidebarProps = {
  roots: MediaSourceRoot[];
  activeRootKey: string;
  activeRoot: MediaSourceRoot | null;
  visibleArtifacts: MediaArtifact[];
  selectedArtifactId: string | null;
  filterState: MediaBrowserFilterState;
  enableAnimations?: boolean;
  onSelectRoot: (rootKey: string) => void;
  onSelectArtifact: (artifactId: string) => void;
  onSetQuery: (query: string) => void;
  onSetSort: (sortKey: MediaBrowserSortKey) => void;
  onClearFilters: () => void;
};

export function MediaBrowserSidebar(props: MediaBrowserSidebarProps) {
  const sortIndicator = (sortKey: MediaBrowserSortKey) => {
    if (props.filterState.sortKey !== sortKey) {
      return "";
    }
    return props.filterState.sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <aside className="sidebar-shell mb-sidebar">
      <div className="sidebar-top">
        <div className="sidebar-title-wrap">
          <div className="sidebar-title">Media</div>
          <div className="sidebar-subtitle">{props.visibleArtifacts.length} visible</div>
        </div>
      </div>

      <BrowserRootTabs
        tabs={props.roots.map((root) => ({
          key: root.key,
          label: root.count != null ? `${root.label} (${root.count})` : root.label,
        }))}
        activeKey={props.activeRootKey}
        className="fm-sidebar-roots"
        tabClassName="fm-root-pill"
        activeTabClassName="active"
        onSelect={props.onSelectRoot}
      />

      <div className="fm-sidebar-nav">
        <BrowserBreadcrumbs
          items={[
            { key: "all", label: "Media", active: props.activeRootKey === "all" },
            ...(props.activeRootKey !== "all" && props.activeRoot
              ? [{ key: props.activeRoot.key, label: props.activeRoot.label, active: true }]
              : []),
          ]}
          className="fm-sidebar-breadcrumb"
          itemClassName="fm-bc-item"
          activeItemClassName="active"
          separatorClassName="fm-bc-sep"
          onSelect={props.onSelectRoot}
        />

        <div className="mb-search-wrap">
          <input
            type="search"
            className="ui-input mb-search-input"
            value={props.filterState.query ?? ""}
            onChange={(event) => props.onSetQuery(event.target.value)}
            placeholder="Search media..."
            aria-label="Search media"
          />
        </div>

        <div className="fm-sidebar-toolbar">
          <button
            type="button"
            className="fm-sidebar-tool"
            onClick={() => props.onSetSort("createdAt")}
            title="Sort by date"
          >
            Newest{sortIndicator("createdAt")}
          </button>
          <button
            type="button"
            className="fm-sidebar-tool"
            onClick={() => props.onSetSort("name")}
            title="Sort by name"
          >
            Name{sortIndicator("name")}
          </button>
          <button
            type="button"
            className="fm-sidebar-tool"
            onClick={props.onClearFilters}
            disabled={!props.filterState.query && !props.filterState.sessionKey && !props.filterState.provenance}
            title="Clear filters"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="sidebar-list">
        {props.visibleArtifacts.length === 0 ? (
          <div className="sidebar-empty">
            No media is visible for this root yet. Load session history to bring more artifacts into the browser.
          </div>
        ) : (
          props.visibleArtifacts.map((artifact) => (
            <MediaBrowserEntryCard
              key={artifact.id}
              artifact={artifact}
              selected={artifact.id === props.selectedArtifactId}
              enableAnimations={props.enableAnimations}
              onSelect={props.onSelectArtifact}
            />
          ))
        )}
      </div>
    </aside>
  );
}
