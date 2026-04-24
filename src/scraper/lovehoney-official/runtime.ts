import path from 'path';

type LovehoneyRuntimeEnv = {
  LOVEHONEY_INTERACTIVE?: string;
  LOVEHONEY_CDP_ENDPOINT?: string;
  LOVEHONEY_PERSISTENT_PROFILE_DIR?: string;
  LOVEHONEY_INTERACTIVE_START_URL?: string;
};

export type LovehoneyRuntimeConfig = {
  mode: 'headless' | 'interactive' | 'cdp';
  interactive: boolean;
  cdpEndpoint: string;
  persistentProfileDir: string;
  interactiveStartUrl: string;
};

const DEFAULT_PERSISTENT_PROFILE_DIR = 'src/data/lovehoney-official-browser-profile';
const DEFAULT_INTERACTIVE_START_URL = 'https://www.lovehoney.co.uk/sex-toys/sex-toys-for-women/';

function isTruthyFlag(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function normalizeComparableUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function shouldReuseCurrentInteractivePage(interactive: boolean, currentUrl: string, targetUrl: string): boolean {
  if (!interactive) return false;
  return normalizeComparableUrl(currentUrl) === normalizeComparableUrl(targetUrl);
}

export function resolveLovehoneyRuntimeConfig(
  env: LovehoneyRuntimeEnv,
  cwd = process.cwd(),
): LovehoneyRuntimeConfig {
  const configuredProfileDir =
    String(env.LOVEHONEY_PERSISTENT_PROFILE_DIR || '').trim() || DEFAULT_PERSISTENT_PROFILE_DIR;
  const cdpEndpoint = String(env.LOVEHONEY_CDP_ENDPOINT || '').trim();
  const interactiveRequested = isTruthyFlag(String(env.LOVEHONEY_INTERACTIVE || ''));
  const mode: LovehoneyRuntimeConfig['mode'] = cdpEndpoint ? 'cdp' : interactiveRequested ? 'interactive' : 'headless';

  return {
    mode,
    interactive: mode !== 'headless',
    cdpEndpoint,
    persistentProfileDir: path.resolve(cwd, configuredProfileDir),
    interactiveStartUrl:
      String(env.LOVEHONEY_INTERACTIVE_START_URL || '').trim() || DEFAULT_INTERACTIVE_START_URL,
  };
}
