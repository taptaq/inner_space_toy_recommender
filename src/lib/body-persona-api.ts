import type { BodyPersonaFullReport } from "./body-persona-report.ts";

type ApiErrorPayload = {
  error?: string;
  details?: string;
};

export type BodyPersonaSessionApiResponse = {
  id: string;
  primaryPersonaCode?: string;
  secondaryPersonaCode?: string | null;
  hiddenRouteCode?: string | null;
  hiddenPowerGrade?: string | null;
  coLivingComfortGrade?: string | null;
  freeSummary?: {
    title?: string;
    blurb?: string;
    why?: string;
    hints?: string[];
  };
  status?: string;
};

export type BodyPersonaOrderApiResponse = {
  id: string;
  personaSessionId?: string;
  userId?: string | null;
  amountCent?: number;
  currency?: string;
  channel?: string | null;
  merchantOrderNo?: string | null;
  paymentProvider?: string | null;
  status?: string;
  confirmationToken?: string;
};

export type BodyPersonaUnlockApiResponse = {
  unlocked: boolean;
  order?: unknown;
  entitlement?: unknown;
  report: BodyPersonaFullReport;
};

export type BodyPersonaSessionReadResponse = {
  session: Record<string, unknown> & { id: string };
  unlocked: boolean;
};

export type BodyPersonaUnlockStatusResponse = {
  unlocked: boolean;
  entitlement: ({ id: string } & Record<string, unknown>) | null;
};

async function readApiErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const detail = payload?.details || payload?.error;
  return detail ? `${fallback}：${detail}` : fallback;
}

async function readJsonResponse<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!payload) {
    throw new Error(fallback);
  }

  return payload;
}

export async function createBodyPersonaSession({
  payload,
  fetcher = fetch,
}: {
  payload: Record<string, unknown>;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher("/api/body-persona/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "创建身体人格测试失败"));
  }

  return await readJsonResponse<BodyPersonaSessionApiResponse>(
    response,
    "创建身体人格测试失败",
  );
}

export async function getBodyPersonaSession({
  sessionId,
  fetcher = fetch,
}: {
  sessionId: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher(`/api/body-persona/sessions/${sessionId}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "读取身体人格结果失败"));
  }

  return await readJsonResponse<BodyPersonaSessionReadResponse>(
    response,
    "读取身体人格结果失败",
  );
}

export async function createBodyPersonaOrder({
  sessionId,
  amountCent,
  channel,
  paymentProvider,
  fetcher = fetch,
}: {
  sessionId: string;
  amountCent?: number;
  channel?: string;
  paymentProvider?: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher("/api/body-persona/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personaSessionId: sessionId,
      amountCent,
      channel,
      paymentProvider,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, "创建身体人格解锁订单失败"),
    );
  }

  const payload = await readJsonResponse<{
    order?: BodyPersonaOrderApiResponse;
    confirmationToken?: string;
  }>(response, "创建身体人格解锁订单失败");

  if (!payload.order?.id) {
    throw new Error("创建身体人格解锁订单失败");
  }

  return {
    ...payload.order,
    confirmationToken: payload.confirmationToken,
  };
}

export async function confirmBodyPersonaUnlock({
  orderId,
  confirmationToken = "dev-confirm",
  fetcher = fetch,
}: {
  orderId: string;
  confirmationToken?: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher(`/api/body-persona/orders/${orderId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmationToken }),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "解锁身体人格报告失败"));
  }

  return await readJsonResponse<BodyPersonaUnlockApiResponse>(
    response,
    "解锁身体人格报告失败",
  );
}

export async function getBodyPersonaUnlockStatus({
  sessionId,
  fetcher = fetch,
}: {
  sessionId: string;
  fetcher?: typeof fetch;
}) {
  const response = await fetcher(
    `/api/body-persona/sessions/${sessionId}/unlock-status`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, "读取身体人格解锁状态失败"),
    );
  }

  return await readJsonResponse<BodyPersonaUnlockStatusResponse>(
    response,
    "读取身体人格解锁状态失败",
  );
}
