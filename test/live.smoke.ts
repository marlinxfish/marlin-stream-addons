import { config } from '../src/config';
import { OppadramaProvider } from '../src/providers/oppadrama';
import { defaultResolverRegistry } from '../src/resolvers/registry';
import { cinemetaService } from '../src/services/cinemeta';

async function main() {
  console.log(`--- Running Live Smoke Test against ${config.oppadramaBaseUrl} ---`);

  // Step 1: Lookup meta for "One Night Only (2026)" - IMDb tt33555239
  console.log('1. Testing Cinemeta lookup...');
  const meta = await cinemetaService.lookup('movie', 'tt33555239');
  console.log('   Cinemeta Meta:', meta);
  if (!meta || !meta.title) {
    throw new Error('Cinemeta lookup failed!');
  }

  // Step 2: Query Oppadrama live
  console.log(`2. Querying Oppadrama at ${config.oppadramaBaseUrl}...`);
  const provider = new OppadramaProvider(config.oppadramaBaseUrl, defaultResolverRegistry);
  const streams = await provider.getStreams(meta);

  console.log(`   Found ${streams.length} stream(s):`);
  for (const s of streams) {
    console.log(`   - [${s.name}] ${s.title} -> ${s.url}`);
    if (s.url.startsWith('http://127.0.0.1') || s.url.startsWith('http://localhost')) {
      throw new Error(`Stream URL ${s.url} must be a direct hoster URL, not local proxy!`);
    }
  }

  console.log('--- Smoke Test Completed Successfully! ---');
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
