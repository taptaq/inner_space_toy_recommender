export function getRequiredServerEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required server env: ${name}`);
  }

  return value;
}

export function createLazyRouteInitializer() {
  const pending = new Map<string, Promise<void>>();

  return function ensureInitialized(
    key: string,
    initialize: () => Promise<void>,
  ) {
    const existing = pending.get(key);
    if (existing) {
      return existing;
    }

    const promise = Promise.resolve()
      .then(initialize)
      .catch((error) => {
        pending.delete(key);
        throw error;
      });

    pending.set(key, promise);
    return promise;
  };
}
