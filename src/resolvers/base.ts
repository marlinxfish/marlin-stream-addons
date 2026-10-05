import { StreamResult } from '../types';

export interface BaseResolver {
  readonly name: string;
  canResolve(url: string): boolean;
  resolve(url: string, qualityHint?: string): Promise<StreamResult | null>;
}
