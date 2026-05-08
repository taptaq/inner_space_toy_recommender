import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import type { RequestHandler } from "express";

import { buildSafeDisplayName } from "../lib/product-display-name.js";
import {
  resolveLibraryAudienceGender,
  resolveLibrarySubtypeCode,
  resolveLibraryTypeCode,
} from "../lib/library-product-type-classifier.js";
import { createRecalibrateResultsHandler } from "./app-ai-recalibration-route.js";
import { createAppAiService } from "./app-ai-service.js";
import {
  createKnowledgeNebulaCreateCardHandler,
  createKnowledgeNebulaRecordCardViewHandler,
  createKnowledgeNebulaTopicHandler,
  createKnowledgeNebulaUpdateCardHandler,
} from "./knowledge-nebula-route.js";
import { createKnowledgeEmbeddingService } from "./knowledge-embedding-service.js";
import {
  createKnowledgeNebulaStore,
  ensureKnowledgeNebulaSchema,
} from "./knowledge-nebula-store.js";
import { ensureRecommenderItemsSchema } from "./recommender-items-schema.js";
import {
  createLazyRouteInitializer,
  getRequiredServerEnv,
} from "./server-runtime.js";
import { createSupabaseAccessTokenVerifier } from "./user-auth.js";
import { createSaveUserFeedbackHandler } from "./user-feedback-route.js";
import {
  createUserFeedbackStore,
  ensureUserFeedbackSchema,
} from "./user-feedback-store.js";
import {
  createListUserRecommendationProfilesHandler,
  createSaveUserRecommendationProfileHandler,
} from "./user-recommendation-route.js";
import {
  createUserRecommendationStore,
  ensureUserRecommendationSchema,
} from "./user-recommendation-store.js";
import { createUsernameRegistrationHandler } from "./user-register-route.js";
import { createUsernameRegistrationService } from "./user-register-service.js";

dotenv.config();

