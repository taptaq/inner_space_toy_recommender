import fs from 'fs';
import path from 'path';

type LovehoneySessionEnv = {
  LOVEHONEY_STORAGE_STATE_PATH?: string;
  LOVEHONEY_COOKIE?: string;
};

type SessionDeps = {
  existsSync?: (targetPath: string) => boolean;
};

export type LovehoneySessionBootstrap = {
  storageStatePath: string;
  cookieHeader: string;
  source: 'storage-state' | 'cookie' | 'none';
};

export function resolveLovehoneySessionBootstrap(
  env: LovehoneySessionEnv,
  deps: SessionDeps = {},
): LovehoneySessionBootstrap {
  const existsSync = deps.existsSync || fs.existsSync;
  const rawStorageStatePath = String(env.LOVEHONEY_STORAGE_STATE_PATH || '').trim();
  if (rawStorageStatePath) {
    const storageStatePath = path.resolve(rawStorageStatePath);
    if (!existsSync(storageStatePath)) {
      throw new Error(`LOVEHONEY_STORAGE_STATE_PATH 文件不存在: ${storageStatePath}`);
    }
    return {
      storageStatePath,
      cookieHeader: '',
      source: 'storage-state',
    };
  }

  const cookieHeader = String(env.LOVEHONEY_COOKIE || '').trim();
  if (cookieHeader) {
    return {
      storageStatePath: '',
      cookieHeader,
      source: 'cookie',
    };
  }

  return {
    storageStatePath: '',
    cookieHeader: '',
    source: 'none',
  };
}
