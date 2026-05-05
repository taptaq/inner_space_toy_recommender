import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Product } from "../data/mock.ts";
import { LibraryPage } from "./LibraryPage.tsx";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Test Brand",
    material: "硅胶",
    imagePlaceholder: "",
    link: null,
    sourceUrl: null,
    tags: [],
    ...overrides,
  };
}

test("library page keeps primary filters visible and moves admin-like filters behind advanced entry", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct()]}
      filterGender="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(html, /适用对象/);
  assert.match(html, /价格区间/);
  assert.match(html, /静音阈值/);
  assert.match(html, /高级筛选/);
  assert.doesNotMatch(html, /品牌厂商/);
  assert.doesNotMatch(html, /出品地区/);
  assert.doesNotMatch(html, /材质偏好/);
});

test("library page keeps a calmer mobile-first shell and lighter filter density", () => {
  const source = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct()]}
      filterGender="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(source, /p-4/);
  assert.match(source, /sm:p-6 md:p-8/);
  assert.match(source, /relative z-10 w-full max-w-5xl pb-20/);
  assert.match(source, /sm:pb-24/);
  assert.match(source, /text-center mb-8 sm:mb-10/);
  assert.match(source, /text-2xl font-light tracking-\[0\.2em\] text-white mb-2 sm:text-3xl sm:tracking-widest/);
  assert.match(source, /glass-panel rounded-\[1\.35rem\] p-4 mb-8 border border-white\/5 bg-white\/5 sm:rounded-2xl sm:p-6 sm:mb-10/);
  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:gap-6 md:grid-cols-3/);
  assert.match(source, /mt-4 border-t border-white\/8 pt-4 sm:mt-5/);
  assert.match(source, /mt-4/);
  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:gap-6 md:grid-cols-3/);
});

test("library page product grid and back-to-top affordance stay mobile-friendly", () => {
  const source = renderToStaticMarkup(
    <LibraryPage
      allProducts={[makeProduct(), makeProduct({ id: "p2", name: "Second Product" })]}
      filterGender="all"
      filterBrand="all"
      filterOrigin="all"
      filterMaterial="all"
      filterPriceRange="all"
      filterMaxDb={70}
      isLoading={false}
      error={null}
      onReload={() => {}}
      onFilterGenderChange={() => {}}
      onFilterBrandChange={() => {}}
      onFilterOriginChange={() => {}}
      onFilterMaterialChange={() => {}}
      onFilterPriceRangeChange={() => {}}
      onFilterMaxDbChange={() => {}}
      onBack={() => {}}
    />,
  );

  assert.match(source, /grid grid-cols-1 gap-4/);
  assert.match(source, /sm:grid-cols-2 sm:gap-6 lg:grid-cols-3/);
  assert.match(source, /glass-panel rounded-\[1\.35rem\] overflow-hidden flex flex-col group hover:border-cyan-500\/40 transition-all hover:bg-white\/5 sm:rounded-2xl/);
  assert.match(source, /fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full/);
  assert.match(source, /sm:bottom-8 sm:right-8/);
});
