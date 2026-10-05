export interface AppConfig {
  port: number;
  oppadramaBaseUrl: string;
  oppadramaEnabled: boolean;
  cacheStreamTtl: number;
  cacheMetaTtl: number;
  requestTimeoutMs: number;
  proxyUrl?: string;
  addonName: string;
  addonIcon: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    port: Number(env.PORT) || 7000,
    oppadramaBaseUrl: (env.OPPADRAMA_BASE_URL || 'http://212.86.121.175').replace(/\/+$/, ''),
    oppadramaEnabled: env.PROVIDER_OPPADRAMA_ENABLED !== 'false',
    cacheStreamTtl: Number(env.CACHE_STREAM_TTL) || 3600,
    cacheMetaTtl: Number(env.CACHE_META_TTL) || 86400,
    requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS) || 6000,
    proxyUrl: env.PROXY_URL || env.HTTP_PROXY || env.HTTPS_PROXY,
    addonName: env.ADDON_NAME || 'Marlin Stream',
    addonIcon: env.ADDON_ICON || '🐟',
  };
}

export const config = loadConfig(process.env);
