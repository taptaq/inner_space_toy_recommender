import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APP_THEME_OPTIONS } from "../lib/app-theme.ts";

import {
  HomeAuthOverlay,
  HomePage,
  getHomeAuthOverlayFocusTrapTarget,
  planHomeFeedbackScreenshotSelection,
  restoreHomeAuthOverlayFocus,
} from "./HomePage.tsx";

const authPanel = {
  isConfigured: true,
  userLabel: null,
  statusMessage: null,
  isSubmitting: false,
  onSubmit: async () => {},
  onSignOut: async () => {},
};

function renderHomePage() {
  return renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={authPanel}
    />,
  );
}

function countMatches(input: string, pattern: RegExp) {
  return input.match(pattern)?.length ?? 0;
}

function collectElements(node: unknown): any[] {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      return node.flatMap((child) => collectElements(child));
    }

    return [];
  }

  const children = (node.props as { children?: unknown }).children;
  return [node, ...collectElements(children)];
}

test("home page prioritizes matching and demotes library and knowledge nebula entries", () => {
  const html = renderHomePage();

  assert.match(html, /开始匹配/);
  assert.match(html, /先随便看看装备库/);
  assert.match(html, /看看知识星云/);
  assert.match(html, /意见反馈/);
  assert.match(html, /先看真实装备参数、价格区间和筛选维度/);
  assert.match(html, /了解常见误区、参数怎么读/);
  assert.ok(html.indexOf("开始匹配") < html.indexOf("先随便看看装备库"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("看看知识星云"));
  assert.ok(html.indexOf("开始匹配") < html.indexOf("意见反馈"));
  assert.doesNotMatch(html, /浏览全息装备库/);
  assert.doesNotMatch(html, /进入知识星云/);
});

test("home page consolidates privacy reassurance into the auth entry", () => {
  const html = renderHomePage();

  assert.match(html, /登录后可加密保存推荐档案，支持多端同步，也可随时删除/);
  assert.doesNotMatch(html, /home-privacy-status/);
  assert.doesNotMatch(html, /登录后多端同步/);
  assert.doesNotMatch(html, /敏感偏好加密保存/);
  assert.doesNotMatch(html, /可随时删除推荐记录/);
  assert.doesNotMatch(html, /无需登录/);
  assert.doesNotMatch(html, /问卷进度保存在本机/);
});

test("home page keeps authentication as a lightweight entry instead of an inline form", () => {
  const html = renderHomePage();

  assert.match(html, /home-auth-entry/);
  assert.match(html, /登录 \/ 注册/);
  assert.match(html, /完成匹配后可加密保存/);
  assert.doesNotMatch(html, /placeholder="用户名"/);
  assert.doesNotMatch(html, /placeholder="密码"/);
  assert.doesNotMatch(html, /登录后保存推荐档案/);
});

test("home auth overlay exposes dialog semantics for keyboard-accessible dismissal", () => {
  const html = renderToStaticMarkup(
    <HomeAuthOverlay onClose={() => {}}>
      <div>auth content</div>
    </HomeAuthOverlay>,
  );

  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="home-auth-dialog-title"/);
  assert.match(html, /id="home-auth-dialog-title"/);
  assert.match(html, /auth content/);
});

test("home auth overlay supports escape-key dismissal through its dialog container", () => {
  let closeCount = 0;

  const elementTree = HomeAuthOverlay({
    onClose: () => {
      closeCount += 1;
    },
    onKeyDown: (event) => {
      if (event.key === "Escape") {
        closeCount += 1;
      }
    },
    children: <div>auth content</div>,
  });

  const elements = collectElements(elementTree);
  const dialog = elements.find((element) => element.props.role === "dialog");

  dialog.props.onKeyDown({ key: "Escape" });

  assert.equal(closeCount, 1);
});

test("home auth overlay focus trap helper loops at overlay boundaries", () => {
  assert.equal(
    getHomeAuthOverlayFocusTrapTarget({
      focusableCount: 3,
      currentIndex: 2,
      isShiftKey: false,
    }),
    0,
  );
  assert.equal(
    getHomeAuthOverlayFocusTrapTarget({
      focusableCount: 3,
      currentIndex: 0,
      isShiftKey: true,
    }),
    2,
  );
  assert.equal(
    getHomeAuthOverlayFocusTrapTarget({
      focusableCount: 3,
      currentIndex: 1,
      isShiftKey: false,
    }),
    null,
  );
});

test("home auth overlay focus restore helper safely restores when possible", () => {
  let focusCount = 0;

  assert.equal(
    restoreHomeAuthOverlayFocus({
      focus() {
        focusCount += 1;
      },
    }),
    true,
  );
  assert.equal(focusCount, 1);
  assert.equal(restoreHomeAuthOverlayFocus(null), false);
  assert.equal(restoreHomeAuthOverlayFocus({}), false);
});

