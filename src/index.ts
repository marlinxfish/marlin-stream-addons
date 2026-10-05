// @ts-expect-error stremio-addon-sdk untyped import in bun
import { serveHTTP } from 'stremio-addon-sdk';
import { addonBuilder } from './addon';
import { config } from './config';

serveHTTP(addonBuilder.getInterface(), { port: config.port });

console.log(`[Movie-Addons] Stremio addon running on http://127.0.0.1:${config.port}`);
console.log(`[Movie-Addons] Manifest: http://127.0.0.1:${config.port}/manifest.json`);
