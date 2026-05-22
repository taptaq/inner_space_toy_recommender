import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompetitorCountryPatch,
  normalizeCompetitorCountry,
} from "./clean-competitor-country-fields.ts";

test("normalizeCompetitorCountry unifies mixed Chinese and English country names", () => {
  assert.equal(normalizeCompetitorCountry("中国"), "China");
  assert.equal(normalizeCompetitorCountry("美国"), "USA");
  assert.equal(normalizeCompetitorCountry("德国"), "Germany");
  assert.equal(normalizeCompetitorCountry("英国"), "United Kingdom");
  assert.equal(normalizeCompetitorCountry("日本"), "Japan");
  assert.equal(normalizeCompetitorCountry("加拿大"), "Canada");
  assert.equal(normalizeCompetitorCountry("法国"), "France");
  assert.equal(normalizeCompetitorCountry("瑞典"), "Sweden");
  assert.equal(normalizeCompetitorCountry("Germany"), "Germany");
  assert.equal(normalizeCompetitorCountry(""), null);
});

test("buildCompetitorCountryPatch fills blanks from explicit brand overrides", () => {
  assert.deepEqual(
    buildCompetitorCountryPatch({
      id: "1",
      name: "Arcwave",
      country: null,
      is_domestic: false,
      domain: "www.arcwave.com",
    }),
    {
      id: "1",
      nextCountry: "Germany",
      previousCountry: null,
    },
  );

  assert.deepEqual(
    buildCompetitorCountryPatch({
      id: "2",
      name: "醉清风-谜姬",
      country: null,
      is_domestic: true,
      domain: "https://www.zuiqingfeng.com",
    }),
    {
      id: "2",
      nextCountry: "China",
      previousCountry: null,
    },
  );
});

test("buildCompetitorCountryPatch returns null when country is already normalized", () => {
  assert.equal(
    buildCompetitorCountryPatch({
      id: "3",
      name: "POPOCAT",
      country: "China",
      is_domestic: true,
      domain: "popocat.tmall.com",
    }),
    null,
  );
});
