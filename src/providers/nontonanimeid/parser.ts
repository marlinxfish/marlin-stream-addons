export interface NontonSearchResult {
  title: string;
  titleEn?: string;
  titleJp?: string;
  url: string;
  type?: string;
}

export interface NontonEpisode {
  number: number;
  title: string;
  url: string;
}

export interface NontonPlayerOption {
  post: string;
  nume: string;
  type: string;
  name: string;
}

export function parseSearchResults(html: string): NontonSearchResult[] {
  const results: NontonSearchResult[] = [];

  // 1. Grid card format (.as-anime-card)
  const cardRegex = /<a[^>]*href=["'](https?:\/\/[^"']+\/anime\/[^"']+)["'][^>]*class=["'][^"']*as-anime-card[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const url = match[1];
    const body = match[2];

    const defMatch = body.match(/data-title-default=["']([^"']+)["']/i);
    const enMatch = body.match(/data-title-en=["']([^"']+)["']/i);
    const jpMatch = body.match(/data-title-jp=["']([^"']+)["']/i);
    const typeMatch = body.match(/class=["']as-type["'][^>]*>[\s\S]*?<\/span>\s*([^<\s]+)/i);

    const title = defMatch ? defMatch[1].trim() : '';
    if (title && url) {
      results.push({
        title,
        titleEn: enMatch ? enMatch[1].trim() : undefined,
        titleJp: jpMatch ? jpMatch[1].trim() : undefined,
        url,
        type: typeMatch ? typeMatch[1].trim() : undefined,
      });
    }
  }

  // 2. Fallback article format (.animeseries)
  if (results.length === 0) {
    const articleRegex = /<a[^>]*href=["'](https?:\/\/[^"']+\/anime\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = articleRegex.exec(html)) !== null) {
      const url = match[1];
      const body = match[2];

      const defMatch = body.match(/data-title-default=["']([^"']+)["']/i);
      const enMatch = body.match(/data-title-en=["']([^"']+)["']/i);
      const jpMatch = body.match(/data-title-jp=["']([^"']+)["']/i);

      let title = defMatch ? defMatch[1].trim() : '';
      if (!title) {
        const titleTag = body.match(/<h[23][^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h[23]>/i);
        if (titleTag) {
          title = titleTag[1].replace(/<[^>]+>/g, '').trim();
        }
      }

      if (title && url && !results.some((r) => r.url === url)) {
        results.push({
          title,
          titleEn: enMatch ? enMatch[1].trim() : undefined,
          titleJp: jpMatch ? jpMatch[1].trim() : undefined,
          url,
        });
      }
    }
  }

  return results;
}

export function parseEpisodeList(html: string): NontonEpisode[] {
  const episodes: NontonEpisode[] = [];
  const epItemRegex = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*class=["'][^"']*episode-item[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = epItemRegex.exec(html)) !== null) {
    const url = match[1];
    const body = match[2];

    const titleMatch = body.match(/class=["']ep-title["'][^>]*>([\s\S]*?)<\/span>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const numMatch = rawTitle.match(/Episode\s*(\d+)/i) || url.match(/episode-(\d+)/i);
    const num = numMatch ? parseInt(numMatch[1], 10) : episodes.length + 1;

    episodes.push({
      number: num,
      title: rawTitle || `Episode ${num}`,
      url,
    });
  }

  // Fallback for movies or single episode lists (.ep-link)
  if (episodes.length === 0) {
    const epLinkRegex = /<a[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*class=["'][^"']*ep-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = epLinkRegex.exec(html)) !== null) {
      const url = match[1];
      const body = match[2];
      const text = body.replace(/<[^>]+>/g, '').trim();
      const numMatch = text.match(/Episode\s*(\d+)/i) || url.match(/episode-(\d+)/i);
      const num = numMatch ? parseInt(numMatch[1], 10) : 1;

      episodes.push({
        number: num,
        title: text || `Episode ${num}`,
        url,
      });
    }
  }

  return episodes;
}

export function parsePlayerOptions(html: string): NontonPlayerOption[] {
  const options: NontonPlayerOption[] = [];
  const liRegex = /<li[^>]*class=["'][^"']*kotak_player_option[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const body = match[1];

    const postMatch = fullTag.match(/data-post=["']([^"']+)["']/i);
    const numeMatch = fullTag.match(/data-nume=["']([^"']+)["']/i);
    const typeMatch = fullTag.match(/data-type=["']([^"']+)["']/i);

    const nameMatch = body.match(/<span>\s*([^<]+)\s*<\/span>/i);
    const name = nameMatch ? nameMatch[1].trim() : typeMatch ? typeMatch[1] : 'Server';

    if (postMatch && numeMatch && typeMatch) {
      options.push({
        post: postMatch[1],
        nume: numeMatch[1],
        type: typeMatch[1],
        name,
      });
    }
  }

  return options;
}

export function parseAjaxNonce(html: string): string {
  const nonceMatch = html.match(/["']nonce["']\s*:\s*["']([^"']+)["']/i);
  return nonceMatch ? nonceMatch[1] : '';
}

export function parseIframeSrc(html: string): string | null {
  const iframeMatch = html.match(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/i);
  if (!iframeMatch) return null;
  const src = iframeMatch[1];
  return src.replace(/&amp;/g, '&');
}