const { Pool } = pg;
const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const appAiService = createAppAiService();
const recalibrateResultsHandler = createRecalibrateResultsHandler({
  appAiService,
});
const knowledgeEmbeddingService = createKnowledgeEmbeddingService();
const knowledgeNebulaStore = createKnowledgeNebulaStore({
  pool,
  embeddingService: knowledgeEmbeddingService,
});
const userRecommendationStore = createUserRecommendationStore({ pool });
const userFeedbackStore = createUserFeedbackStore({ pool });
const usernameRegistrationService = createUsernameRegistrationService({
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
const supabaseAccessTokenVerifier = createSupabaseAccessTokenVerifier({
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const ensureRouteInitialized = createLazyRouteInitializer();

app.use(express.json({ limit: "1mb" }));

pool.on("error", (error) => {
  console.error("💥 [Server/DB] 数据库连接池发生灾难性错误:", error);
});

function ensureDatabaseConfigured() {
  getRequiredServerEnv("DATABASE_URL");
}

function withRouteInitialization(
  ensureReady: () => Promise<void>,
  handler: RequestHandler,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await ensureReady();
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function ensureLibraryRouteReady() {
  return ensureRouteInitialized("library", async () => {
    ensureDatabaseConfigured();
    await ensureRecommenderItemsSchema(pool);
  });
}

function ensureKnowledgeRouteReady() {
  return ensureRouteInitialized("knowledge", async () => {
    ensureDatabaseConfigured();
    await ensureKnowledgeNebulaSchema(pool);
  });
}

function ensureFeedbackRouteReady() {
  return ensureRouteInitialized("feedback", async () => {
    ensureDatabaseConfigured();
    await ensureUserFeedbackSchema(pool);
  });
}

function ensureUserRecommendationRouteReady() {
  return ensureRouteInitialized("user-recommendation", async () => {
    ensureDatabaseConfigured();
    await ensureUserRecommendationSchema(pool);
  });
}

app.get("/api/recommender/toys", async (_req, res) => {
  console.log("📡 [Server] 收到全息库同步指令...");

  try {
    await ensureLibraryRouteReady();

    const result = await pool.query(`
      SELECT
        t.id, t.name, t.safe_display_name, t.price, t.max_db, t.waterproof,
        t.appearance, t.physical_form, t.motor_type, t.gender, t.type_code, t.subtype_code,
        t.brand, t.material, t.image_url, t.raw_description,
        COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description,
        p.link, p.tags, p.persona_\x61nalysis AS persona_analysis,
        c.is_domestic
      FROM public.recommender_toys t
      LEFT JOIN public.products p ON t.original_id = p.id
      LEFT JOIN public.competitors c ON p.competitor_id = c.id
      ORDER BY t.created_at DESC
    `);

    const normalized = result.rows.map((toy) => {
      const resolvedGender = resolveLibraryAudienceGender({
        gender: toy.gender,
        physicalForm: toy.physical_form,
        name: toy.name,
        rawDescription: [toy.raw_description, toy.product_raw_description]
          .filter(Boolean)
          .join("\n") || null,
        tags: Array.isArray(toy.tags) ? toy.tags : [],
      });
      const resolvedTypeCode = resolveLibraryTypeCode(toy.type_code, {
        gender: resolvedGender,
        physicalForm: toy.physical_form,
        name: toy.name,
        rawDescription: [toy.raw_description, toy.product_raw_description]
          .filter(Boolean)
          .join("\n") || null,
        tags: Array.isArray(toy.tags) ? toy.tags : [],
      });
      const resolvedSubtypeCode = resolveLibrarySubtypeCode(toy.subtype_code, {
        typeCode: resolvedTypeCode,
        gender: resolvedGender,
        physicalForm: toy.physical_form,
        name: toy.name,
        rawDescription: [toy.raw_description, toy.product_raw_description]
          .filter(Boolean)
          .join("\n") || null,
        tags: Array.isArray(toy.tags) ? toy.tags : [],
      });

      return {
        id: toy.id,
        name: toy.name,
        canonicalName: toy.name,
        displayName: toy.safe_display_name || buildSafeDisplayName(toy.name),
        safeDisplayName:
          toy.safe_display_name || buildSafeDisplayName(toy.name),
        price: Number(toy.price),
        maxDb: toy.max_db,
        waterproof: toy.waterproof,
        appearance: toy.appearance,
        physicalForm: toy.physical_form,
        motorType: toy.motor_type,
        gender: resolvedGender,
        typeCode: resolvedTypeCode,
        subtypeCode: resolvedSubtypeCode,
        brand: toy.brand || "探索品牌",
        material: toy.material || "亲肤材质",
        rawDescription:
          toy.raw_description || toy.product_raw_description || null,
        imagePlaceholder:
          toy.image_url || "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
        link: toy.link,
        sourceUrl: toy.link,
        tags: toy.tags || [],
        personaAnalysis: toy.persona_analysis,
        isDomestic: toy.is_domestic,
      };
    });

    console.log(`✅ [Server] 已同步 ${normalized.length} 条晶体库数据`);
    res.json(normalized);
  } catch (error) {
    console.error("❌ [Server] 数据库同步中断:", error);
    res.status(500).json({
      error: "Database synchronization failed",
      details: String(error),
    });
  }
});

app.post("/api/ai/rerank", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  try {
    const result = await appAiService.runServerAiProxy<unknown[]>({
      prompt,
      temperature: 0.1,
      emptyJson: "[]",
      logContext: "Top3 重排",
    });
    res.json(result);
  } catch (error) {
    console.error("❌ [Server/AI] Top3 重排链路全部中断:", error);
    res.status(500).json({ error: "AI rerank failed", details: String(error) });
  }
});

app.post("/api/ai/result-enhancement", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  try {
    const result = await appAiService.runServerAiProxy<Record<string, unknown>>({
      prompt,
      temperature: 0.3,
      emptyJson: "{}",
      logContext: "结果增强",
    });
    res.json(result);
  } catch (error) {
    console.error("❌ [Server/AI] 结果增强链路全部中断:", error);
    res.status(500).json({
      error: "AI result enhancement failed",
      details: String(error),
    });
  }
});

app.post("/api/ai/recalibrate-results", recalibrateResultsHandler);
app.post(
  "/api/auth/register",
  createUsernameRegistrationHandler({
    service: usernameRegistrationService,
  }),
);
app.get(
  "/api/knowledge/topics/:slug",
  withRouteInitialization(
    ensureKnowledgeRouteReady,
    createKnowledgeNebulaTopicHandler({ store: knowledgeNebulaStore }),
  ),
);
app.post(
  "/api/knowledge/topics/:slug/cards",
  withRouteInitialization(
    ensureKnowledgeRouteReady,
    createKnowledgeNebulaCreateCardHandler({ store: knowledgeNebulaStore }),
  ),
);
app.patch(
  "/api/knowledge/cards/:cardId",
  withRouteInitialization(
    ensureKnowledgeRouteReady,
    createKnowledgeNebulaUpdateCardHandler({ store: knowledgeNebulaStore }),
  ),
);
app.post(
  "/api/knowledge/cards/:cardId/view",
  withRouteInitialization(
    ensureKnowledgeRouteReady,
    createKnowledgeNebulaRecordCardViewHandler({ store: knowledgeNebulaStore }),
  ),
);
app.post(
  "/api/feedback",
  withRouteInitialization(
    ensureFeedbackRouteReady,
    createSaveUserFeedbackHandler({
      store: userFeedbackStore,
    }),
  ),
);
app.post(
  "/api/user/recommendation-profiles",
  withRouteInitialization(
    ensureUserRecommendationRouteReady,
    createSaveUserRecommendationProfileHandler({
      encryptionKey: process.env.PRIVATE_DATA_ENCRYPTION_KEY,
      jwtSecret: process.env.JWT_SECRET,
      authVerifier: supabaseAccessTokenVerifier,
      store: userRecommendationStore,
    }),
  ),
);
app.get(
  "/api/user/recommendation-profiles",
  withRouteInitialization(
    ensureUserRecommendationRouteReady,
    createListUserRecommendationProfilesHandler({
      encryptionKey: process.env.PRIVATE_DATA_ENCRYPTION_KEY,
      jwtSecret: process.env.JWT_SECRET,
      authVerifier: supabaseAccessTokenVerifier,
      store: userRecommendationStore,
    }),
  ),
);

export function ensureServerReady() {
  return Promise.resolve().then(() => {
    ensureDatabaseConfigured();
    console.log("🪐 [Server] 后端运行时配置已就绪");
  });
}

app.use(((error, _req, res, _next) => {
  console.error("💥 [Server] 路由初始化或处理中断:", error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: "Server request failed",
    details: error instanceof Error ? error.message : String(error),
  });
}) as RequestHandler);

export { app, pool };
