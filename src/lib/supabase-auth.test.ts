import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInternalAuthEmailFromUsername,
  getSupabaseAuthConfig,
  getReadableSupabaseAuthErrorMessage,
  isSupabaseAuthConfigured,
  registerUsernamePassword,
} from "./supabase-auth.ts";

test("isSupabaseAuthConfigured requires both url and anon key", () => {
  assert.equal(
    isSupabaseAuthConfigured({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "anon-key",
    }),
    true,
  );

  assert.equal(
    isSupabaseAuthConfigured({
      VITE_SUPABASE_URL: "https://example.supabase.co",
    }),
    false,
  );
});

test("getSupabaseAuthConfig trims configured values", () => {
  assert.deepEqual(
    getSupabaseAuthConfig({
      VITE_SUPABASE_URL: " https://example.supabase.co ",
      VITE_SUPABASE_PUBLISHABLE_KEY: " anon-key ",
    }),
    {
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    },
  );
});

test("buildInternalAuthEmailFromUsername hides the raw username behind a stable synthetic email", () => {
  assert.equal(
    buildInternalAuthEmailFromUsername("  Nebula_User  "),
    "u_6e6562756c615f75736572@users.inner-space.com",
  );
});

test("getReadableSupabaseAuthErrorMessage explains unconfirmed hidden-email accounts in Chinese", () => {
  assert.equal(
    getReadableSupabaseAuthErrorMessage("signin", "Email not confirmed"),
    "这个用户名对应的内部账号还处于未确认状态。请到 Supabase Auth > Users 删除该账号后重新注册，或直接换一个新用户名。",
  );
});

test("getReadableSupabaseAuthErrorMessage maps duplicate users to username conflict wording", () => {
  assert.equal(
    getReadableSupabaseAuthErrorMessage("signup", "User already registered"),
    "用户名已被占用，请换一个新的用户名。",
  );
});

test("getReadableSupabaseAuthErrorMessage explains email send rate limits in Chinese", () => {
  assert.equal(
    getReadableSupabaseAuthErrorMessage("signup", "email rate limit exceeded"),
    "注册邮件触发过于频繁，Supabase 暂时限流了。请先到 Supabase Auth > Users 删除这个用户名对应的内部账号后再试，或换一个全新的用户名。",
  );
});

test("registerUsernamePassword calls the server-side registration endpoint", async () => {
  let captured: unknown;

  const result = await registerUsernamePassword({
    username: "taptaq",
    password: "secret-pass",
    fetcher: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ success: true }),
      } as Response;
    },
  });

  assert.deepEqual(result, { success: true });
  assert.match(JSON.stringify(captured), /\/api\/auth\/register/);
  assert.match(JSON.stringify(captured), /taptaq/);
});
