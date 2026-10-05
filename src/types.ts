export type MediaType = 'movie' | 'series';

export interface MediaItemQuery {
  imdbId: string;
  type: MediaType;
  title: string;
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
