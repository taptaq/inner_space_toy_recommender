type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type BodyPersonaSession = {
  id: string;
  recommendationSessionId: string | null;
  userId: string | null;
  sourcePageRoute: string;
  questionVersion: string;
  scoringVersion: string;
  answers: unknown;
  answerPath: unknown;
  dimensionScores: unknown;
  primaryPersonaCode: string;
  secondaryPersonaCode: string | null;
  hiddenRouteCode: string | null;
  hiddenPowerGrade: string | null;
  coLivingComfortGrade: string | null;
  freeSummary: unknown;
  fullReport: unknown;
  status: string;
};

export type CreateBodyPersonaSessionInput = {
  recommendationSessionId?: string | null;
  userId?: string | null;
  sourcePageRoute: string;
  questionVersion: string;
  scoringVersion: string;
  answers: Record<string, unknown>;
  answerPath: unknown[];
  dimensionScores: Record<string, unknown>;
  primaryPersonaCode: string;
  secondaryPersonaCode?: string | null;
  hiddenRouteCode?: string | null;
  hiddenPowerGrade?: string | null;
  coLivingComfortGrade?: string | null;
  freeSummary: unknown;
  fullReport?: unknown;
  status?: string;
};

export type BodyPersonaUnlockOrder = {
  id: string;
  personaSessionId: string;
  userId: string | null;
  amountCent: number;
  currency: string;
  channel: string | null;
  merchantOrderNo: string | null;
  paymentProvider: string | null;
  status: string;
};

export type CreateBodyPersonaOrderInput = {
  personaSessionId: string;
  userId?: string | null;
  amountCent?: number;
  currency?: string;
  channel?: string | null;
  merchantOrderNo?: string | null;
  paymentProvider?: string | null;
  expiredAt?: string | null;
};

export type BodyPersonaUnlockEntitlement = {
  id: string;
  personaSessionId: string;
  orderId: string | null;
  userId: string | null;
  unlockedScope: string;
};

export type CreateBodyPersonaEntitlementInput = {
  personaSessionId: string;
  orderId?: string | null;
  userId?: string | null;
  unlockedScope?: string;
};

export type BodyPersonaStore = {
  createSession: (
    input: CreateBodyPersonaSessionInput,
  ) => Promise<BodyPersonaSession>;
  getSessionById: (id: string) => Promise<BodyPersonaSession | null>;
  saveFullReport: (id: string, fullReport: unknown) => Promise<void>;
  createOrder: (
    input: CreateBodyPersonaOrderInput,
  ) => Promise<BodyPersonaUnlockOrder>;
  markOrderPaid: (id: string) => Promise<BodyPersonaUnlockOrder | null>;
  createEntitlement: (
    input: CreateBodyPersonaEntitlementInput,
  ) => Promise<BodyPersonaUnlockEntitlement>;
  getEntitlementBySessionId: (
    personaSessionId: string,
  ) => Promise<BodyPersonaUnlockEntitlement | null>;
};

type SessionRow = {
  id?: string;
  recommendation_session_id?: string | null;
  user_id?: string | null;
  source_page_route?: string;
  question_version?: string;
  scoring_version?: string;
  answers?: unknown;
  answer_path?: unknown;
  dimension_scores?: unknown;
  primary_persona_code?: string;
  secondary_persona_code?: string | null;
  hidden_route_code?: string | null;
  hidden_power_grade?: string | null;
  co_living_comfort_grade?: string | null;
  free_summary?: unknown;
  full_report?: unknown;
  status?: string;
};

type OrderRow = {
  id?: string;
  persona_session_id?: string;
  user_id?: string | null;
  amount_cent?: number;
  currency?: string;
  channel?: string | null;
  merchant_order_no?: string | null;
  payment_provider?: string | null;
  status?: string;
};

type EntitlementRow = {
  id?: string;
  persona_session_id?: string;
  order_id?: string | null;
  user_id?: string | null;
  unlocked_scope?: string;
};

