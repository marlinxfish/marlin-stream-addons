import { StreamResult } from '../types';
import { BaseResolver } from './base';
import { BuzzheavierResolver } from './buzzheavier';
import { DataNodesResolver } from './datanodes';
import { VidhideResolver } from './vidhide';

export class ResolverRegistry {
  private resolvers: BaseResolver[] = [];

  register(resolver: BaseResolver): void {
    this.resolvers.push(resolver);
  }

  async resolve(url: string, qualityHint?: string): Promise<StreamResult | null> {
    for (const resolver of this.resolvers) {
      if (resolver.canResolve(url)) {
        try {
          const result = await resolver.resolve(url, qualityHint);
          if (result) return result;
        } catch {
          continue;
        }
      }
    }
    return null;
  }
}

export const defaultResolverRegistry = new ResolverRegistry();
defaultResolverRegistry.register(new BuzzheavierResolver());
defaultResolverRegistry.register(new VidhideResolver());
defaultResolverRegistry.register(new DataNodesResolver());
