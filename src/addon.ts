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
  description: 'Educational stream resolver indexer for Stremio. Zero-bandwidth direct streaming from public sources. Does not host or store any media.',
  resources: ['stream'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt'],
  behaviorHints: {
    configurable: true,
  },
};


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

    if (!streams || streams.length === 0) {
      const meta = await cinemetaService.lookup(type, id);
      if (!meta) return [];

      streams = await providerRegistry.getAllStreams(meta);
      if (streams && streams.length > 0) {
        cacheService.setStream(cacheKey, streams);
      }
    }

    return filterStreamsByConfig(streams, userConfig);
  } catch (err) {
    console.error(`[StreamHandler] Error processing ${type}/${id}:`, err);
    return [];
  }
}
