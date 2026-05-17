import path from 'path';

type KiirooRuntimeEnv = {
  KIIROO_INTERACTIVE?: string;
  KIIROO_CDP_ENDPOINT?: string;
  KIIROO_PERSISTENT_PROFILE_DIR?: string;
  KIIROO_INTERACTIVE_START_URL?: string;
};

export type KiirooRuntimeConfig = {
  mode: 'headless' | 'interactive' | 'cdp';
  interactive: boolean;
  cdpEndpoint: string;
  persistentProfileDir: string;
  interactiveStartUrl: string;
};

const DEFAULT_PERSISTENT_PROFILE_DIR = 'src/data/kiiroo-official-browser-profile';
const DEFAULT_INTERACTIVE_START_URL = 'https://www.kiiroo.com/collections/male-masturbators';

function isTruthyFlag(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

export function resolveKiirooRuntimeConfig(env: KiirooRuntimeEnv, cwd = process.cwd()): KiirooRuntimeConfig {
  const configuredProfileDir =
    String(env.KIIROO_PERSISTENT_PROFILE_DIR || '').trim() || DEFAULT_PERSISTENT_PROFILE_DIR;
  const cdpEndpoint = String(env.KIIROO_CDP_ENDPOINT || '').trim();
  const interactiveRequested = isTruthyFlag(String(env.KIIROO_INTERACTIVE || ''));
  const mode: KiirooRuntimeConfig['mode'] = cdpEndpoint ? 'cdp' : interactiveRequested ? 'interactive' : 'headless';

  return {
    mode,
    interactive: mode !== 'headless',
    cdpEndpoint,
    persistentProfileDir: path.resolve(cwd, configuredProfileDir),
    interactiveStartUrl:
      String(env.KIIROO_INTERACTIVE_START_URL || '').trim() || DEFAULT_INTERACTIVE_START_URL,
  };
}
