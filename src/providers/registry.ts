import { MediaItemQuery, StreamResult } from '../types';
import { BaseProvider } from './base';

export class ProviderRegistry {
  private providers: BaseProvider[] = [];

  register(provider: BaseProvider): void {
    this.providers.push(provider);
  }

  async getAllStreams(query: MediaItemQuery): Promise<StreamResult[]> {
    const promises = this.providers.map((p) => p.getStreams(query));
    const settled = await Promise.allSettled(promises);
    const allStreams: StreamResult[] = [];

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allStreams.push(...res.value);
      }
    }

    return allStreams;
  }
}
