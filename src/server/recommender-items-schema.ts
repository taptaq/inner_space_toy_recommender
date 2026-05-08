type Queryable = {
  query: (sql: string) => Promise<unknown>;
};

export async function ensureRecommenderItemsSchema(pool: Queryable) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recommender_toys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      original_id UUID,
      name TEXT NOT NULL,
      safe_display_name TEXT,
      price DECIMAL(10, 2),
      max_db INTEGER,
      waterproof INTEGER,
      appearance TEXT,
      physical_form TEXT,
      motor_type TEXT,
      gender TEXT,
      brand TEXT,
      material TEXT,
      image_url TEXT,
      raw_description TEXT,
      type_code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS safe_display_name TEXT
  `);

  await pool.query(`
    ALTER TABLE public.recommender_toys
    ADD COLUMN IF NOT EXISTS subtype_code TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommender_toys_created_at
    ON public.recommender_toys(created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommender_toys_original_id
    ON public.recommender_toys(original_id)
    WHERE original_id IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_recommender_toys_filter_codes
    ON public.recommender_toys(gender, type_code, subtype_code)
  `);
}
