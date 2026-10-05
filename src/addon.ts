// @ts-expect-error stremio-addon-sdk untyped import in bun
import { addonBuilder } from 'stremio-addon-sdk';
import { config } from './config';
import { OppadramaProvider } from './providers/oppadrama';
import { ProviderRegistry } from './providers/registry';
import { defaultResolverRegistry } from './resolvers/registry';
import { cacheService } from './services/cache';
import { cinemetaService } from './services/cinemeta';
import { MediaType, StreamResult } from './types';

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

builder.defineStreamHandler(async ({ type, id }: { type: MediaType; id: string }) => {
  try {
    const cacheKey = `stream:${type}:${id}`;
    const cached = cacheService.getStream(cacheKey);
    if (cached) {
      return { streams: cached };
    }

    // Resolve meta via Cinemeta
    const meta = await cinemetaService.lookup(type, id);
    if (!meta) {
      return { streams: [] };
    }

    // Query providers
    const streams: StreamResult[] = await providerRegistry.getAllStreams(meta);

    if (streams.length > 0) {
      cacheService.setStream(cacheKey, streams);
    }

    return { streams };
  } catch (err) {
    console.error(`[StreamHandler] Error processing ${type}/${id}:`, err);
    return { streams: [] };
  }
});

export { builder as addonBuilder };
