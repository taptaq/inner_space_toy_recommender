import dotenv from "dotenv";
import pg from "pg";
import { chromium, type BrowserContext, type Page } from "playwright";

dotenv.config();

const { Pool } = pg;

const TARGET_BRANDS = (process.env.TMALL_EMPTY_LINK_BRANDS || "KISSTOY,雷霆暴风")
  .split(",")
  .map((brand) => brand.trim())
  .filter(Boolean);
const SCORE_THRESHOLD = Number(process.env.TMALL_EMPTY_LINK_SCORE_THRESHOLD || "0.42");
const DETAIL_WAIT_MS = Number(process.env.TMALL_EMPTY_LINK_DETAIL_WAIT_MS || "4500");
const MAX_TARGETS = Number(process.env.TMALL_EMPTY_LINK_LIMIT || "80");

type TargetRow = {
  toy_id: string;
  original_id: string;
  brand: string;
  name: string;
  product_name: string | null;
  current_price: string | null;
  product_price: string | null;
};

type ShopCandidate = {
  title: string;
  href: string;
  price: number | null;
  image: string | null;
  sourcePage: string;
  domIndex: number;
  listDomKind: "legacy" | "shelf" | "anchor" | "unknown";
};

type BrandConfig = {
  aliases: string[];
  seedUrls: string[];
  searchHost: string;
};

type MatchResult = {
  target: TargetRow;
  candidate: ShopCandidate;
  score: number;
  detailUrl: string;
  price: number | null;
};

const BRAND_CONFIGS: BrandConfig[] = [
  {
    aliases: ["KISSTOY", "KISTOY"],
    searchHost: "https://kistoy.tmall.com",
    seedUrls: [
      "https://kistoy.tmall.com/shop/view_shop.htm?appUid=RAzN8HWRAt6t925s4h2jbxKCaTypMafA6yNHWCR5harmJCXqVv9&spm=a21n57.1.hoverItem.3",
      "https://kistoy.tmall.com/search.htm?search=y&orderType=coefp_desc",
      "https://kisstoy.tmall.com/search.htm?search=y&orderType=coefp_desc",
    ],
  },
  {
    aliases: ["雷霆暴风", "雷霆"],
    searchHost: "https://leten.tmall.com",
    seedUrls: [
      "https://leten.tmall.com/search.htm?keyword=kisstoy&spm=a21xtw.29178619.0.0",
      "https://leten.tmall.com/search.htm?search=y&orderType=coefp_desc",
      "https://leten.tmall.com/shop/view_shop.htm?appUid=RAzN8HWScNUQgh2LxJzFPCm3wEt9AcUhVZFYCfHdSqfya87nYCj&spm=a21n57.1.hoverItem.1",
    ],
  },
];

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parsePrice(value: unknown) {
  const text = normalizeText(value);
  const matches = Array.from(text.matchAll(/([1-9]\d{0,5}(?:\.\d{1,2})?)/g))
    .map((match) => Number(match[1]))
    .filter((price) => Number.isFinite(price) && price > 0 && price < 100000);
  if (!matches.length) return null;
  return Math.min(...matches);
}

function toAbsoluteUrl(href: string) {
  const normalized = normalizeText(href);
  if (!normalized) return "";
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  return normalized;
}

function extractTmallItemId(url: string) {
  return normalizeText(url).match(/[?&]id=(\d+)/)?.[1] ?? "";
}

function canonicalizeTmallItemUrl(url: string) {
  const itemId = extractTmallItemId(url);
  return itemId ? `https://detail.tmall.com/item.htm?id=${itemId}` : normalizeText(url);
}

const LEGACY_LIST_CARD_SELECTOR = ".J_TItems dl.item";
const SHELF_LIST_CARD_SELECTOR =
  ".product_shelf [class*='cardContainer'], [class*='ProductShelf'] [class*='cardContainer'], [class*='product_shelf'] [class*='cardContainer']";
const LIST_READY_SELECTOR = `${LEGACY_LIST_CARD_SELECTOR}, ${SHELF_LIST_CARD_SELECTOR}`;

function parseTmallCookieHeader(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0) return null;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!name || !value) return null;
      return [
        { name, value, domain: ".tmall.com", path: "/" },
        { name, value, domain: ".taobao.com", path: "/" },
      ];
    })
    .filter((value): value is Array<{ name: string; value: string; domain: string; path: string }> =>
      Boolean(value),
    )
    .flat();
}

