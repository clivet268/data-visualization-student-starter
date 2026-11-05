export interface NewsItem {
  source: string;
  id: string | null;
  title: string;
  link: string;
}

interface Feed {
  source: string;
  url: string;
}

const FEEDS: Feed[] = [
  { source: 'EPA NEPIS', url: 'https://nepis.epa.gov/RSS/All.xml' },
  // more feeds go here
];

// tried in order until one works
// tried in order; null = direct request (works only if EPA sends CORS headers)
const PROXIES: (((url: string) => string) | null)[] = [
  null,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];


const CACHE_KEY = 'newsCache';
const CACHE_MS = 60 * 60 * 1000; // matches the feed's 60 min ttl

async function fetchXml(url: string): Promise<string> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy ? proxy(url) : url);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.includes('<rss')) return text; // skip proxy error pages
    } catch {
      /* try next */
    }
  }
  throw new Error(`All proxies failed for ${url}`);
}

function safeLink(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function parseFeed(xml: string, source: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  return Array.from(doc.querySelectorAll('item')).flatMap((el) => {
    const link = safeLink(el.querySelector('link')?.textContent?.trim() ?? '');
    const raw = el.querySelector('title')?.textContent?.trim() ?? '';
    if (!link || !raw) return [];
    const m = raw.match(/^(\S+)\s+(.*)$/); // "542R21001 Review of..."
    return [{ source, id: m ? m[1] : null, title: m ? m[2] : raw, link }];
  });
}

export async function loadNews(): Promise<NewsItem[]> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached && Date.now() - cached.time < CACHE_MS) return cached.items;
  } catch {
    /* ignore bad cache */
  }

  const results = await Promise.allSettled(
    FEEDS.map(async (f) => parseFeed(await fetchXml(f.url), f.source)),
  );

  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const it of r.value) {
      if (seen.has(it.link)) continue; // the feed repeats items
      seen.add(it.link);
      items.push(it);
    }
  }

  if (items.length) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), items }));
    } catch {
      /* storage full or blocked */
    }
  }
  return items;
}