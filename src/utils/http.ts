import { config } from '../config';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

export interface FetchSpoofOptions extends RequestInit {
  referer?: string;
  defaultHost?: string;
  timeoutMs?: number;
}

export interface SpoofedResponse {
  response: Response;
  latencyMs: number;
}

export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[index];
}

export function toSafeFetchUrl(rawUrl: string): { fetchUrl: string } {
  return { fetchUrl: rawUrl };
}

export function getBrowserHeaders(referer?: string, defaultHost?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };


  if (referer) {
    headers['Referer'] = referer.replace(/\.nip\.io/g, '');
  }

  return headers;
}

export async function fetchWithSpoof(url: string, options: FetchSpoofOptions = {}): Promise<SpoofedResponse> {
  const timeoutMs = options.timeoutMs || config.requestTimeoutMs;
  const { fetchUrl } = toSafeFetchUrl(url);
  const browserHeaders = getBrowserHeaders(options.referer);

  const mergedHeaders = {
    ...browserHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };
  const fetchInit: RequestInit & { proxy?: string } = {
    ...options,
    headers: mergedHeaders,
    signal: options.signal || AbortSignal.timeout(timeoutMs),
  };

  if (config.proxyUrl) {
    fetchInit.proxy = config.proxyUrl;
  }

  const start = performance.now();
  const response = await fetch(fetchUrl, fetchInit as RequestInit);
  const latencyMs = Math.round(performance.now() - start);

  return { response, latencyMs };
}

export async function safeFetch(url: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
  const { response } = await fetchWithSpoof(urlStr, init);
  return response;
}
