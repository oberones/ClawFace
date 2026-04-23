import type { DreamCandidate } from "./dream-candidates.ts";
import type { DreamDiaryDocument, DreamDiaryEntry, DreamDiaryRelation } from "./dream-diary.ts";
import type { DreamRelatedContext } from "./dream-related-context.ts";
import type { DreamTimelineArtifactLink, DreamTimelineMomentGroup } from "./dream-timeline.ts";

function uniqueLinks(links: DreamTimelineArtifactLink[]): DreamTimelineArtifactLink[] {
  const seen = new Set<string>();
  const result: DreamTimelineArtifactLink[] = [];
  for (const link of links) {
    const key = `${link.kind}:${link.targetId ?? ""}:${link.label}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(link);
  }
  return result;
}

function candidateSafeMoment(
  moment: DreamTimelineMomentGroup,
  selectedCandidate: DreamCandidate | null,
): boolean {
  if (!selectedCandidate) {
    return false;
  }
  return moment.candidateRefs.some((ref) => ref.candidateKey === selectedCandidate.key);
}

function buildDiaryLinks(params: {
  moment: DreamTimelineMomentGroup;
  diary: DreamDiaryDocument;
  diaryRelation: DreamDiaryRelation | null;
  selectedDiaryEntry: DreamDiaryEntry | null;
  selectedCandidate: DreamCandidate | null;
}): DreamTimelineArtifactLink[] {
  const links: DreamTimelineArtifactLink[] = [];
  if (params.moment.kind === "diary-entry") {
    const targetId = params.moment.id.replace(/^diary-entry:/, "");
    links.push({
      kind: "diary-entry",
      targetId,
      label: "Open Dream Diary entry",
      detail: params.selectedDiaryEntry?.dateLabel ?? params.diary.path,
      relationship: "direct",
    });
    return links;
  }

  if (params.moment.kind === "diary-update") {
    links.push({
      kind: "diary-entry",
      targetId: params.selectedDiaryEntry?.id ?? params.diary.entries[0]?.id ?? null,
      label: "Open Dream Diary",
      detail: "Only file-level diary timing is visible from this snapshot.",
      relationship: "limited",
    });
    return links;
  }

  if (!candidateSafeMoment(params.moment, params.selectedCandidate) || !params.diaryRelation?.entryId) {
    return links;
  }

  links.push({
    kind: "diary-entry",
    targetId: params.diaryRelation.entryId,
    label: params.diaryRelation.status === "direct" ? "Open related Dream Diary entry" : "Open nearby Dream Diary context",
    detail:
      params.selectedDiaryEntry?.dateLabel ??
      params.diary.entries.find((entry) => entry.id === params.diaryRelation?.entryId)?.dateLabel ??
      params.diary.path,
    relationship: params.diaryRelation.status === "direct" ? "direct" : "limited",
  });
  return links;
}

function buildCandidateLinks(
  moment: DreamTimelineMomentGroup,
  selectedCandidate: DreamCandidate | null,
): DreamTimelineArtifactLink[] {
  if (moment.candidateRefs.length === 0) {
    return [];
  }
  if (selectedCandidate && candidateSafeMoment(moment, selectedCandidate)) {
    return [
      {
        kind: "dream-candidate",
        targetId: selectedCandidate.key,
        label: "Open selected candidate detail",
        detail: selectedCandidate.path,
        relationship: "direct",
      },
    ];
  }
  return moment.candidateRefs
    .filter((ref) => ref.candidateKey)
    .slice(0, 3)
    .map((ref) => ({
      kind: "dream-candidate" as const,
      targetId: ref.candidateKey,
      label: ref.label,
      detail: ref.path,
      relationship: ref.relationship === "direct" || ref.relationship === "grouped" ? "direct" : "inferred",
    }));
}

function buildRelatedContextLinks(
  moment: DreamTimelineMomentGroup,
  selectedCandidate: DreamCandidate | null,
  relatedContext: DreamRelatedContext,
): DreamTimelineArtifactLink[] {
  if (!candidateSafeMoment(moment, selectedCandidate) || relatedContext.status !== "ready") {
    return [];
  }
  const insightLinks = relatedContext.insights.slice(0, 2).map((item) => ({
    kind: "related-insight" as const,
    targetId: `insight:${item.pagePath}`,
    label: item.title,
    detail: item.pagePath,
    relationship: "nearby" as const,
  }));
  const palaceLinks = relatedContext.palacePages.slice(0, 2).map((item) => ({
    kind: "related-palace" as const,
    targetId: `palace:${item.pagePath}`,
    label: item.title,
    detail: item.pagePath,
    relationship: "nearby" as const,
  }));
  return [...insightLinks, ...palaceLinks];
}

export function attachDreamTimelineLinks(params: {
  momentGroups: DreamTimelineMomentGroup[];
  diary: DreamDiaryDocument;
  diaryRelation: DreamDiaryRelation | null;
  selectedDiaryEntry: DreamDiaryEntry | null;
  selectedCandidate: DreamCandidate | null;
  relatedContext: DreamRelatedContext;
}): DreamTimelineMomentGroup[] {
  return params.momentGroups.map((moment) => {
    const artifactLinks = uniqueLinks([
      ...buildDiaryLinks({
        moment,
        diary: params.diary,
        diaryRelation: params.diaryRelation,
        selectedDiaryEntry: params.selectedDiaryEntry,
        selectedCandidate: params.selectedCandidate,
      }),
      ...buildCandidateLinks(moment, params.selectedCandidate),
      ...buildRelatedContextLinks(moment, params.selectedCandidate, params.relatedContext),
    ]);
    return {
      ...moment,
      artifactLinks,
    };
  });
}
