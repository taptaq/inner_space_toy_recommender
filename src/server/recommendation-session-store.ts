type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type SaveRecommendationSessionInput = {
  sessionId: string;
  answers: Record<string, unknown>;
  answerPath: unknown[];
  topProducts: unknown[];
  flowVersion: string;
  algorithmVersion: string;
  resultProvider?: string | null;
  resultModelName?: string | null;
  pageRoute: string;
};

export type RecommendationSessionStore = {
  saveSession: (
    input: SaveRecommendationSessionInput,
  ) => Promise<{ id: string }>;
};

export async function ensureRecommendationSessionSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recommendation_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id text NOT NULL UNIQUE,
      answers jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_path jsonb NOT NULL DEFAULT '[]'::jsonb,
      top_products jsonb NOT NULL DEFAULT '[]'::jsonb,
      flow_version text NOT NULL DEFAULT 'quiz-flow-v1',
      algorithm_version text NOT NULL DEFAULT 'recommendation-v1',
      result_provider text,
      result_model_name text,
      page_route text NOT NULL DEFAULT '/results',
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS session_id text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS answer_path jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS top_products jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS flow_version text NOT NULL DEFAULT 'quiz-flow-v1'
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS algorithm_version text NOT NULL DEFAULT 'recommendation-v1'
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS result_provider text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS result_model_name text
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS page_route text NOT NULL DEFAULT '/results'
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS completed_at timestamptz NOT NULL DEFAULT now()
  `);

  await pool.query(`
    ALTER TABLE public.recommendation_sessions
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendation_sessions_session_id
    ON public.recommendation_sessions(session_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommendation_sessions_completed_at
    ON public.recommendation_sessions(completed_at DESC)
  `);
}

export function createRecommendationSessionStore({
  pool,
}: {
  pool: Queryable;
}): RecommendationSessionStore {
  return {
    async saveSession({
      sessionId,
      answers,
      answerPath,
      topProducts,
      flowVersion,
      algorithmVersion,
      resultProvider,
      resultModelName,
      pageRoute,
    }) {
      const result = await pool.query(
        `
          INSERT INTO public.recommendation_sessions (
            session_id,
            answers,
            answer_path,
            top_products,
            flow_version,
            algorithm_version,
            result_provider,
            result_model_name,
            page_route
          )
          VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9)
          ON CONFLICT (session_id) DO UPDATE SET
            answers = EXCLUDED.answers,
            answer_path = EXCLUDED.answer_path,
            top_products = EXCLUDED.top_products,
            flow_version = EXCLUDED.flow_version,
            algorithm_version = EXCLUDED.algorithm_version,
            result_provider = EXCLUDED.result_provider,
            result_model_name = EXCLUDED.result_model_name,
            page_route = EXCLUDED.page_route,
            completed_at = now(),
            updated_at = now()
          RETURNING id
        `,
        [
          sessionId,
          JSON.stringify(answers),
          JSON.stringify(answerPath),
          JSON.stringify(topProducts),
          flowVersion,
          algorithmVersion,
          resultProvider ?? null,
          resultModelName ?? null,
          pageRoute,
        ],
      );

      const row = result.rows[0] as { id?: string } | undefined;
      if (!row?.id) {
        throw new Error("Recommendation session insert did not return an id");
      }

      return { id: row.id };
    },
  };
}
