import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BodyPersonaResultPanel } from "./BodyPersonaResultPanel.tsx";

test("BodyPersonaResultPanel shows free summary before unlock", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaResultPanel
      status="completed_free"
      freeSummary={{
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先低存在感路线"],
      }}
      fullReport={null}
      onUnlock={() => undefined}
      isUnlocking={false}
    />,
  );

  assert.match(html, /星幕型·隐秘安全感者/);
  assert.match(html, /优先低存在感路线/);
  assert.match(html, /解锁完整身体人格报告/);
});

test("BodyPersonaResultPanel shows unlocked report details", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaResultPanel
      status="unlocked"
      freeSummary={{
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先低存在感路线"],
      }}
      fullReport={{
        title: "星幕型·隐秘安全感者",
        portrait: "完整画像",
        hiddenRouteSummary: "日常器物型，隐藏力 S，共居安心度 高",
        goodFits: ["更适合低存在感路线"],
        avoidNotes: ["暂不优先高噪音路线"],
        productPicks: [{ id: "p1", name: "Quiet Orbit", score: 95, personaScore: 103 }],
      }}
      onUnlock={() => undefined}
      isUnlocking={false}
    />,
  );

  assert.match(html, /完整画像/);
  assert.match(html, /隐藏力 S/);
  assert.match(html, /Quiet Orbit/);
  assert.doesNotMatch(html, /解锁完整身体人格报告/);
});
