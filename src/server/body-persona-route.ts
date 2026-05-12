import type { Request, Response } from "express";

import {
  BODY_PERSONA_CODES,
  HIDDEN_ROUTE_CODES,
  type BodyPersonaAnswers,
  type BodyPersonaCode,
  type BodyPersonaResult,
  type HiddenRouteCode,
  resolveBodyPersonaResult,
} from "../lib/body-persona.js";
import {
  buildBodyPersonaFullReport,
  type BodyPersonaCandidate,
  type BodyPersonaFullReport,
} from "../lib/body-persona-report.js";
import { normalizeReportStringArray } from "./body-persona-report-service.js";
import type {
  BodyPersonaSession,
  BodyPersonaStore,
  BodyPersonaUnlockEntitlement,
  BodyPersonaUnlockOrder,
} from "./body-persona-store.js";

const DEFAULT_QUESTION_VERSION = "body-persona-question-v1";
const DEFAULT_SCORING_VERSION = "body-persona-scoring-v1";
const DEV_CONFIRMATION_TOKEN = "dev-confirm";

type BodyPersonaReportService = {
  enhanceUnlockedReport: (input: {
    freeSummary: unknown;
    baseReport: BodyPersonaFullReport;
  }) => Promise<unknown>;
};

type ConfirmUnlockOrder = Pick<BodyPersonaUnlockOrder, "id" | "personaSessionId"> &
  Partial<BodyPersonaUnlockOrder>;

type ConfirmUnlockSession = Pick<
  BodyPersonaSession,
  "id" | "freeSummary" | "fullReport"
> &
  Partial<BodyPersonaSession>;

type ConfirmUnlockEntitlement = Pick<BodyPersonaUnlockEntitlement, "id"> &
  Partial<BodyPersonaUnlockEntitlement>;

type ConfirmUnlockStore = {
  markOrderPaid: (id: string) => Promise<ConfirmUnlockOrder | null>;
  createEntitlement: (input: {
    personaSessionId: string;
    orderId?: string | null;
    userId?: string | null;
  }) => Promise<ConfirmUnlockEntitlement>;
  getSessionById: (id: string) => Promise<ConfirmUnlockSession | null>;
  saveFullReport: (id: string, fullReport: unknown) => Promise<void>;
};

function normalizeOptionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizeRequiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePageRoute(value: unknown) {
  return normalizeOptionalText(value) ?? "/results";
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeCandidatePool(value: unknown): BodyPersonaCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((candidate) =>
      candidate && typeof candidate === "object"
        ? (candidate as Record<string, unknown>)
        : null,
    )
    .filter((candidate): candidate is Record<string, unknown> => !!candidate)
    .map((candidate, index) => ({
      id: normalizeOptionalText(candidate.id) ?? `candidate-${index + 1}`,
      name: normalizeOptionalText(candidate.name) ?? "未命名产品",
      score:
        typeof candidate.score === "number" && Number.isFinite(candidate.score)
          ? candidate.score
          : 0,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      typeCode: normalizeOptionalText(candidate.typeCode),
      appearance: normalizeOptionalText(candidate.appearance),
      maxDb:
        typeof candidate.maxDb === "number" && Number.isFinite(candidate.maxDb)
          ? candidate.maxDb
          : null,
    }));
}

function normalizeReportProductPicks(
  value: unknown,
  fallback: BodyPersonaFullReport["productPicks"],
): BodyPersonaFullReport["productPicks"] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((candidate) =>
      candidate && typeof candidate === "object"
        ? (candidate as Record<string, unknown>)
        : null,
    )
    .filter((candidate): candidate is Record<string, unknown> => !!candidate)
    .map((candidate, index) => ({
      id: normalizeOptionalText(candidate.id) ?? `candidate-${index + 1}`,
      name: normalizeOptionalText(candidate.name) ?? "未命名产品",
      score:
        typeof candidate.score === "number" && Number.isFinite(candidate.score)
          ? candidate.score
          : 0,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      typeCode: normalizeOptionalText(candidate.typeCode),
      appearance: normalizeOptionalText(candidate.appearance),
      maxDb:
        typeof candidate.maxDb === "number" && Number.isFinite(candidate.maxDb)
          ? candidate.maxDb
          : null,
      personaScore:
        typeof candidate.personaScore === "number" &&
        Number.isFinite(candidate.personaScore)
          ? candidate.personaScore
          : 0,
    }));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isPersonaCode(value: string): value is BodyPersonaCode {
  return BODY_PERSONA_CODES.includes(value as BodyPersonaCode);
}

function isHiddenRouteCode(value: string): value is HiddenRouteCode {
  return HIDDEN_ROUTE_CODES.includes(value as HiddenRouteCode);
}

