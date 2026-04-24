# Research: Dream Diary Timeline

## Decision 1: Replace the dream dashboard with a diary-first pane

**Decision**: Implement the dream refactor as a replacement for the current Dream Inspector composition, not as another tab or secondary view inside it.

**Rationale**: User feedback is about the primary experience being boring and not useful. Keeping the old signal/candidate dashboard as the first stop would preserve the problem. The app is greenfield with no user migration requirement, so a clean replacement is cheaper and clearer than compatibility layering.

**Alternatives Considered**:

- Keep the current Dream Inspector and make diary the default expanded panel: rejected because the signal/candidate UI would still shape the experience.
- Add a separate Diary tab beside Timeline and Inspector: rejected because it keeps too much surface area for a feature users primarily use to read.
- Delete all dream code and rebuild from scratch: rejected because current diary gateway normalization and parsing helpers are useful and testable.

## Decision 2: Use `doctor.memory.dreamDiary` as the primary source

**Decision**: The Dream Diary Timeline should primarily request and normalize `doctor.memory.dreamDiary`; `doctor.memory.status` is optional support for disabled/unavailable copy.

**Rationale**: The feature is about reading diary entries. Pulling status data as the main source would reintroduce the old dashboard mental model. Status can still answer "is dreaming off?" when available, but it should not define the main view.

**Alternatives Considered**:

- Continue loading full dream status before diary: rejected because it couples diary reading to candidate/status availability and makes failures broader than needed.
- Use raw `DREAMS.md` filesystem reads: rejected by the constitution and current integration boundary.
- Add a new OpenClaw diary timeline method: rejected because ClawFace must ship against current surfaces.

## Decision 3: Add a small diary timeline helper instead of expanding components

**Decision**: Add `src/lib/dream-diary-timeline.ts` for diary-specific availability, grouping, ordering, and selection defaults.

**Rationale**: Components should render a reader and list, not infer parse status, latest entry, or limited chronology from raw document text. A small helper gives focused tests without extending the older candidate/timeline helpers.

**Alternatives Considered**:

- Put grouping logic in `DreamDiaryTimelinePane`: rejected because it would be harder to test and easier to regress.
- Reuse `dream-timeline.ts`: rejected because it is built around promotion/replay/candidate chronology and would keep the wrong product concept alive.
- Fold everything into `dream-diary.ts`: possible, but less clean if the parser remains source-level and the timeline helper owns view-model decisions.

## Decision 4: Treat undated content as limited readable content

**Decision**: If content cannot be split into dated entries, preserve it as a readable limited timeline entry or group rather than dropping it or inventing dates.

**Rationale**: Users mostly want to read. A single limited entry is more useful than an empty timeline, and it stays honest about the lack of reliable chronology.

**Alternatives Considered**:

- Use diary `updatedAtMs` as the entry date: rejected because that is file freshness, not entry chronology.
- Hide undated content: rejected because it would discard the user's primary value.
- Guess dates from nearby prose: rejected because it overclaims precision.

## Decision 5: Keep future related-memory support entry-scoped

**Decision**: Future Imported Insights and Memory Palace support should attach to diary entries, not candidates.

**Rationale**: The refactor changes the primary unit from memory candidates to diary entries. Future related context should follow the unit the user is reading. That keeps optional context helpful without rebuilding the previous candidate dashboard.

**Alternatives Considered**:

- Preserve candidate-related panels in MVP: rejected because they distract from reading and depend on a product concept users did not find helpful.
- Build a full related-memory side browser now: rejected because it is not necessary for the diary-first MVP.
- Leave no extension path: rejected because the user explicitly wants an eye toward future Imported Insights and Memory Palace support.

## Open Questions Resolved By Assumption

- The existing Dreams button remains the entry point.
- Snapshot-local entry ids are acceptable for MVP.
- Search, bookmarks, export, and annotations are future diary features, not part of this lean refactor.