async function injectTmallCookies(context: BrowserContext) {
  const cookieHeader = process.env.TMALL_COOKIE || "";
  const cookies = parseTmallCookieHeader(cookieHeader);
  if (!cookies.length) return;
  await context.addCookies(cookies);
  console.log(`[tmall-empty-link] 已注入 TMALL_COOKIE: ${cookies.length} 条`);
}

async function expandShelfListUntilStable(page: Page, minCardCount = 0) {
  let lastCount = -1;
  let lastScrollHeight = -1;
  let stableRounds = 0;

  for (let round = 1; round <= 18; round += 1) {
    const snapshot = await page.evaluate(
      ({ selector }) => {
        const count = document.querySelectorAll(selector).length;
        const text = document.body?.innerText || "";
        const scrollHeight = document.body?.scrollHeight || 0;
        return { count, scrollHeight, hasNoMoreText: text.includes("没有更多商品") };
      },
      { selector: SHELF_LIST_CARD_SELECTOR },
    );

    if (snapshot.count === lastCount && snapshot.scrollHeight === lastScrollHeight) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
    }

    if (snapshot.hasNoMoreText && snapshot.count >= minCardCount) break;
    if (stableRounds >= 3 && snapshot.count >= Math.max(minCardCount, 1)) break;

    lastCount = snapshot.count;
    lastScrollHeight = snapshot.scrollHeight;
    await page.evaluate(() => window.scrollBy(0, Math.max(900, window.innerHeight * 0.9))).catch(() => {});
    await page.waitForTimeout(600);
  }
}

function getBrandConfig(brand: string) {
  return BRAND_CONFIGS.find((config) =>
    config.aliases.some((alias) => brand.toLowerCase().includes(alias.toLowerCase()) || alias.toLowerCase().includes(brand.toLowerCase())),
  );
}

function normalizeForMatch(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/kisstoy|kistoy|雷霆暴风|雷霆/g, " ")
    .replace(/情趣|成人|用品|玩具|专用|女用|男用|女性|男性|女人|男人|神器|自慰器|自尉器|高潮|私处|性/g, " ")
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function charSet(value: string) {
  return new Set(Array.from(value.replace(/\s+/g, "")));
}

function tokenSet(value: string) {
  return new Set(value.split(/\s+/).filter((token) => token.length >= 2));
}

function scoreCandidate(target: TargetRow, candidate: ShopCandidate) {
  const targetText = normalizeForMatch([target.product_name, target.name].filter(Boolean).join(" "));
  const candidateText = normalizeForMatch(candidate.title);
  if (!targetText || !candidateText) return 0;

  const targetChars = charSet(targetText);
  const candidateChars = charSet(candidateText);
  const charIntersection = Array.from(targetChars).filter((char) => candidateChars.has(char)).length;
  const charDice = (2 * charIntersection) / Math.max(1, targetChars.size + candidateChars.size);

  const targetTokens = tokenSet(targetText);
  const candidateTokens = tokenSet(candidateText);
  const tokenHits = Array.from(targetTokens).filter((token) => candidateText.includes(token) || candidateTokens.has(token)).length;
  const tokenRecall = tokenHits / Math.max(1, targetTokens.size);

  const itemIdBonus = extractTmallItemId(candidate.href) ? 0.08 : 0;
  return Math.min(1, charDice * 0.62 + tokenRecall * 0.3 + itemIdBonus);
}

function buildSearchKeywords(row: TargetRow) {
  const source = normalizeForMatch([row.product_name, row.name].filter(Boolean).join(" "));
  const chunks = Array.from(
    new Set(
      source
        .split(/\s+/)
        .filter((token) => token.length >= 2)
        .slice(0, 8),
    ),
  );
  const compact = chunks.join(" ");
  const highSignal = chunks
    .filter((token) => /polly|g点|秒潮|突突|小甜罐|保温舱|光子|全自动|泷泽|润滑|飞机杯|震动棒/i.test(token))
    .join(" ");
  return Array.from(new Set([highSignal, compact, row.product_name || row.name].map(normalizeText).filter(Boolean))).slice(0, 3);
}

function buildBrandSearchUrl(config: BrandConfig, keyword: string) {
  const url = new URL("/search.htm", config.searchHost);
  url.searchParams.set("search", "y");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("orderType", "coefp_desc");
  return url.toString();
}

