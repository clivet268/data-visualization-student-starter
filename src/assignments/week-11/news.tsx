export interface NewsItem {
  title: string;
  link: string;
  date: number | null; // ms since epoch, null if the feed gave none
}

export interface NewsData {
  latest: NewsItem[]; // spills / hazardous events from every feed below, newest first
  superfund: NewsItem[]; // superfund feed only, newest first
}

// EPA news releases, filtered by subject. Each feed lists candidate URLs and the first one that returns items wins
// (EPA's subject urls carry a numeric id on the site, so both forms are tried).
const EPA = 'https://www.epa.gov/newsreleases/search/rss/subject/';
const FEEDS = {
  superfund: [`${EPA}superfund-and-brownfields-226213`, `${EPA}superfund-and-brownfields`],
  emergency: [`${EPA}emergency-response-226193`, `${EPA}emergency-response`],
  hazwaste: [`${EPA}hazardous-waste`],
};

const MAX_ITEMS = 50; // only honoured with an rss2json key, otherwise rss2json returns 10 per feed
const TIMEOUT_MS = 8000;
const CACHE_KEY = 'spilloverNewsV2';
const CACHE_MS = 60 * 60 * 1000;

function safeLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function toTime(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  // rss2json gives "2026-10-14 12:00:00" (UTC); RSS gives RFC 2822
  const iso = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

type Strategy = (feedUrl: string, signal: AbortSignal) => Promise<NewsItem[]>;

// rss2json: answers with CORS headers and JSON, no key needed (a free key lifts the 10-item limit)
const viaRss2Json: Strategy = async (url, signal) => {
  const key = import.meta.env.VITE_RSS2JSON_KEY as string | undefined;
  const q =
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}` +
    (key ? `&api_key=${encodeURIComponent(key)}&count=${MAX_ITEMS}` : '');
  const res = await fetch(q, { signal });
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const json = await res.json();
  if (json.status !== 'ok' || !Array.isArray(json.items)) throw new Error('rss2json: bad response');
  return json.items.flatMap((it: Record<string, unknown>): NewsItem[] => {
    const link = safeLink(it.link);
    const title = typeof it.title === 'string' ? it.title.trim() : '';
    return link && title ? [{ title, link, date: toTime(it.pubDate) }] : [];
  });
};

function parseXml(xml: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  return Array.from(doc.querySelectorAll('item')).flatMap((el): NewsItem[] => {
    const link = safeLink(el.querySelector('link')?.textContent);
    const title = el.querySelector('title')?.textContent?.trim() ?? '';
    return link && title ? [{ title, link, date: toTime(el.querySelector('pubDate')?.textContent) }] : [];
  });
}

// plain "give me the raw bytes with CORS headers" proxies, parsed here
const viaXmlProxy =
  (wrap: (u: string) => string): Strategy =>
  async (url, signal) => {
    const res = await fetch(wrap(url), { signal });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const text = await res.text();
    if (!text.includes('<rss')) throw new Error('not rss'); // proxy error pages
    return parseXml(text);
  };

const STRATEGIES: Strategy[] = [
  viaRss2Json,
  viaXmlProxy((u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`),
  viaXmlProxy((u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`),
];

async function fetchFeed(urls: string[]): Promise<NewsItem[]> {
  for (const url of urls) {
    for (const strategy of STRATEGIES) {
      try {
        const items = await strategy(url, AbortSignal.timeout(TIMEOUT_MS));
        if (items.length > 0) return items;
      } catch {
        /* try the next proxy / url */
      }
    }
  }
  return [];
}

// de-duplicates by link and sorts newest first (undated items go last)
function merge(lists: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const list of lists) {
    for (const it of list) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      out.push(it);
    }
  }
  return out.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

async function fetchAll(): Promise<NewsData> {
  const [superfund, emergency, hazwaste] = await Promise.all([
    fetchFeed(FEEDS.superfund),
    fetchFeed(FEEDS.emergency),
    fetchFeed(FEEDS.hazwaste),
  ]);
  const data: NewsData = { superfund: merge([superfund]), latest: merge([superfund, emergency, hazwaste]) };
  if (data.latest.length > 0) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
    } catch {
      /* storage full or blocked */
    }
  }
  return data;
}

function readCache(): NewsData | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return c && Date.now() - c.time < CACHE_MS ? (c.data as NewsData) : null;
  } catch {
    return null;
  }
}

let inflight: Promise<NewsData> | null = null; // React StrictMode runs effects twice in dev; share one fetch

export function loadNews(): Promise<NewsData> {
  const cached = readCache();
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetchAll().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
