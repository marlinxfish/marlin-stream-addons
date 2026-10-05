import type { StreamResult } from '../types';

export interface UserConfigPayload {
  servers?: {
    buzzheavier?: boolean;
    filelions?: boolean;
    vidhide?: boolean;
    datanodes?: boolean;
  };
  maxResolution?: '1080p' | '720p' | '480p';
  showSpeed?: boolean;
  showSize?: boolean;
}

export function decodeConfigParam(encoded?: unknown): UserConfigPayload | null {
  if (!encoded) return null;
  if (typeof encoded === 'object') return encoded as UserConfigPayload;
  if (typeof encoded !== 'string') return null;
  try {
    if (encoded.startsWith('{')) {
      return JSON.parse(encoded) as UserConfigPayload;
    }
    const json = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(json) as UserConfigPayload;
  } catch {
    return null;
  }
}

export function filterStreamsByConfig(
  streams: StreamResult[],
  config?: UserConfigPayload | null
): StreamResult[] {
  if (!config) return streams;

  return streams.filter((stream) => {
    // Check server toggle
    if (config.servers && stream.server) {
      const serverKey = stream.server.toLowerCase();
      if (serverKey.includes('buzzheavier') && config.servers.buzzheavier === false) return false;
      if (serverKey.includes('filelions') && config.servers.filelions === false) return false;
      if (serverKey.includes('vidhide') && config.servers.vidhide === false) return false;
      if (serverKey.includes('datanodes') && config.servers.datanodes === false) return false;
    }

    // Check resolution limit
    if (config.maxResolution && stream.quality) {
      const q = stream.quality.toLowerCase();
      if (config.maxResolution === '720p' && q.includes('1080p')) return false;
      if (config.maxResolution === '480p' && (q.includes('1080p') || q.includes('720p'))) return false;
    }

    return true;
  });
}