function parseJsonColumn(value: unknown, fallback: unknown) {
  if (typeof value !== "string") {
    return value ?? fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapSessionRow(row: SessionRow | undefined): BodyPersonaSession | null {
  if (!row?.id || !row.primary_persona_code) {
    return null;
  }

  return {
    id: row.id,
    recommendationSessionId: row.recommendation_session_id ?? null,
    userId: row.user_id ?? null,
    sourcePageRoute: row.source_page_route ?? "/results",
    questionVersion: row.question_version ?? "body-persona-question-v1",
    scoringVersion: row.scoring_version ?? "body-persona-scoring-v1",
    answers: parseJsonColumn(row.answers, {}),
    answerPath: parseJsonColumn(row.answer_path, []),
    dimensionScores: parseJsonColumn(row.dimension_scores, {}),
    primaryPersonaCode: row.primary_persona_code,
    secondaryPersonaCode: row.secondary_persona_code ?? null,
    hiddenRouteCode: row.hidden_route_code ?? null,
    hiddenPowerGrade: row.hidden_power_grade ?? null,
    coLivingComfortGrade: row.co_living_comfort_grade ?? null,
    freeSummary: parseJsonColumn(row.free_summary, {}),
    fullReport: parseJsonColumn(row.full_report, null),
    status: row.status ?? "completed_free",
  };
}

function mapOrderRow(row: OrderRow | undefined): BodyPersonaUnlockOrder | null {
  if (!row?.id || !row.persona_session_id) {
    return null;
  }

  return {
    id: row.id,
    personaSessionId: row.persona_session_id,
    userId: row.user_id ?? null,
    amountCent: row.amount_cent ?? 50,
    currency: row.currency ?? "CNY",
    channel: row.channel ?? null,
    merchantOrderNo: row.merchant_order_no ?? null,
    paymentProvider: row.payment_provider ?? null,
    status: row.status ?? "pending",
  };
}

function mapEntitlementRow(
  row: EntitlementRow | undefined,
): BodyPersonaUnlockEntitlement | null {
  if (!row?.id || !row.persona_session_id) {
    return null;
  }

  return {
    id: row.id,
    personaSessionId: row.persona_session_id,
    orderId: row.order_id ?? null,
    userId: row.user_id ?? null,
    unlockedScope: row.unlocked_scope ?? "full_report",
  };
}

export async function ensureBodyPersonaSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.body_persona_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recommendation_session_id text,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      source_page_route text NOT NULL DEFAULT '/results',
      question_version text NOT NULL,
      scoring_version text NOT NULL,
      answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_path jsonb NOT NULL DEFAULT '[]'::jsonb,
      dimension_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      primary_persona_code text NOT NULL,
      secondary_persona_code text,
      hidden_route_code text,
      hidden_power_grade text,
      co_living_comfort_grade text,
      free_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      full_report jsonb,
      status text NOT NULL DEFAULT 'completed_free',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.body_persona_unlock_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      persona_session_id uuid NOT NULL REFERENCES public.body_persona_sessions(id) ON DELETE CASCADE,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      amount_cent integer NOT NULL DEFAULT 50,
      currency text NOT NULL DEFAULT 'CNY',
      channel text,
      merchant_order_no text UNIQUE,
      payment_provider text,
      status text NOT NULL DEFAULT 'pending',
      paid_at timestamptz,
      expired_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.body_persona_unlock_entitlements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      persona_session_id uuid NOT NULL UNIQUE REFERENCES public.body_persona_sessions(id) ON DELETE CASCADE,
      order_id uuid REFERENCES public.body_persona_unlock_orders(id) ON DELETE SET NULL,
      user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      unlocked_scope text NOT NULL DEFAULT 'full_report',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_body_persona_unlock_orders_session_id
    ON public.body_persona_unlock_orders(persona_session_id)
  `);
}

export function createBodyPersonaStore({
  pool,
}: {
  pool: Queryable;
}): BodyPersonaStore {
  return {
    async createSession(input) {
      const result = await pool.query(
        `
          INSERT INTO public.body_persona_sessions (
            recommendation_session_id,
            user_id,
            source_page_route,
            question_version,
            scoring_version,
            answers,
            answer_path,
            dimension_scores,
            primary_persona_code,
            secondary_persona_code,
            hidden_route_code,
            hidden_power_grade,
            co_living_comfort_grade,
            free_summary,
            full_report,
            status
          )
          VALUES (
            $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb,
            $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16
          )
          RETURNING *
        `,
        [
          input.recommendationSessionId ?? null,
          input.userId ?? null,
          input.sourcePageRoute,
          input.questionVersion,
          input.scoringVersion,
          JSON.stringify(input.answers),
          JSON.stringify(input.answerPath),
          JSON.stringify(input.dimensionScores),
          input.primaryPersonaCode,
          input.secondaryPersonaCode ?? null,
          input.hiddenRouteCode ?? null,
          input.hiddenPowerGrade ?? null,
          input.coLivingComfortGrade ?? null,
          JSON.stringify(input.freeSummary),
          input.fullReport == null ? null : JSON.stringify(input.fullReport),
          input.status ?? "completed_free",
        ],
      );

      const session = mapSessionRow(result.rows[0] as SessionRow | undefined);
      if (!session) {
        throw new Error("Body persona session insert did not return a row");
      }

      return session;
    },

    async getSessionById(id) {
      const result = await pool.query(
        `
          SELECT *
          FROM public.body_persona_sessions
          WHERE id = $1
          LIMIT 1
        `,
        [id],
      );

      return mapSessionRow(result.rows[0] as SessionRow | undefined);
    },

    async saveFullReport(id, fullReport) {
      await pool.query(
        `
          UPDATE public.body_persona_sessions
          SET full_report = $2::jsonb,
              status = 'unlocked',
              updated_at = now()
          WHERE id = $1
        `,
        [id, JSON.stringify(fullReport)],
      );
    },

    async createOrder(input) {
      const result = await pool.query(
        `
          INSERT INTO public.body_persona_unlock_orders (
            persona_session_id,
            user_id,
            amount_cent,
            currency,
            channel,
            merchant_order_no,
            payment_provider,
            expired_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          input.personaSessionId,
          input.userId ?? null,
          input.amountCent ?? 50,
          input.currency ?? "CNY",
          input.channel ?? null,
          input.merchantOrderNo ?? null,
          input.paymentProvider ?? "dev",
          input.expiredAt ?? null,
        ],
      );

      const order = mapOrderRow(result.rows[0] as OrderRow | undefined);
      if (!order) {
        throw new Error("Body persona unlock order insert did not return a row");
      }

      return order;
    },

    async markOrderPaid(id) {
      const result = await pool.query(
        `
          UPDATE public.body_persona_unlock_orders
          SET status = 'paid',
              paid_at = COALESCE(paid_at, now()),
              updated_at = now()
          WHERE id = $1
          RETURNING *
        `,
        [id],
      );

      return mapOrderRow(result.rows[0] as OrderRow | undefined);
    },

    async createEntitlement(input) {
      const result = await pool.query(
        `
          INSERT INTO public.body_persona_unlock_entitlements (
            persona_session_id,
            order_id,
            user_id,
            unlocked_scope
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (persona_session_id) DO UPDATE SET
            order_id = COALESCE(EXCLUDED.order_id, public.body_persona_unlock_entitlements.order_id),
            user_id = COALESCE(EXCLUDED.user_id, public.body_persona_unlock_entitlements.user_id),
            unlocked_scope = EXCLUDED.unlocked_scope
          RETURNING *
        `,
        [
          input.personaSessionId,
          input.orderId ?? null,
          input.userId ?? null,
          input.unlockedScope ?? "full_report",
        ],
      );

      const entitlement = mapEntitlementRow(
        result.rows[0] as EntitlementRow | undefined,
      );
      if (!entitlement) {
        throw new Error("Body persona entitlement insert did not return a row");
      }

      return entitlement;
    },

    async getEntitlementBySessionId(personaSessionId) {
      const result = await pool.query(
        `
          SELECT *
          FROM public.body_persona_unlock_entitlements
          WHERE persona_session_id = $1
          LIMIT 1
        `,
        [personaSessionId],
      );

      return mapEntitlementRow(result.rows[0] as EntitlementRow | undefined);
    },
  };
}
