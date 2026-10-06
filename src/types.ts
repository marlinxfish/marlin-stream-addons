export type MediaType = 'movie' | 'series' | 'anime';
export type FetchFunction = (input: string | Request | URL, init?: RequestInit) => Promise<Response>;
export interface MediaItemQuery {
  imdbId?: string;
  kitsuId?: string;
  type: MediaType;
  title: string;
  titles?: string[];
  year?: number;
  season?: number;
  episode?: number;
}

export interface StreamResult {
  name: string;
  title: string;
  url: string;
  quality?: string;
  server?: string;
  latencyMs?: number;
  sizeText?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    proxyHeaders?: {
      request?: Record<string, string>;
    };
  };
}
