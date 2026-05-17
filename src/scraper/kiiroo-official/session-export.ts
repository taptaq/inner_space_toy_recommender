import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext } from 'playwright';

type SessionExportEnv = {
  KIIROO_STORAGE_STATE_PATH?: string;
  KIIROO_SESSION_CAPTURE_URL?: string;
};

type SessionExportConfig = {
  storageStatePath: string;
  launchUrl: string;
};

const DEFAULT_OUTPUT_RELATIVE_PATH = 'src/data/kiiroo-official-storage-state.json';
const DEFAULT_LAUNCH_URL = 'https://www.kiiroo.com/collections/male-masturbators';

export function resolveKiirooSessionExportConfig(
  env: SessionExportEnv,
  cwd = process.cwd(),
): SessionExportConfig {
  const configuredOutputPath = String(env.KIIROO_STORAGE_STATE_PATH || '').trim() || DEFAULT_OUTPUT_RELATIVE_PATH;
  const outputPath = path.resolve(cwd, configuredOutputPath);
  const launchUrl = String(env.KIIROO_SESSION_CAPTURE_URL || DEFAULT_LAUNCH_URL).trim() || DEFAULT_LAUNCH_URL;
  return {
    storageStatePath: outputPath,
    launchUrl,
  };
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      ignoreDefaultArgs: ['--enable-automation'],
    });
  } catch (error) {
    console.warn('[会话导出] 启动系统 Chrome 失败，回退到 Playwright Chromium:', error);
    return chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      ignoreDefaultArgs: ['--enable-automation'],
    });
  }
}

async function waitForUserConfirmation() {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question('浏览器中确认 Kiiroo 页面已正常打开后，回到这里按回车保存会话...');
  } finally {
    rl.close();
  }
}

async function createContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.9',
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return context;
}

export async function runKiirooSessionExporter() {
  const config = resolveKiirooSessionExportConfig(process.env);
  ensureDir(config.storageStatePath);

  console.log('--- 启动 Kiiroo 会话导出工具 ---');
  console.log(`[会话导出] 输出文件: ${config.storageStatePath}`);
  console.log(`[会话导出] 启动页面: ${config.launchUrl}`);

  const browser = await launchBrowser();
  const context = await createContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(config.launchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);
    console.log('[会话导出] 浏览器已打开。请在浏览器中完成验证、登录或手动跳转到可正常访问的 Kiiroo 页面。');
    await waitForUserConfirmation();

    const title = String(await page.title()).trim();
    const finalUrl = page.url();
    const cookies = await context.cookies();
    await context.storageState({ path: config.storageStatePath });

    console.log(
      `[会话导出] 已保存 storageState: cookies=${cookies.length}, title=${title || 'N/A'}, finalUrl=${finalUrl}`,
    );
    console.log('[会话导出] 后续可直接配合 KIIROO_STORAGE_STATE_PATH 运行抓取。');
  } finally {
    await context.close();
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runKiirooSessionExporter().catch((error) => {
    console.error('[致命错误] Kiiroo 会话导出失败:', error);
    process.exitCode = 1;
  });
}
