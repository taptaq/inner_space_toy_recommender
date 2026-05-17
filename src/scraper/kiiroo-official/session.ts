import fs from 'fs';
import path from 'path';

type KiirooSessionEnv = {
  KIIROO_STORAGE_STATE_PATH?: string;
  KIIROO_COOKIE?: string;
};

type SessionDeps = {
  existsSync?: (targetPath: string) => boolean;
};

export type KiirooSessionBootstrap = {
  storageStatePath: string;
  cookieHeader: string;
  source: 'storage-state' | 'cookie' | 'none';
};

export function resolveKiirooSessionBootstrap(
  env: KiirooSessionEnv,
  deps: SessionDeps = {},
): KiirooSessionBootstrap {
  const existsSync = deps.existsSync || fs.existsSync;
  const rawStorageStatePath = String(env.KIIROO_STORAGE_STATE_PATH || '').trim();
  if (rawStorageStatePath) {
    const storageStatePath = path.resolve(rawStorageStatePath);
    if (!existsSync(storageStatePath)) {
      throw new Error(`KIIROO_STORAGE_STATE_PATH 文件不存在: ${storageStatePath}`);
    }
    return {
      storageStatePath,
      cookieHeader: '',
      source: 'storage-state',
    };
  }

  const cookieHeader = String(env.KIIROO_COOKIE || '').trim();
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
