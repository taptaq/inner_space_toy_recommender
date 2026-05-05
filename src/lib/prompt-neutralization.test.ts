import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

test("model-facing prompts no longer use retired high-risk wording", () => {
  const files = [
    "src/server/app-ai-service.ts",
    "src/App.tsx",
    "src/scraper/svakom-official/crawler.ts",
    "src/scraper/zalo-official/crawler.ts",
    "src/scraper/wevibe-official/cleaner.ts",
    "src/scraper/lovense-official/cleaner.ts",
    "src/scraper/nomitang-official/cleaner.ts",
    "src/scraper/lelo/cleaner.ts",
  ];

  for (const file of files) {
    const source = read(file);

    assert.doesNotMatch(source, /性健康装备选品专家/);
    assert.doesNotMatch(source, /情趣用品详情图识别助手/);
    assert.doesNotMatch(source, /情趣硬件参数的数据拆解机器人/);
    assert.doesNotMatch(source, /情趣玩具商品/);
    assert.doesNotMatch(source, /产品定位\/玩法/);
    assert.doesNotMatch(source, /肛玩/);
    assert.doesNotMatch(source, /\\u60c5\\u8da3电商品牌数据清洗助手/);
    assert.doesNotMatch(source, /情趣电商品牌数据清洗助手/);
  }
});

test("approved prompt files use the new neutral wording", () => {
  const serverPromptSource = read("src/server/app-ai-service.ts");
  const appPromptSource = read("src/App.tsx");
  const svakomOcrSource = read("src/scraper/svakom-official/crawler.ts");
  const zaloOcrSource = read("src/scraper/zalo-official/crawler.ts");
  const leloCleanerSource = read("src/scraper/lelo/cleaner.ts");
  const lovenseCleanerSource = read("src/scraper/lovense-official/cleaner.ts");
  const nomitangCleanerSource = read("src/scraper/nomitang-official/cleaner.ts");

  assert.match(serverPromptSource, /个人护理设备选品助手/);
  assert.match(appPromptSource, /个人护理设备选品助手/);
  assert.match(svakomOcrSource, /个人护理用品详情图识别助手/);
  assert.match(zaloOcrSource, /产品定位\/使用方式/);
  assert.match(leloCleanerSource, /个人护理设备参数的数据拆解助手/);
  assert.match(lovenseCleanerSource, /特定使用场景商品/);
  assert.match(nomitangCleanerSource, /特定使用场景商品/);
});
