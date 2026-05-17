import assert from "node:assert/strict";
import test from "node:test";

import {
  inferLbdoMaterialFromRow,
  shouldRunLbdoMaterialBackfillScript,
} from "./backfill-lbdo-materials.ts";

test("inferLbdoMaterialFromRow recognizes water-based lubricant material", () => {
  assert.equal(
    inferLbdoMaterialFromRow({
      name: "Flow Water-Based",
      raw_description:
        "Natural water-based lubricant with organic aloe vera, pH balanced, toy-friendly.",
    }),
    "水基配方",
  );
});

test("inferLbdoMaterialFromRow recognizes translated water-based lubricant material", () => {
  assert.equal(
    inferLbdoMaterialFromRow({
      name: "Flow Water-Based",
      raw_description:
        "一种温和、pH平衡的润滑剂，专为自然、不粘腻的触感而设计。流动水基润滑剂兼容玩具和安全套。",
    }),
    "水基配方",
  );
});

test("inferLbdoMaterialFromRow recognizes massage candle material", () => {
  assert.equal(
    inferLbdoMaterialFromRow({
      name: "Melt",
      raw_description:
        "Massage candle made with shea butter, soy wax, jojoba oil and macadamia oil.",
    }),
    "大豆蜡/油脂复合",
  );
});

test("inferLbdoMaterialFromRow recognizes translated massage candle material", () => {
  assert.equal(
    inferLbdoMaterialFromRow({
      name: "Melt",
      raw_description:
        "采用全天然乳木果脂和大豆蜡制成，这款蜡烛融化后变成一滩温热而感性的按摩油，其中添加了滋润肌肤的荷荷巴和澳洲坚果油。",
    }),
    "大豆蜡/油脂复合",
  );
});

test("inferLbdoMaterialFromRow recognizes card game content material", () => {
  assert.equal(
    inferLbdoMaterialFromRow({
      name: "Journey Deeper: Intimacy Edition",
      raw_description:
        "A card game with 100 prompt cards designed to deepen intimacy and communication.",
    }),
    "纸质/数字内容",
  );
});

test("inferLbdoMaterialFromRow recognizes translated card game content material", () => {
  assert.equal(
    inferLbdoMaterialFromRow({
      name: "Journey Deeper: Intimacy Edition",
      raw_description:
        "一款亲密关系卡牌游戏。拥有100张精心策划的提示卡，帮助你们深入亲密与连接的深处。",
    }),
    "纸质/数字内容",
  );
});

test("shouldRunLbdoMaterialBackfillScript only matches direct execution", () => {
  assert.equal(
    shouldRunLbdoMaterialBackfillScript("file:///tmp/backfill-lbdo-materials.ts", "/tmp/backfill-lbdo-materials.ts"),
    true,
  );
  assert.equal(
    shouldRunLbdoMaterialBackfillScript("file:///tmp/backfill-lbdo-materials.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunLbdoMaterialBackfillScript("file:///tmp/backfill-lbdo-materials.ts"), false);
});
