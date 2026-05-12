import type { buildBodyPersonaFullReport } from "../lib/body-persona-report.js";

type BodyPersonaAiEnhancement = {
  portrait?: string;
  goodFits?: unknown;
  avoidNotes?: unknown;
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
          portrait: result.data.portrait || input.baseReport.portrait,
          goodFits: normalizeReportStringArray(
            result.data.goodFits,
            input.baseReport.goodFits,
          ),
          avoidNotes: normalizeReportStringArray(
            result.data.avoidNotes,
            input.baseReport.avoidNotes,
          ),
        };
      } catch {
        return input.baseReport;
      }
    },
  };
}
