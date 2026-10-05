import express from 'express';
// @ts-expect-error stremio-addon-sdk untyped import in bun
import { getRouter } from 'stremio-addon-sdk';
// @ts-expect-error stremio-addon-sdk internal import
import landingTemplate from 'stremio-addon-sdk/src/landingTemplate';
import { addonBuilder } from './addon';
import { config } from './config';

export const app = express();

// Private Network Access (PNA) and universal CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const addonInterface = addonBuilder.getInterface();
app.use(getRouter(addonInterface));
// Custom routes for user configuration URLs when manifest.config is empty
app.get('/:config/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(addonInterface.manifest);
});

app.get('/:config/stream/:type/:id.json', async (req, res) => {
  try {
    const { type, id, config: userConfig } = req.params;
    const result = await addonInterface.get('stream', type, id, {}, userConfig);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ streams: result?.streams || [] });
  } catch (err) {
    console.error(`[AddonRoute] Error resolving stream for ${req.params.type}/${req.params.id}:`, err);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({ streams: [] });
  }
});

// Configure routes (redirects to configuration web portal)
app.get(['/configure', '/:config/configure'], (req, res) => {
  const configParam = req.params.config ? `?config=${encodeURIComponent(req.params.config)}` : '';
  res.redirect(`http://localhost:3000/${configParam}`);
});

// Landing page with one-click install button
const landingHTML = landingTemplate(addonInterface.manifest);
app.get('/', (_, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(landingHTML);
});

export const server = process.env.NODE_ENV !== 'test' && !process.env.BUN_TEST
  ? app.listen(config.port, '0.0.0.0', () => {
      console.log(`[Movie-Addons] Stremio addon running on http://127.0.0.1:${config.port}`);
      console.log(`[Movie-Addons] Web Landing Page: http://127.0.0.1:${config.port}/`);
      console.log(`[Movie-Addons] Manifest URL: http://127.0.0.1:${config.port}/manifest.json`);
      console.log(`[Movie-Addons] Stremio Protocol URL: stremio://127.0.0.1:${config.port}/manifest.json`);
    })
  : null;
