import { useEffect, useMemo, useState } from "react";
import type { DreamCandidate } from "../lib/dream-candidates.ts";
import type { DreamDiaryEntry, DreamDiaryRelation } from "../lib/dream-diary.ts";
import type { DreamRelatedContext } from "../lib/dream-related-context.ts";
import {
  attachDreamTimelineLinks,
} from "../lib/dream-timeline-links.ts";
import {
  buildDreamTimelineSnapshot,
  filterTimelineMomentsForCandidate,
  getTimelineCandidateTrack,
  getTimelineMomentById,
  type DreamTimelineCandidateTrack,
  type DreamTimelineMomentGroup,
  type DreamTimelineSnapshot,
} from "../lib/dream-timeline.ts";
import type { DreamInspectorSnapshot } from "./useDreamInspectorController.ts";

export type DreamTimelineControllerModel = {
  snapshot: DreamTimelineSnapshot;
  selectedMoment: DreamTimelineMomentGroup | null;
  candidateTrack: DreamTimelineCandidateTrack | null;
  candidateMoments: DreamTimelineMomentGroup[];
  candidateTrackNote: string | null;
  onSelectMoment: (momentId: string) => void;
};

type UseDreamTimelineControllerParams = {
  snapshot: DreamInspectorSnapshot;
  selectedCandidate: DreamCandidate | null;
  selectedDiaryEntry: DreamDiaryEntry | null;
  diaryRelation: DreamDiaryRelation | null;
  relatedContext: DreamRelatedContext;
};

export function useDreamTimelineController(
  params: UseDreamTimelineControllerParams,
): DreamTimelineControllerModel {
  const derivedSnapshot = useMemo(() => buildDreamTimelineSnapshot(params.snapshot), [params.snapshot]);

  const snapshotWithLinks = useMemo(() => ({
    ...derivedSnapshot,
    momentGroups: attachDreamTimelineLinks({
      momentGroups: derivedSnapshot.momentGroups,
      diary: params.snapshot.diary,
      diaryRelation: params.diaryRelation,
      selectedDiaryEntry: params.selectedDiaryEntry,
      selectedCandidate: params.selectedCandidate,
      relatedContext: params.relatedContext,
    }),
  }), [
    derivedSnapshot,
    params.diaryRelation,
    params.relatedContext,
    params.selectedCandidate,
    params.selectedDiaryEntry,
    params.snapshot.diary,
  ]);

  const candidateTrack = useMemo(
    () => getTimelineCandidateTrack(snapshotWithLinks, params.selectedCandidate?.key),
    [params.selectedCandidate?.key, snapshotWithLinks],
  );
  const candidateMoments = useMemo(
    () => filterTimelineMomentsForCandidate(snapshotWithLinks, params.selectedCandidate?.key),
    [params.selectedCandidate?.key, snapshotWithLinks],
  );

  const [selectedMomentId, setSelectedMomentId] = useState<string | null>(null);

  useEffect(() => {
    const availableMomentIds = new Set(snapshotWithLinks.momentGroups.map((moment) => moment.id));
    const preferredMomentId =
      candidateMoments[0]?.id ??
      snapshotWithLinks.momentGroups[0]?.id ??
      null;
    const currentFitsCandidate =
      candidateMoments.length === 0 || candidateMoments.some((moment) => moment.id === selectedMomentId);
    if (selectedMomentId && availableMomentIds.has(selectedMomentId) && currentFitsCandidate) {
      return;
    }
    if (preferredMomentId !== selectedMomentId) {
      setSelectedMomentId(preferredMomentId);
    }
  }, [candidateMoments, selectedMomentId, snapshotWithLinks.momentGroups]);

  const selectedMoment = useMemo(
    () => getTimelineMomentById(snapshotWithLinks, selectedMomentId) ?? candidateMoments[0] ?? snapshotWithLinks.momentGroups[0] ?? null,
    [candidateMoments, selectedMomentId, snapshotWithLinks],
  );

  const candidateTrackNote = useMemo(() => {
    if (!params.selectedCandidate) {
      return "Select a memory candidate to compare the workspace chronology with one visible memory track.";
    }
    if (candidateTrack) {
      return candidateTrack.limitationNote;
    }
    return "This candidate is visible in Dream Inspector, but current surfaces do not expose enough timestamped evidence to build its own track yet.";
  }, [candidateTrack, params.selectedCandidate]);

  return {
    snapshot: snapshotWithLinks,
    selectedMoment,
    candidateTrack,
    candidateMoments,
    candidateTrackNote,
    onSelectMoment: setSelectedMomentId,
  };
}
