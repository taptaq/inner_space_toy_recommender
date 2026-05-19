import assert from "node:assert/strict";
import test from "node:test";

import { parseNaturalLanguageRecommendationIntent } from "./recommendation-natural-language-intent.ts";

test("parseNaturalLanguageRecommendationIntent builds must and avoid signals for explicit suction and exclusions", () => {
  const intent = parseNaturalLanguageRecommendationIntent(
    "想要一个吮吸器，不要入体，不要APP，也不要情侣款。",
  );

  assert.equal(intent.must.suctionProduct, true);
  assert.equal(intent.must.externalOnly, true);
  assert.equal(intent.avoid.insertable, true);
  assert.equal(intent.avoid.appOrRemote, true);
  assert.equal(intent.avoid.couple, true);
});

test("parseNaturalLanguageRecommendationIntent separates strong suction from pattern and gentle preferences", () => {
  const intent = parseNaturalLanguageRecommendationIntent(
    "我是女生，想要吮吸感更强一点，波形更多一点，温和一点，噪音适中。",
  );

  assert.equal(intent.must.suctionProduct, true);
  assert.equal(intent.prefer.strongSuction, true);
  assert.equal(intent.prefer.morePatterns, true);
  assert.equal(intent.prefer.moderateNoise, true);
  assert.equal(intent.prefer.gentleIntensity, true);
  assert.equal(intent.avoid.strongIntensity, true);
});
