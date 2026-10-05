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
const manifest = {
  id: 'community.movieaddons.stream',
  version: '1.0.0',
  name: 'Movie Addons (Oppadrama & Multi-Provider)',
  description: 'Stream resolver for movies & series from Oppadrama and community sources with zero-bandwidth direct streaming.',
  resources: ['stream'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt'],
};

export const builder = new addonBuilder(manifest);

// Setup Provider Registry
export const providerRegistry = new ProviderRegistry();
providerRegistry.register(new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry));

builder.defineStreamHandler(async ({ type, id, config: rawConfig }: { type: MediaType; id: string; config?: string }) => {
  try {
    const userConfig = decodeConfigParam(rawConfig);
    const cacheKey = `stream:${type}:${id}`;
    let streams = cacheService.getStream(cacheKey);

    if (!streams) {
      const meta = await cinemetaService.lookup(type, id);
      if (!meta) return { streams: [] };

      streams = await providerRegistry.getAllStreams(meta);
      if (streams.length > 0) {
        cacheService.setStream(cacheKey, streams);
      }
    }

    return { streams: filterStreamsByConfig(streams, userConfig) };
  } catch (err) {
    console.error(`[StreamHandler] Error processing ${type}/${id}:`, err);
    return { streams: [] };
  }
});

export { builder as addonBuilder };
