import type { AppAiProvider } from "../lib/app-ai-chain";

type ProviderMap<T> = Record<AppAiProvider, () => Promise<T>>;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  provider: AppAiProvider,
) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${provider} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export async function runAppAiProviderLadder<T>({
  providerOrder,
  providers,
  onProviderError,
  providerTimeoutMs,
}: {
  providerOrder: readonly AppAiProvider[];
  providers: ProviderMap<T>;
  onProviderError?: (provider: AppAiProvider, error: unknown) => void;
  providerTimeoutMs?: number;
}) {
  let lastError: unknown;

  for (const provider of providerOrder) {
    try {
      return await withTimeout(providers[provider](), providerTimeoutMs, provider);
    } catch (error) {
      lastError = error;
      onProviderError?.(provider, error);
    }
  }

  throw lastError ?? new Error("No provider available");
}