function normalizeFreeSummary(value: unknown): BodyPersonaResult["freeSummary"] {
  const summary = normalizeJsonObject(value);
  return {
    title: normalizeOptionalText(summary.title) ?? "微光型·慢热探索者",
    blurb:
      normalizeOptionalText(summary.blurb) ??
      "你更适合先建立自己的节奏，再向更贴合的体验路线推进。",
    why:
      normalizeOptionalText(summary.why) ??
      "你的答案在节奏、层次和掌控感之间形成了稳定偏好。",
    hints: Array.isArray(summary.hints)
      ? summary.hints.filter((hint): hint is string => typeof hint === "string")
      : [],
  };
}

function buildPersonaResultFromSession(
  session: Partial<BodyPersonaSession>,
): BodyPersonaResult {
  const primaryPersonaCode =
    session.primaryPersonaCode && isPersonaCode(session.primaryPersonaCode)
      ? session.primaryPersonaCode
      : "soft_glow";
  const secondaryPersonaCode =
    session.secondaryPersonaCode && isPersonaCode(session.secondaryPersonaCode)
      ? session.secondaryPersonaCode
      : null;
  const hiddenRouteCode =
    session.hiddenRouteCode && isHiddenRouteCode(session.hiddenRouteCode)
      ? session.hiddenRouteCode
      : "zero_profile";
  const hiddenPowerGrade =
    session.hiddenPowerGrade === "S" ||
    session.hiddenPowerGrade === "A" ||
    session.hiddenPowerGrade === "B"
      ? session.hiddenPowerGrade
      : "B";
  const coLivingComfortGrade =
    session.coLivingComfortGrade === "high" ||
    session.coLivingComfortGrade === "medium" ||
    session.coLivingComfortGrade === "low"
      ? session.coLivingComfortGrade
      : "low";

  return {
    primaryPersonaCode,
    secondaryPersonaCode,
    hiddenRouteCode,
    hiddenPowerGrade,
    coLivingComfortGrade,
    freeSummary: normalizeFreeSummary(session.freeSummary),
  };
}

function toBaseReport(session: ConfirmUnlockSession): BodyPersonaFullReport {
  const deterministicReport = buildBodyPersonaFullReport({
    persona: buildPersonaResultFromSession(session),
    candidatePool: [],
  });
  const savedReport = normalizeJsonObject(session.fullReport);

  return {
    title: normalizeOptionalText(savedReport.title) ?? deterministicReport.title,
    portrait:
      normalizeOptionalText(savedReport.portrait) ??
      deterministicReport.portrait,
    hiddenRouteSummary:
      normalizeOptionalText(savedReport.hiddenRouteSummary) ??
      deterministicReport.hiddenRouteSummary,
    goodFits: normalizeReportStringArray(
      savedReport.goodFits,
      deterministicReport.goodFits,
    ),
    avoidNotes: normalizeReportStringArray(
      savedReport.avoidNotes,
      deterministicReport.avoidNotes,
    ),
    productPicks: normalizeReportProductPicks(
      savedReport.productPicks,
      deterministicReport.productPicks,
    ),
  };
}

function sendServerError(res: Response, label: string, error: unknown) {
  console.error(`❌ [Server/BodyPersona] ${label}:`, error);
  res.status(500).json({
    error: label,
    details: getErrorMessage(error),
  });
}

export function createCreateBodyPersonaSessionHandler({
  store,
}: {
  store: Pick<BodyPersonaStore, "createSession">;
}) {
  return async (req: Request, res: Response) => {
    const requestBody = normalizeJsonObject(req.body);
    const answers = normalizeJsonObject(requestBody.answers);
    const persona = resolveBodyPersonaResult({
      answers: answers as BodyPersonaAnswers,
    });
    const candidatePool = normalizeCandidatePool(requestBody.candidatePool);
    const baseReport = buildBodyPersonaFullReport({ persona, candidatePool });

    try {
      const session = await store.createSession({
        recommendationSessionId: normalizeOptionalText(
          requestBody.recommendationSessionId,
        ),
        userId: normalizeOptionalText(requestBody.userId),
        sourcePageRoute: normalizePageRoute(requestBody.sourcePageRoute),
        questionVersion:
          normalizeOptionalText(requestBody.questionVersion) ??
          DEFAULT_QUESTION_VERSION,
        scoringVersion:
          normalizeOptionalText(requestBody.scoringVersion) ??
          DEFAULT_SCORING_VERSION,
        answers,
        answerPath: normalizeJsonArray(requestBody.answerPath),
        dimensionScores: normalizeJsonObject(requestBody.dimensionScores),
        primaryPersonaCode: persona.primaryPersonaCode,
        secondaryPersonaCode: persona.secondaryPersonaCode,
        hiddenRouteCode: persona.hiddenRouteCode,
        hiddenPowerGrade: persona.hiddenPowerGrade,
        coLivingComfortGrade: persona.coLivingComfortGrade,
        freeSummary: persona.freeSummary,
        fullReport: baseReport,
      });

      res.status(201).json({
        id: session.id,
        primaryPersonaCode: persona.primaryPersonaCode,
        secondaryPersonaCode: persona.secondaryPersonaCode,
        hiddenRouteCode: persona.hiddenRouteCode,
        hiddenPowerGrade: persona.hiddenPowerGrade,
        coLivingComfortGrade: persona.coLivingComfortGrade,
        freeSummary: persona.freeSummary,
        status: session.status,
      });
    } catch (error) {
      sendServerError(res, "Body persona session create failed", error);
    }
  };
}

