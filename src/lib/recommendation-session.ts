import type { AnswerState, Question } from "../data/mock.js";

export const RECOMMENDATION_FLOW_VERSION = "quiz-flow-v1";
export const RECOMMENDATION_ALGORITHM_VERSION = "recommendation-v1";

type ApiErrorPayload = {
  error?: string;
  details?: string;
};

export type QuizAnswerPathEntry = {
  step: number;
  questionId: string;
  questionTitle: string;
  field: keyof AnswerState;
  optionLabel: string;
  optionValue?: AnswerState[keyof AnswerState];
  tag: string;
  answerPatch?: Partial<Omit<AnswerState, "tags">>;
  selectedAt: string;
};

export type AppendQuizAnswerPathEntryInput = {
  step: number;
  question: Question;
  optionLabel: string;
  optionValue: AnswerState[keyof AnswerState];
  tag: string;
  answerPatch?: Partial<Omit<AnswerState, "tags">>;
  selectedAt?: string;
};

export type SubmitRecommendationSessionInput = {
  sessionId: string;
  answers: Record<string, unknown>;
  answerPath: unknown[];
  topProducts: unknown[];
  flowVersion?: string;
  algorithmVersion?: string;
  resultProvider?: string | null;
  resultModelName?: string | null;
  pageRoute: string;
  fetcher?: typeof fetch;
};

type SubmitRecommendationSessionResponse = {
  id: string;
};

export function createRecommendationSessionId(
  uuidFactory = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
) {
  return `rec-session-${uuidFactory()}`;
}

export function appendQuizAnswerPathEntry(
  currentPath: QuizAnswerPathEntry[],
  input: AppendQuizAnswerPathEntryInput,
): QuizAnswerPathEntry[] {
  return [
    ...currentPath,
    {
      step: input.step,
      questionId: input.question.id,
      questionTitle: input.question.title,
      field: input.question.field,
      optionLabel: input.optionLabel,
      ...(input.optionValue === undefined ? {} : { optionValue: input.optionValue }),
      tag: input.tag,
      ...(input.answerPatch ? { answerPatch: input.answerPatch } : {}),
      selectedAt: input.selectedAt ?? new Date().toISOString(),
    },
  ];
}

export function trimQuizAnswerPathFromStep<T extends { step?: unknown }>(
  currentPath: T[],
  fromStep: number,
): T[] {
  if (!Number.isFinite(fromStep)) {
    return currentPath;
  }

  return currentPath.filter(
    (entry) => typeof entry.step !== "number" || entry.step < fromStep,
  );
}

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

async function readSubmitRecommendationSessionResponse(
  response: Response,
  fallback: string,
): Promise<SubmitRecommendationSessionResponse> {
  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;

  if (!payload || typeof payload.id !== "string") {
    throw new Error(fallback);
  }

  return { id: payload.id };
}

export async function submitRecommendationSession({
  sessionId,
  answers,
  answerPath,
  topProducts,
  flowVersion = RECOMMENDATION_FLOW_VERSION,
  algorithmVersion = RECOMMENDATION_ALGORITHM_VERSION,
  resultProvider,
  resultModelName,
  pageRoute,
  fetcher = fetch,
}: SubmitRecommendationSessionInput) {
  const response = await fetcher("/api/recommendation-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      answers,
      answerPath,
      topProducts,
      flowVersion,
      algorithmVersion,
      resultProvider,
      resultModelName,
      pageRoute,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "保存推荐会话失败"));
  }

  return await readSubmitRecommendationSessionResponse(
    response,
    "保存推荐会话失败",
  );
}
