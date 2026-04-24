export type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
};

export function buildLovehoneyCookies(cookieHeader: string, domains: string[]): BrowserCookie[] {
  const pairs = String(cookieHeader || '')
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [name, ...rest] = segment.split('=');
      return {
        name: String(name || '').trim(),
        value: rest.join('=').trim(),
      };
    })
    .filter((pair) => pair.name && pair.value);

  const cookies: BrowserCookie[] = [];
  const seen = new Set<string>();

  for (const domain of domains) {
    for (const pair of pairs) {
      const key = `${domain}\u0000${pair.name}\u0000/`;
      if (seen.has(key)) continue;
      seen.add(key);
      cookies.push({
        name: pair.name,
        value: pair.value,
        domain,
        path: '/',
      });
    }
  }

  return cookies;
}
