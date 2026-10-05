// @ts-expect-error stremio-addon-sdk untyped import in bun
import { addonBuilder } from 'stremio-addon-sdk';
import { config } from './config';
import { OppadramaProvider } from './providers/oppadrama';
import { ProviderRegistry } from './providers/registry';
import { defaultResolverRegistry } from './resolvers/registry';
import { cacheService } from './services/cache';
import { cinemetaService } from './services/cinemeta';
import type { MediaType, StreamResult } from './types';
import { decodeConfigParam, filterStreamsByConfig } from './services/config-filter';
export const manifest = {
  id: 'community.movieaddons.stream',
  version: '1.0.0',
  name: 'Marlin Stream Addons',
  description: 'Multi-source stream resolver for movies & series with zero-bandwidth direct streaming.',
  resources: ['stream'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt'],
  behaviorHints: {
    configurable: true,
  },
};

export const builder = new addonBuilder(manifest);

// Setup Provider Registry
export const providerRegistry = new ProviderRegistry();
providerRegistry.register(new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry));

export async function resolveStreams({
  type,
  id,
  config: rawConfig,
}: {
  type: MediaType;
  id: string;
  config?: string;
}): Promise<StreamResult[]> {
  try {
    const userConfig = decodeConfigParam(rawConfig);
    const cacheKey = `stream:${type}:${id}`;
    let streams = cacheService.getStream(cacheKey);

    if (!streams) {
      const meta = await cinemetaService.lookup(type, id);
      if (!meta) return [];

      streams = await providerRegistry.getAllStreams(meta);
      if (streams.length > 0) {
        cacheService.setStream(cacheKey, streams);
      }
    }

    return filterStreamsByConfig(streams, userConfig);
  } catch (err) {
    console.error(`[StreamHandler] Error processing ${type}/${id}:`, err);
    return [];
  }
}

builder.defineStreamHandler(async ({ type, id, config: rawConfig }: { type: MediaType; id: string; config?: string }) => {
  const streams = await resolveStreams({ type, id, config: rawConfig });
  return { streams };
});

export { builder as addonBuilder };