test("home page renders an animated inner-space entry atmosphere", () => {
  const html = renderHomePage();

  assert.match(html, /home-space-depth/);
  assert.match(html, /home-orbit-core/);
  assert.match(html, /home-primary-ignition/);
  assert.match(html, /home-secondary-node/);
  assert.match(html, /w-\[100vw\]/);
  assert.doesNotMatch(html, /overflow-hidden rounded-\[2rem\]/);
});

test("home page background orbits render as refined trace lines instead of heavy plates", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(html, /home-space-orbit-a/);
  assert.match(html, /home-space-orbit-b/);
  assert.match(cssSource, /\.home-space-orbit::before/);
  assert.match(cssSource, /mask-image: linear-gradient/);
  assert.doesNotMatch(cssSource, /inset 0 34px 80px var\(--theme-glow\)/);
});

test("home page background now uses a real-space photo layer instead of only synthetic haze", () => {
  const html = renderHomePage();
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(html, /home-space-photo/);
  assert.match(html, /home-space-photo-veil/);
  assert.match(cssSource, /\.home-space-photo/);
  assert.match(cssSource, /\/assets\/home-cosmos\/inner-space-spiral\.jpg/);
  assert.match(cssSource, /\/assets\/home-cosmos\/soft-signal-rosette\.jpg/);
  assert.match(cssSource, /\/assets\/home-cosmos\/vector-pulse-cats-eye\.png/);
  assert.match(cssSource, /\/assets\/home-cosmos\/sync-field-arp273\.jpg/);
});

test("home page mobile layout keeps the photo atmosphere visible by scaling and lifting it upward", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /@media \(max-width: 640px\)/);
  assert.match(cssSource, /\.home-space-photo \{/);
  assert.match(cssSource, /scale\(0\.78\)/);
  assert.match(cssSource, /translate3d\(-8%, -12%, 0\)/);
});

