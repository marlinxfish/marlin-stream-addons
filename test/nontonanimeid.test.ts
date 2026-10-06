import { describe, expect, it } from 'bun:test';
import {
  parseAjaxNonce,
  parseEpisodeList,
  parseIframeSrc,
  parsePlayerOptions,
  parseSearchResults,
} from '../src/providers/nontonanimeid/parser';
import { KotakanimeResolver } from '../src/resolvers/kotakanime';
import { KitsuService } from '../src/services/kitsu';
import { FetchFunction } from '../src/types';
describe('NontonAnimeID Parser', () => {
  it('parses search results with cards', () => {
    const html = `
      <div class="as-anime-grid">
        <a href="https://s13.nontonanimeid.boats/anime/ore-dake-level-up-na-ken-season-2/" class="as-anime-card">
          <h3 class="as-anime-title" data-title-default="Ore dake Level Up Season 2" data-title-en="Solo Leveling Season 2" data-title-jp="Ore dake Level Up">Ore dake</h3>
          <span class="as-type"><span class="icon">📺</span> TV</span>
        </a>
        <a href="https://s13.nontonanimeid.boats/anime/jujutsu-kaisen-0-movie/" class="as-anime-card">
          <h3 class="as-anime-title" data-title-default="Jujutsu Kaisen 0 Movie" data-title-en="Jujutsu Kaisen 0" data-title-jp="JJK 0">JJK 0</h3>
          <span class="as-type"><span class="icon">🎬</span> Movie</span>
        </a>
      </div>
    `;

    const results = parseSearchResults(html);
    expect(results.length).toBe(2);
    expect(results[0].title).toBe('Ore dake Level Up Season 2');
    expect(results[0].titleEn).toBe('Solo Leveling Season 2');
    expect(results[0].url).toBe('https://s13.nontonanimeid.boats/anime/ore-dake-level-up-na-ken-season-2/');
    expect(results[0].type).toBe('TV');

    expect(results[1].title).toBe('Jujutsu Kaisen 0 Movie');
    expect(results[1].type).toBe('Movie');
  });

  it('parses episode list items', () => {
    const html = `
      <div class="episode-list-items">
        <a href="https://s13.nontonanimeid.boats/solo-leveling-episode-12/" class="episode-item">
          <span class="ep-title">Episode 12</span>
        </a>
        <a href="https://s13.nontonanimeid.boats/solo-leveling-episode-11/" class="episode-item">
          <span class="ep-title">Episode 11</span>
        </a>
      </div>
    `;

    const episodes = parseEpisodeList(html);
    expect(episodes.length).toBe(2);
    expect(episodes[0].number).toBe(12);
    expect(episodes[0].url).toBe('https://s13.nontonanimeid.boats/solo-leveling-episode-12/');
    expect(episodes[1].number).toBe(11);
  });

  it('parses player options tabs', () => {
    const html = `
      <ul class="tabs1 player">
        <li id="player-option-1" data-post="142180" data-type="Kotakvideo" data-nume="1" class="tab-link tabchs serverplayer kotak_player_option on">
          <span>S-Kotakvideo</span>
        </li>
        <li id="player-option-2" data-post="142180" data-type="Vidhide" data-nume="2" class="tab-link tabchs serverplayer kotak_player_option">
          <span>S-Vidhide</span>
        </li>
      </ul>
    `;

    const options = parsePlayerOptions(html);
    expect(options.length).toBe(2);
    expect(options[0].post).toBe('142180');
    expect(options[0].nume).toBe('1');
    expect(options[0].type).toBe('Kotakvideo');
    expect(options[0].name).toBe('S-Kotakvideo');

    expect(options[1].type).toBe('Vidhide');
  });

  it('parses ajax nonce and iframe src', () => {
    const html = `
      <script>var kotakajax={"url":"...","nonce":"abc123nonce","servers":[]};</script>
      <iframe src="https://vidhideplus.com/embed/xyz123" allowfullscreen></iframe>
    `;

    expect(parseAjaxNonce(html)).toBe('abc123nonce');
    expect(parseIframeSrc(html)).toBe('https://vidhideplus.com/embed/xyz123');
  });
});

describe('KotakanimeResolver', () => {
  it('identifies Kotakanime embeds and unpacks sources', async () => {
    const resolver = new KotakanimeResolver();
    expect(resolver.canResolve('https://s2.kotakanimeid.link/video-embed/?vid=123')).toBe(true);
    expect(resolver.canResolve('https://example.com/embed')).toBe(false);

    // Mock HTML with obfuscation math
    const sArray = '100,105,110'.split(',');
    const mult = 10;
    const key = sArray.map((v, j) => (parseInt(v, 10) - mult * (j + 3)) & 255);

    const innerPayload = `var __activeSources = __isBot ? [] : [{"file":"https://s2.kotakanimeid.link/go/dl/?url=test1234","type":"video/mp4","label":"720p"}];`;
    const payloadBytes = new TextEncoder().encode(innerPayload);
    const cipherBytes = new Uint8Array(payloadBytes.length);
    for (let i = 0; i < payloadBytes.length; i++) {
      cipherBytes[i] = payloadBytes[i] ^ key[i % key.length];
    }
    const b64 = Buffer.from(cipherBytes).toString('base64');

    const mockHtml = `
      <script>
      var _k=function(){var s='100,105,110'.split(',');var r=[];for(var j=0;j<s.length;j++){r.push((parseInt(s[j],10)-10*(j+3))&255);}return r;};
      var _w=self;
      var _d=_w['at'+'ob']('${b64}');
      </script>
    `;
    const mockFetch: FetchFunction = async () => new Response(mockHtml, { status: 200 });
    const mockResolver = new KotakanimeResolver(mockFetch);

    const streams = await mockResolver.resolveAll('https://s2.kotakanimeid.link/video-embed/?vid=test');
    expect(streams.length).toBe(1);
    expect(streams[0].url).toBe('https://s2.kotakanimeid.link/go/dl/?url=test1234');
    expect(streams[0].quality).toBe('720p');
    expect(streams[0].server).toBe('KotakVideo');
  });
});

describe('KitsuService', () => {
  it('fetches metadata and formats MediaItemQuery', async () => {
    const mockKitsuResponse = {
      data: {
        id: '12',
        attributes: {
          canonicalTitle: 'One Piece',
          titles: {
            en: 'One Piece',
            en_jp: 'One Piece',
            ja_jp: 'ONE PIECE',
          },
          subtype: 'TV',
          startDate: '1999-10-20',
        },
      },
    };

    const mockFetch: FetchFunction = async () =>
      new Response(JSON.stringify(mockKitsuResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    const service = new KitsuService(mockFetch);
    const result = await service.lookup('series', 'kitsu:12:1085');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('One Piece');
    expect(result?.titles).toContain('One Piece');
    expect(result?.type).toBe('series');
    expect(result?.episode).toBe(1085);
    expect(result?.year).toBe(1999);
  });
});
