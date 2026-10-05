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

  return links;
}
