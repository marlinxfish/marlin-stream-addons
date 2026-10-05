import * as cheerio from 'cheerio';

export interface SearchEntry {
  title: string;
  url: string;
}

export interface ExtractedLink {
  server: string;
  quality: string;
  url: string;
}

export function parseSearchResults(html: string): SearchEntry[] {
  const $ = cheerio.load(html);
  const results: SearchEntry[] = [];

  $('article, .result-item, .post-item').each((_, el) => {
    const linkEl = $(el).find('a').first();
    const title = $(el).find('.title, h2, h3').text().trim() || linkEl.text().trim();
    const url = linkEl.attr('href') || '';
    if (url && title) {
      results.push({ title, url });
    }
  });

  return results;
}

export function parseDownloadLinks(html: string): ExtractedLink[] {
  const $ = cheerio.load(html);
  const links: ExtractedLink[] = [];

  // Parse links table or list items
  $('li, tr').each((_, el) => {
    const text = $(el).text();
    const anchor = $(el).find('a').first();
    const href = anchor.attr('href') || '';
    if (!href || href.startsWith('#') || href.includes('javascript:')) return;

    let server = $(el).find('strong, .server').first().text().trim();
    if (!server) {
      if (href.includes('buzzheavier')) server = 'Buzzheavier';
      else if (href.includes('vidhide') || href.includes('earnvids')) server = 'EarnVids';
      else if (href.includes('datanodes')) server = 'DataNodes';
      else if (href.includes('filekeeper')) server = 'FileKeeper';
      else return;
    }

    let quality = '720p';
    if (text.includes('1080p') || text.includes('FHD')) quality = '1080p';
    else if (text.includes('720p') || text.includes('HD')) quality = '720p';
    else if (text.includes('480p') || text.includes('SD')) quality = '480p';
    else if (text.includes('360p')) quality = '360p';

    links.push({ server, quality, url: href });
  });

  // Parse embedded video mirrors (<select class="mirror">)
  $('select.mirror option').each((_, el) => {
    const val = $(el).attr('value');
    const label = $(el).text().trim();
    if (val && val.length > 10) {
      try {
        const decoded = Buffer.from(val, 'base64').toString('utf8');
        const srcMatch = decoded.match(/src=["'](https?:\/\/[^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          links.push({
            server: label || 'Mirror',
            quality: '720p',
            url: srcMatch[1],
          });
        }
      } catch {}
    }
  });

  return links;
}

export function parseEpisodeUrl(html: string, episodeNum?: number): string | null {
  const $ = cheerio.load(html);
  const items = $('.eplister li a, .epcheck li a');
  if (items.length === 0) return null;

  if (episodeNum !== undefined) {
    let matched: string | null = null;
    items.each((_, el) => {
      const numText = $(el).find('.epl-num').text().trim();
      const titleText = $(el).find('.epl-title').text().trim();
      const num = parseInt(numText, 10);
      if (num === episodeNum || titleText.includes(`Episode ${episodeNum}`)) {
        matched = $(el).attr('href') || null;
        return false;
      }
    });
    if (matched) return matched;
  }

  return items.first().attr('href') || null;
}
