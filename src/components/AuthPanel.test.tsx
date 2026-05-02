import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthPanel } from "./AuthPanel.tsx";

test("auth panel keeps inputs editable even before supabase config is ready", () => {
  const html = renderToStaticMarkup(
    <AuthPanel
      isConfigured={false}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(html, /需要配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY 后才能完成登录或注册/);
  assert.match(html, /type="text"/);
  assert.match(html, /type="password"/);
  assert.doesNotMatch(html, /type="text"[^>]*disabled=""/);
  assert.doesNotMatch(html, /type="password"[^>]*disabled=""/);
  assert.match(html, /type="submit"[^>]*disabled/);
});

test("auth panel uses username wording instead of email wording", () => {
  const html = renderToStaticMarkup(
    <AuthPanel
      isConfigured={true}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(html, /用户名/);
  assert.doesNotMatch(html, /邮箱/);
});

test("auth panel modal surface is opaque instead of glassy", () => {
  const html = renderToStaticMarkup(
    <AuthPanel
      isConfigured={true}
      userLabel={null}
      statusMessage={null}
      isSubmitting={false}
      surface="modal"
      onSubmit={async () => {}}
      onSignOut={async () => {}}
    />,
  );

  assert.match(html, /auth-panel-modal/);
  assert.match(html, /bg-slate-950/);
  assert.doesNotMatch(html, /bg-cyan-400\/\[/);
});
