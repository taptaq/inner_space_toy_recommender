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
