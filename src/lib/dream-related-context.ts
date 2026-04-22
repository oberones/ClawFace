import type { DreamCandidate } from "./dream-candidates.ts";
import type {
  DreamMethodAvailability,
  DreamWikiImportInsights,
  DreamWikiInsightItem,
  DreamWikiMemoryPalace,
  DreamWikiPalaceItem,
} from "./shell-gateway-memory.ts";

const RELATED_STOP_WORDS = new Set([
  "about",
  "after",
  "already",
  "around",
  "being",
  "from",
  "into",
  "only",
  "other",
  "their",
  "these",
  "through",
  "while",
  "with",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s/._-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !RELATED_STOP_WORDS.has(token));
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function candidateTokens(candidate: DreamCandidate): string[] {
  const pathBits = candidate.path.replace(/\\/g, "/").split("/").pop() ?? candidate.path;
  return unique(tokenize(`${candidate.snippet} ${pathBits.replace(/\.[a-z0-9]+$/i, "")}`));
}

function scoreMatches(candidateTerms: string[], sourceText: string): { score: number; matches: string[] } {
  const sourceTerms = new Set(tokenize(sourceText));
  const matches = candidateTerms.filter((term) => sourceTerms.has(term));
  return {
    score: matches.length,
    matches,
  };
}

export type DreamRelatedContextStatus = "idle" | "loading" | "ready" | "unsupported" | "error" | "limited";

export type DreamRelatedInsightMatch = {
  kind: "insight";
  pagePath: string;
  title: string;
  summary: string;
  topicLabel: string;
  riskLevel: DreamWikiInsightItem["riskLevel"];
  matchedTerms: string[];
  candidateSignals: string[];
};

export type DreamRelatedPalaceMatch = {
  kind: "palace";
  pagePath: string;
  title: string;
  pageKind: DreamWikiPalaceItem["kind"];
  snippet: string | null;
  matchedTerms: string[];
  claimCount: number;
  questionCount: number;
  contradictionCount: number;
};

export type DreamRelatedContext = {
  status: DreamRelatedContextStatus;
  insights: DreamRelatedInsightMatch[];
  palacePages: DreamRelatedPalaceMatch[];
  limitationNote: string | null;
  error: string | null;
};

type MatchDreamRelatedContextParams = {
  candidate: DreamCandidate | null;
  importInsights: DreamWikiImportInsights | null;
  palace: DreamWikiMemoryPalace | null;
  importInsightsAvailability: DreamMethodAvailability;
  palaceAvailability: DreamMethodAvailability;
  importInsightsError?: string | null;
  palaceError?: string | null;
  loading?: boolean;
};

function flattenInsightMatches(candidateTerms: string[], payload: DreamWikiImportInsights | null): DreamRelatedInsightMatch[] {
  if (!payload) {
    return [];
  }
  return payload.clusters
    .flatMap((cluster) => cluster.items)
    .map((item) => {
      const relevance = scoreMatches(
        candidateTerms,
        `${item.title} ${item.summary} ${item.topicLabel} ${item.candidateSignals.join(" ")} ${item.preferenceSignals.join(" ")}`,
      );
      return {
        relevance,
        match: {
          kind: "insight" as const,
          pagePath: item.pagePath,
          title: item.title,
          summary: item.summary,
          topicLabel: item.topicLabel,
          riskLevel: item.riskLevel,
          matchedTerms: relevance.matches.slice(0, 4),
          candidateSignals: item.candidateSignals.slice(0, 3),
        },
      };
    })
    .filter((item) => item.relevance.score > 0)
    .sort((left, right) => {
      if (right.relevance.score !== left.relevance.score) {
        return right.relevance.score - left.relevance.score;
      }
      return left.match.title.localeCompare(right.match.title);
    })
    .slice(0, 4)
    .map((item) => item.match);
}

function flattenPalaceMatches(candidateTerms: string[], payload: DreamWikiMemoryPalace | null): DreamRelatedPalaceMatch[] {
  if (!payload) {
    return [];
  }
  return payload.clusters
    .flatMap((cluster) => cluster.items)
    .map((item) => {
      const relevance = scoreMatches(
        candidateTerms,
        `${item.title} ${item.snippet ?? ""} ${item.claims.join(" ")} ${item.questions.join(" ")} ${item.contradictions.join(" ")}`,
      );
      return {
        relevance,
        match: {
          kind: "palace" as const,
          pagePath: item.pagePath,
          title: item.title,
          pageKind: item.kind,
          snippet: item.snippet,
          matchedTerms: relevance.matches.slice(0, 4),
          claimCount: item.claimCount,
          questionCount: item.questionCount,
          contradictionCount: item.contradictionCount,
        },
      };
    })
    .filter((item) => item.relevance.score > 0)
    .sort((left, right) => {
      if (right.relevance.score !== left.relevance.score) {
        return right.relevance.score - left.relevance.score;
      }
      return left.match.title.localeCompare(right.match.title);
    })
    .slice(0, 4)
    .map((item) => item.match);
}

export function matchDreamRelatedContext(params: MatchDreamRelatedContextParams): DreamRelatedContext {
  if (!params.candidate) {
    return {
      status: "idle",
      insights: [],
      palacePages: [],
      limitationNote: null,
      error: null,
    };
  }

  if (params.loading) {
    return {
      status: "loading",
      insights: [],
      palacePages: [],
      limitationNote: null,
      error: null,
    };
  }

  const supportsInsights = params.importInsightsAvailability === "supported";
  const supportsPalace = params.palaceAvailability === "supported";
  if (!supportsInsights && !supportsPalace) {
    return {
      status: "unsupported",
      insights: [],
      palacePages: [],
      limitationNote: "Imported Insights and Memory Palace are not available on this gateway.",
      error: null,
    };
  }

  const candidateTerms = candidateTokens(params.candidate);
  const insights = flattenInsightMatches(candidateTerms, params.importInsights);
  const palacePages = flattenPalaceMatches(candidateTerms, params.palace);
  const error = [params.importInsightsError, params.palaceError].filter(Boolean).join(" · ") || null;

  if (insights.length > 0 || palacePages.length > 0) {
    return {
      status: "ready",
      insights,
      palacePages,
      limitationNote: null,
      error,
    };
  }

  if (error) {
    return {
      status: "error",
      insights: [],
      palacePages: [],
      limitationNote: "Related context could not be loaded completely, so only the primary Dream Inspector remains available.",
      error,
    };
  }

  return {
    status: "limited",
    insights: [],
    palacePages: [],
    limitationNote: "No strong Imported Insight or Memory Palace match is visible from the current gateway data.",
    error: null,
  };
}