async function collectCandidatesFromPage(page: Page, url: string): Promise<ShopCandidate[]> {
  console.log(`[tmall-empty-link] 打开店铺页: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  await expandShelfListUntilStable(page);

  const candidates = await page.evaluate((sourcePage) => {
    const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    const absolute = (href: string) => {
      const normalized = normalize(href);
      if (!normalized) return "";
      if (normalized.startsWith("//")) return `https:${normalized}`;
      if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
      try {
        return new URL(normalized, location.href).toString();
      } catch {
        return normalized;
      }
    };
    const readImage = (root: Element) =>
      normalize(
        root.querySelector("img")?.getAttribute("src") ||
          root.querySelector("img")?.getAttribute("data-src") ||
          root.querySelector("img")?.getAttribute("data-ks-lazyload") ||
          "",
      );
    const readTitle = (root: Element) => {
      const explicit = normalize(
        root.querySelector("[title]")?.getAttribute("title") ||
          root.querySelector("img")?.getAttribute("alt") ||
          root.querySelector(".title")?.textContent ||
          root.querySelector('[class*="title"], [class*="Title"], [class*="name"], [class*="Name"]')?.textContent ||
          root.textContent,
      );
      return explicit.replace(/¥\s*\d+(?:\.\d+)?/g, " ").replace(/\s+/g, " ").trim();
    };
    const readHref = (root: Element) =>
      absolute(
        root.querySelector<HTMLAnchorElement>('a[href*="item.htm"], a[href*="detail.tmall.com"], a[href*="detail.taobao.com"]')
          ?.href || "",
      );
    const readPrice = (root: Element) =>
      normalize(
        root.querySelector(".c-price, .price, [class*='price'], [class*='Price'], .text-price")?.textContent || "",
      );

    const records: Array<{
      title: string;
      href: string;
      priceText: string;
      image: string;
      sourcePage: string;
      domIndex: number;
      listDomKind: "legacy" | "shelf" | "anchor" | "unknown";
    }> = [];
    document
      .querySelectorAll(".J_TItems dl.item")
      .forEach((root, domIndex) =>
        records.push({
          title: readTitle(root),
          href: readHref(root),
          priceText: readPrice(root),
          image: absolute(readImage(root)),
          sourcePage,
          domIndex,
          listDomKind: "legacy",
        }),
      );
    document
      .querySelectorAll(
        ".product_shelf [class*='cardContainer'], [class*='ProductShelf'] [class*='cardContainer'], [class*='product_shelf'] [class*='cardContainer']",
      )
      .forEach((root, domIndex) =>
        records.push({
          title: readTitle(root),
          href: readHref(root),
          priceText: readPrice(root),
          image: absolute(readImage(root)),
          sourcePage,
          domIndex,
          listDomKind: "shelf",
        }),
      );
    document.querySelectorAll('a[href*="item.htm"], a[href*="detail.tmall.com"], a[href*="detail.taobao.com"]').forEach((anchor) => {
      const root = anchor.closest("dl, li, div") || anchor;
      records.push({
        title: readTitle(root),
        href: readHref(root),
        priceText: readPrice(root),
        image: absolute(readImage(root)),
        sourcePage,
        domIndex: -1,
        listDomKind: "anchor",
      });
    });

    return records.filter((item) => item.title || item.href);
  }, url);

  const seen = new Set<string>();
  return candidates
    .map((item) => ({
      title: normalizeText(item.title),
      href: toAbsoluteUrl(item.href),
      price: parsePrice(item.priceText),
      image: toAbsoluteUrl(item.image),
      sourcePage: item.sourcePage,
      domIndex: item.domIndex,
      listDomKind: item.listDomKind,
    }))
    .filter((item) => {
      const key = `${extractTmallItemId(item.href) || item.href}|${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(item.title && (item.href || item.image));
    });
}

