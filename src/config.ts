export interface AppConfig {
  port: number;
  oppadramaBaseUrl: string;
  cacheStreamTtl: number;
  cacheMetaTtl: number;
  requestTimeoutMs: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    port: Number(env.PORT) || 7000,
    oppadramaBaseUrl: (env.OPPADRAMA_BASE_URL || 'http://212.86.121.175').replace(/\/+$/, ''),
    cacheStreamTtl: Number(env.CACHE_STREAM_TTL) || 3600,
    cacheMetaTtl: Number(env.CACHE_META_TTL) || 86400,
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS) || 6000,
  };
}

export const config = loadConfig(process.env);
