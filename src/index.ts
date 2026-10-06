import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { manifest, resolveStreams } from './addon';
import { config } from './config';
import { renderConfigPage } from './portal';
import { cacheService } from './services/cache';
import { catalogService } from './services/catalog';
import { isAccessKeyValid } from './services/config-filter';
import type { MediaType } from './types';

export const app = new Hono();

// Private Network Access (PNA) and universal CORS headers
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Private-Network', 'true');
});

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['*'],
  })
);

// Helper to extract search parameter from Stremio extra segment
function parseSearchParam(extraParam?: string): string | undefined {
  if (!extraParam) return undefined;
  const cleanExtra = extraParam.endsWith('.json') ? extraParam.slice(0, -5) : extraParam;
  const searchMatch = cleanExtra.match(/search=([^&]+)/);
  return searchMatch ? decodeURIComponent(searchMatch[1]) : undefined;
}

// Route: Manifest
app.get('/manifest.json', (c) => {
  if (config.accessKey) {
    return c.json({ error: 'Unauthorized: Access key required' }, 401);
  }
  return c.json(manifest);
});

app.get('/:config/manifest.json', (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ error: 'Unauthorized: Invalid access key' }, 401);
  }
  return c.json(manifest);
});

// Route: Catalog (Browse & Search)
app.get('/catalog/:type/:id/:extra?', async (c) => {
  if (config.accessKey) {
    return c.json({ error: 'Unauthorized: Access key required' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const search = parseSearchParam(c.req.param('extra'));
  const metas = await catalogService.getCatalog(type, search);
  return c.json({ metas });
});

app.get('/:config/catalog/:type/:id/:extra?', async (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ error: 'Unauthorized: Invalid access key' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const search = parseSearchParam(c.req.param('extra'));
  const metas = await catalogService.getCatalog(type, search);
  return c.json({ metas });
});

// Route: Meta (Title & Episodes details)
app.get('/meta/:type/:id', async (c) => {
  if (config.accessKey) {
    return c.json({ error: 'Unauthorized: Access key required' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;
  const meta = await catalogService.getMeta(type, id);
  return c.json({ meta: meta || {} });
});

app.get('/:config/meta/:type/:id', async (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ error: 'Unauthorized: Invalid access key' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;
  const meta = await catalogService.getMeta(type, id);
  return c.json({ meta: meta || {} });
});

// Route: Streams
app.get('/stream/:type/:id', async (c) => {
  if (config.accessKey) {
    return c.json({ streams: [], error: 'Unauthorized: Access key required' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;

  if (config.cacheStreamTtl <= 0) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  } else {
    c.header('Cache-Control', `max-age=${config.cacheStreamTtl}, public`);
  }

  const streams = await resolveStreams({ type, id });
  return c.json({ streams });
});

app.get('/:config/stream/:type/:id', async (c) => {
  const configParam = c.req.param('config');
  if (config.accessKey && !isAccessKeyValid(configParam, config.accessKey)) {
    return c.json({ streams: [], error: 'Unauthorized: Invalid access key' }, 401);
  }
  const type = c.req.param('type') as MediaType;
  const rawId = c.req.param('id');
  const id = rawId.endsWith('.json') ? rawId.slice(0, -5) : rawId;

  if (config.cacheStreamTtl <= 0) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  } else {
    c.header('Cache-Control', `max-age=${config.cacheStreamTtl}, public`);
  }

  const streams = await resolveStreams({ type, id, config: configParam });
  return c.json({ streams });
});

// Route: Cache Clear
app.get('/cache/clear', (c) => {
  cacheService.clear();
  return c.json({ status: 'ok', message: 'In-memory cache purged successfully' });
});

// Route: Health & VPS Diagnostics
const serverStartTime = Date.now();
app.get('/health', (c) => {
  const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);
  const mem = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : null;
  const memoryMb = mem
    ? {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
      }
    : undefined;

  return c.json({
    status: 'ok',
    service: 'marlin-stream-addons',
    version: manifest.version,
    uptimeSec,
    memoryMb,
    providers: {
      oppadrama: config.oppadramaEnabled,
      nontonAnimeId: config.nontonAnimeIdEnabled,
    },
  });
});

// Landing & Configure Routes: self-contained portal
app.get('/', (c) =>
  c.html(
    renderConfigPage('', {
      accessKey: config.accessKey,
      oppadramaEnabled: config.oppadramaEnabled,
      nontonAnimeIdEnabled: config.nontonAnimeIdEnabled,
      version: manifest.version,
    })
  )
);

app.get('/configure', (c) =>
  c.html(
    renderConfigPage('', {
      accessKey: config.accessKey,
      oppadramaEnabled: config.oppadramaEnabled,
      nontonAnimeIdEnabled: config.nontonAnimeIdEnabled,
      version: manifest.version,
    })
  )
);

app.get('/:config/configure', (c) =>
  c.html(
    renderConfigPage(c.req.param('config'), {
      accessKey: config.accessKey,
      oppadramaEnabled: config.oppadramaEnabled,
      nontonAnimeIdEnabled: config.nontonAnimeIdEnabled,
      version: manifest.version,
    })
  )
);

// Dual export: works for Bun/Node server (hostname + port + fetch) and Cloudflare Workers (fetch)
export default {
  hostname: config.host,
  port: config.port,
  fetch: app.fetch,
};
