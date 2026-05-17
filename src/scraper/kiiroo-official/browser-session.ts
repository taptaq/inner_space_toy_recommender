import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium, type Browser, type BrowserContext, type Cookie, type Page } from 'playwright';
import { resolveKiirooRuntimeConfig, type KiirooRuntimeConfig } from './runtime.ts';
import { resolveKiirooSessionBootstrap } from './session.ts';

const ORIGIN = 'https://www.kiiroo.com';

export type KiirooContextBundle = {
  context: BrowserContext;
  runtime: KiirooRuntimeConfig;
  cleanup: () => Promise<void>;
};

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 40): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function buildKiirooCookies(cookieHeader: string): Cookie[] {
  const now = Math.floor(Date.now() / 1000);
  return String(cookieHeader || '')
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair): Cookie | null => {
      const index = pair.indexOf('=');
      const name = index >= 0 ? pair.slice(0, index).trim() : pair.trim();
      const value = index >= 0 ? pair.slice(index + 1).trim() : '';
      if (!name) return null;
      return {
        name,
        value,
        domain: 'www.kiiroo.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const,
        expires: now + 30 * 24 * 60 * 60,
      };
    })
    .filter((cookie): cookie is Cookie => Boolean(cookie));
}

async function waitForUserConfirmation(promptText: string) {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(promptText);
  } finally {
    rl.close();
  }
}

export async function createKiirooContext(): Promise<KiirooContextBundle> {
  const runtime = resolveKiirooRuntimeConfig(process.env);
  const sessionBootstrap = resolveKiirooSessionBootstrap(process.env);
  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    locale: 'en-US' as const,
    ...(sessionBootstrap.storageStatePath ? { storageState: sessionBootstrap.storageStatePath } : {}),
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.9',
    },
  };

  let browser: Browser | null = null;
  let context: BrowserContext;

  if (runtime.mode === 'cdp') {
    console.log(`[CDP] 正在连接本机 Chrome: ${runtime.cdpEndpoint}`);
    browser = await chromium.connectOverCDP(runtime.cdpEndpoint);
    const existingContext = browser.contexts()[0];
    if (!existingContext) {
      throw new Error(`CDP 已连接，但未找到可复用的浏览器上下文: ${runtime.cdpEndpoint}`);
    }
    context = existingContext;
  } else if (runtime.mode === 'interactive') {
    ensureDir(path.join(runtime.persistentProfileDir, '.keep'));
    console.log(`[交互] 已启用 Kiiroo 有界面持久会话模式: ${runtime.persistentProfileDir}`);
    try {
      context = await chromium.launchPersistentContext(runtime.persistentProfileDir, {
        channel: 'chrome',
        headless: false,
        args: ['--no-sandbox'],
        ignoreDefaultArgs: ['--enable-automation'],
        ...contextOptions,
      });
    } catch (error) {
      console.warn('[交互] 启动系统 Chrome 失败，回退到 Playwright Chromium:', error);
      context = await chromium.launchPersistentContext(runtime.persistentProfileDir, {
        headless: false,
        args: ['--no-sandbox'],
        ignoreDefaultArgs: ['--enable-automation'],
        ...contextOptions,
      });
    }
  } else {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    context = await browser.newContext(contextOptions);
  }

  await context.route('**/*', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === 'media' || resourceType === 'font') {
      await route.abort();
      return;
    }
    await route.continue();
  });

  if (sessionBootstrap.source === 'storage-state') {
    const contextCookies = await context.cookies([ORIGIN]);
    const cookieNames = uniqueStrings(contextCookies.map((cookie) => cookie.name), 12);
    console.log(
      `[情报] 已载入 Kiiroo storageState: path=${sessionBootstrap.storageStatePath}, context=${contextCookies.length}, names=${cookieNames.join(', ') || 'none'}`,
    );
  }

  if (sessionBootstrap.source === 'cookie') {
    const cookies = buildKiirooCookies(sessionBootstrap.cookieHeader);
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      const contextCookies = await context.cookies([ORIGIN]);
      const cookieNames = uniqueStrings(contextCookies.map((cookie) => cookie.name), 12);
      console.log(
        `[情报] 已注入 Kiiroo Cookie: raw=${sessionBootstrap.cookieHeader.length}, parsed=${cookies.length}, context=${contextCookies.length}, names=${cookieNames.join(', ') || 'none'}`,
      );
    }
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return {
    context,
    runtime,
    cleanup: async () => {
      if (runtime.mode === 'cdp') return;
      await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    },
  };
}

export async function getOrCreateKiirooPage(context: BrowserContext): Promise<Page> {
  const existingPage =
    context.pages().find((candidate) => candidate.url().includes('kiiroo.com') && !candidate.isClosed()) || context.pages()[0];
  if (existingPage) {
    await existingPage.bringToFront().catch(() => {});
    return existingPage;
  }
  return context.newPage();
}

export async function prepareKiirooInteractiveGate(page: Page, runtime: KiirooRuntimeConfig, startUrl: string) {
  if (runtime.mode === 'cdp') {
    console.log('[CDP] 已连接到你自己的 Chrome。请先在这个真实浏览器中手动打开并保持一个可正常访问的 Kiiroo 页面。');
    await waitForUserConfirmation('准备好后回到这里按回车开始抓取...');
  } else {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    console.log('[交互] 浏览器已打开。请在当前浏览器中完成 Kiiroo 验证，并确认页面可正常访问。');
    await waitForUserConfirmation('完成后回到这里按回车开始抓取...');
  }

  const title = normalizeWhitespace(String(await page.title()).trim());
  const finalUrl = page.url();
  console.log(`[交互] 当前页面状态: title=${title || 'N/A'} | finalUrl=${finalUrl || startUrl}`);
}
