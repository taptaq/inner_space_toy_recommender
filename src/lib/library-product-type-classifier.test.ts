import assert from "node:assert/strict";
import test from "node:test";

import { classifyLibraryTypeCode } from "./library-product-type-classifier.ts";

test("classifyLibraryTypeCode recognizes suction products from external female signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "female",
      physicalForm: "external",
      name: "Womanizer Liberty",
      rawDescription: "气脉冲吸感，外部刺激设备",
      tags: [],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode recognizes prostate products from male text signals", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "internal",
      name: "前列腺按摩器",
      rawDescription: "P-spot 定向刺激",
      tags: [],
    }),
    "prostate",
  );
});

test("classifyLibraryTypeCode recognizes unisex remote wearable products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "情侣远控穿戴器",
      rawDescription: "双人共玩，app 远程控制，可穿戴",
      tags: ["情侣", "远控"],
    }),
    "wearable_remote",
  );
});

test("classifyLibraryTypeCode normalizes historical enum casing and whitespace", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: " Female ",
      physicalForm: " External ",
      name: "Womanizer Liberty",
      rawDescription: "air pulse suction for external stimulation",
      tags: [],
    }),
    "suction",
  );
});

test("classifyLibraryTypeCode avoids broad ring false positives for male cup products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "internal",
      name: "Cup Pro",
      rawDescription: "环绕包裹通道，masturbator cup design",
      tags: [],
    }),
    "masturbator",
  );
});

test("classifyLibraryTypeCode keeps remote-only unisex toys out of wearable_remote", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "情侣远控器",
      rawDescription: "支持 app 远程控制，双人互动氛围更强",
      tags: ["情侣"],
    }),
    "couples",
  );
});

test("classifyLibraryTypeCode avoids bare app false positives for unisex products", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: "external",
      name: "Starter Toy",
      rawDescription: "applicable to beginners and easy to clean",
      tags: [],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode avoids collapsing generic anal items into prostate", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "male",
      physicalForm: "internal",
      name: "肛珠入门套装",
      rawDescription: "Anal beads for beginners",
      tags: [],
    }),
    "unknown",
  );
});

test("classifyLibraryTypeCode falls back to unknown when signals are too weak", () => {
  assert.equal(
    classifyLibraryTypeCode({
      gender: "unisex",
      physicalForm: null,
      name: "探索系列",
      rawDescription: null,
      tags: [],
    }),
    "unknown",
  );
});
