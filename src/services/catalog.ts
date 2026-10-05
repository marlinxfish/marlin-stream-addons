import * as cheerio from 'cheerio';
import { config } from '../config';
import type { MediaType } from '../types';
import { safeFetch } from '../utils/http';

export interface CatalogMetaItem {
  id: string;
  name: string;
  type: MediaType;
  poster?: string;
  description?: string;
  releaseInfo?: string;
}

export interface VideoEpisodeItem {
  id: string;
  title: string;
  season: number;
  episode: number;
  released?: string;
}

export interface FullMetaDetail extends CatalogMetaItem {
  genres?: string[];
  videos?: VideoEpisodeItem[];
}

export class CatalogService {
  private baseUrl: string;

  constructor(baseUrl: string = config.oppadramaBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async getCatalog(type: MediaType, searchQuery?: string): Promise<CatalogMetaItem[]> {
    if (!config.oppadramaEnabled) return [];
    try {
      let targetUrl = '';
      if (searchQuery && searchQuery.trim()) {
        targetUrl = `${this.baseUrl}/?s=${encodeURIComponent(searchQuery.trim())}`;
      } else {
        targetUrl = type === 'movie' ? `${this.baseUrl}/series/?type=Movie` : `${this.baseUrl}/series/?type=Drama`;
      }

      const res = await safeFetch(targetUrl);
      if (!res.ok) return [];

      const html = await res.text();
      const $ = cheerio.load(html);
      const items: CatalogMetaItem[] = [];

      $('article.bs, .listupd article, .post-item').each((_, el) => {
        const linkEl = $(el).find('a').first();
        const href = linkEl.attr('href') || '';
        const title = $(el).find('.tt, h2, .title').text().trim() || linkEl.attr('title') || '';
        const poster = $(el).find('img').attr('src') || '';
        const typeText = $(el).find('.typez').text().trim().toLowerCase();

        const isMovie = typeText.includes('movie');
        const itemType: MediaType = isMovie ? 'movie' : 'series';

        // Filter by requested type
        if (type && itemType !== type) return;

        const slugMatch = href.match(/212\.86\.121\.175\/([^/]+)\/?/);
        const slug = slugMatch ? slugMatch[1] : '';

        // Clean title formatting (remove tabs and duplicate words)
        const cleanTitle = title.split('\t')[0].split('\n')[0].trim();

        if (slug && cleanTitle) {
          items.push({
            id: `oppa:${slug}`,
            name: cleanTitle,
            type: itemType,
            poster,
          });
        }
      });

      return items;
    } catch (err) {
      console.error('[CatalogService] getCatalog error:', err);
      return [];
    }
  }

  async getMeta(type: MediaType, id: string): Promise<FullMetaDetail | null> {
    if (!config.oppadramaEnabled) return null;
    try {
      if (!id.startsWith('oppa:')) return null;
      const slug = id.slice(5);
      const url = `${this.baseUrl}/${slug}/`;

      const res = await safeFetch(url);
      if (!res.ok) return null;

      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('h1.entry-title').text().trim() || $('.infox h1').text().trim() || slug;
      const poster = $('.thumb img').attr('src') || '';
      const desc = $('.entry-content p').text().trim() || $('.desc').text().trim();
      const yearText = $('.spe span:contains("Dirilis")').text() || '';
      const yearMatch = yearText.match(/\d{4}/);
      const releaseInfo = yearMatch ? yearMatch[0] : undefined;

      const genres: string[] = [];
      $('.genxed a, .genre-item a').each((_, el) => {
        const g = $(el).text().trim();
        if (g) genres.push(g);
      });

      const videos: VideoEpisodeItem[] = [];
      $('.eplister li a').each((_, el) => {
        const numText = $(el).find('.epl-num').text().trim();
        const epTitle = $(el).find('.epl-title').text().trim();
        const href = $(el).attr('href') || '';
        const num = parseInt(numText, 10);
        const slugMatch = href.match(/212\.86\.121\.175\/([^/]+)\/?/);
        const epSlug = slugMatch ? slugMatch[1] : '';

        if (!isNaN(num) && epSlug) {
          videos.push({
            id: `oppa:${epSlug}`,
            title: epTitle || `Episode ${num}`,
            season: 1,
            episode: num,
          });
        }
      });

      // Sort episodes ascending (1, 2, ... 42)
      videos.sort((a, b) => a.episode - b.episode);

      return {
        id,
        name: title,
        type,
        poster,
        description: desc,
        releaseInfo,
        genres,
        videos: type === 'series' && videos.length > 0 ? videos : undefined,
      };
    } catch (err) {
      console.error('[CatalogService] getMeta error:', err);
      return null;
    }
  }
}

export const catalogService = new CatalogService();