export function createGetBodyPersonaSessionHandler({
  store,
}: {
  store: Pick<BodyPersonaStore, "getSessionById" | "getEntitlementBySessionId">;
}) {
  return async (req: Request, res: Response) => {
    const id = normalizeRequiredText(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Body persona session id is required" });
      return;
    }

    try {
      const session = await store.getSessionById(id);
      if (!session) {
        res.status(404).json({ error: "Body persona session not found" });
        return;
      }

      const entitlement = await store.getEntitlementBySessionId(session.id);
      const unlocked = !!entitlement;

      res.json({
        session: {
          id: session.id,
          primaryPersonaCode: session.primaryPersonaCode,
          secondaryPersonaCode: session.secondaryPersonaCode,
          hiddenRouteCode: session.hiddenRouteCode,
          hiddenPowerGrade: session.hiddenPowerGrade,
          coLivingComfortGrade: session.coLivingComfortGrade,
          freeSummary: session.freeSummary,
          fullReport: unlocked ? toBaseReport(session) : null,
          status: session.status,
        },
        unlocked,
      });
    } catch (error) {
      sendServerError(res, "Body persona session read failed", error);
    }
  };
}

export function createCreateBodyPersonaOrderHandler({
  store,
}: {
  store: Pick<BodyPersonaStore, "createOrder">;
}) {
  return async (req: Request, res: Response) => {
    const requestBody = normalizeJsonObject(req.body);
    const personaSessionId = normalizeRequiredText(
      requestBody.personaSessionId,
    );

    if (!personaSessionId) {
      res.status(400).json({ error: "Body persona session id is required" });
      return;
    }

    try {
      const order = await store.createOrder({
        personaSessionId,
        userId: normalizeOptionalText(requestBody.userId),
        channel: normalizeOptionalText(requestBody.channel),
        merchantOrderNo: normalizeOptionalText(requestBody.merchantOrderNo),
        paymentProvider: normalizeOptionalText(requestBody.paymentProvider),
      });

      res.status(201).json({ order, confirmationToken: DEV_CONFIRMATION_TOKEN });
    } catch (error) {
      sendServerError(res, "Body persona unlock order create failed", error);
    }
  };
}

export function createConfirmBodyPersonaUnlockHandler({
  store,
  reportService,
}: {
  store: ConfirmUnlockStore;
  reportService: BodyPersonaReportService;
}) {
  return async (req: Request, res: Response) => {
    const orderId = normalizeRequiredText(req.params.id);
    const requestBody = normalizeJsonObject(req.body);

    if (!orderId) {
      res.status(400).json({ error: "Body persona unlock order id is required" });
      return;
    }

    if (
      normalizeRequiredText(requestBody.confirmationToken) !==
      DEV_CONFIRMATION_TOKEN
    ) {
      res.status(400).json({ error: "Body persona unlock confirmation failed" });
      return;
    }

    try {
      const order = await store.markOrderPaid(orderId);
      if (!order) {
        res.status(404).json({ error: "Body persona unlock order not found" });
        return;
      }

      const entitlement = await store.createEntitlement({
        personaSessionId: order.personaSessionId,
        orderId: order.id,
        userId: order.userId,
      });
      const session = await store.getSessionById(order.personaSessionId);

      if (!session) {
        res.status(404).json({ error: "Body persona session not found" });
        return;
      }

      const report = await reportService.enhanceUnlockedReport({
        freeSummary: session.freeSummary,
        baseReport: toBaseReport(session),
      });
      await store.saveFullReport(session.id, report);

      res.status(200).json({
        unlocked: true,
        order,
        entitlement,
        report,
      });
    } catch (error) {
      sendServerError(res, "Body persona unlock confirmation failed", error);
    }
  };
}

export function createBodyPersonaUnlockStatusHandler({
  store,
}: {
  store: Pick<BodyPersonaStore, "getEntitlementBySessionId">;
}) {
  return async (req: Request, res: Response) => {
    const id = normalizeRequiredText(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Body persona session id is required" });
      return;
    }

    try {
      const entitlement = await store.getEntitlementBySessionId(id);
      res.json({
        unlocked: !!entitlement,
        entitlement: entitlement
          ? ({
              id: entitlement.id,
              personaSessionId: entitlement.personaSessionId,
              orderId: entitlement.orderId,
              unlockedScope: entitlement.unlockedScope,
            } satisfies Omit<BodyPersonaUnlockEntitlement, "userId">)
          : null,
      });
    } catch (error) {
      sendServerError(res, "Body persona unlock status read failed", error);
    }
  };
}

export type {
  BodyPersonaReportService,
  BodyPersonaUnlockEntitlement,
  BodyPersonaUnlockOrder,
};