async function clickCandidateCard(page: Page, context: BrowserContext, candidate: ShopCandidate) {
  await page.goto(candidate.sourcePage, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.waitForSelector(LIST_READY_SELECTOR, { timeout: 20_000 }).catch(() => {});
  if (candidate.listDomKind === "shelf") {
    await expandShelfListUntilStable(page, candidate.domIndex + 1);
  }

  const selector = candidate.listDomKind === "legacy" ? LEGACY_LIST_CARD_SELECTOR : SHELF_LIST_CARD_SELECTOR;
  const card = page.locator(selector).nth(candidate.domIndex);
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.querySelectorAll(".J_MIDDLEWARE_FRAME_WIDGET").forEach((node) => node.remove());
  }).catch(() => {});
  await card
    .evaluate((root: Element) => {
      root.querySelectorAll("a[target]").forEach((anchor) => anchor.setAttribute("target", "_self"));
    })
    .catch(() => {});

  const clickTarget = card
    .locator('dt.photo a, a.J_TGoldData, a.J_GoldData, dd.detail a.item-name, [class*="title"], img')
    .first();
  const fallbackClickTarget = candidate.listDomKind === "shelf" ? card : clickTarget;
  const popupOrNavigation = Promise.race([
    context
      .waitForEvent("page", { timeout: 8000 })
      .then((popupPage) => ({ type: "popup" as const, popupPage }))
      .catch(() => null),
    page
      .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 })
      .then(() => ({ type: "navigation" as const }))
      .catch(() => null),
    page.waitForTimeout(10_000).then(() => ({ type: "timeout" as const })),
  ]);

  await fallbackClickTarget.click({ timeout: 15_000, force: candidate.listDomKind === "shelf" });
  const clickResult = await popupOrNavigation;
  if (clickResult?.type === "popup") {
    const popupPage = clickResult.popupPage;
    await popupPage.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
    await popupPage.waitForTimeout(1500).catch(() => {});
    const popupUrl = popupPage.url();
    await popupPage.close().catch(() => {});
    if (popupUrl && popupUrl !== "about:blank") {
      await page.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(2000);
      return page.url() || popupUrl;
    }
  }

  const landedUrl = page.url();
  return landedUrl && landedUrl.includes("detail.tmall.com") ? landedUrl : "";
}

