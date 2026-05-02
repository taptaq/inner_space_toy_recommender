import { createClient, type Session } from "@supabase/supabase-js";

type SupabaseAuthEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

type SupabaseAuthClient = ReturnType<typeof createClient>;

let cachedClient: SupabaseAuthClient | null = null;
const INTERNAL_AUTH_EMAIL_DOMAIN = "users.inner-space.com";

function readRuntimeEnv(): SupabaseAuthEnv {
  return ((import.meta as ImportMeta & { env?: SupabaseAuthEnv }).env ?? {}) as SupabaseAuthEnv;
}

export function getSupabaseAuthConfig(env: SupabaseAuthEnv = readRuntimeEnv()) {
  return {
    url: (env.VITE_SUPABASE_URL ?? "").trim(),
    anonKey: (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim(),
  };
}

export function isSupabaseAuthConfigured(env: SupabaseAuthEnv = readRuntimeEnv()) {
  const config = getSupabaseAuthConfig(env);
  return Boolean(config.url && config.anonKey);
}

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getSupabaseAuthConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

export function buildInternalAuthEmailFromUsername(username: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const usernameHex = Array.from(normalizedUsername)
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `u_${usernameHex}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}

export function getReadableSupabaseAuthErrorMessage(
  mode: "signup" | "signin",
  message: string,
) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("email not confirmed")) {
    return "这个用户名对应的内部账号还处于未确认状态。请到 Supabase Auth > Users 删除该账号后重新注册，或直接换一个新用户名。";
  }

  if (normalizedMessage.includes("user already registered")) {
    return mode === "signup"
      ? "用户名已被占用，请换一个新的用户名。"
      : "这个用户名已经存在，但当前密码不匹配。";
  }

  if (
    normalizedMessage.includes("email rate limit exceeded") ||
    normalizedMessage.includes("over_email_send_rate_limit")
  ) {
    return "注册邮件触发过于频繁，Supabase 暂时限流了。请先到 Supabase Auth > Users 删除这个用户名对应的内部账号后再试，或换一个全新的用户名。";
  }

  return message;
}

export async function registerUsernamePassword({
  username,
  password,
  fetcher = fetch,
}: {
  username: string;
  password: string;
  fetcher?: typeof fetch;
}) {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password.trim()) {
    throw new Error("请先填写用户名和密码。");
  }

  const response = await fetcher("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: normalizedUsername,
      password,
    }),
  });

  const result = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      getReadableSupabaseAuthErrorMessage(
        "signup",
        result?.error || "注册失败，请稍后重试",
      ),
    );
  }

  return { success: true };
}

export async function signInWithUsernamePassword(username: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase 登录配置缺失，请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  const email = buildInternalAuthEmailFromUsername(username);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      getReadableSupabaseAuthErrorMessage(
        "signin",
        error.message || "登录失败，请检查用户名和密码",
      ),
    );
  }
  return data;
}

export async function signOutOfSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message || "退出登录失败，请稍后重试");
  }
}

export async function getCurrentSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    return null;
  }
  return data.session;
}

export function onSupabaseAuthStateChange(
  listener: (session: Session | null) => void,
) {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
