import { describe, expect, it, mock } from 'bun:test';
import { BuzzheavierResolver } from '../src/resolvers/buzzheavier';
import { DataNodesResolver } from '../src/resolvers/datanodes';
import { ResolverRegistry } from '../src/resolvers/registry';
import { VidhideResolver } from '../src/resolvers/vidhide';

describe('BuzzheavierResolver', () => {
  it('identifies buzzheavier URLs', () => {
    const resolver = new BuzzheavierResolver();
    expect(resolver.canResolve('https://buzzheavier.com/lu8y76xr0cb6')).toBe(true);
    expect(resolver.canResolve('https://other.com/file')).toBe(false);
  });

  it('resolves direct download URL via redirect or download endpoint', async () => {
    const mockFetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/download')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://cdn.buzzheavier.com/file/video.mp4' },
        });
      }
      return new Response('<html>mock page</html>', { status: 200 });
    });

    const resolver = new BuzzheavierResolver(mockFetch as unknown as typeof fetch);
    const result = await resolver.resolve('https://buzzheavier.com/lu8y76xr0cb6', '1080p');

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://cdn.buzzheavier.com/file/video.mp4');
    expect(result?.quality).toBe('1080p');
    expect(result?.behaviorHints?.proxyHeaders?.request?.Referer).toBe('https://buzzheavier.com/');
  });
});

describe('VidhideResolver', () => {
  it('identifies vidhide and earnvids URLs', () => {
    const resolver = new VidhideResolver();
    expect(resolver.canResolve('https://vidhidepro.com/d/meh7d2m0lyx3')).toBe(true);
    expect(resolver.canResolve('https://earnvids.com/v/12345')).toBe(true);
    expect(resolver.canResolve('https://other.com/file')).toBe(false);
  });

  it('extracts m3u8 source from Vidhide player HTML', async () => {
    const html = `
      <html>
        <script>
          var player = new Player({ file: "https://stream.vidhide.com/hls/master.m3u8" });
        </script>
      </html>
    `;
    const mockFetch = mock(async () => new Response(html, { status: 200 }));
    const resolver = new VidhideResolver(mockFetch as unknown as typeof fetch);

    const result = await resolver.resolve('https://vidhidepro.com/d/meh7d2m0lyx3', '720p');
    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://stream.vidhide.com/hls/master.m3u8');
    expect(result?.quality).toBe('720p');
    expect(result?.behaviorHints?.proxyHeaders?.request?.Referer).toBe('https://vidhidepro.com/');
  });
});

describe('DataNodesResolver', () => {
  it('identifies datanodes URLs', () => {
    const resolver = new DataNodesResolver();
    expect(resolver.canResolve('https://datanodes.to/abc123xyz')).toBe(true);
    expect(resolver.canResolve('https://other.com/file')).toBe(false);
  });

  it('extracts direct download link from DataNodes HTML', async () => {
    const html = `
      <html>
        <a href="https://dl.datanodes.to/files/video.mp4">Download</a>
      </html>
    `;
    const mockFetch = mock(async () => new Response(html, { status: 200 }));
    const resolver = new DataNodesResolver(mockFetch as unknown as typeof fetch);

    const result = await resolver.resolve('https://datanodes.to/abc123xyz', '1080p');
    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://dl.datanodes.to/files/video.mp4');
    expect(result?.quality).toBe('1080p');
    expect(result?.behaviorHints?.proxyHeaders?.request?.Referer).toBe('https://datanodes.to/');
  });
});

describe('ResolverRegistry', () => {
  it('routes URL to the correct resolver', async () => {
    const registry = new ResolverRegistry();
    const bz = new BuzzheavierResolver(mock(async () => new Response(null, {
      status: 302,
      headers: { Location: 'https://cdn.buzzheavier.com/v.mp4' },
    })) as unknown as typeof fetch);

    registry.register(bz);
    const stream = await registry.resolve('https://buzzheavier.com/12345', '1080p');
    expect(stream).not.toBeNull();
    expect(stream?.url).toBe('https://cdn.buzzheavier.com/v.mp4');
  });

  it('returns null when no resolver matches', async () => {
    const registry = new ResolverRegistry();
    const stream = await registry.resolve('https://unknown-host.com/12345', '1080p');
    expect(stream).toBeNull();
  });
});