test("home page ambient photo layers use layered motion instead of a static still background", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /\.home-space-photo\s*\{[\s\S]*animation: home-space-photo-float/);
  assert.match(cssSource, /\.home-space-photo-veil\s*\{[\s\S]*animation: home-space-veil-breathe/);
  assert.match(cssSource, /\.home-space-stars-a\s*\{[\s\S]*animation: home-space-drift-a[\s\S]*home-space-star-pulse/);
  assert.match(cssSource, /@keyframes home-space-veil-breathe/);
  assert.match(cssSource, /@keyframes home-space-star-pulse/);
});

test("home page theme atmospheres stay visible while each theme keeps its own motion cadence", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(cssSource, /:root\[data-theme="inner-space"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.36;/);
  assert.match(cssSource, /:root\[data-theme="soft-signal"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.31;/);
  assert.match(cssSource, /:root\[data-theme="vector-pulse"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.32;[\s\S]*--home-space-photo-size: contain;/);
  assert.match(cssSource, /:root\[data-theme="sync-field"\] \.home-space-depth \{[\s\S]*--home-space-photo-opacity: 0\.31;[\s\S]*--home-space-photo-size: contain;/);
  assert.match(cssSource, /:root\[data-theme="inner-space"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 24s;[\s\S]*--home-space-veil-duration: 19s;[\s\S]*--home-space-star-pulse-duration: 10\.5s;/);
  assert.match(cssSource, /:root\[data-theme="soft-signal"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 29s;[\s\S]*--home-space-veil-duration: 23s;[\s\S]*--home-space-star-pulse-duration: 12\.5s;/);
  assert.match(cssSource, /:root\[data-theme="vector-pulse"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 18s;[\s\S]*--home-space-veil-duration: 15\.5s;[\s\S]*--home-space-star-pulse-duration: 8\.2s;/);
  assert.match(cssSource, /:root\[data-theme="sync-field"\] \.home-space-depth \{[\s\S]*--home-space-photo-float-duration: 21s;[\s\S]*--home-space-veil-duration: 17\.5s;[\s\S]*--home-space-star-pulse-duration: 9\.4s;/);
  assert.match(cssSource, /\.home-space-depth \{[\s\S]*rgba\(2, 6, 23, 0\.42\)\);/);
  assert.match(cssSource, /\.home-space-photo \{[\s\S]*width: min\(70rem, 66vw\);[\s\S]*background-size: var\(--home-space-photo-size\);[\s\S]*mix-blend-mode: screen;/);
  assert.match(cssSource, /\.home-space-photo\s*\{[\s\S]*animation: home-space-photo-float var\(--home-space-photo-float-duration\)/);
  assert.match(cssSource, /\.home-space-photo-veil\s*\{[\s\S]*animation: home-space-veil-breathe var\(--home-space-veil-duration\)/);
  assert.match(cssSource, /\.home-space-stars-a\s*\{[\s\S]*home-space-star-pulse var\(--home-space-star-pulse-duration\)/);
});

test("home page secondary entry buttons do not render oversized hover halos", () => {
  const cssSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.doesNotMatch(cssSource, /\.home-secondary-node::after/);
  assert.doesNotMatch(cssSource, /\.home-secondary-node:hover::after/);
  assert.doesNotMatch(cssSource, /\.home-secondary-node:focus-within::after/);
});

test("home page keeps ambient layers grouped behind stable semantic anchor nodes", () => {
  const html = renderHomePage();

  assert.equal(countMatches(html, /home-space-stars-a/g), 1);
  assert.equal(countMatches(html, /home-space-stars-b/g), 1);
  assert.equal(countMatches(html, /class="home-space-photo"/g), 1);
  assert.equal(countMatches(html, /home-space-orbit-offset/g), 1);
  assert.equal(countMatches(html, /home-space-comet/g), 1);
  assert.equal(countMatches(html, /home-panel-scan/g), 1);
  assert.equal(countMatches(html, /home-primary-ignition/g), 1);
});

test("home page keeps a focused hero shell with a single primary action and compact orbit scene", () => {
  const html = renderHomePage();

  assert.equal(countMatches(html, /home-orbit-core/g), 1);
  assert.equal(countMatches(html, /home-primary-ignition/g), 1);
  assert.equal(countMatches(html, /glass-panel/g), 2);
  assert.match(html, /内太空装备智能选品向导/);
  assert.match(html, /SELECTION GUIDE/);
  assert.match(html, /开始匹配/);
  assert.ok(countMatches(html, /<button/g) >= 4);
});

test("home page keeps secondary entry navigation and auth actions structurally distinct", () => {
  const signedOutHtml = renderHomePage();
  const signedInHtml = renderToStaticMarkup(
    <HomePage
      pageVariants={{}}
      onStart={() => {}}
      onBrowseLibrary={() => {}}
      onOpenKnowledgeNebula={() => {}}
      onOpenProfiles={() => {}}
      themeId="inner-space"
      onThemeChange={() => {}}
      authPanel={{ ...authPanel, userLabel: "taptaq" }}
    />,
  );

  assert.equal(countMatches(signedOutHtml, /home-secondary-node/g), 3);
  assert.equal(countMatches(signedOutHtml, /home-auth-entry/g), 1);
  assert.match(signedOutHtml, /登录 \/ 注册/);
  assert.doesNotMatch(signedOutHtml, /匹配档案/);
  assert.doesNotMatch(signedOutHtml, />退出</);

  assert.equal(countMatches(signedInHtml, /home-secondary-node/g), 3);
  assert.equal(countMatches(signedInHtml, /home-auth-entry/g), 1);
  assert.match(signedInHtml, /匹配档案/);
  assert.match(signedInHtml, />退出</);
  assert.match(signedInHtml, /taptaq/);
});

test("home page exposes four audience-aware theme options and marks the active one", () => {
  const html = renderHomePage();

  assert.match(html, /主题风格/);
  for (const option of APP_THEME_OPTIONS) {
    assert.match(html, new RegExp(option.label));
  }
  assert.match(html, /aria-pressed="true"[^>]*>[\s\S]*深空/);
});

test("home page feedback screenshot planning respects reserved capacity and reports validation issues", () => {
  const planned = planHomeFeedbackScreenshotSelection({
    currentCount: 1,
    reservedCount: 1,
    selectedTypes: ["image/png", "image/gif", "image/jpeg", "image/webp"],
  });

  assert.deepEqual(planned.acceptedIndexes, [0]);
  assert.equal(planned.invalidTypeCount, 1);
  assert.equal(planned.overflowCount, 2);
  assert.equal(planned.remainingCapacity, 1);
  assert.equal(planned.nextReservedCount, 2);
  assert.equal(planned.hasInvalidTypeError, true);
  assert.equal(planned.hasOverflowError, true);
});

test("home page feedback screenshot planning blocks additions when capacity is already reserved", () => {
  const planned = planHomeFeedbackScreenshotSelection({
    currentCount: 2,
    reservedCount: 1,
    selectedTypes: ["image/png"],
  });

  assert.deepEqual(planned.acceptedIndexes, []);
  assert.equal(planned.remainingCapacity, 0);
  assert.equal(planned.overflowCount, 1);
  assert.equal(planned.hasOverflowError, true);
});

test("home page keeps feedback entry rendered without mounting the modal content by default", () => {
  const html = renderHomePage();

  assert.match(html, /意见反馈/);
  assert.doesNotMatch(html, /反馈内容/);
  assert.doesNotMatch(html, /截图上传（可选，最多 3 张）/);
});
