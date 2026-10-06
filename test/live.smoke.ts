import { config } from '../src/config';
import { OppadramaProvider } from '../src/providers/oppadrama';
import { NontonAnimeIDProvider } from '../src/providers/nontonanimeid';
import { defaultResolverRegistry } from '../src/resolvers/registry';
import { cinemetaService } from '../src/services/cinemeta';
import { kitsuService } from '../src/services/kitsu';
import { resolveStreams } from '../src/addon';

async function main() {
  console.log('--- Running Live Smoke Test ---');

  if (config.oppadramaEnabled) {
    console.log(`1. Testing Oppadrama against ${config.oppadramaBaseUrl}...`);
    const meta = await cinemetaService.lookup('movie', 'tt33555239');
    if (!meta || !meta.title) {
      throw new Error('Cinemeta lookup failed!');
    }
    const provider = new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry);
    const streams = await provider.getStreams(meta);
    console.log(`   Oppadrama found ${streams.length} stream(s)`);
  }

  if (config.nontonAnimeIdEnabled) {
    console.log(`2. Testing NontonAnimeID & Kitsu against ${config.nontonAnimeIdBaseUrl}...`);
    // Lookup Kitsu series
    const seriesMeta = await kitsuService.lookup('series', 'kitsu:48671:1');
    if (!seriesMeta || !seriesMeta.title) {
      throw new Error('Kitsu lookup failed!');
    }
    console.log(`   Kitsu series meta resolved: ${seriesMeta.title}`);

    const provider = new NontonAnimeIDProvider(config.nontonAnimeIdBaseUrl, defaultResolverRegistry);
    const seriesStreams = await provider.getStreams(seriesMeta);
    console.log(`   NontonAnimeID series streams found: ${seriesStreams.length}`);
    if (seriesStreams.length === 0) {
      throw new Error('No streams found for series on NontonAnimeID!');
    }
    // Slight pause between series and movie live requests to avoid rate limits
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 1000);
    await promise;
    // Lookup Kitsu movie
    const movieStreams = await resolveStreams({ type: 'movie', id: 'kitsu:44212' });
    if (movieStreams.length === 0) {
      throw new Error('No streams found for movie on NontonAnimeID!');
    }

    for (const s of [...seriesStreams, ...movieStreams]) {
      if (s.url.startsWith('http://127.0.0.1') || s.url.startsWith('http://localhost')) {
        throw new Error(`Stream URL ${s.url} must be a direct hoster URL, not local proxy!`);
      }
    }
  }

  console.log('--- Smoke Test Completed Successfully! ---');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
