import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { HomePage } from "./HomePage.tsx";

const authPanel = {
  isConfigured: true,
  userLabel: null,
  statusMessage: null,
  isSubmitting: false,
  onSubmit: async () => {},
  onSignOut: async () => {},
};

test("home page prioritizes matching and demotes library and knowledge nebula entries", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /开始匹配/);
  assert.match(html, /先随便看看装备库/);
  assert.match(html, /看看知识星云/);
  assert.match(html, /先看真实装备参数、价格区间和筛选维度/);
  assert.match(html, /了解常见误区、参数怎么读/);
  assert.ok(html.indexOf("开始匹配") < html.indexOf("先随便看看装备库"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("看看知识星云"));
  assert.doesNotMatch(html, /浏览全息装备库/);
  assert.doesNotMatch(html, /进入知识星云/);
});

test("home page consolidates privacy reassurance into the auth entry", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /登录后可加密保存推荐档案，支持多端同步，也可随时删除/);
  assert.doesNotMatch(html, /home-privacy-status/);
  assert.doesNotMatch(html, /登录后多端同步/);
  assert.doesNotMatch(html, /敏感偏好加密保存/);
  assert.doesNotMatch(html, /可随时删除推荐记录/);
  assert.doesNotMatch(html, /无需登录/);
  assert.doesNotMatch(html, /问卷进度保存在本机/);
});

test("home page keeps authentication as a lightweight entry instead of an inline form", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /home-auth-entry/);
  assert.match(html, /登录 \/ 注册/);
  assert.match(html, /完成匹配后可加密保存/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
  assert.doesNotMatch(html, /登录后保存推荐档案/);
});

test("home page renders an animated inner-space entry atmosphere", () => {
  const html = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      authPanel={authPanel}
    />,
  );

  assert.match(html, /home-space-depth/);
  assert.match(html, /home-orbit-core/);
  assert.match(html, /home-primary-ignition/);
  assert.match(html, /home-secondary-node/);
  assert.match(html, /w-\[100vw\]/);
  assert.doesNotMatch(html, /overflow-hidden rounded-\[2rem\]/);
});

test("home page trims secondary ambient layers on mobile to protect smoothness", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.home-space-stars-b\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.home-space-comet\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.home-space-orbit-offset\s*\{[\s\S]*display:\s*none;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.home-panel-scan\s*\{[\s\S]*animation:\s*none\s*!important;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.home-primary-ignition::after\s*\{[\s\S]*animation:\s*none\s*!important;/,
  );
});

test("home page keeps a more compact mobile-first shell without losing the main action", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(source, /className="relative mb-9 flex items-center justify-center sm:mb-12"/);
  assert.match(source, /h-28 w-28 rounded-full border border-cyan-500\/20/);
  assert.match(source, /sm:h-32 sm:w-32/);
  assert.match(source, /h-36 w-36 rounded-full border border-indigo-500\/20 border-dashed/);
  assert.match(source, /sm:h-40 sm:w-40/);
  assert.match(source, /home-orbit-core relative z-10 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full glass-panel/);
  assert.match(source, /sm:h-20 sm:w-20/);
  assert.match(source, /glass-panel relative flex w-full flex-col items-center overflow-hidden rounded-\[1\.75rem\] p-6 text-center/);
  assert.match(source, /sm:rounded-3xl sm:p-8/);
  assert.match(source, /relative mb-2 text-2xl font-light tracking-\[0\.22em\] text-white/);
  assert.match(source, /sm:text-3xl sm:tracking-widest/);
  assert.match(source, /relative mb-7 font-mono text-\[11px\] tracking-\[0\.28em\] text-cyan-500\/80/);
  assert.match(source, /sm:mb-8 sm:text-xs sm:tracking-widest/);
  assert.match(source, /relative mb-8 max-w-\[19rem\] text-sm leading-7 text-slate-300/);
  assert.match(source, /sm:mb-10 sm:max-w-\[300px\]/);
});

test("home page stacks secondary entries and auth actions more comfortably on mobile", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/HomePage.tsx"),
    "utf8",
  );

  assert.match(source, /home-secondary-node group relative inline-flex w-full sm:w-auto/);
  assert.match(source, /relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white\/8 bg-white\/\[0\.035\] px-4 py-2 text-xs tracking-wider text-slate-300/);
  assert.match(source, /sm:w-auto/);
  assert.match(source, /home-auth-entry mt-5 flex w-full flex-col gap-3 rounded-2xl border border-cyan-300\/12 bg-cyan-400\/\[0\.035\] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between/);
  assert.match(source, /className="shrink-0 rounded-full border border-cyan-300\/18 bg-cyan-300\/9 px-4 py-2 text-xs tracking-wider text-cyan-50 transition-colors hover:border-cyan-200\/34 hover:bg-cyan-300\/14 sm:w-auto"/);
  assert.match(source, /className="home-auth-entry mt-5 flex w-full flex-col gap-3 rounded-2xl border border-emerald-300\/12 bg-emerald-400\/\[0\.045\] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"/);
  assert.match(source, /className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap"/);
});
