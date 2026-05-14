import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BodyPersonaFullReportDialog } from "./BodyPersonaFullReportDialog.tsx";

test("BodyPersonaFullReportDialog renders hero, hidden route, and product matches", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaFullReportDialog
      isOpen
      onClose={() => undefined}
      report={{
        reportTitle: "完整星系人格档案",
        personaName: "隐私安全型",
        personaSubtitle: "隐私安全型 · M104 草帽星系",
        personaManifesto: "你不是退缩，你只是更需要边界清晰的靠近方式。",
        personaImageAsset: null,
        primaryPersonaCode: "starlit_guard",
        secondaryPersonaCode: "soft_glow",
        secondaryPersonaName: "慢热探索型",
        hiddenRouteCode: "daily_object",
        hiddenRouteName: "日常器物型",
        hiddenPowerGrade: "S",
        coLivingComfortGrade: "high",
        portraitShort: "短描述",
        portraitLong: "长描述",
        whyYouAreThis: "形成原因",
        strengthTags: ["边界清晰"],
        growthTip: "成长建议",
        dimensionBreakdown: [
          { id: "privacy_need", label: "隐私需求", score: 95, summary: "很高" },
        ],
        hiddenRouteSummaryShort: "短隐藏路线",
        hiddenRouteSummaryLong: "长隐藏路线",
        disguisePreference: "更偏好伪装",
        storagePreference: "优先易收纳",
        privacyNeedLevel: "高",
        bestRouteSummary: "最适合路线",
        goodFits: ["低存在感路线"],
        avoidNotes: ["高存在感路线"],
        sceneMatches: ["同住环境"],
        paceAdvice: ["先低压进入"],
        parameterFocus: ["优先看静音"],
        topCategoryMatches: [
          {
            id: "external_vibe",
            label: "低存在感路线",
            fitScore: 92,
            reason: "更安心",
          },
        ],
        pickReasonSummary: "匹配原因总结",
        mismatchWarnings: ["别先看高噪音路线"],
        productPicks: [
          {
            id: "demo-1",
            name: "演示产品",
            score: 88,
            personaScore: 96,
            reason: "更适合你",
          },
        ],
        title: "隐私安全型",
        portrait: "长描述",
        hiddenRouteSummary: "长隐藏路线",
      }}
    />,
  );

  assert.match(html, /完整星系人格档案/);
  assert.match(html, /隐私安全型 · M104 草帽星系/);
  assert.match(html, /日常器物型/);
  assert.match(html, /优先看静音/);
  assert.match(html, /演示产品/);
});
