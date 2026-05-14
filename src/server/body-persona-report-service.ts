import type { buildBodyPersonaFullReport } from "../lib/body-persona-report.js";

type BodyPersonaAiEnhancement = {
  portrait?: string;
  portraitLong?: string;
  personaManifesto?: string;
  whyYouAreThis?: string;
  strengthTags?: unknown;
  growthTip?: string;
  hiddenRouteSummaryLong?: string;
  goodFits?: unknown;
  avoidNotes?: unknown;
  sceneMatches?: unknown;
  paceAdvice?: unknown;
  parameterFocus?: unknown;
  pickReasonSummary?: string;
  mismatchWarnings?: unknown;
};

export function normalizeReportStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  const normalized = value.map((item) =>
    typeof item === "string" ? item.trim() : "",
  );

  return normalized.every((item) => item.length > 0) ? normalized : fallback;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function createBodyPersonaReportService({
  appAiService,
}: {
  appAiService: {
    runServerAiProxy: (input: {
      prompt: string;
      temperature: number;
      emptyJson: string;
      logContext: string;
      maxTokens: number;
      providerTimeoutMs?: number;
    }) => Promise<{ data: BodyPersonaAiEnhancement }>;
  };
}) {
  return {
    async enhanceUnlockedReport(input: {
      freeSummary: unknown;
      baseReport: ReturnType<typeof buildBodyPersonaFullReport>;
    }) {
      try {
        const result = await appAiService.runServerAiProxy({
          prompt: `请基于以下结构化人格结果，润色中文，不改变结论：${JSON.stringify(input)}`,
          temperature: 0.1,
          emptyJson: "{}",
          logContext: "身体人格报告润色",
          maxTokens: 800,
        });

        return {
          ...input.baseReport,
          portraitLong:
            normalizeOptionalString(result.data.portraitLong) ??
            input.baseReport.portraitLong,
          portrait:
            normalizeOptionalString(result.data.portrait) ??
            normalizeOptionalString(result.data.portraitLong) ??
            input.baseReport.portrait,
          personaManifesto:
            normalizeOptionalString(result.data.personaManifesto) ??
            input.baseReport.personaManifesto,
          whyYouAreThis:
            normalizeOptionalString(result.data.whyYouAreThis) ??
            input.baseReport.whyYouAreThis,
          strengthTags: normalizeReportStringArray(
            result.data.strengthTags,
            input.baseReport.strengthTags,
          ),
          growthTip:
            normalizeOptionalString(result.data.growthTip) ??
            input.baseReport.growthTip,
          hiddenRouteSummaryLong:
            normalizeOptionalString(result.data.hiddenRouteSummaryLong) ??
            input.baseReport.hiddenRouteSummaryLong,
          goodFits: normalizeReportStringArray(
            result.data.goodFits,
            input.baseReport.goodFits,
          ),
          avoidNotes: normalizeReportStringArray(
            result.data.avoidNotes,
            input.baseReport.avoidNotes,
          ),
          sceneMatches: normalizeReportStringArray(
            result.data.sceneMatches,
            input.baseReport.sceneMatches,
          ),
          paceAdvice: normalizeReportStringArray(
            result.data.paceAdvice,
            input.baseReport.paceAdvice,
          ),
          parameterFocus: normalizeReportStringArray(
            result.data.parameterFocus,
            input.baseReport.parameterFocus,
          ),
          pickReasonSummary:
            normalizeOptionalString(result.data.pickReasonSummary) ??
            input.baseReport.pickReasonSummary,
          mismatchWarnings: normalizeReportStringArray(
            result.data.mismatchWarnings,
            input.baseReport.mismatchWarnings,
          ),
        };
      } catch {
        return input.baseReport;
      }
    },
  };
}