async function resolveDetail(page: Page, candidate: ShopCandidate) {
  let candidateHref = candidate.href;
  if (!extractTmallItemId(candidateHref) && candidate.domIndex >= 0) {
    candidateHref = await clickCandidateCard(page, page.context(), candidate).catch((error) => {
      console.warn(`[tmall-empty-link] 候选卡片点击失败: ${candidate.title} ${error?.message || error}`);
      return "";
    });
  }

  const canonicalUrl = canonicalizeTmallItemUrl(candidateHref);
  if (!canonicalUrl || !/^https?:\/\/detail\.tmall\.com\/item\.htm/i.test(canonicalUrl)) {
    return { detailUrl: candidateHref || candidate.href, price: candidate.price };
  }

  await page.goto(canonicalUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(DETAIL_WAIT_MS).catch(() => {});
  const currentUrl = page.url();
  const pagePrice = await page
    .evaluate(() => {
      const meta = document.querySelector('meta[property="og:product:price"], meta[name="twitter:data1"]');
      const metaText = meta?.getAttribute("content") || "";
      const domText = Array.from(document.querySelectorAll('[class*="price"], [class*="Price"]'))
        .map((node) => node.textContent || "")
        .join(" ");
      const sourceMatch =
        document.documentElement.outerHTML.match(/"price":"(\d+\.?\d*)"/i)?.[1] ||
        document.documentElement.outerHTML.match(/"skuPrice":"(\d+\.?\d*)"/i)?.[1] ||
        "";
      return [metaText, domText, sourceMatch].join(" ");
    })
    .catch(() => "");

  const resolvedUrl = /^https?:\/\/detail\.tmall\.com\/item\.htm/i.test(currentUrl) ? currentUrl : canonicalUrl;
  return {
    detailUrl: resolvedUrl,
    price: parsePrice(pagePrice) ?? candidate.price,
  };
}

async function readTargets(client: pg.PoolClient) {
  const result = await client.query<TargetRow>(
    `
      SELECT
        t.id AS toy_id,
        t.original_id::text AS original_id,
        t.brand,
        t.name,
        p.name AS product_name,
        t.price::text AS current_price,
        p.price::text AS product_price
      FROM public.recommender_toys AS t
      JOIN public.products AS p ON p.id::text = t.original_id::text
      WHERE t.original_id IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(p.link, '')), '') IS NULL
        AND (${TARGET_BRANDS.map((_, index) => `t.brand ILIKE $${index + 1}`).join(" OR ")})
      ORDER BY t.brand, t.name
      LIMIT $${TARGET_BRANDS.length + 1}
    `,
    [...TARGET_BRANDS.map((brand) => `%${brand}%`), MAX_TARGETS],
  );
  return result.rows;
}

async function updateMatch(client: pg.PoolClient, match: MatchResult) {
  const safePrice = match.price && match.price >= 10 ? match.price : null;
  await client.query(
    `
      UPDATE public.products
      SET link = $2,
          price = COALESCE($3::numeric, price),
          image = COALESCE(NULLIF($4::text, ''), image),
          specs = jsonb_set(
            jsonb_set(
              COALESCE(specs::jsonb, '{}'::jsonb),
              '{sourceUrl}',
              to_jsonb($2::text),
              true
            ),
            '{linkRecoveredFrom}',
            to_jsonb($5::text),
            true
          )
      WHERE id::text = $1::text
    `,
    [
      match.target.original_id,
      match.detailUrl,
      safePrice,
      match.candidate.image || null,
      match.candidate.sourcePage,
    ],
  );

  await client.query(
    `
      UPDATE public.recommender_toys
      SET price = COALESCE($2::numeric, price),
          image_url = COALESCE(NULLIF($3::text, ''), image_url),
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [match.target.toy_id, safePrice, match.candidate.image || null],
  );
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const client = await pool.connect();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  await context.addInitScript("window.__name = (target) => target;");
  await injectTmallCookies(context);
  const page = await context.newPage();

  try {
    const targets = await readTargets(client);
    console.log(`[tmall-empty-link] 待追回空 link 产品 ${targets.length} 条`);
    const matches: MatchResult[] = [];
    const misses: Array<{ target: TargetRow; bestScore: number; bestTitle: string }> = [];

    for (const target of targets) {
      const config = getBrandConfig(target.brand);
      if (!config) {
        misses.push({ target, bestScore: 0, bestTitle: "未找到品牌配置" });
        continue;
      }

      const urls = new Set<string>(config.seedUrls);
      for (const keyword of buildSearchKeywords(target)) {
        urls.add(buildBrandSearchUrl(config, keyword));
      }

      const candidates: ShopCandidate[] = [];
      for (const url of urls) {
        try {
          candidates.push(...(await collectCandidatesFromPage(page, url)));
        } catch (error: any) {
          console.warn(`[tmall-empty-link] 店铺页失败: ${url} ${error?.message || error}`);
        }
      }

      const uniqueCandidates = Array.from(
        new Map(candidates.map((candidate) => [extractTmallItemId(candidate.href) || `${candidate.href}|${candidate.title}`, candidate])).values(),
      );
      const ranked = uniqueCandidates
        .map((candidate) => ({ candidate, score: scoreCandidate(target, candidate) }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];

      const canResolveBest =
        Boolean(extractTmallItemId(best?.candidate.href || "")) ||
        Boolean(best && best.candidate.domIndex >= 0 && best.candidate.sourcePage);
      if (!best || best.score < SCORE_THRESHOLD || !canResolveBest) {
        misses.push({
          target,
          bestScore: best?.score ?? 0,
          bestTitle: best?.candidate.title ?? "无候选",
        });
        console.warn(
          `[tmall-empty-link] 未命中: ${target.brand} | ${target.name} best=${(best?.score ?? 0).toFixed(3)} ${best?.candidate.title ?? ""}`,
        );
        continue;
      }

      const detail = await resolveDetail(page, best.candidate);
      const match: MatchResult = {
        target,
        candidate: best.candidate,
        score: best.score,
        detailUrl: detail.detailUrl,
        price: detail.price,
      };
      await updateMatch(client, match);
      matches.push(match);
      console.log(
        `[tmall-empty-link] 已补链: ${target.brand} | ${target.name} -> ${canonicalizeTmallItemUrl(detail.detailUrl)} score=${best.score.toFixed(3)} price=${detail.price ?? "keep"}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          scanned: targets.length,
          updated: matches.length,
          missed: misses.length,
          matches: matches.map((match) => ({
            brand: match.target.brand,
            name: match.target.name,
            candidate: match.candidate.title,
            score: Number(match.score.toFixed(3)),
            link: canonicalizeTmallItemUrl(match.detailUrl),
            price: match.price,
          })),
          misses: misses.map((miss) => ({
            brand: miss.target.brand,
            name: miss.target.name,
            bestScore: Number(miss.bestScore.toFixed(3)),
            bestTitle: miss.bestTitle,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close().catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[tmall-empty-link] 执行失败:", error);
  process.exitCode = 1;
});
